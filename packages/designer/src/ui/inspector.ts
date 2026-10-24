import { GEOMETRY_KEYS, type GeometryKey, type GeometryPatch } from '@delphia/protocol'
import type { Actions } from '../actions.js'
import { parseField } from '../core/fields.js'
import type { AppState } from '../state.js'
import { h } from './dom.js'

const LABELS: Record<GeometryKey, string> = {
  dx: 'Décalage X (dx)',
  dy: 'Décalage Y (dy)',
  width: 'Largeur',
  height: 'Hauteur',
}

/** Panneau de droite : géométrie de l'élément sélectionné, éditable. */
export function createInspector(
  container: HTMLElement,
  actions: Actions,
  getState: () => AppState,
): (s: AppState) => void {
  const title = h('h2', { class: 'panel-title' }, 'Inspecteur')
  const empty = h('p', { class: 'hint' }, 'Cliquez un élément dans l’app pour le sélectionner.')
  const ident = h('p', { class: 'ident' })
  const error = h('p', { class: 'field-error', role: 'alert' })
  const release = h('button', { type: 'button', class: 'btn' }, 'Libérer')
  const form = h('div', { class: 'fields' })
  const inputs = {} as Record<GeometryKey, HTMLInputElement>

  for (const key of GEOMETRY_KEYS) {
    const input = h('input', {
      type: 'text',
      inputmode: 'numeric',
      id: `field-${key}`,
      autocomplete: 'off',
    })
    inputs[key] = input
    input.addEventListener('change', () => {
      const id = getState().selectedId
      if (!id) return
      const parsed = parseField(key, input.value)
      if (!parsed.ok) {
        error.textContent = `${LABELS[key]} : ${parsed.reason}`
        input.blur()
        render(getState())
        return
      }
      error.textContent = ''
      actions.commit(id, { [key]: parsed.value } as GeometryPatch)
    })
    form.append(h('label', { for: `field-${key}` }, LABELS[key]), input)
  }
  release.addEventListener('click', () => {
    const id = getState().selectedId
    if (id) actions.clear(id)
  })
  container.append(title, empty, ident, form, error, release)

  function render(s: AppState): void {
    const el = s.elements.find(e => e.id === s.selectedId)
    const has = el !== undefined
    empty.hidden = has
    form.hidden = ident.hidden = release.hidden = !has
    if (!el) {
      error.textContent = ''
      return
    }
    const stored = s.overrides.elements[el.id]
    const o = s.ghost?.id === el.id ? s.ghost.geometry : stored
    ident.textContent = `<${el.tag}>  ${el.id}`
    release.disabled = stored === undefined
    const shown = s.ghost?.id === el.id ? s.ghost.rect : el.rect
    const values: Record<GeometryKey, number> = {
      dx: o?.dx ?? 0,
      dy: o?.dy ?? 0,
      width: o?.width ?? Math.round(shown.width),
      height: o?.height ?? Math.round(shown.height),
    }
    for (const key of GEOMETRY_KEYS) {
      const input = inputs[key]
      input.classList.toggle('auto', o?.[key] === undefined)
      if (document.activeElement !== input) input.value = String(values[key])
    }
  }
  return render
}
