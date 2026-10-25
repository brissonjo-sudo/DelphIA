import {
  compareRects,
  isBakeOpen,
  type BakeDoc,
  type BakeRequest,
  type ClientToBridge,
  type ElementInfo,
  type Rect,
} from '@vite-plugin-delph-ia/protocol'

/** Délai maximal d'attente de la mise à jour de l'app avant de mesurer quand même. */
export const VERIFY_WAIT_MS = 5000

// ── Demande ─────────────────────────────────────────────────────────────────

/** Bouton « Figer » actif : au moins un élément épinglé sélectionné, aucune demande ouverte. */
export function canBake(
  selectedIds: readonly string[],
  pinnedIds: ReadonlySet<string>,
  bake: BakeDoc,
): boolean {
  return !isBakeOpen(bake.current) && selectedIds.some(id => pinnedIds.has(id))
}

/** Éléments à figer (épinglés et mesurés) et ids ignorés (non épinglés ou absents). */
export function bakeTargets(
  selectedIds: readonly string[],
  pinnedIds: ReadonlySet<string>,
  elements: readonly ElementInfo[],
): { items: { id: string; target: Rect }[]; ignored: string[] } {
  const items: { id: string; target: Rect }[] = []
  const ignored: string[] = []
  for (const id of selectedIds) {
    const el = elements.find(e => e.id === id)
    if (el && pinnedIds.has(id)) items.push({ id, target: el.rect })
    else ignored.push(id)
  }
  return { items, ignored }
}

export const buildBakeRequest = (items: { id: string; target: Rect }[]): ClientToBridge => ({
  type: 'bake:request',
  items,
})

/** Mesures pour `bake:verify` : un rectangle par id demandé, `null` si absent de la page. */
export function buildVerify(
  bakeId: string,
  ids: readonly string[],
  elements: readonly ElementInfo[],
): ClientToBridge {
  return {
    type: 'bake:verify',
    bakeId,
    results: ids.map(id => ({ id, actual: elements.find(e => e.id === id)?.rect ?? null })),
  }
}

// ── Vérification automatique : quand mesurer et juger ───────────────────────

/** `waiting` : on attend overrides:state puis runtime:elements ; `measuring` : mesure demandée. */
export interface Pending {
  bakeId: string
  startedAt: number
  overridesSeen: boolean
  phase: 'waiting' | 'measuring'
}
export interface VerifyFlow {
  pending: Pending | null
  /** `bakeId` déjà vérifiés (ou abandonnés) : une seule vérification par demande. */
  handled: readonly string[]
}
export type VerifyEvent =
  /**
   * `overlayCleared` : la surcouche reçue ne contient déjà plus aucun élément de la demande.
   * Le pont diffuse `overrides:state` AVANT `bake:state` : sans ce drapeau, on attendrait un
   * nouvel `overrides:state` qui ne viendra pas (5 s perdues).
   */
  | { kind: 'bake'; current: BakeRequest | null; now: number; overlayCleared?: boolean }
  | { kind: 'overrides' }
  | { kind: 'elements'; now: number }
  | { kind: 'tick'; now: number }
/** `measure` : demander une mesure fraîche ; `verify` : envoyer `bake:verify` ; `stalled` : abandon. */
export type VerifyAction = 'measure' | 'verify' | 'stalled' | null

export const initialFlow = (): VerifyFlow => ({ pending: null, handled: [] })

export function stepVerify(
  flow: VerifyFlow,
  ev: VerifyEvent,
): { flow: VerifyFlow; action: VerifyAction } {
  const p = flow.pending
  switch (ev.kind) {
    case 'bake': {
      const c = ev.current
      if (c?.status !== 'applied') return { flow: { ...flow, pending: null }, action: null }
      if (p?.bakeId === c.bakeId || flow.handled.includes(c.bakeId)) return { flow, action: null }
      const next: Pending = {
        bakeId: c.bakeId,
        startedAt: ev.now,
        overridesSeen: ev.overlayCleared === true,
        phase: 'waiting',
      }
      return { flow: { ...flow, pending: next }, action: null }
    }
    case 'overrides':
      return p?.phase === 'waiting' && !p.overridesSeen
        ? { flow: { ...flow, pending: { ...p, overridesSeen: true } }, action: null }
        : { flow, action: null }
    case 'elements': {
      if (!p) return { flow, action: null }
      if (p.phase === 'waiting') {
        if (!p.overridesSeen) return { flow, action: null }
        return { flow: { ...flow, pending: { ...p, phase: 'measuring' } }, action: 'measure' }
      }
      // Réponse à notre demande de mesure : c'est la mesure à envoyer.
      return { flow: { pending: null, handled: [...flow.handled, p.bakeId] }, action: 'verify' }
    }
    case 'tick': {
      if (!p || ev.now - p.startedAt < VERIFY_WAIT_MS) return { flow, action: null }
      if (p.phase === 'waiting') {
        // Délai dépassé : on mesure quand même.
        const pending: Pending = { ...p, phase: 'measuring', startedAt: ev.now }
        return { flow: { ...flow, pending }, action: 'measure' }
      }
      // Pas de réponse à la mesure : l'app est injoignable, on abandonne sans juger.
      return { flow: { pending: null, handled: [...flow.handled, p.bakeId] }, action: 'stalled' }
    }
  }
}

