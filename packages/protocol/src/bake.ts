/**
 * « Figer » : faire passer des ajustements de la surcouche CSS dans le code (ADR 0003).
 *
 * Cycle d'une demande, toujours écrit par le pont dans `.delphia/bake.json` :
 *   requested ─(mod : tour de Claude terminé)→ applied ─(concepteur : mesure)→ verified | mismatch
 *   requested ─(tour interrompu / refusé / abandon)→ cancelled
 *   applied | mismatch ─(utilisateur : « Rétablir »)→ reverted
 */
import { GEOMETRY_KEYS, parseGeometry, type Geometry } from './geometry.js'
import { DZ_ATTR, isDzId } from './ids.js'
import { DELPHIA_DIR } from './paths.js'
import { isFiniteNum, parseRect, type Rect } from './rect.js'
import { fail, isRecord, ok, type Result } from './result.js'

export const BAKE_FILE = `${DELPHIA_DIR}/bake.json`
export const BAKE_VERSION = 1
export const BAKE_ID_PATTERN = /^bk-[a-z0-9]{6,32}$/
export const MAX_BAKE_ITEMS = 200
export const MAX_BAKE_HISTORY = 20
export const MAX_TOUCHED_FILES = 200
/** Écart toléré, en px, entre la position visée et la position mesurée après figeage. */
export const BAKE_TOLERANCE_PX = 1

export type BakeStatus =
  'requested' | 'applied' | 'verified' | 'mismatch' | 'cancelled' | 'reverted'
const STATUSES: readonly BakeStatus[] = [
  'requested',
  'applied',
  'verified',
  'mismatch',
  'cancelled',
  'reverted',
]

/** Un élément à figer : l'ajustement à reproduire et le rectangle visé (mesuré avec la surcouche). */
export interface BakeItem {
  id: string
  geometry: Geometry
  target: Rect
}

/** Résultat de la vérification d'un élément. `actual: null` = élément introuvable après figeage. */
export interface BakeResult {
  id: string
  ok: boolean
  actual: Rect | null
}

export interface BakeRequest {
  bakeId: string
  status: BakeStatus
  createdAt: string
  updatedAt: string
  items: BakeItem[]
  /** Fichiers modifiés par Claude pendant le tour de figeage (renseigné par le mod). */
  touchedFiles: string[]
  results: BakeResult[]
  /** Raison d'une annulation, d'un écart ou d'un refus (texte court). */
  note?: string
}

export interface BakeDoc {
  version: typeof BAKE_VERSION
  /** Demande en cours (au plus une), ou `null`. */
  current: BakeRequest | null
  /** Demandes terminées, la plus récente en premier. */
  history: BakeRequest[]
}

export const emptyBake = (): BakeDoc => ({ version: BAKE_VERSION, current: null, history: [] })

/** Une demande est « en cours » tant que Claude ou la vérification n'a pas conclu. */
export const isBakeOpen = (r: BakeRequest | null): boolean =>
  r !== null && (r.status === 'requested' || r.status === 'applied')

/** Génère un identifiant de demande à partir d'octets aléatoires fournis par l'appelant. */
export function makeBakeId(random: Uint8Array): string {
  const hex = Array.from(random.slice(0, 8), b => b.toString(16).padStart(2, '0')).join('')
  if (hex.length < 6) throw new Error('makeBakeId : au moins 3 octets aléatoires')
  return `bk-${hex}`
}

// ── Validation ──────────────────────────────────────────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/

function parseItem(v: unknown, where: string): Result<BakeItem> {
  if (!isRecord(v) || !isDzId(v.id)) return fail([`${where}.id`])
  const g = parseGeometry(v.geometry, `${where}.geometry`)
  if (!g.ok) return g
  const target = parseRect(v.target)
  if (!target) return fail([`${where}.target`])
  return ok({ id: v.id, geometry: g.value, target })
}

function parseResult(v: unknown, where: string): Result<BakeResult> {
  if (!isRecord(v) || !isDzId(v.id) || typeof v.ok !== 'boolean') return fail([where])
  if (v.actual === null) return ok({ id: v.id, ok: v.ok, actual: null })
  const actual = parseRect(v.actual)
  return actual ? ok({ id: v.id, ok: v.ok, actual }) : fail([`${where}.actual`])
}

