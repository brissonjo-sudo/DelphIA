import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  BAKE_APPLIED_ROUTE,
  BAKE_CANCEL_ROUTE,
  BAKE_FILE,
  BRIDGE_FILE,
  BRIDGE_TOKEN_HEADER,
  MAX_BAKE_HISTORY,
  parseBakeDoc,
  parseBridgeInfo,
  type BakeDoc,
  type Rect,
} from '@vite-plugin-delph-ia/protocol'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { startBridge } from '../src/server.js'
import { Client, post, setup, type Fixture } from './helpers.js'

let fx: Fixture
let port: number
let token: string
beforeEach(async () => {
  fx = await setup()
  port = fx.bridge.port
  token = fx.bridge.token
})
afterEach(() => fx.cleanup())

const rect = (x: number, y: number, width = 100, height = 40): Rect => ({ x, y, width, height })
const auth = (): Record<string, string> => ({ [BRIDGE_TOKEN_HEADER]: token })
const body = (bakeId: string, extra: object = {}): string =>
  JSON.stringify({ bakeId, touchedFiles: ['src/App.css'], note: 'abandon', ...extra })
const errorOf = async (c: Client): Promise<string> => {
  const m = await c.next()
  return m.type === 'bridge:error' ? m.message : `inattendu : ${m.type}`
}

async function connect(): Promise<Client> {
  const c = await Client.connect(port)
  await c.nextState()
  await c.nextBake()
  return c
}

/** Ajuste `btn-ok` (dx 10, dy 5) puis demande le figeage ; renvoie l'état `requested`. */
async function requested(c: Client): Promise<{ bakeId: string; doc: BakeDoc }> {
  c.send({ type: 'override:set', id: 'btn-ok', patch: { dx: 10, dy: 5 } })
  await c.nextState()
  c.send({ type: 'bake:request', items: [{ id: 'btn-ok', target: rect(110, 55) }] })
  const doc = await c.nextBake()
  expect(doc.current?.status).toBe('requested')
  return { bakeId: doc.current?.bakeId as string, doc }
}

const bakeOnDisk = async (): Promise<BakeDoc> => {
  const parsed = parseBakeDoc(JSON.parse(await readFile(join(fx.project, BAKE_FILE), 'utf8')))
  if (!parsed.ok) throw new Error(parsed.errors.join(';'))
  return parsed.value
}

/** requested → applied via la route du mod ; consomme les deux diffusions. */
async function applied(c: Client, bakeId: string): Promise<void> {
  const res = await post(port, BAKE_APPLIED_ROUTE, body(bakeId), auth())
  expect(res).toEqual({ status: 200, body: '{"ok":true}' })
  expect((await c.nextState()).elements).toEqual({})
  expect((await c.nextBake()).current?.status).toBe('applied')
}

describe('Figer : cycle', () => {
  it('request → applied → verify ok → verified archivé', async () => {
    const c = await connect()
    const { bakeId, doc } = await requested(c)
    expect(doc.current?.items).toEqual([
      { id: 'btn-ok', geometry: { dx: 10, dy: 5 }, target: rect(110, 55) },
    ])
    await applied(c, bakeId)
    expect((await bakeOnDisk()).current?.touchedFiles).toEqual(['src/App.css'])

    c.send({ type: 'bake:verify', bakeId, results: [{ id: 'btn-ok', actual: rect(110.5, 54.6) }] })
    const done = await c.nextBake()
    expect(done.current).toBeNull()
    expect(done.history[0]).toMatchObject({ bakeId, status: 'verified' })
    expect(done.history[0]?.results).toEqual([
      { id: 'btn-ok', ok: true, actual: rect(110.5, 54.6) },
    ])
    expect(await bakeOnDisk()).toEqual(done)
    c.close()
  })

  it('mismatch (écart > 1 px, puis élément null) puis revert', async () => {
    const c = await connect()
    const { bakeId } = await requested(c)
    await applied(c, bakeId)
    c.send({ type: 'bake:verify', bakeId, results: [{ id: 'btn-ok', actual: rect(113, 55) }] })
    const mm = await c.nextBake()
    expect(mm.history[0]).toMatchObject({ status: 'mismatch', results: [{ ok: false }] })

    c.send({ type: 'bake:revert', bakeId })
    const ov = await c.nextState()
    expect(ov.revision).toBe(3) // set, applied, revert
    expect(ov.elements['btn-ok']).toMatchObject({ dx: 10, dy: 5 })
    const rev = await c.nextBake()
    expect(rev.history).toHaveLength(1)
    expect(rev.history[0]?.status).toBe('reverted')

    // élément introuvable après figeage
    const second = await requested(c)
    await applied(c, second.bakeId)
    c.send({
      type: 'bake:verify',
      bakeId: second.bakeId,
      results: [{ id: 'btn-ok', actual: null }],
    })
    expect((await c.nextBake()).history[0]).toMatchObject({
      status: 'mismatch',
      results: [{ ok: false, actual: null }],
    })
    c.close()
  })

  it('revert depuis applied remet la géométrie', async () => {
    const c = await connect()
    const { bakeId } = await requested(c)
    await applied(c, bakeId)
    c.send({ type: 'bake:revert', bakeId })
    expect((await c.nextState()).elements['btn-ok']).toMatchObject({ dx: 10, dy: 5 })
    const doc = await c.nextBake()
    expect(doc.current).toBeNull()
    expect(doc.history[0]?.status).toBe('reverted')
    c.close()
  })

  it('cancel par WebSocket et par HTTP', async () => {
    const c = await connect()
    const first = await requested(c)
    c.send({ type: 'bake:cancel', bakeId: first.bakeId })
    expect((await c.nextBake()).history[0]?.status).toBe('cancelled')

    c.send({ type: 'bake:request', items: [{ id: 'btn-ok', target: rect(110, 55) }] })
    const id2 = (await c.nextBake()).current?.bakeId as string
    const res = await post(port, BAKE_CANCEL_ROUTE, body(id2, { note: 'tour interrompu' }), auth())
    expect(res.status).toBe(200)
    const doc = await c.nextBake()
    expect(doc.history[0]).toMatchObject({
      bakeId: id2,
      status: 'cancelled',
      note: 'tour interrompu',
    })
    // la surcouche n'a pas été touchée : une nouvelle demande est possible
    c.send({ type: 'bake:request', items: [{ id: 'btn-ok', target: rect(1, 1) }] })
    expect((await c.nextBake()).current?.status).toBe('requested')
    c.close()
  })

  it('bake:state à la connexion, historique borné', async () => {
    const a = await Client.connect(port)
    expect((await a.nextState()).revision).toBe(0)
    expect(await a.nextBake()).toEqual({ version: 1, current: null, history: [] })
    a.send({ type: 'override:set', id: 'btn-ok', patch: { dx: 1 } })
    await a.nextState()
    for (let i = 0; i < MAX_BAKE_HISTORY + 2; i++) {
      a.send({ type: 'bake:request', items: [{ id: 'btn-ok', target: rect(1, 1) }] })
      const id = (await a.nextBake()).current?.bakeId as string
      a.send({ type: 'bake:cancel', bakeId: id })
      await a.nextBake()
    }
    const b = await Client.connect(port)
    await b.nextState()
    expect((await b.nextBake()).history).toHaveLength(MAX_BAKE_HISTORY)
    a.close()
    b.close()
  })
})

