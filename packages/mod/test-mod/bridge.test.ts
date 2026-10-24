import { expect, test } from 'claude-code/testing'

import { CONFIG, CWD, installWorld } from './world'

const CLI = `${CWD}/node_modules/@vite-plugin-delph-ia/bridge/dist/cli.js`
const START = { cwd: CWD, surface: null, isInteractive: false } as const

test("session.start lance le pont et affiche l'URL du concepteur", async ($, on) => {
  const world = installWorld(on, { [CONFIG]: '{}', [CLI]: '' })
  const argvs: (readonly string[])[] = []
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('process.spawn', async function* (_, e) {
    argvs.push(e.argv)
    yield { stream: 'stdout', text: 'DelphIA bridge lis' }
    yield { stream: 'stdout', text: 'tening on http://127.0.0.1:4317/\n' }
    return { value: { code: 0, signal: null } }
  })
  await $.session.start(START)
  // La boucle de lecture est détachée : on laisse la microtâche se terminer.
  for (let i = 0; i < 200; i++) await Promise.resolve()
  expect(argvs[0]?.[0]).toBe('node')
  expect(argvs[0]?.slice(2)[0]).toBe('--project')
  expect(world.statuses).toContain('DelphIA : concepteur http://127.0.0.1:4317/')
  expect(world.statuses[world.statuses.length - 1]).toContain('pont arrêté')
})

test("pont introuvable : statut explicite, rien n'est lancé", async ($, on) => {
  const world = installWorld(on, { [CONFIG]: '{}' })
  let spawned = 0
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('process.spawn', async function* () {
    spawned++
    yield* []
  })
  await $.session.start(START)
  expect(spawned).toBe(0)
  expect(world.statuses[world.statuses.length - 1]).toContain('pont indisponible')
})

test('pont déjà actif (bridge.json + /api/config) : pas de second lancement', async ($, on) => {
  const info = { pid: 42, port: 4999, appPort: 1420, startedAt: '2026-10-24T10:00:00.000Z' }
  const world = installWorld(on, {
    [CONFIG]: '{}',
    [CLI]: '',
    [`${CWD}/.delphia/bridge.json`]: JSON.stringify(info),
  })
  let spawned = 0
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('http.fetch', (_, e) => ({
    value: { status: 200, ok: e.url.startsWith('http://127.0.0.1:4999/'), headers: {}, text: '{}' },
  }))
  on('process.spawn', async function* () {
    spawned++
    yield* []
  })
  await $.session.start(START)
  expect(spawned).toBe(0)
  expect(world.statuses[world.statuses.length - 1]).toContain('http://127.0.0.1:4999/')
})

test('sans delphia.config.json, session.start ne fait rien', async ($, on) => {
  const world = installWorld(on, { [CLI]: '' })
  let spawned = 0
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('process.spawn', async function* () {
    spawned++
    yield* []
  })
  await $.session.start(START)
  expect(spawned).toBe(0)
  expect(world.statuses).toEqual([])
})
