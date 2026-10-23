// Monde simulé pour les tests du mod : faux système de fichiers + bas de chaîne du moteur.
import type { On } from 'claude-code'

export const CWD = '/proj'
export const CONFIG = `${CWD}/delphia.config.json`
export const OVERRIDES = `${CWD}/.delphia/overrides.json`

export const overridesDoc = (revision: number, ids: string[]): string =>
  JSON.stringify({
    version: 1,
    revision,
    elements: Object.fromEntries(
      ids.map(id => [id, { dx: 12, dy: -4, updatedAt: '2026-10-24T10:00:00.000Z' }]),
    ),
  })

export const APP_BEFORE =
  '<div>\n  <button data-dz-id="save-btn">OK</button>\n  <p data-dz-id="title">T</p>\n</div>\n'

export type World = {
  files: Record<string, string>
  toasts: string[]
  statuses: (string | undefined)[]
}

// Le moteur absolutise les chemins (E:\proj\... sous Windows) : on compare sans lecteur ni « \ ».
const norm = (path: string): string => path.replace(/^[A-Za-z]:/, '').replaceAll('\\', '/')

/** Installe sous le mod les réponses du moteur : fichiers, cwd, outils, affichage. */
export function installWorld(on: On, files: Record<string, string>): World {
  const world: World = { files, toasts: [], statuses: [] }
  const find = (path: string): string | undefined =>
    Object.entries(world.files).find(([name]) => norm(name) === norm(path))?.[1]
  on('session.cwd', () => ({ value: CWD }))
  on('fs.exists', (_, e) => ({ value: find(e.path) !== undefined }))
  on('fs.read', (_, e) => {
    const text = find(e.path)
    return text === undefined ? { deny: 'ENOENT' } : { value: text }
  })
  on('fs.stat', (_, e) =>
    find(e.path) === undefined
      ? { deny: 'ENOENT' }
      : { value: { kind: 'file', size: 1, mtimeMs: 0, isLink: false } },
  )
  on('tool.call', () => ({ result: {} }))
  on('ui.toast', (_, e) => {
    world.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.status', (_, e) => {
    world.statuses.push(e.text)
    return { value: undefined }
  })
  on('ui.log', () => ({ value: undefined }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  return world
}
