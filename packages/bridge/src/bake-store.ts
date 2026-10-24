import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  BAKE_FILE,
  GEOMETRY_KEYS,
  MAX_BAKE_HISTORY,
  MAX_BAKE_ITEMS,
  applyPatch,
  compareRects,
  emptyBake,
  isBakeOpen,
  makeBakeId,
  parseBakeDoc,
  type BakeAppliedBody,
  type BakeDoc,
  type BakeRequest,
  type BakeResult,
  type Geometry,
  type GeometryPatch,
  type OverridesDoc,
  type Rect,
} from '@vite-plugin-delph-ia/protocol'
import { atomicWrite } from './fs-atomic.js'
import type { Store } from './store.js'

// ── Transitions : fonctions pures (état courant → nouvel état + écritures à faire) ──────────

/** `overrides` absent = `overrides.json` inchangé. */
export type Outcome =
  { ok: true; bake: BakeDoc; overrides?: OverridesDoc } | { ok: false; error: string }

const refuse = (error: string): Outcome => ({ ok: false, error })

const archive = (bake: BakeDoc, req: BakeRequest): BakeDoc => ({
  ...bake,
  current: null,
  history: [req, ...bake.history].slice(0, MAX_BAKE_HISTORY),
})

/** Une seule révision pour l'ensemble des éléments touchés. */
const withElements = (doc: OverridesDoc, elements: OverridesDoc['elements']): OverridesDoc => ({
  ...doc,
  revision: doc.revision + 1,
  elements,
})

export function requestBake(
  bake: BakeDoc,
  overrides: OverridesDoc,
  targets: { id: string; target: Rect }[],
  now: Date,
  bakeId: string,
): Outcome {
  if (isBakeOpen(bake.current)) return refuse('une demande de figeage est déjà ouverte')
  if (targets.length === 0 || targets.length > MAX_BAKE_ITEMS) {
    return refuse(`figeage : 1 à ${MAX_BAKE_ITEMS} éléments`)
  }
  const items: BakeRequest['items'] = []
  for (const { id, target } of targets) {
    const override = overrides.elements[id]
    if (!override) return refuse(`aucun ajustement à figer pour ${id}`)
    if (items.some(i => i.id === id)) return refuse(`élément en double : ${id}`)
    const geometry: Geometry = {}
    for (const k of GEOMETRY_KEYS) if (override[k] !== undefined) geometry[k] = override[k]
    items.push({ id, geometry, target })
  }
  const iso = now.toISOString()
  const current: BakeRequest = {
    bakeId,
    status: 'requested',
    createdAt: iso,
    updatedAt: iso,
    items,
    touchedFiles: [],
    results: [],
  }
  return { ok: true, bake: { ...bake, current } }
}

export function cancelBake(bake: BakeDoc, bakeId: string, note: string | null, now: Date): Outcome {
  const c = bake.current
  if (!c || c.bakeId !== bakeId || c.status !== 'requested') {
    return refuse('aucune demande « requested » avec cet identifiant')
  }
  const done: BakeRequest = {
    ...c,
    status: 'cancelled',
    updatedAt: now.toISOString(),
    ...(note ? { note } : {}),
  }
  return { ok: true, bake: archive(bake, done) }
}

/** Le tour de Claude est abouti : la surcouche perd les éléments (fin de la double application). */
export function markApplied(
  bake: BakeDoc,
  overrides: OverridesDoc,
  body: BakeAppliedBody,
  now: Date,
): Outcome {
  const c = bake.current
  if (!c || c.bakeId !== body.bakeId || c.status !== 'requested') {
    return refuse('aucune demande « requested » avec cet identifiant')
  }
  const elements = { ...overrides.elements }
  for (const { id } of c.items) delete elements[id]
  const current: BakeRequest = {
    ...c,
    status: 'applied',
    updatedAt: now.toISOString(),
    touchedFiles: body.touchedFiles,
  }
  return { ok: true, bake: { ...bake, current }, overrides: withElements(overrides, elements) }
}

export function verifyBake(
  bake: BakeDoc,
  bakeId: string,
  measured: { id: string; actual: Rect | null }[],
  now: Date,
): Outcome {
  const c = bake.current
  if (!c || c.bakeId !== bakeId || c.status !== 'applied') {
    return refuse('aucune demande « applied » avec cet identifiant')
  }
  const byId = new Map(measured.map(m => [m.id, m.actual]))
  const results: BakeResult[] = c.items.map(it => {
    const actual = byId.get(it.id) ?? null // absent de la mesure = introuvable
    return { id: it.id, ok: compareRects(it.target, actual).ok, actual }
  })
  const status = results.every(r => r.ok) ? 'verified' : 'mismatch'
  return { ok: true, bake: archive(bake, { ...c, status, results, updatedAt: now.toISOString() }) }
}

