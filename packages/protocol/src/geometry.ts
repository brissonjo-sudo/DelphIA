import { fail, isRecord, ok, type Result } from './result.js'

/** Borne absolue d'une valeur en pixels : protège le CSS généré des valeurs aberrantes. */
export const MAX_PX = 10_000

/**
 * Ajustement manuel d'un élément, en pixels CSS entiers.
 * - `dx`, `dy` : décalage par rapport à la position calculée par le code (propriété `translate`).
 * - `width`, `height` : taille imposée (bordure comprise).
 * Un champ absent laisse le code décider.
 */
export interface Geometry {
  dx?: number
  dy?: number
  width?: number
  height?: number
}

export const GEOMETRY_KEYS = ['dx', 'dy', 'width', 'height'] as const
export type GeometryKey = (typeof GEOMETRY_KEYS)[number]

const minFor = (key: GeometryKey): number => (key === 'dx' || key === 'dy' ? -MAX_PX : 0)

export function isEmptyGeometry(g: Geometry): boolean {
  return GEOMETRY_KEYS.every(k => g[k] === undefined)
}

/** Valide une géométrie inconnue. Les clés inconnues sont refusées. */
export function parseGeometry(input: unknown, where = 'geometry'): Result<Geometry> {
  if (!isRecord(input)) return fail([`${where} : objet attendu`])
  const errors: string[] = []
  const out: Geometry = {}
  for (const key of Object.keys(input)) {
    if (!(GEOMETRY_KEYS as readonly string[]).includes(key)) {
      errors.push(`${where}.${key} : clé inconnue`)
    }
  }
  for (const key of GEOMETRY_KEYS) {
    const v = input[key]
    if (v === undefined) continue
    if (typeof v !== 'number' || !Number.isInteger(v)) {
      errors.push(`${where}.${key} : entier attendu`)
      continue
    }
    if (v < minFor(key) || v > MAX_PX) {
      errors.push(`${where}.${key} : hors bornes [${minFor(key)}, ${MAX_PX}]`)
      continue
    }
    out[key] = v
  }
  return errors.length ? fail(errors) : ok(out)
}

/** Arrondit et borne une géométrie issue de mesures (souris, getBoundingClientRect). */
export function normalizeGeometry(g: Geometry): Geometry {
  const out: Geometry = {}
  for (const key of GEOMETRY_KEYS) {
    const v = g[key]
    if (v === undefined || !Number.isFinite(v)) continue
    out[key] = Math.min(MAX_PX, Math.max(minFor(key), Math.round(v)))
  }
  return out
}
