import { dzSelector, type Geometry } from '@delphia/protocol'

type Styled = HTMLElement | SVGElement
type Saved = Map<string, { value: string; priority: string }>

/** Valeurs inline d'origine des propriétés que l'aperçu a écrasées. */
const saved = new WeakMap<Styled, Saved>()

function declarations(g: Geometry): [string, string][] {
  const out: [string, string][] = []
  if (g.dx !== undefined || g.dy !== undefined) {
    out.push(['translate', `${g.dx ?? 0}px ${g.dy ?? 0}px`])
  }
  if (g.width !== undefined || g.height !== undefined) out.push(['box-sizing', 'border-box'])
  if (g.width !== undefined) out.push(['width', `${g.width}px`])
  if (g.height !== undefined) out.push(['height', `${g.height}px`])
  return out
}

/** Retire l'aperçu et rend à l'élément ses styles inline d'avant. */
export function clearPreview(el: Styled): void {
  const prev = saved.get(el)
  if (!prev) return
  for (const [prop, { value, priority }] of prev) {
    if (value) el.style.setProperty(prop, value, priority)
    else el.style.removeProperty(prop)
  }
  saved.delete(el)
}

/** Applique une géométrie complète (pas un delta) en style inline `!important`. */
export function applyPreview(el: Styled, g: Geometry): void {
  clearPreview(el)
  const prev: Saved = new Map()
  for (const [prop, value] of declarations(g)) {
    prev.set(prop, {
      value: el.style.getPropertyValue(prop),
      priority: el.style.getPropertyPriority(prop),
    })
    el.style.setProperty(prop, value, 'important')
  }
  if (prev.size) saved.set(el, prev)
}

/** Aperçu d'un élément désigné par son id ; `null` le retire. Id introuvable : sans effet. */
export function previewById(doc: Document, id: string, geometry: Geometry | null): void {
  const el = doc.querySelector(dzSelector(id))
  if (!(el instanceof HTMLElement || el instanceof SVGElement)) return
  if (geometry === null) clearPreview(el)
  else applyPreview(el, geometry)
}
