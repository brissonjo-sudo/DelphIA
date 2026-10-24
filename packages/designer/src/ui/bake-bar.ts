import type { Actions } from '../actions.js'
import { bannerModel } from '../core/bake-flow.js'
import type { AppState } from '../state.js'
import { h } from './dom.js'

/** Bandeau d'état de la demande de figeage. Tout texte passe par `textContent`. */
export function createBakeBar(container: HTMLElement, actions: Actions): (s: AppState) => void {
  const text = h('span', { class: 'bake-text' })
  const details = h('ul', { class: 'bake-details' })
  const cancel = h('button', { type: 'button', class: 'btn small' }, 'Annuler')
  const revert = h('button', { type: 'button', class: 'btn small' }, 'Rétablir')
  const close = h('button', { type: 'button', class: 'btn small' }, 'Fermer')
  cancel.addEventListener('click', actions.cancelBake)
  revert.addEventListener('click', actions.revertBake)
  close.addEventListener('click', actions.dismissBake)
  const head = h('div', { class: 'bake-head' }, text, cancel, revert, close)
  container.append(head, details)
  return s => {
    const m = bannerModel(s.bake, s.bakeDismissed, s.bakeNotice)
    container.hidden = m === null
    if (!m) return
    container.dataset.kind = m.kind
    text.textContent = m.text
    details.replaceChildren(...m.details.map(d => h('li', {}, d)))
    cancel.hidden = !m.canCancel
    revert.hidden = !m.canRevert
    close.hidden = !m.dismissable
  }
}
