import type { Actions } from '../actions.js'
import { findOrphans } from '../core/elements.js'
import type { AppState } from '../state.js'
import { h } from './dom.js'

/** Panneau de gauche : éléments mesurés (badge « épinglé ») puis ajustements orphelins. */
export function createElementList(container: HTMLElement, actions: Actions): (s: AppState) => void {
  const title = h('h2', { class: 'panel-title' }, 'Éléments')
  const list = h('ul', { class: 'list', 'aria-label': 'Éléments de la page' })
  const orphanTitle = h('h2', { class: 'panel-title' }, 'Orphelins')
  const orphanHint = h('p', { class: 'hint' }, 'Ajustements dont l’id n’existe plus dans la page.')
  const orphanList = h('ul', { class: 'list', 'aria-label': 'Ajustements orphelins' })
  container.append(title, list, orphanTitle, orphanHint, orphanList)

  return s => {
    const pinned = new Set(Object.keys(s.overrides.elements))
    list.replaceChildren(
      ...s.elements.map(el => {
        const btn = h('button', {
          type: 'button',
          class: 'row',
          'aria-pressed': String(el.id === s.selectedId),
        })
        btn.append(h('span', { class: 'tag' }, el.tag), h('span', { class: 'name' }, el.id))
        if (pinned.has(el.id)) btn.append(h('span', { class: 'badge' }, 'épinglé'))
        btn.addEventListener('click', () => actions.select(el.id))
        return h('li', {}, btn)
      }),
    )
    const orphans = s.measured
      ? findOrphans(
          [...pinned],
          s.elements.map(e => e.id),
        )
      : []
    orphanTitle.textContent = `Orphelins (${orphans.length})`
    orphanHint.hidden = orphans.length === 0
    orphanList.replaceChildren(
      ...orphans.map(id => {
        const free = h(
          'button',
          { type: 'button', class: 'btn small', 'aria-label': `Libérer ${id}` },
          'Libérer',
        )
        free.addEventListener('click', () => actions.clear(id))
        return h('li', { class: 'row orphan' }, h('span', { class: 'name' }, id), free)
      }),
    )
  }
}
