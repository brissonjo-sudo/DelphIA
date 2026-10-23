import { parseGeometry, type Geometry } from './geometry.js'
import { isDzId } from './ids.js'
import { parseOverrides, type GeometryPatch, type OverridesDoc } from './overrides.js'
import { fail, isRecord, ok, type Result } from './result.js'

/** Marqueur d'enveloppe : distingue les messages DelphIA des autres `postMessage`. */
export const PROTOCOL_TAG = 'delphia/1'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Un élément ajustable tel que le runtime le mesure dans l'app affichée. */
export interface ElementInfo {
  id: string
  tag: string
  parentId: string | null
  rect: Rect
}

// ── Runtime (dans l'app, iframe) ⇄ Concepteur, via postMessage ──────────────

export type RuntimeToDesigner =
  | { type: 'runtime:hello'; url: string }
  | {
      type: 'runtime:elements'
      viewport: { width: number; height: number }
      elements: ElementInfo[]
    }

export type DesignerToRuntime =
  | { type: 'designer:measure' }
  /** Aperçu pendant un glisser ; `geometry: null` retire l'aperçu. */
  | { type: 'designer:preview'; id: string; geometry: Geometry | null }

// ── Concepteur ⇄ Pont, via WebSocket ────────────────────────────────────────

export type ClientToBridge =
  | { type: 'override:set'; id: string; patch: GeometryPatch }
  | { type: 'override:clear'; id: string }

export type BridgeToClient =
  { type: 'overrides:state'; doc: OverridesDoc } | { type: 'bridge:error'; message: string }

/** Enveloppe sur le fil : `{ tag, msg }`. */
export const wrap = <M>(msg: M): { tag: typeof PROTOCOL_TAG; msg: M } => ({
  tag: PROTOCOL_TAG,
  msg,
})

// ── Validation ──────────────────────────────────────────────────────────────

const MAX_LIST = 5_000
const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function unwrap(input: unknown): Result<Record<string, unknown>> {
  if (!isRecord(input) || input.tag !== PROTOCOL_TAG) return fail(['enveloppe DelphIA absente'])
  if (!isRecord(input.msg) || typeof input.msg.type !== 'string') return fail(['message sans type'])
  return ok(input.msg)
}

function parseRect(v: unknown): Rect | null {
  if (!isRecord(v)) return null
  const { x, y, width, height } = v
  if (![x, y, width, height].every(isFiniteNum)) return null
  return { x: x as number, y: y as number, width: width as number, height: height as number }
}

function parseElement(v: unknown): ElementInfo | null {
  if (!isRecord(v) || !isDzId(v.id) || typeof v.tag !== 'string' || v.tag.length > 32) return null
  if (v.parentId !== null && !isDzId(v.parentId)) return null
  const rect = parseRect(v.rect)
  return rect ? { id: v.id, tag: v.tag, parentId: v.parentId, rect } : null
}

export function parseRuntimeToDesigner(input: unknown): Result<RuntimeToDesigner> {
  const m = unwrap(input)
  if (!m.ok) return m
  const msg = m.value
  switch (msg.type) {
    case 'runtime:hello':
      return typeof msg.url === 'string' ? ok({ type: msg.type, url: msg.url }) : fail(['url'])
    case 'runtime:elements': {
      const vp = msg.viewport
      if (!isRecord(vp) || !isFiniteNum(vp.width) || !isFiniteNum(vp.height))
        return fail(['viewport'])
      if (!Array.isArray(msg.elements) || msg.elements.length > MAX_LIST) return fail(['elements'])
      const elements: ElementInfo[] = []
      for (const raw of msg.elements) {
        const el = parseElement(raw)
        if (!el) return fail(['élément invalide'])
        elements.push(el)
      }
      return ok({ type: msg.type, viewport: { width: vp.width, height: vp.height }, elements })
    }
    default:
      return fail([`type inconnu : ${String(msg.type)}`])
  }
}

export function parseDesignerToRuntime(input: unknown): Result<DesignerToRuntime> {
  const m = unwrap(input)
  if (!m.ok) return m
  const msg = m.value
  switch (msg.type) {
    case 'designer:measure':
      return ok({ type: msg.type })
    case 'designer:preview': {
      if (!isDzId(msg.id)) return fail(['id'])
      if (msg.geometry === null) return ok({ type: msg.type, id: msg.id, geometry: null })
      const g = parseGeometry(msg.geometry)
      return g.ok ? ok({ type: msg.type, id: msg.id, geometry: g.value }) : g
    }
    default:
      return fail([`type inconnu : ${String(msg.type)}`])
  }
}

function parsePatch(v: unknown): Result<GeometryPatch> {
  if (!isRecord(v)) return fail(['patch : objet attendu'])
  const removed: GeometryPatch = {}
  const kept: Record<string, unknown> = {}
  for (const [k, val] of Object.entries(v)) {
    if (val === null) (removed as Record<string, null>)[k] = null
    else kept[k] = val
  }
  const g = parseGeometry(kept, 'patch')
  if (!g.ok) return g
  for (const k of Object.keys(removed)) {
    if (!['dx', 'dy', 'width', 'height'].includes(k)) return fail([`patch.${k} : clé inconnue`])
  }
  return ok({ ...g.value, ...removed })
}

export function parseClientToBridge(input: unknown): Result<ClientToBridge> {
  const m = unwrap(input)
  if (!m.ok) return m
  const msg = m.value
  if (!isDzId(msg.id)) return fail(['id'])
  switch (msg.type) {
    case 'override:set': {
      const p = parsePatch(msg.patch)
      return p.ok ? ok({ type: msg.type, id: msg.id, patch: p.value }) : p
    }
    case 'override:clear':
      return ok({ type: msg.type, id: msg.id })
    default:
      return fail([`type inconnu : ${String(msg.type)}`])
  }
}

export function parseBridgeToClient(input: unknown): Result<BridgeToClient> {
  const m = unwrap(input)
  if (!m.ok) return m
  const msg = m.value
  switch (msg.type) {
    case 'overrides:state': {
      const d = parseOverrides(msg.doc)
      return d.ok ? ok({ type: msg.type, doc: d.value }) : d
    }
    case 'bridge:error':
      return typeof msg.message === 'string'
        ? ok({ type: msg.type, message: msg.message.slice(0, 500) })
        : fail(['message'])
    default:
      return fail([`type inconnu : ${String(msg.type)}`])
  }
}