/** Chemin de fichier rapporté par le mod : texte court, sans caractère de contrôle. */
const isSafePath = (p: unknown): p is string =>
  typeof p === 'string' &&
  p.length > 0 &&
  p.length <= 1024 &&
  [...p].every(c => (c.codePointAt(0) ?? 0) >= 0x20)

export function parseBakeRequest(v: unknown, where = 'bake'): Result<BakeRequest> {
  if (!isRecord(v)) return fail([`${where} : objet attendu`])
  const errors: string[] = []
  const { bakeId, status, createdAt, updatedAt, items, touchedFiles, results, note } = v
  if (typeof bakeId !== 'string' || !BAKE_ID_PATTERN.test(bakeId)) errors.push(`${where}.bakeId`)
  if (!STATUSES.includes(status as BakeStatus)) errors.push(`${where}.status`)
  for (const [k, d] of [
    ['createdAt', createdAt],
    ['updatedAt', updatedAt],
  ] as const) {
    if (typeof d !== 'string' || !ISO_DATE.test(d)) errors.push(`${where}.${k}`)
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_BAKE_ITEMS) {
    errors.push(`${where}.items : 1 à ${MAX_BAKE_ITEMS} éléments`)
  }
  if (
    !Array.isArray(touchedFiles) ||
    touchedFiles.length > MAX_TOUCHED_FILES ||
    !touchedFiles.every(isSafePath)
  ) {
    errors.push(`${where}.touchedFiles`)
  }
  if (!Array.isArray(results) || results.length > MAX_BAKE_ITEMS) errors.push(`${where}.results`)
  if (note !== undefined && (typeof note !== 'string' || note.length > 500)) {
    errors.push(`${where}.note`)
  }
  if (errors.length) return fail(errors)

  const parsedItems: BakeItem[] = []
  const seen = new Set<string>()
  for (const [i, raw] of (items as unknown[]).entries()) {
    const it = parseItem(raw, `${where}.items[${i}]`)
    if (!it.ok) return it
    if (seen.has(it.value.id)) return fail([`${where}.items : doublon ${it.value.id}`])
    seen.add(it.value.id)
    parsedItems.push(it.value)
  }
  const parsedResults: BakeResult[] = []
  for (const [i, raw] of (results as unknown[]).entries()) {
    const r = parseResult(raw, `${where}.results[${i}]`)
    if (!r.ok) return r
    parsedResults.push(r.value)
  }
  return ok({
    bakeId: bakeId as string,
    status: status as BakeStatus,
    createdAt: createdAt as string,
    updatedAt: updatedAt as string,
    items: parsedItems,
    touchedFiles: touchedFiles as string[],
    results: parsedResults,
    ...(note !== undefined ? { note: note as string } : {}),
  })
}

/** Valide le contenu de `.delphia/bake.json`. */
export function parseBakeDoc(input: unknown): Result<BakeDoc> {
  if (!isRecord(input)) return fail(['bake : objet attendu'])
  if (input.version !== BAKE_VERSION) return fail([`bake.version : ${BAKE_VERSION} attendu`])
  let current: BakeRequest | null = null
  if (input.current !== null) {
    const c = parseBakeRequest(input.current, 'bake.current')
    if (!c.ok) return c
    current = c.value
  }
  if (!Array.isArray(input.history) || input.history.length > MAX_BAKE_HISTORY) {
    return fail(['bake.history'])
  }
  const history: BakeRequest[] = []
  for (const [i, raw] of input.history.entries()) {
    const h = parseBakeRequest(raw, `bake.history[${i}]`)
    if (!h.ok) return h
    history.push(h.value)
  }
  return ok({ version: BAKE_VERSION, current, history })
}

// ── Routes HTTP du mod vers le pont (jeton exigé) ───────────────────────────

/** `POST` : le tour de figeage est terminé ; le pont retire les éléments de la surcouche. */
export const BAKE_APPLIED_ROUTE = '/api/bake/applied'
/** `POST` : le tour de figeage n'a pas abouti ; rien n'est retiré. */
export const BAKE_CANCEL_ROUTE = '/api/bake/cancel'

export interface BakeAppliedBody {
  bakeId: string
  touchedFiles: string[]
}
export interface BakeCancelBody {
  bakeId: string
  note: string
}