const asPatch = (g: Geometry): GeometryPatch => ({
  dx: g.dx ?? null,
  dy: g.dy ?? null,
  width: g.width ?? null,
  height: g.height ?? null,
})

/** Remet les ajustements dans la surcouche (remplace l'ajustement actuel de chaque élément). */
export function revertBake(
  bake: BakeDoc,
  overrides: OverridesDoc,
  bakeId: string,
  now: Date,
): Outcome {
  const c = bake.current
  const last = bake.history[0]
  const fromCurrent = c?.bakeId === bakeId && c.status === 'applied'
  const fromHistory =
    last?.bakeId === bakeId && (last.status === 'mismatch' || last.status === 'verified')
  const target = fromCurrent ? c : fromHistory ? last : undefined
  if (!target) return refuse('aucune demande « applied », « mismatch » ou « verified » à rétablir')
  if (fromHistory && isBakeOpen(c)) {
    return refuse('une autre demande est ouverte : annulez-la avant de rétablir')
  }
  let next = overrides
  for (const { id, geometry } of target.items) next = applyPatch(next, id, asPatch(geometry), now)
  const reverted: BakeRequest = { ...target, status: 'reverted', updatedAt: now.toISOString() }
  const nextBake = fromCurrent
    ? archive(bake, reverted)
    : { ...bake, history: [reverted, ...bake.history.slice(1)] }
  return { ok: true, bake: nextBake, overrides: withElements(overrides, next.elements) }
}

// ── Persistance ─────────────────────────────────────────────────────────────

export interface BakeChange {
  bake: BakeDoc
  /** Présent si `overrides.json` a aussi changé. */
  overrides?: OverridesDoc
}

export type BakeResultOf = { ok: true } | { ok: false; error: string }

export interface BakeStore {
  current(): BakeDoc
  request(targets: { id: string; target: Rect }[]): Promise<BakeResultOf>
  cancel(bakeId: string, note: string | null): Promise<BakeResultOf>
  applied(body: BakeAppliedBody): Promise<BakeResultOf>
  verify(bakeId: string, measured: { id: string; actual: Rect | null }[]): Promise<BakeResultOf>
  revert(bakeId: string): Promise<BakeResultOf>
}

async function readBake(file: string): Promise<BakeDoc> {
  let text: string
  try {
    text = await readFile(file, 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return emptyBake()
    throw e
  }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`${BAKE_FILE} n'est pas du JSON valide`)
  }
  const parsed = parseBakeDoc(json)
  if (!parsed.ok) throw new Error(`${BAKE_FILE} invalide : ${parsed.errors.join(' ; ')}`)
  return parsed.value
}

/**
 * Ouvre `bake.json` (seul écrivain). Un fichier invalide au démarrage est une erreur.
 * Chaque transition passe par la file d'écriture de `store` ; ordre d'écriture :
 * `overrides.json` puis `bake.json` (le premier est annulé si le second échoue).
 */
export async function openBakeStore(
  project: string,
  store: Store,
  onChange: (change: BakeChange) => void,
): Promise<BakeStore> {
  const file = join(project, BAKE_FILE)
  let bake = await readBake(file)

  const transact = (
    compute: (bake: BakeDoc, overrides: OverridesDoc, now: Date) => Outcome,
  ): Promise<BakeResultOf> =>
    store.run(async tx => {
      const before = await tx.read()
      const out = compute(bake, before, new Date())
      if (!out.ok) return out
      if (out.overrides) await tx.write(out.overrides)
      try {
        await atomicWrite(file, `${JSON.stringify(out.bake, null, 2)}\n`)
      } catch (e) {
        // Sans `bake.json` à jour, la surcouche modifiée serait incohérente : on la remet.
        if (out.overrides) {
          await tx.write({ ...before, revision: out.overrides.revision + 1 }).catch(() => undefined)
        }
        throw e
      }
      bake = out.bake
      onChange({ bake, ...(out.overrides ? { overrides: out.overrides } : {}) })
      return { ok: true }
    })

  return {
    current: () => bake,
    request: targets =>
      transact((b, o, now) => requestBake(b, o, targets, now, makeBakeId(randomBytes(8)))),
    cancel: (bakeId, note) => transact((b, _o, now) => cancelBake(b, bakeId, note, now)),
    applied: body => transact((b, o, now) => markApplied(b, o, body, now)),
    verify: (bakeId, measured) => transact((b, _o, now) => verifyBake(b, bakeId, measured, now)),
    revert: bakeId => transact((b, o, now) => revertBake(b, o, bakeId, now)),
  }
}
