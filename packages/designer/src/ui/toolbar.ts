import type { Actions } from '../actions.js'
import { GRID_SIZE, SNAP_THRESHOLD } from '../core/snap.js'
import type { AppState } from '../state.js'
import { h } from './dom.js'

/** Barre d'outils : grille, accrochage, remesure, zoom (100 % fixe en M1). */
export function createToolbar(container: HTMLElement, actions: Actions): (s: AppState) => void {
  const brand = h('strong', { class: 'brand' }, 'DelphIA')
  const grid = h(
    'button',
    { type: 'button', class: 'btn', title: `Grille de ${GRID_SIZE} px` },
    'Grille',
  )
  const snap = h(
    'button',
    { type: 'button', class: 'btn', title: `Repères magnétiques (${SNAP_THRESHOLD} px)` },
    'Accrochage',
  )
  const measure = h(
    'button',
    { type: 'button', class: 'btn', title: 'Mesurer à nouveau' },
    'Remesurer',
  )
  const zoom = h('span', { class: 'zoom', 'aria-label': 'Zoom 100 %' }, '100 %')
  const keys = h(
    'span',
    { class: 'hint-inline' },
    'Flèches ±1 px · Maj ±10 px · Échap désélectionne',
  )
  grid.addEventListener('click', actions.toggleGrid)
  snap.addEventListener('click', actions.toggleSnap)
  measure.addEventListener('click', actions.remeasure)
  container.append(brand, grid, snap, measure, zoom, keys)
  return s => {
    grid.setAttribute('aria-pressed', String(s.gridOn))
    snap.setAttribute('aria-pressed', String(s.snapOn))
  }
}
