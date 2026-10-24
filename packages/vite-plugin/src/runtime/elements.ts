import { DZ_ATTR, isDzId, type ElementInfo } from '@vite-plugin-delphia/protocol'

export interface Collected {
  elements: ElementInfo[]
  /** id → premier élément portant cet id. */
  byId: Map<string, Element>
  warnings: string[]
}

/**
 * Mesure les `[data-dz-id]` valides, rectangles relatifs au viewport.
 * Ids invalides et doublons (le premier gagne) sont ignorés et signalés.
 * `parentId` = plus proche ancêtre retenu, sinon `null`.
 */
export function collectElements(doc: Document): Collected {
  const idOf = new Map<Element, string>()
  const byId = new Map<string, Element>()
  const warnings: string[] = []
  for (const el of doc.querySelectorAll(`[${DZ_ATTR}]`)) {
    const id = el.getAttribute(DZ_ATTR)
    if (!isDzId(id)) {
      warnings.push(`${DZ_ATTR} invalide ignoré : ${JSON.stringify(id)}`)
    } else if (byId.has(id)) {
      warnings.push(`${DZ_ATTR} en double ignoré : "${id}" (le premier élément est conservé)`)
    } else {
      idOf.set(el, id)
      byId.set(id, el)
    }
  }

  const elements: ElementInfo[] = []
  for (const [id, el] of byId) {
    let parentId: string | null = null
    for (let p = el.parentElement; p && !parentId; p = p.parentElement) {
      parentId = idOf.get(p) ?? null
    }
    const r = el.getBoundingClientRect()
    elements.push({
      id,
      tag: el.tagName.toLowerCase().slice(0, 32),
      parentId,
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
    })
  }
  return { elements, byId, warnings }
}
