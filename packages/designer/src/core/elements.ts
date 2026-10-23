import type { ElementInfo, Rect } from '@delphia/protocol'

/**
 * Élément sous le point : le plus petit rectangle qui le contient (bords inclus). À aire égale,
 * le dernier de la liste (le plus profond dans le DOM). Les éléments sans surface sont ignorés.
 */
export function hitTest(
  elements: readonly ElementInfo[],
  x: number,
  y: number,
): ElementInfo | null {
  let best: ElementInfo | null = null
  let bestArea = Infinity
  for (const el of elements) {
    const r = el.rect
    if (r.width <= 0 || r.height <= 0) continue
    if (x < r.x || y < r.y || x > r.x + r.width || y > r.y + r.height) continue
    const area = r.width * r.height
    if (area <= bestArea) {
      best = el
      bestArea = area
    }
  }
  return best
}

/** Identifiants des descendants (directs ou non) de `id`. */
export function descendantsOf(elements: readonly ElementInfo[], id: string): Set<string> {
  const found = new Set<string>()
  let grew = true
  while (grew) {
    grew = false
    for (const el of elements) {
      const p = el.parentId
      if (p !== null && (p === id || found.has(p)) && !found.has(el.id)) {
        found.add(el.id)
        grew = true
      }
    }
  }
  return found
}

/** Rectangles servant de repères à `id` : tous les autres, hors lui-même et ses descendants. */
export function snapTargets(elements: readonly ElementInfo[], id: string): Rect[] {
  const skip = descendantsOf(elements, id)
  return elements.filter(e => e.id !== id && !skip.has(e.id)).map(e => e.rect)
}

/** Ajustements dont l'identifiant n'est plus présent dans la page. */
export function findOrphans(
  overrideIds: readonly string[],
  presentIds: readonly string[],
): string[] {
  const present = new Set(presentIds)
  return overrideIds.filter(id => !present.has(id)).sort()
}
