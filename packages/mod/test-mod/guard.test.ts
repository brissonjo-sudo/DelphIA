import { expect, test } from 'claude-code/testing'

import { APP_BEFORE, CONFIG, CWD, OVERRIDES, installWorld, overridesDoc } from './world'

const APP = `${CWD}/src/App.tsx`
const project = { [CONFIG]: '{}', [OVERRIDES]: overridesDoc(3, ['save-btn']), [APP]: APP_BEFORE }

test('Write dans .delphia/ est refusé', async ($, on) => {
  installWorld(on, project)
  const res = await $.tool.call({ tool: 'Write', file_path: OVERRIDES, content: '{}' })
  expect(res.deny).toContain('.delphia')
})

test('NotebookEdit dans .delphia/ est refusé', async ($, on) => {
  installWorld(on, project)
  const res = await $.tool.call({
    tool: 'NotebookEdit',
    notebook_path: `${CWD}\\.delphia\\n.ipynb`,
    new_source: 'x',
  })
  expect(res.deny).toContain('.delphia')
})

test("Edit qui supprime un id épinglé est refusé et cite l'élément", async ($, on) => {
  installWorld(on, project)
  const res = await $.tool.call({
    tool: 'Edit',
    file_path: APP,
    old_string: '<button data-dz-id="save-btn">OK</button>',
    new_string: '<button>OK</button>',
  })
  expect(res.deny).toContain('save-btn')
  expect(res.deny).toContain("demande d'abord")
})

test('Write qui réécrit le fichier sans id épinglé est refusé', async ($, on) => {
  installWorld(on, project)
  const res = await $.tool.call({
    tool: 'Write',
    file_path: APP,
    content: '<div><button>OK</button></div>',
  })
  expect(res.deny).toContain('save-btn')
})

test("Edit normal ou qui conserve l'id est accepté", async ($, on) => {
  installWorld(on, project)
  const text = await $.tool.call({
    tool: 'Edit',
    file_path: APP,
    old_string: '>OK<',
    new_string: '>Enregistrer<',
  })
  expect(text.deny).toBeUndefined()
  const other = await $.tool.call({
    tool: 'Edit',
    file_path: APP,
    old_string: '<p data-dz-id="title">T</p>',
    new_string: '<h1>T</h1>',
  })
  // « title » n'est pas épinglé : seul save-btn l'est.
  expect(other.deny).toBeUndefined()
})

test('Bash : écriture dans .delphia refusée, lecture permise', async ($, on) => {
  installWorld(on, project)
  const write = await $.tool.call({ tool: 'Bash', command: 'echo {} > .delphia/overrides.json' })
  expect(write.deny).toContain('.delphia')
  const remove = await $.tool.call({ tool: 'Bash', command: 'rm -rf .delphia' })
  expect(remove.deny).toContain('.delphia')
  const read = await $.tool.call({ tool: 'Bash', command: 'cat .delphia/overrides.json 2>&1' })
  expect(read.deny).toBeUndefined()
  const ps = await $.tool.call({
    tool: 'PowerShell',
    command: 'Set-Content .delphia\\overrides.json "{}"',
  })
  expect(ps.deny).toContain('.delphia')
})

test('sans delphia.config.json, aucun effet', async ($, on) => {
  installWorld(on, { [OVERRIDES]: overridesDoc(3, ['save-btn']), [APP]: APP_BEFORE })
  const res = await $.tool.call({ tool: 'Write', file_path: OVERRIDES, content: '{}' })
  expect(res.deny).toBeUndefined()
  const edit = await $.tool.call({
    tool: 'Edit',
    file_path: APP,
    old_string: ' data-dz-id="save-btn"',
    new_string: '',
  })
  expect(edit.deny).toBeUndefined()
})