export function parseBakeAppliedBody(v: unknown): Result<BakeAppliedBody> {
  if (!isRecord(v) || typeof v.bakeId !== 'string' || !BAKE_ID_PATTERN.test(v.bakeId)) {
    return fail(['bakeId'])
  }
  const files = v.touchedFiles
  if (!Array.isArray(files) || files.length > MAX_TOUCHED_FILES || !files.every(isSafePath)) {
    return fail(['touchedFiles'])
  }
  return ok({ bakeId: v.bakeId, touchedFiles: [...new Set(files as string[])] })
}

export function parseBakeCancelBody(v: unknown): Result<BakeCancelBody> {
  if (!isRecord(v) || typeof v.bakeId !== 'string' || !BAKE_ID_PATTERN.test(v.bakeId)) {
    return fail(['bakeId'])
  }
  if (typeof v.note !== 'string' || v.note.length > 500) return fail(['note'])
  return ok({ bakeId: v.bakeId, note: v.note })
}

// ── Vérification ────────────────────────────────────────────────────────────

/** Compare la position mesurée après figeage à la position visée, à `tolerance` px près. */
export function compareRects(target: Rect, actual: Rect | null, tolerance = BAKE_TOLERANCE_PX) {
  if (!actual) return { ok: false, delta: null }
  const delta = {
    x: actual.x - target.x,
    y: actual.y - target.y,
    width: actual.width - target.width,
    height: actual.height - target.height,
  }
  const ok = Object.values(delta).every(d => isFiniteNum(d) && Math.abs(d) <= tolerance)
  return { ok, delta }
}

// ── Consigne pour Claude ────────────────────────────────────────────────────

/** Phrase courte, visible dans la zone de saisie, qui déclenche le tour de figeage. */
export const bakeTrigger = (bakeId: string): string =>
  `Fige les ajustements DelphIA dans le code (demande ${bakeId}).`

/** Retrouve l'identifiant de demande dans un texte de prompt. */
export function findBakeId(text: string): string | null {
  const m = /\b(bk-[a-z0-9]{6,32})\b/.exec(text)
  return m ? (m[1] ?? null) : null
}

const describeGeometry = (g: Geometry): string =>
  GEOMETRY_KEYS.filter(k => g[k] !== undefined)
    .map(k => `${k} ${g[k]} px`)
    .join(', ')

/**
 * Consigne détaillée, ajoutée en contexte au tour de figeage (le texte visible reste court).
 * Claude doit reproduire chaque ajustement dans le code, sans toucher `.delphia/`.
 */
export function bakeInstructions(req: BakeRequest): string {
  const lines = [
    `# DelphIA — figer des ajustements (demande ${req.bakeId})`,
    `L'utilisateur a ajusté ces éléments au pixel dans le concepteur et demande de figer ces`,
    `ajustements dans le code. Aujourd'hui ils sont appliqués par une surcouche CSS générée`,
    `(translate = décalage dx/dy, width/height = taille imposée, bordure comprise).`,
    ``,
    `À faire, pour chaque élément ci-dessous :`,
    `- modifie le code (CSS ou structure) pour que l'élément obtienne exactement le même rendu`,
    `  final, de façon idiomatique : marges, gap, padding, largeur/hauteur, alignement ; n'utilise`,
    `  translate que si rien de plus naturel ne convient ;`,
    `- garde l'attribut ${DZ_ATTR} de chaque élément tel quel ;`,
    `- ne touche pas ${DELPHIA_DIR}/ : DelphIA retirera lui-même la surcouche après ton tour, puis`,
    `  mesurera le résultat au pixel près ;`,
    `- ne modifie pas les autres éléments au-delà du nécessaire.`,
    ``,
    `Éléments (rectangle visé en px, relatif à la fenêtre de l'app) :`,
  ]
  for (const it of req.items) {
    const t = it.target
    lines.push(
      `- ${it.id} : ${describeGeometry(it.geometry)} → visé x ${Math.round(t.x)}, y ${Math.round(
        t.y,
      )}, ${Math.round(t.width)}×${Math.round(t.height)}`,
    )
  }
  lines.push(``, `Termine par la liste des fichiers modifiés.`)
  return lines.join('\n')
}
