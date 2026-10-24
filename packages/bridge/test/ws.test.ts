import { access, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  BRIDGE_FILE,
  DELPHIA_DIR,
  parseBridgeInfo,
  parseOverrides,
} from '@vite-plugin-delphia/protocol'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { Client, overridesPath, setup, type Fixture } from './helpers.js'

let fx: Fixture
let port: number
beforeEach(async () => {
  fx = await setup()
  port = fx.bridge.port
})
afterEach(() => fx.cleanup())

const exists = (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false,
  )

const diskDoc = async (): Promise<ReturnType<typeof parseOverrides>> =>
  parseOverrides(JSON.parse(await readFile(overridesPath(fx.project), 'utf8')))

const externalDoc = (revision: number, dx: number): string =>
  JSON.stringify({
    version: 1,
    revision,
    elements: { 'btn-ok': { dx, updatedAt: '2026-01-01T00:00:00Z' } },
  })

describe('WebSocket', () => {
  it('refuse un Origin interdit ou absent', async () => {
    await expect(Client.connect(port, 'http://evil.example')).rejects.toThrow(/403/)
    await expect(Client.connect(port, `http://127.0.0.1:${port + 1}`)).rejects.toThrow(/403/)
    const noOrigin = new WebSocket(`ws://127.0.0.1:${port}/ws`)
    await new Promise<void>(resolve => noOrigin.once('error', () => resolve()))
    // Origin valide mais mauvais chemin : 404
    await expect(
      new Promise((_, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/autre`, {
          origin: `http://127.0.0.1:${port}`,
        })
        ws.once('error', reject)
      }),
    ).rejects.toThrow(/404/)
  })

  it('envoie overrides:state à la connexion (localhost accepté)', async () => {
    const c = await Client.connect(port, `http://localhost:${port}`)
    const doc = await c.nextState()
    expect(doc).toEqual({ version: 1, revision: 0, elements: {} })
    c.close()
  })

  it('override:set écrit un fichier valide, révision +1, diffusé à 2 clients', async () => {
    const a = await Client.connect(port)
    const b = await Client.connect(port)
    await a.nextState()
    await b.nextState()

    a.send({ type: 'override:set', id: 'btn-ok', patch: { dx: 12, width: 100 } })
    for (const client of [a, b]) {
      const doc = await client.nextState()
      expect(doc.revision).toBe(1)
      expect(doc.elements['btn-ok']).toMatchObject({ dx: 12, width: 100 })
    }
    const onDisk = await diskDoc()
    expect(onDisk.ok && onDisk.value.revision).toBe(1)
    expect(onDisk.ok && onDisk.value.elements['btn-ok']).toMatchObject({ dx: 12, width: 100 })
    // pas de fichier temporaire résiduel
    expect((await readdir(join(fx.project, DELPHIA_DIR))).filter(f => f.endsWith('.tmp'))).toEqual(
      [],
    )

    b.send({ type: 'override:clear', id: 'btn-ok' })
    expect((await a.nextState()).elements).toEqual({})
    expect((await b.nextState()).revision).toBe(2)
    // un nouveau client voit l'état courant
    const c = await Client.connect(port)
    expect((await c.nextState()).revision).toBe(2)
    for (const client of [a, b, c]) client.close()
  })

  it('écritures concurrentes : toutes appliquées, révisions consécutives', async () => {
    const a = await Client.connect(port)
    await a.nextState()
    for (let i = 1; i <= 10; i++) a.send({ type: 'override:set', id: `el-${i}`, patch: { dx: i } })
    let last = await a.nextState()
    for (let i = 1; i < 10; i++) last = await a.nextState()
    expect(last.revision).toBe(10)
    expect(Object.keys(last.elements)).toHaveLength(10)
    a.close()
  })

  it('message invalide : bridge:error à l émetteur seul, connexion conservée', async () => {
    const a = await Client.connect(port)
    const b = await Client.connect(port)
    await a.nextState()
    await b.nextState()

    a.ws.send('pas du json')
    expect((await a.next()).type).toBe('bridge:error')
    a.send({ type: 'override:set', id: 'Bad Id', patch: { dx: 1 } })
    expect((await a.next()).type).toBe('bridge:error')
    a.send({ type: 'override:set', id: 'ok', patch: { dx: 'x' } })
    expect((await a.next()).type).toBe('bridge:error')
    a.ws.send(JSON.stringify({ type: 'override:clear', id: 'ok' })) // sans enveloppe
    expect((await a.next()).type).toBe('bridge:error')
    a.ws.send(Buffer.from([1, 2, 3]))
    expect((await a.next()).type).toBe('bridge:error')

    expect(await b.silentFor(300)).toBe(true)
    expect(await exists(overridesPath(fx.project))).toBe(false)

    a.send({ type: 'override:set', id: 'ok', patch: { dx: 3 } }) // la connexion fonctionne encore
    expect((await a.nextState()).elements['ok']).toMatchObject({ dx: 3 })
    a.close()
    b.close()
  })

  it('message trop gros : connexion fermée, le pont survit', async () => {
    const a = await Client.connect(port)
    await a.nextState()
    a.ws.send('x'.repeat(70 * 1024))
    await new Promise<void>(resolve => a.ws.once('close', () => resolve()))
    const b = await Client.connect(port)
    expect((await b.nextState()).revision).toBe(0)
    b.close()
  })
})

describe('fichier surveillé', () => {
  it('une modification externe valide est diffusée', async () => {
    const a = await Client.connect(port)
    await a.nextState()
    await writeFile(overridesPath(fx.project), externalDoc(5, 9))
    const doc = await a.nextState()
    expect(doc.revision).toBe(5)
    expect(doc.elements['btn-ok']).toMatchObject({ dx: 9 })
    // le pont repart de l'état externe
    a.send({ type: 'override:set', id: 'btn-ok', patch: { dy: 2 } })
    const next = await a.nextState()
    expect(next.revision).toBe(6)
    expect(next.elements['btn-ok']).toMatchObject({ dx: 9, dy: 2 })
    // et ignore sa propre écriture : rien de plus
    expect(await a.silentFor(400)).toBe(true)
    a.close()
  })

  it('un fichier externe invalide n est pas diffusé et ne fait pas tomber le pont', async () => {
    const a = await Client.connect(port)
    await a.nextState()
    await writeFile(overridesPath(fx.project), '{ pas du json')
    expect(await a.silentFor(400)).toBe(true)
    await writeFile(overridesPath(fx.project), JSON.stringify({ version: 1, revision: 'x' }))
    expect(await a.silentFor(400)).toBe(true)
    // une écriture du pont refuse d'écraser un fichier invalide
    a.send({ type: 'override:set', id: 'ok', patch: { dx: 1 } })
    expect((await a.next()).type).toBe('bridge:error')
    // retour à un fichier valide : la diffusion reprend
    await writeFile(overridesPath(fx.project), externalDoc(2, 4))
    expect((await a.nextState()).revision).toBe(2)
    a.close()
  })
})

describe('bridge.json', () => {
  it('est créé au démarrage puis supprimé à close()', async () => {
    const file = join(fx.project, BRIDGE_FILE)
    const info = parseBridgeInfo(JSON.parse(await readFile(file, 'utf8')))
    expect(info.ok && info.value).toMatchObject({ pid: process.pid, port, appPort: 1420 })
    await fx.bridge.close()
    expect(await exists(file)).toBe(false)
    await fx.bridge.close() // idempotent
  })
})
