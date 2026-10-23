import { h } from './dom.js'

export interface Shell {
  toolbar: HTMLElement
  list: HTMLElement
  inspector: HTMLElement
  status: HTMLElement
  /** Zone de l'app (iframe ou fausse app) : le calque est aligné dessus. */
  viewport: HTMLElement
  overlay: HTMLElement
  banner: HTMLElement
}

/** Squelette de la page : barre d'outils, liste, scène, inspecteur, barre d'état. */
export function buildShell(root: HTMLElement): Shell {
  const toolbar = h('header', { class: 'toolbar', role: 'toolbar', 'aria-label': 'Outils' })
  const list = h('aside', { class: 'panel list-panel', 'aria-label': 'Liste des éléments' })
  const overlay = h('div', { class: 'overlay', 'aria-label': 'Calque de conception' })
  const banner = h('div', { class: 'banner', role: 'status' })
  const viewport = h('div', { class: 'viewport' }, overlay, banner)
  const stage = h('main', { class: 'stage' }, viewport)
  const inspector = h('aside', { class: 'panel inspector-panel', 'aria-label': 'Inspecteur' })
  const status = h('footer', { class: 'statusbar' })
  root.append(toolbar, list, stage, inspector, status)
  return { toolbar, list, inspector, status, viewport, overlay, banner }
}