// ── Affichage ───────────────────────────────────────────────────────────────

const fmtPx = (n: number): string => {
  const r = Math.round(n * 10) / 10
  return `${r > 0 ? '+' : ''}${r} px`
}

/** Écart d'un élément, en px : « x +3 px, largeur -2 px », ou « introuvable ». */
export function formatDelta(target: Rect, actual: Rect | null): string {
  const c = compareRects(target, actual)
  if (!c.delta) return 'introuvable après figeage'
  const d = c.delta
  const names: [keyof Rect, string][] = [
    ['x', 'x'],
    ['y', 'y'],
    ['width', 'largeur'],
    ['height', 'hauteur'],
  ]
  const parts = names.filter(([k]) => d[k] !== 0).map(([k, n]) => `${n} ${fmtPx(d[k])}`)
  return parts.length ? parts.join(', ') : 'identique'
}

export type BannerKind = 'requested' | 'applied' | 'verified' | 'mismatch' | 'info'
export interface BakeBannerModel {
  kind: BannerKind
  bakeId: string
  text: string
  /** Lignes de détail (écarts, fichiers) — à afficher via textContent seulement. */
  details: string[]
  canCancel: boolean
  canRevert: boolean
  /** Une demande terminée peut être masquée. */
  dismissable: boolean
}

const itemsOf = (r: BakeRequest): string =>
  r.items.length === 1 ? (r.items[0]?.id ?? '') : `${r.items.length} éléments`
const filesLine = (r: BakeRequest): string[] =>
  r.touchedFiles.length ? [`Fichiers touchés : ${r.touchedFiles.join(', ')}`] : []

/** Bandeau à afficher : demande ouverte, sinon la plus récente de l'historique non masquée. */
export function bannerModel(
  bake: BakeDoc,
  dismissedId: string | null,
  notice: string | null,
): BakeBannerModel | null {
  const r = bake.current ?? bake.history[0]
  if (!r || (!bake.current && r.bakeId === dismissedId)) return null
  const base = { bakeId: r.bakeId, details: [] as string[], canCancel: false, canRevert: false }
  const done = { ...base, dismissable: true }
  switch (r.status) {
    case 'requested':
      return {
        ...base,
        kind: 'requested',
        dismissable: false,
        canCancel: true,
        text: `En attente de Claude — validez la demande dans Claude Code (${itemsOf(r)})`,
      }
    case 'applied':
      return {
        ...base,
        kind: 'applied',
        dismissable: false,
        text: notice ?? 'Vérification…',
        details: filesLine(r),
      }
    case 'verified':
      return { ...done, kind: 'verified', text: `Figé (${itemsOf(r)})` }
    case 'mismatch':
      return {
        ...done,
        kind: 'mismatch',
        canRevert: true,
        text: `Écart après figeage${r.note ? ` — ${r.note}` : ''}`,
        details: [
          ...r.results
            .filter(x => !x.ok)
            .map(x => {
              const target = r.items.find(i => i.id === x.id)?.target
              return `${x.id} : ${target ? formatDelta(target, x.actual) : 'écart'}`
            }),
          ...filesLine(r),
        ],
      }
    case 'cancelled':
      return { ...done, kind: 'info', text: `Demande annulée${r.note ? ` — ${r.note}` : ''}` }
    case 'reverted':
      return { ...done, kind: 'info', text: 'Ajustements rétablis dans la surcouche' }
  }
}

const STATUS_LABEL: Record<BakeRequest['status'], string> = {
  requested: 'en attente',
  applied: 'appliqué',
  verified: 'figé',
  mismatch: 'écart',
  cancelled: 'annulé',
  reverted: 'rétabli',
}

/** Historique court (5 dernières demandes terminées). */
export const historyLines = (bake: BakeDoc, max = 5): string[] =>
  bake.history
    .slice(0, max)
    .map(
      r =>
        `${r.updatedAt.slice(0, 16).replace('T', ' ')} · ${itemsOf(r)} · ${STATUS_LABEL[r.status]}`,
    )