describe('Figer : refus WebSocket', () => {
  it('demande déjà ouverte, id sans ajustement, mauvais état', async () => {
    const c = await connect()
    c.send({ type: 'bake:request', items: [{ id: 'btn-ok', target: rect(0, 0) }] })
    expect(await errorOf(c)).toMatch(/aucun ajustement/)

    const { bakeId } = await requested(c)
    c.send({ type: 'bake:request', items: [{ id: 'btn-ok', target: rect(0, 0) }] })
    expect(await errorOf(c)).toMatch(/déjà ouverte/)
    c.send({ type: 'bake:verify', bakeId, results: [{ id: 'btn-ok', actual: null }] }) // pas encore applied
    expect(await errorOf(c)).toMatch(/applied/)
    c.send({ type: 'bake:revert', bakeId })
    expect(await errorOf(c)).toMatch(/rétablir/)

    // l'erreur n'est envoyée qu'à l'émetteur
    const other = await connect()
    c.send({ type: 'bake:revert', bakeId })
    await errorOf(c)
    expect(await other.silentFor(200)).toBe(true)
    c.close()
    other.close()
  })
})

describe('Figer : routes HTTP', () => {
  it('refuse sans jeton, mauvais jeton, Origin, Host, type, taille', async () => {
    const c = await connect()
    const { bakeId } = await requested(c)
    const ok = body(bakeId)
    const status = async (headers: Record<string, string>, payload = ok): Promise<number> =>
      (await post(port, BAKE_APPLIED_ROUTE, payload, headers)).status

    expect(await status({})).toBe(401)
    expect(await status({ [BRIDGE_TOKEN_HEADER]: 'a'.repeat(64) })).toBe(401)
    expect(await status({ [BRIDGE_TOKEN_HEADER]: 'court' })).toBe(401)
    expect(await status({ ...auth(), Origin: 'http://evil.example' })).toBe(403)
    expect(await status({ ...auth(), Host: 'evil.example' })).toBe(403)
    expect(await status({ ...auth(), 'content-type': 'text/plain' })).toBe(415)
    expect(await status(auth(), 'x'.repeat(70_000))).toBe(413)
    expect(await status(auth(), '{pas du json')).toBe(400)
    expect(await status(auth(), '{"bakeId":"nope"}')).toBe(400)
    expect((await post(port, '/api/bake/autre', ok, auth())).status).toBe(405)
    // rien n'a bougé
    expect((await bakeOnDisk()).current?.status).toBe('requested')
    expect(await c.silentFor(200)).toBe(true)
    c.close()
  })

  it('409 : mauvais état ou mauvais bakeId', async () => {
    const c = await connect()
    expect((await post(port, BAKE_CANCEL_ROUTE, body('bk-aaaaaaaa'), auth())).status).toBe(409)
    const { bakeId } = await requested(c)
    expect((await post(port, BAKE_APPLIED_ROUTE, body('bk-aaaaaaaa'), auth())).status).toBe(409)
    await applied(c, bakeId)
    expect((await post(port, BAKE_APPLIED_ROUTE, body(bakeId), auth())).status).toBe(409)
    expect((await post(port, BAKE_CANCEL_ROUTE, body(bakeId), auth())).status).toBe(409)
    c.close()
  })
})

describe('Figer : démarrage', () => {
  it('bridge.json contient un jeton valide', async () => {
    const info = parseBridgeInfo(JSON.parse(await readFile(join(fx.project, BRIDGE_FILE), 'utf8')))
    expect(info.ok && info.value.token).toBe(token)
  })

  it('bake.json invalide : démarrage refusé', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'delphia-bake-'))
    try {
      await mkdir(join(dir, '.delphia'))
      await writeFile(join(dir, '.delphia', 'bake.json'), '{"version":1,"current":3}')
      await expect(startBridge({ project: dir, port: 0 })).rejects.toThrow(/bake\.json invalide/)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
