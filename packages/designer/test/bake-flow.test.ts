import {
  emptyBake,
  type BakeDoc,
  type BakeRequest,
  type ElementInfo,
} from '@vite-plugin-delph-ia/protocol'
import { describe, expect, it } from 'vitest'
import {
  VERIFY_WAIT_MS,
  bakeTargets,
  bannerModel,
  buildVerify,
  canBake,
  formatDelta,
  initialFlow,
  stepVerify,
  type VerifyEvent,
  type VerifyFlow,
} from '../src/core/bake-flow.js'

const rect = (x: number, y: number, width = 10, height = 10) => ({ x, y, width, height })
const el = (id: string, x = 0): ElementInfo => ({
  id,
  tag: 'div',
  parentId: null,
  rect: rect(x, 0),
})
const T = '2026-10-24T08:00:00.000Z'
const req = (status: BakeRequest['status'], extra: Partial<BakeRequest> = {}): BakeRequest => ({
  bakeId: 'bk-abcdef01',
  status,
  createdAt: T,
  updatedAt: T,
  items: [{ id: 'a', geometry: { dx: 3 }, target: rect(3, 0) }],
  touchedFiles: [],
  results: [],
  ...extra,
})
const doc = (current: BakeRequest | null, history: BakeRequest[] = []): BakeDoc => ({
  ...emptyBake(),
  current,
  history,
})

describe('canBake / bakeTargets', () => {
  const pinned = new Set(['a', 'b'])
  it('actif seulement avec un élément épinglé et aucune demande ouverte', () => {
    expect(canBake(['a'], pinned, emptyBake())).toBe(true)
    expect(canBake(['z'], pinned, emptyBake())).toBe(false)
    expect(canBake([], pinned, emptyBake())).toBe(false)
    expect(canBake(['a'], pinned, doc(req('requested')))).toBe(false)
    expect(canBake(['a'], pinned, doc(req('applied')))).toBe(false)
    expect(canBake(['a'], pinned, doc(null, [req('verified')]))).toBe(true)
  })
  it('filtre les non épinglés et les absents', () => {
    const r = bakeTargets(['a', 'z', 'b', 'gone'], new Set(['a', 'b', 'gone']), [
      el('a', 1),
      el('b', 2),
      el('z'),
    ])
    expect(r.items).toEqual([
      { id: 'a', target: rect(1, 0) },
      { id: 'b', target: rect(2, 0) },
    ])
    expect(r.ignored).toEqual(['z', 'gone'])
  })
})

describe('buildVerify', () => {
  it('null pour un id absent', () => {
    expect(buildVerify('bk-abcdef01', ['a', 'x'], [el('a', 5)])).toEqual({
      type: 'bake:verify',
      bakeId: 'bk-abcdef01',
      results: [
        { id: 'a', actual: rect(5, 0) },
        { id: 'x', actual: null },
      ],
    })
  })
})

function run(events: VerifyEvent[], start: VerifyFlow = initialFlow()) {
  let flow = start
  const actions: (string | null)[] = []
  for (const ev of events) {
    const r = stepVerify(flow, ev)
    flow = r.flow
    actions.push(r.action)
  }
  return { flow, actions }
}
const applied = (now = 0): VerifyEvent => ({ kind: 'bake', current: req('applied'), now })
const appliedCleared = (now = 0): VerifyEvent => ({
  kind: 'bake',
  current: req('applied'),
  now,
  overlayCleared: true,
})

describe('stepVerify', () => {
  it('overrides puis elements : mesure, puis vérification une seule fois', () => {
    const r = run([
      applied(),
      { kind: 'elements', now: 1 }, // avant overrides : ignoré
      { kind: 'overrides' },
      { kind: 'elements', now: 2 }, // déclenche la mesure
      { kind: 'elements', now: 3 }, // réponse à la mesure
      { kind: 'elements', now: 4 },
      applied(5), // même état renvoyé : pas de seconde vérification
      { kind: 'overrides' },
      { kind: 'elements', now: 6 },
    ])
    expect(r.actions).toEqual([null, null, null, 'measure', 'verify', null, null, null, null])
  })
  it('délai dépassé : mesure sans attendre, puis vérification', () => {
    const r = run([
      applied(0),
      { kind: 'tick', now: VERIFY_WAIT_MS - 1 },
      { kind: 'tick', now: VERIFY_WAIT_MS },
      { kind: 'elements', now: VERIFY_WAIT_MS + 1 },
    ])
    expect(r.actions).toEqual([null, null, 'measure', 'verify'])
  })
  it('app muette après la mesure : abandon sans juger, une seule fois', () => {
    const r = run([
      applied(0),
      { kind: 'tick', now: VERIFY_WAIT_MS },
      { kind: 'tick', now: 2 * VERIFY_WAIT_MS },
      { kind: 'tick', now: 3 * VERIFY_WAIT_MS },
    ])
    expect(r.actions).toEqual([null, 'measure', 'stalled', null])
  })
  it('statut qui quitte applied : plus rien en attente', () => {
    const r = run([applied(), { kind: 'bake', current: req('verified'), now: 1 }])
    expect(r.flow.pending).toBeNull()
  })
})

describe('affichage', () => {
  it('formate les écarts en px', () => {
    expect(formatDelta(rect(0, 0), rect(3, 0, 8, 10))).toBe('x +3 px, largeur -2 px')
    expect(formatDelta(rect(0, 0), null)).toBe('introuvable après figeage')
  })
  it('bandeau par statut', () => {
    expect(bannerModel(doc(req('requested')), null, null)).toMatchObject({
      kind: 'requested',
      canCancel: true,
    })
    expect(bannerModel(doc(req('applied')), null, null)?.text).toBe('Vérification…')
    expect(bannerModel(doc(null, [req('verified')]), null, null)?.text).toContain('Figé')
    const mm = bannerModel(
      doc(null, [
        req('mismatch', {
          touchedFiles: ['src/a.css'],
          results: [{ id: 'a', ok: false, actual: rect(8, 0) }],
        }),
      ]),
      null,
      null,
    )
    expect(mm?.canRevert).toBe(true)
    expect(mm?.details).toEqual(['a : x +5 px', 'Fichiers touchés : src/a.css'])
    expect(bannerModel(doc(null, [req('reverted')]), 'bk-abcdef01', null)).toBeNull()
  })
})

describe('ordre du vrai pont (overrides:state avant bake:state)', () => {
  it('surcouche déjà vidée : la mesure part au runtime:elements suivant, sans attendre 5 s', () => {
    const r = run([appliedCleared(0), { kind: 'elements', now: 100 }])
    expect(r.actions).toContain('measure')
  })
})
