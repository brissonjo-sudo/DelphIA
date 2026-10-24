import type { Rect } from '@vite-plugin-delphia/protocol'

export const SNAP_THRESHOLD = 5
export const GRID_SIZE = 8

export type Axis = 'x' | 'y'

/** Repère à dessiner : ligne verticale (`axis: 'x'`, abscisse `pos`) ou horizontale. */
export interface Guide {
  axis: Axis
  pos: number
  from: number
  to: number
}

export const snapToGrid = (v: number, size = GRID_SIZE): number => Math.round(v / size) * size

/** Début, milieu et fin d'un rectangle sur un axe. */
export function axisValues(r: Rect, axis: Axis): [number, number, number] {
  const [s, size] = axis === 'x' ? [r.x, r.width] : [r.y, r.height]
  return [s, s + size / 2, s + size]
}

/** Plus petite correction (cible − valeur) dont la valeur absolue est ≤ seuil ; `null` si aucune. */
export function snapAxis(
  values: readonly number[],
  targets: readonly number[],
  threshold = SNAP_THRESHOLD,
): number | null {
  let best: number | null = null
  for (const v of values) {
    for (const t of targets) {
      const c = t - v
      if (Math.abs(c) <= threshold && (best === null || Math.abs(c) < Math.abs(best))) best = c
    }
  }
  return best
}

/** Toutes les valeurs de repère (bords et centre) d'un ensemble de rectangles. */
export const targetValues = (rects: readonly Rect[], axis: Axis): number[] =>
  rects.flatMap(r => axisValues(r, axis))

/**
 * Repères à afficher : chaque bord ou centre de `rect` aligné (à `tolerance` près) sur un bord
 * ou centre d'un autre rectangle. Les repères de même position sont fusionnés.
 */
export function findGuides(rect: Rect, others: readonly Rect[], tolerance = 0.5): Guide[] {
  const guides: Guide[] = []
  for (const axis of ['x', 'y'] as const) {
    const cross: Axis = axis === 'x' ? 'y' : 'x'
    const byPos = new Map<number, Guide>()
    const [c0, , c1] = axisValues(rect, cross)
    for (const other of others) {
      const [o0, , o1] = axisValues(other, cross)
      const otherValues = axisValues(other, axis)
      for (const v of axisValues(rect, axis)) {
        if (!otherValues.some(t => Math.abs(t - v) <= tolerance)) continue
        const pos = Math.round(v * 10) / 10
        const from = Math.min(c0, o0)
        const to = Math.max(c1, o1)
        const g = byPos.get(pos)
        if (g) {
          g.from = Math.min(g.from, from)
          g.to = Math.max(g.to, to)
        } else byPos.set(pos, { axis, pos, from, to })
      }
    }
    guides.push(...byPos.values())
  }
  return guides
}
