import type { Geometry, Rect } from '@vite-plugin-delph-ia/protocol'
import {
  geometryPatch,
  mergeGeometry,
  moveRect,
  resizeRect,
  type DragMode,
  type Handle,
} from './geometry.js'
import { findGuides, snapAxis, snapToGrid, targetValues, type Axis, type Guide } from './snap.js'

export interface DragInput {
  mode: DragMode
  /** Rectangle mesuré au début du geste (inclut déjà le `translate` existant). */
  startRect: Rect
  /** Ajustement en vigueur au début du geste. */
  startGeometry: Geometry
  /** Déplacement brut de la souris depuis le début du geste, en pixels. */
  dx: number
  dy: number
  /** Rectangles des autres éléments (cibles de l'accrochage). */
  targets: readonly Rect[]
  snap: boolean
  grid: boolean
}

export interface DragResult {
  /** Rectangle visé, à dessiner pendant le geste. */
  rect: Rect
  /** Clés modifiées : à envoyer au pont. */
  patch: Geometry
  /** Géométrie complète : à envoyer au runtime en aperçu. */
  geometry: Geometry
  guides: Guide[]
  /** Faux si le rectangle est revenu à sa position/taille de départ. */
  changed: boolean
}

/** Valeurs mobiles sur un axe : pour l'accrochage aimanté, et pour la grille (un seul bord). */
function axisFeatures(
  mode: DragMode,
  axis: Axis,
  r: Rect,
  d: number,
): { magnet: number[]; grid: number | null } {
  const [s, size] = axis === 'x' ? [r.x, r.width] : [r.y, r.height]
  if (mode === 'move') return { magnet: [s + d, s + size / 2 + d, s + size + d], grid: s + d }
  const [startKey, endKey] = axis === 'x' ? ['w', 'e'] : ['n', 's']
  if (mode.includes(startKey as string)) return { magnet: [s + d], grid: s + d }
  if (mode.includes(endKey as string)) return { magnet: [s + size + d], grid: s + size + d }
  return { magnet: [], grid: null }
}

/** Correction à ajouter au déplacement de la souris : accrochage aimanté d'abord, sinon grille. */
function correction(axis: Axis, input: DragInput, d: number): number {
  const f = axisFeatures(input.mode, axis, input.startRect, d)
  const magnetic = input.snap ? snapAxis(f.magnet, targetValues(input.targets, axis)) : null
  if (magnetic !== null) return magnetic
  return input.grid && f.grid !== null ? snapToGrid(f.grid) - f.grid : 0
}

/** Calcule le résultat d'un déplacement ou d'un redimensionnement, aides d'alignement comprises. */
export function computeDrag(input: DragInput): DragResult {
  const { mode, startRect, startGeometry } = input
  const dx = Math.round(input.dx + correction('x', input, input.dx))
  const dy = Math.round(input.dy + correction('y', input, input.dy))
  const rect =
    mode === 'move' ? moveRect(startRect, dx, dy) : resizeRect(startRect, mode as Handle, dx, dy)
  const patch = geometryPatch(mode, startRect, startGeometry, rect)
  const changed =
    Math.round(rect.x - startRect.x) !== 0 ||
    Math.round(rect.y - startRect.y) !== 0 ||
    Math.round(rect.width - startRect.width) !== 0 ||
    Math.round(rect.height - startRect.height) !== 0
  return {
    rect,
    patch,
    geometry: mergeGeometry(startGeometry, patch),
    guides: input.snap ? findGuides(rect, input.targets) : [],
    changed,
  }
}
