import { HANDLES, handlePoint } from '../core/geometry.js'
import type { AppState } from '../state.js'
import { h, place } from './dom.js'

/** Dessine le calque : cadres, sélection, poignées, repères. Reconstruit à chaque rendu. */
export function renderOverlay(overlay: HTMLElement, s: AppState): void {
  overlay.hidden = !s.appConnected
  const nodes: HTMLElement[] = []
  const pinned = new Set(Object.keys(s.overrides.elements))
  for (const el of s.elements) {
    const rect = s.ghost?.id === el.id ? s.ghost.rect : el.rect
    if (rect.width <= 0 || rect.height <= 0) continue
    const cls = ['frame']
    if (pinned.has(el.id)) cls.push('pinned')
    if (el.id === s.hoverId) cls.push('hover')
    if (el.id === s.selectedId) cls.push('selected')
    else if (s.selectedIds.includes(el.id)) cls.push('multi')
    const frame = h('div', { class: cls.join(' ') })
    place(frame, rect.x, rect.y, rect.width, rect.height)
    if (el.id === s.selectedId) {
      const label = h('span', { class: 'frame-label' }, el.id)
      frame.append(label)
    }
    nodes.push(frame)
  }
  const sel = s.elements.find(e => e.id === s.selectedId)
  if (sel) {
    const rect = s.ghost?.id === sel.id ? s.ghost.rect : sel.rect
    for (const handle of HANDLES) {
      const p = handlePoint(rect, handle)
      const node = h('div', {
        class: `handle handle-${handle}`,
        'data-handle': handle,
        role: 'presentation',
      })
      place(node, p.x, p.y)
      nodes.push(node)
    }
  }
  for (const g of s.guides) {
    const line = h('div', { class: `guide guide-${g.axis}` })
    if (g.axis === 'x') place(line, g.pos, g.from, undefined, g.to - g.from)
    else place(line, g.from, g.pos, g.to - g.from, undefined)
    nodes.push(line)
  }
  overlay.replaceChildren(...nodes)
}
