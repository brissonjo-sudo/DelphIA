import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import {
  BAKE,
  BAKE_ID,
  BRIDGE,
  CONFIG,
  CWD,
  OVERRIDES,
  TOKEN,
  bakeDoc,
  bridgeInfo,
  installWorld,
  overridesDoc,
} from './world'

const START = { cwd: CWD, surface: null, isInteractive: false } as const
const TRIGGER = `Fige les ajustements DelphIA dans le code (demande ${BAKE_ID}).`
const project = {
  [CONFIG]: '{}',
  [BAKE]: bakeDoc(),
  [BRIDGE]: bridgeInfo(),
  [OVERRIDES]: overridesDoc(2, ['save-btn', 'title', 'other']),
}
const BASE = { sections: [{ id: 'intro', text: 'Intro', scope: 'shared' as const }] }
const COMPOSE = {
  model: 'm',
  promptModel: 'm',
  surfaces: [],
  tools: [],
  outputStyle: null,
  traits: [],
}

type Post = { url: string; headers: Record<string, string>; body: Record<string, unknown> }
type Calls = {
  fills: { text: string; mode: string }[]
  submits: { text: string; context: readonly string[] | undefined }[]
  posts: Post[]
}

// Frappe d'un utilisateur : passe par prompt.submit comme une saisie.
const type = ($: Engine, text: string) =>
  $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } })

// Laisse les tâches détachées (détection, notification) se terminer.
const settle = async (): Promise<void> => {
  for (let i = 0; i < 300; i++) await Promise.resolve()
}

/** Branche le bas de chaîne : fill/submit/fetch enregistrés, session.start et turn.start passants. */
function wire(on: Parameters<typeof installWorld>[0]): Calls {
  const calls: Calls = { fills: [], submits: [], posts: [] }
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('prompt.compose', () => BASE)
  on('prompt.fill', (_, e) => {
    calls.fills.push({ text: e.text, mode: e.mode })
    return { isFilled: true }
  })
  on('prompt.submit', (_, e) => {
    calls.submits.push({ text: e.text, context: e.context })
    return { text: e.text, context: e.context }
  })
  on('http.fetch', (_, e) => {
    if (e.init?.method === 'POST') {
      calls.posts.push({
        url: e.url,
        headers: e.init.headers ?? {},
        body: JSON.parse(e.init.body ?? '{}') as Record<string, unknown>,
      })
    }
    return { value: { status: 200, ok: true, headers: {}, text: '{"ok":true}' } }
  })
  on('turn.complete', (_, e) => ({ text: e.answer }))
  return calls
}

const complete = (reason: 'answer' | 'aborted') => ({
  answer: 'fait',
  durationMs: 1,
  isAborted: reason === 'aborted',
  turnId: 't1',
  reason,
})

test('demande requested : préremplissage par défaut, une seule fois', async ($, on) => {
  const world = installWorld(on, project)
  const calls = wire(on)
  await $.session.start(START)
  await $.turn.start({ text: 'a', turnId: 't1' })
  await settle()
  await $.turn.start({ text: 'b', turnId: 't2' })
  await settle()
  expect(calls.fills).toEqual([{ text: TRIGGER, mode: 'replace' }])
  expect(calls.submits).toEqual([])
  expect(world.toasts.some(t => t.includes('figeage demandé'))).toBe(true)
})

test(
  'option direct : prompt.submit au lieu de fill',
  { options: { figer: 'direct' } },
  async ($, on) => {
    installWorld(on, project)
    const calls = wire(on)
    await $.session.start(START)
    await $.turn.start({ text: 'a', turnId: 't1' })
    await settle()
    expect(calls.submits.map(s => s.text)).toEqual([TRIGGER])
    expect(calls.fills).toEqual([])
  },
)

test('demande déjà traitée (statut applied) : rien', async ($, on) => {
  installWorld(on, { ...project, [BAKE]: bakeDoc('applied') })
  const calls = wire(on)
  await $.session.start(START)
  await $.turn.start({ text: 'a', turnId: 't1' })
  await settle()
  expect(calls.fills).toEqual([])
  expect(calls.submits).toEqual([])
})

