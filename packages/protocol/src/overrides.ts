import { isDzId } from './ids.js'
import {
  GEOMETRY_KEYS,
  isEmptyGeometry,
  normalizeGeometry,
  parseGeometry,
  type Geometry,
} from './geometry.js'
import { fail, isRecord, ok, type Result } from './result.js'

export const OVERRIDES_VERSION = 1
export const MAX_ELEMENTS = 2_000

/** Ajustement d'un élément, horodaté (ISO 8601 UTC). */
export interface ElementOverride extends Geometry {
  updatedAt: string
}

/**
 * Contenu de `.delphia/overrides.json` : source de vérité des ajustements manuels.
 * `revision` augmente à chaque écriture ; le mod s'en sert pour détecter les changements.
 */
export interface OverridesDoc {
  version: typeof OVERRIDES_VERSION
  revision: number
  elements: Record<string, ElementOverride>
}

/** Patch d'ajustement : une clé à `null` la retire, une clé absente la conserve. */
export type GeometryPatch = { [K in keyof Geometry]?: number | null }

export function emptyOverrides(): OverridesDoc {
  return { version: OVERRIDES_VERSION, revision: 0, elements: {} }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/

/** Valide un document d'ajustements lu sur disque (JSON déjà parsé). */
export function parseOverrides(input: unknown): Result<OverridesDoc> {
  if (!isRecord(input)) return fail(['document : objet attendu'])
  const errors: string[] = []
  if (input.version !== OVERRIDES_VERSION) errors.push(`version : ${OVERRIDES_VERSION} attendu`)
  const revision = input.revision
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0) {
    errors.push('revision : entier positif attendu')
  }
  if (!isRecord(input.elements)) return fail([...errors, 'elements : objet attendu'])

  const ids = Object.keys(input.elements)
  if (ids.length > MAX_ELEMENTS) errors.push(`elements : au plus ${MAX_ELEMENTS}`)
  const elements: Record<string, ElementOverride> = {}
  for (const id of ids) {
    if (!isDzId(id)) {
      errors.push(`elements : identifiant invalide ${JSON.stringify(id)}`)
      continue
    }
    const raw = input.elements[id]
    if (!isRecord(raw)) {
      errors.push(`elements.${id} : objet attendu`)
      continue
    }
    const { updatedAt, ...geometryInput } = raw
    if (typeof updatedAt !== 'string' || !ISO_DATE.test(updatedAt)) {
      errors.push(`elements.${id}.updatedAt : date ISO UTC attendue`)
      continue
    }
    const geometry = parseGeometry(geometryInput, `elements.${id}`)
    if (!geometry.ok) {
      errors.push(...geometry.errors)
      continue
    }
    if (isEmptyGeometry(geometry.value)) {
      errors.push(`elements.${id} : aucun ajustement`)
      continue
    }
    elements[id] = { ...geometry.value, updatedAt }
  }
  if (errors.length) return fail(errors)
  return ok({ version: OVERRIDES_VERSION, revision: revision as number, elements })
}

/**
 * Applique un ajustement et renvoie un nouveau document (l'original n'est pas modifié).
 * `patch` fusionne avec l'existant ; `patch === null` retire tout l'ajustement de l'élément.
 */
export function applyPatch(
  doc: OverridesDoc,
  id: string,
  patch: GeometryPatch | null,
  now: Date,
): OverridesDoc {
  if (!isDzId(id)) throw new Error(`Identifiant DelphIA invalide : ${JSON.stringify(id)}`)
  const elements = { ...doc.elements }
  const current = elements[id]
  if (patch === null) {
    delete elements[id]
  } else {
    const merged: Geometry = {}
    for (const key of GEOMETRY_KEYS) {
      const value = key in patch ? patch[key] : current?.[key]
      if (value !== null && value !== undefined) merged[key] = value
    }
    const geometry = normalizeGeometry(merged)
    if (isEmptyGeometry(geometry)) delete elements[id]
    else elements[id] = { ...geometry, updatedAt: now.toISOString() }
  }
  if (Object.keys(elements).length > MAX_ELEMENTS) {
    throw new Error(`Trop d'éléments ajustés (au plus ${MAX_ELEMENTS})`)
  }
  return { version: OVERRIDES_VERSION, revision: doc.revision + 1, elements }
}

export interface OverridesDiff {
  added: string[]
  changed: string[]
  removed: string[]
}

/** Éléments ajoutés, modifiés ou retirés entre deux versions du document. */
export function diffOverrides(prev: OverridesDoc, next: OverridesDoc): OverridesDiff {
  const added: string[] = []
  const changed: string[] = []
  const removed: string[] = []
  for (const id of Object.keys(next.elements).sort()) {
    const before = prev.elements[id]
    const after = next.elements[id]
    if (!before) added.push(id)
    else if (GEOMETRY_KEYS.some(k => before[k] !== after?.[k])) changed.push(id)
  }
  for (const id of Object.keys(prev.elements).sort()) {
    if (!(id in next.elements)) removed.push(id)
  }
  return { added, changed, removed }
}
