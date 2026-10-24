import { mkdir, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { raw, setup, type Fixture } from './helpers.js'

let fx: Fixture
let port: number
beforeAll(async () => {
  fx = await setup()
  port = fx.bridge.port
})
afterAll(() => fx.cleanup())

describe('HTTP', () => {
  it('/api/config renvoie appUrl et port', async () => {
    const res = await raw(port, '/api/config')
    expect(res.status).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ appUrl: 'http://localhost:1420', port })
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  it('refuse un Host invalide (403), accepte localhost', async () => {
    expect((await raw(port, '/api/config', { Host: 'evil.example:80' })).status).toBe(403)
    expect((await raw(port, '/api/config', { Host: `127.0.0.1:${port + 1}` })).status).toBe(403)
    expect((await raw(port, '/api/config', { Host: `localhost:${port}` })).status).toBe(200)
  })

  it('sert le concepteur avec le bon type MIME', async () => {
    const index = await raw(port, '/')
    expect(index.status).toBe(200)
    expect(index.headers['content-type']).toContain('text/html')
    const js = await raw(port, '/app.js?v=1')
    expect(js.headers['content-type']).toContain('text/javascript')
  })

  it('refuse les extensions hors liste blanche', async () => {
    expect((await raw(port, '/notes.exe')).status).toBe(404)
    expect((await raw(port, '/absent.js')).status).toBe(404)
  })

  it.each(['/../secret.txt', '/%2e%2e/secret.txt', '/%2E%2E%2fsecret.txt', '/a/..%5csecret.txt'])(
    'refuse la traversée %s',
    async path => {
      const res = await raw(port, path)
      expect(res.status).toBe(403)
      expect(res.body).not.toContain('secret')
    },
  )

  it('refuse un lien symbolique sortant du dossier du concepteur', async () => {
    await writeFile(join(fx.root, 'outside.txt'), 'outside')
    await mkdir(join(fx.root, 'outdir'))
    await writeFile(join(fx.root, 'outdir', 'leak.txt'), 'leak')
    try {
      await symlink(join(fx.root, 'outdir'), join(fx.designer, 'link'), 'junction')
    } catch {
      return // création de lien non permise sur ce poste
    }
    const res = await raw(port, '/link/leak.txt')
    expect(res.status).toBe(403)
    expect(res.body).not.toContain('leak')
  })
})

describe('concepteur non buildé', () => {
  it('sert une page d aide à la racine', async () => {
    const { startBridge } = await import('../src/server.js')
    const project = join(fx.root, 'other')
    await mkdir(project)
    const bridge = await startBridge({ project, designerDir: join(fx.root, 'absent'), port: 0 })
    try {
      const res = await raw(bridge.port, '/')
      expect(res.status).toBe(200)
      expect(res.body).toContain('npm run build -w @vite-plugin-delph-ia/designer')
      expect((await raw(bridge.port, '/app.js')).status).toBe(404)
    } finally {
      await bridge.close()
    }
  })
})

describe('port occupé', () => {
  it('échoue avec un message clair', async () => {
    const { startBridge } = await import('../src/server.js')
    const project = join(fx.root, 'busy')
    await mkdir(project)
    await expect(startBridge({ project, port })).rejects.toThrow(/déjà utilisé/)
  })
})
