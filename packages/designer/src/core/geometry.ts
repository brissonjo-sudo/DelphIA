import {
  GEOMETRY_KEYS,
  normalizeGeometry,
  type Geometry,
  type Rect,
} from '@vite-plugin-delphia/protocol'

/** Poignées de redimensionnement, nommées par les points cardinaux touchés. */
export type Handle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'
export type DragMode = 'move' | Handle

export const HANDLES: readonly Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
export const MIN_SIZE = 1

export const affectsX = (mode: DragMode): boolean => mode.includes('e') || mode.includes('w')
export const affectsY = (mode: DragMode): boolean => mode.includes('n') || mode.includes('s')

export function moveRect(r: Rect, dx: number, dy: number): Rect {
  return { ...r, x: r.x + dx, y: r.y + dy }
}

/**
 * Un axe : le bord mobile est déplacé de `d`, l'autre reste fixe. Si le bord mobile passe de
 * l'autre côté du bord fixe, le rectangle s'inverse ; en deçà de `min` il garde sa taille
 * minimale, du côté d'origine.
 */
function resizeAxis(
  start: number,
  size: number,
  d: number,
  moving: 'start' | 'end',
  min: number,
): [number, number] {
  const fixed = moving === 'start' ? start + size : start
  const m = (moving === 'start' ? start : start + size) + d
  const dist = m - fixed
  if (Math.abs(dist) >= min) return [Math.min(m, fixed), Math.abs(dist)]
  return [moving === 'start' ? fixed - min : fixed, min]
}

export function resizeRect(r: Rect, handle: Handle, dx: number, dy: number, min = MIN_SIZE): Rect {
  const [x, width] = affectsX(handle)
    ? resizeAxis(r.x, r.width, dx, handle.includes('w') ? 'start' : 'end', min)
    : [r.x, r.width]
  const [y, height] = affectsY(handle)
    ? resizeAxis(r.y, r.height, dy, handle.includes('n') ? 'start' : 'end', min)
    : [r.y, r.height]
  return { x, y, width, height }
}

/** Position d'une poignée sur le rectangle. */
export function handlePoint(r: Rect, handle: Handle): { x: number; y: number } {
  const x = handle.includes('w') ? r.x : handle.includes('e') ? r.x + r.width : r.x + r.width / 2
  const y = handle.includes('n') ? r.y : handle.includes('s') ? r.y + r.height : r.y + r.height / 2
  return { x, y }
}

/**
 * Ajustement (clés modifiées seulement) qui amène l'élément de `start` à `next`.
 * `start` est le rectangle mesuré : il inclut déjà le `translate` de `current`,
 * donc nouveau dx = ancien dx + déplacement du bord gauche.
 */
export function geometryPatch(
  mode: DragMode,
  start: Rect,
  current: Geometry,
  next: Rect,
): Geometry {
  const shiftX = Math.round(next.x - start.x)
  const shiftY = Math.round(next.y - start.y)
  const out: Geometry = {}
  if (mode === 'move') {
    out.dx = (current.dx ?? 0) + shiftX
    out.dy = (current.dy ?? 0) + shiftY
  } else {
    if (affectsX(mode)) {
      out.width = Math.round(next.width)
      if (shiftX !== 0) out.dx = (current.dx ?? 0) + shiftX
    }
    if (affectsY(mode)) {
      out.height = Math.round(next.height)
      if (shiftY !== 0) out.dy = (current.dy ?? 0) + shiftY
    }
  }
  return normalizeGeometry(out)
}

/** Géométrie complète après application d'un patch (valeurs finales, pas un delta). */
export const mergeGeometry = (current: Geometry, patch: Geometry): Geometry => ({
  ...current,
  ...patch,
})

/** Ne garde que les clés de géométrie (écarte par exemple `updatedAt`). */
export function pickGeometry(source: Geometry | undefined): Geometry {
  const out: Geometry = {}
  for (const k of GEOMETRY_KEYS) {
    const v = source?.[k]
    if (v !== undefined) out[k] = v
  }
  return out
}
