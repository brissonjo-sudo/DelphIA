import { expect, test } from 'claude-code/testing'

import { CONFIG, CWD, OVERRIDES, installWorld, overridesDoc } from './world'

const BASE = { sections: [{ id: 'intro', text: 'Intro', scope: 'shared' as const }] }
const COMPOSE = {
  model: 'm',
  promptModel: 'm',
  surfaces: [],
  tools: [],
  outputStyle: null,
  traits: [],
}

test('prompt.compose ajoute la section DelphIA en dernier quand des éléments sont épinglés', async ($, on) => {
  installWorld(on, { [CONFIG]: '{}', [OVERRIDES]: overridesDoc(2, ['save-btn', 'title']) })
  on('prompt.compose', () => BASE)
  const { sections } = await $.prompt.compose(COMPOSE)
  const last = sections[sections.length - 1]
  expect(sections.length).toBe(2)
  expect(last?.id).toBe('delphia:overrides')
  expect(last?.text).toContain('save-btn')
  expect(last?.scope).toBe('session')
})

test('prompt.compose : rien si aucun élément, overrides absent ou invalide', async ($, on) => {
  const world = installWorld(on, { [CONFIG]: '{}', [OVERRIDES]: overridesDoc(2, []) })
  on('prompt.compose', () => BASE)
  expect((await $.prompt.compose(COMPOSE)).sections.length).toBe(1)
  world.files[OVERRIDES] = '{ pas du json'
  expect((await $.prompt.compose(COMPOSE)).sections.length).toBe(1)
  delete world.files[OVERRIDES]
  expect((await $.prompt.compose(COMPOSE)).sections.length).toBe(1)
})

test('prompt.compose : aucun effet sans delphia.config.json', async ($, on) => {
  installWorld(on, { [OVERRIDES]: overridesDoc(2, ['save-btn']) })
  on('prompt.compose', () => BASE)
  expect((await $.prompt.compose(COMPOSE)).sections.length).toBe(1)
})

test('turn.start : toast quand la révision change, pas sinon', async ($, on) => {
  const world = installWorld(on, { [CONFIG]: '{}', [OVERRIDES]: overridesDoc(1, ['save-btn']) })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  await $.session.start({ cwd: CWD, surface: null, isInteractive: false })

  await $.turn.start({ text: 'a', turnId: 't1' })
  expect(world.toasts).toEqual([])

  world.files[OVERRIDES] = overridesDoc(2, ['save-btn', 'title'])
  await $.turn.start({ text: 'b', turnId: 't2' })
  expect(world.toasts).toEqual(['DelphIA : 1 épinglé(s)'])

  await $.turn.start({ text: 'c', turnId: 't3' })
  expect(world.toasts.length).toBe(1)
})

test('/delphia : état du pont et liste des éléments épinglés', async ($, on) => {
  installWorld(on, { [CONFIG]: '{}', [OVERRIDES]: overridesDoc(5, ['save-btn', 'title']) })
  const res = await $.command.run({
    command: 'delphia',
    args: '',
    origin: { kind: 'plugin', name: 'test' },
    presentation: { isFullscreen: false, columns: 80 },
  })
  expect(res.text).toContain('Pont : arrêté')
  expect(res.text).toContain('Éléments épinglés : 2')
  expect(res.text).toContain('- save-btn')
})
