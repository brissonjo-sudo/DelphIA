import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build, createServer, type ViteDevServer } from 'vite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { delphia, OVERRIDES_EVENT } from '../src/index.js'

const doc = (elements: Record<string, object>, revision = 1): string =>
  JSON.stringify({ version: 1, revision, elements })

const entry = (dx: number): Record<string, object> => ({
  titre: { dx, dy: 2, width: 200, updatedAt: '2026-10-24T10:00:00Z' },
})

let root: string

async function makeProject(overrides?: string): Promise<void> {
  await writeFile(
    join(root, 'index.html'),
    '<!doctype html><html><head><title>t</title></head><body><h1 data-dz-id="titre">x</h1><script type="module" src="/main.js"></script></body></html>',
  )
  await writeFile(join(root, 'main.js'), "import './app.css'\n")
  await writeFile(join(root, 'app.css'), 'h1 { color: red; }\n')
  await writeFile(join(root, 'delphia.config.json'), JSON.stringify({ port: 4400 }))
  if (overrides !== undefined) {
    await mkdir(join(root, '.delphia'), { recursive: true })
    await writeFile(join(root, '.delphia', 'overrides.json'), overrides)
  }
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'delphia-it-'))
})
afterEach(() => rm(root, { recursive: true, force: true, maxRetries: 5 }))

describe('serve', () => {
  let server: ViteDevServer
  let base: string
  let sends: { mock: { calls: unknown[][] } }

  const start = async (): Promise<void> => {
    server = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [delphia()],
      optimizeDeps: { noDiscovery: true, include: [] },
      server: { host: '127.0.0.1', port: 0 },
    })
    await server.listen()
    base = server.resolvedUrls?.local[0] ?? ''
    sends = vi.spyOn(server.ws, 'send')
  }
  afterEach(() => server.close())

  const html = async (): Promise<string> =>
    server.transformIndexHtml('/', await readFile(join(root, 'index.html'), 'utf8'))

  const waitForCssEvent = async (timeout = 5_000): Promise<string> => {
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
      const call = sends.mock.calls.find(
        ([p]) => (p as { event?: string } | undefined)?.event === OVERRIDES_EVENT,
      )
      if (call) return (call[0] as { data: { css: string } }).data.css
      await new Promise(r => setTimeout(r, 10))
    }
    throw new Error('aucun événement HMR delphia:overrides reçu')
  }

  it('injecte le runtime et le CSS ; le runtime et le protocole sont servis', async () => {
    await makeProject(doc(entry(10)))
    await start()
    const out = await html()
    expect(out).toContain('/@id/__x00__virtual:delphia/runtime')
    expect(out).toMatch(/<style data-delphia[^>]*>[\s\S]*translate: 10px 2px !important;/)
    // ordre : la balise de surcouche est la dernière du head
    expect(out.indexOf('data-delphia>')).toBeGreaterThan(out.indexOf('virtual:delphia/runtime'))

    const mod = await fetch(`${base}@id/__x00__virtual:delphia/runtime`)
    expect(mod.status).toBe(200)
    const code = await mod.text()
    expect(code).toContain('startDelphia')
    expect(code).toContain('http://127.0.0.1:4400')
    expect(code).toContain('http://localhost:4400')

    // chaîne d'imports complète : tout est servi (fs.allow), le protocole comme source
    const seen = new Set<string>()
    const walk = async (url: string): Promise<void> => {
      if (seen.has(url)) return
      seen.add(url)
      const res = await fetch(new URL(url, base))
      expect(res.status, url).toBe(200)
      for (const m of (await res.text()).matchAll(/from "(\/[^"]+)"/g)) await walk(m[1]!)
    }
    await walk('/@id/__x00__virtual:delphia/runtime')
    expect([...seen].some(u => u.includes('/protocol/dist/index.js'))).toBe(true)
    expect([...seen].some(u => u.includes('/.vite/deps/'))).toBe(false)
  })

  it('met à jour le CSS à la modification, en moins de 300 ms', async () => {
    await makeProject(doc(entry(10)))
    await start()
    const file = join(root, '.delphia', 'overrides.json')
    // laisse le watcher s'installer
    await new Promise(r => setTimeout(r, 300))
    const t0 = Date.now()
    await writeFile(file, doc(entry(33), 2))
    const css = await waitForCssEvent()
    const elapsed = Date.now() - t0
    console.info(`[delphia] mise à jour du CSS reçue en ${elapsed} ms`)
    expect(css).toContain('translate: 33px 2px !important;')
    expect(elapsed).toBeLessThan(300)
    expect(await html()).toContain('translate: 33px 2px !important;')
  })

  it('fichier invalide : pas de crash, CSS vide', async () => {
    await makeProject('{ cassé')
    await start()
    const out = await html()
    expect(out).toContain('<style data-delphia')
    expect(out).not.toContain('translate:')
  })

  it('fichier absent au démarrage puis créé : CSS mis à jour', async () => {
    await makeProject()
    await start()
    expect(await html()).not.toContain('translate:')
    await mkdir(join(root, '.delphia'), { recursive: true })
    // Le scan initial du watcher peut ne pas être fini : on réécrit jusqu'à ce qu'il réagisse.
    const file = join(root, '.delphia', 'overrides.json')
    let css: string | undefined
    for (let i = 0; i < 40 && css === undefined; i++) {
      await writeFile(file, doc(entry(7), i + 1))
      css = await waitForCssEvent(250).catch(() => undefined)
    }
    expect(css).toContain('translate: 7px 2px !important;')
  }, 15_000)
})

describe('build', () => {
  const runBuild = async (): Promise<string> => {
    const outDir = join(root, 'dist')
    await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [delphia()],
      build: { outDir, emptyOutDir: true },
    })
    return readFile(join(outDir, 'index.html'), 'utf8')
  }

  it('embarque le CSS de surcouche après le CSS de l’app, sans le runtime', async () => {
    await makeProject(doc(entry(10)))
    const out = await runBuild()
    expect(out).toContain('translate: 10px 2px !important;')
    expect(out).toContain('width: 200px !important;')
    expect(out.lastIndexOf('<style data-delphia')).toBeGreaterThan(out.indexOf('stylesheet'))
    expect(out).not.toContain('virtual:delphia')
    expect(out).not.toContain('__x00__')
  }, 30_000)

  it('sans ajustement : rien d’injecté', async () => {
    await makeProject()
    const out = await runBuild()
    expect(out).not.toContain('data-delphia')
  }, 30_000)
})