test('prompt.submit avec le bakeId : consigne ajoutée en contexte ; sans bakeId : inchangé', async ($, on) => {
  installWorld(on, project)
  const calls = wire(on)
  await $.session.start(START)
  await type($, 'Bonjour')
  expect(calls.submits[0]).toEqual({ text: 'Bonjour', context: undefined })
  await type($, TRIGGER)
  const ctx = calls.submits[1]?.context ?? []
  expect(ctx.length).toBe(1)
  expect(ctx[0]).toContain(BAKE_ID)
  expect(ctx[0]).toContain('save-btn')
})

test('prompt.compose : les ids de la demande sont exclus pendant le tour', async ($, on) => {
  installWorld(on, project)
  wire(on)
  await $.session.start(START)
  const before = (await $.prompt.compose(COMPOSE)).sections.at(-1)?.text ?? ''
  expect(before).toContain('save-btn')
  await type($, TRIGGER)
  const during = (await $.prompt.compose(COMPOSE)).sections.at(-1)?.text ?? ''
  expect(during).toContain('other')
  expect(during).not.toContain('save-btn')
  expect(during).not.toContain('title')
})

test('fichiers notés puis POST applied avec le jeton à la fin du tour', async ($, on) => {
  const world = installWorld(on, project)
  const calls = wire(on)
  await $.session.start(START)
  await type($, TRIGGER)
  await $.tool.call({
    tool: 'Edit',
    file_path: `${CWD}/src/App.css`,
    old_string: 'a',
    new_string: 'b',
  })
  await $.tool.call({ tool: 'Write', file_path: `${CWD}\\src\\App.tsx`, content: 'x' })
  await $.tool.call({
    tool: 'Edit',
    file_path: `${CWD}/src/App.css`,
    old_string: 'b',
    new_string: 'c',
  })
  await $.turn.complete(complete('answer'))
  expect(calls.posts.length).toBe(1)
  const post = calls.posts[0]
  expect(post?.url).toBe('http://127.0.0.1:4999/api/bake/applied')
  expect(post?.headers['x-delphia-token']).toBe(TOKEN)
  expect(post?.headers['content-type']).toBe('application/json')
  expect(post?.headers.origin).toBeUndefined()
  expect(post?.body).toEqual({ bakeId: BAKE_ID, touchedFiles: ['src/App.css', 'src/App.tsx'] })
  expect(world.toasts.some(t => t.includes('figeage transmis'))).toBe(true)
  // Le tour est clos : une seconde fin de tour ne renotifie pas.
  await $.turn.complete(complete('answer'))
  expect(calls.posts.length).toBe(1)
})

test('tour interrompu : POST cancel avec la raison', async ($, on) => {
  installWorld(on, project)
  const calls = wire(on)
  await $.session.start(START)
  await type($, TRIGGER)
  await $.turn.complete(complete('aborted'))
  expect(calls.posts[0]?.url).toBe('http://127.0.0.1:4999/api/bake/cancel')
  expect(calls.posts[0]?.body.bakeId).toBe(BAKE_ID)
  expect(String(calls.posts[0]?.body.note)).toContain('aborted')
})

test('bridge.json sans jeton : aucun appel, toast', async ($, on) => {
  const info = JSON.parse(bridgeInfo()) as Record<string, unknown>
  delete info.token
  const world = installWorld(on, { ...project, [BRIDGE]: JSON.stringify(info) })
  const calls = wire(on)
  await $.session.start(START)
  await type($, TRIGGER)
  await $.turn.complete(complete('answer'))
  expect(calls.posts).toEqual([])
  expect(world.toasts.some(t => t.includes('sans jeton'))).toBe(true)
})

test('sans delphia.config.json, aucun effet', async ($, on) => {
  installWorld(on, { ...project, [CONFIG]: undefined as unknown as string })
  const calls = wire(on)
  await $.session.start(START)
  await $.turn.start({ text: 'a', turnId: 't1' })
  await type($, TRIGGER)
  await $.turn.complete(complete('answer'))
  await settle()
  expect(calls.fills).toEqual([])
  expect(calls.submits[0]?.context).toBeUndefined()
  expect(calls.posts).toEqual([])
})
