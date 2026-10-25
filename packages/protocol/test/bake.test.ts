import { describe, expect, it } from 'vitest'

import {
  bakeInstructions,
  bakeTrigger,
  compareRects,
  emptyBake,
  findBakeId,
  isBakeOpen,
  makeBakeId,
  parseBakeAppliedBody,
  parseBakeCancelBody,
  parseBakeDoc,
  parseBridgeToClient,
  parseClientToBridge,
  wrap,
  type BakeRequest,
} from '../src/index.js'

const NOW = '2026-10-24T12:00:00.000Z'
const req = (over: Partial<BakeRequest> = {}): BakeRequest => ({
  bakeId: 'bk-a1b2c3d4',
  status: 'requested',
  createdAt: NOW,
  updatedAt: NOW,
  items: [
    {
      id: 'btn-ok',
      geometry: { dx: 12, width: 120 },
      target: { x: 40, y: 10, width: 120, height: 32 },
    },
  ],
  touchedFiles: [],
  results: [],
  ...over,
})

describe('identifiant de demande', () => {
  it('makeBakeId produit un id valide et findBakeId le retrouve', () => {
    const id = makeBakeId(new Uint8Array([1, 2, 3, 4, 250, 251, 252, 253]))
    expect(id).toBe('bk-01020304fafbfcfd')
    expect(findBakeId(bakeTrigger(id))).toBe(id)
    expect(findBakeId('rien ici')).toBeNull()
  })
})

describe('parseBakeDoc', () => {
  it('relit un document valide', () => {
    const doc = {
      ...emptyBake(),
      current: req(),
      history: [req({ bakeId: 'bk-ffffff', status: 'verified' })],
    }
    expect(parseBakeDoc(JSON.parse(JSON.stringify(doc)))).toEqual({ ok: true, value: doc })
  })

  it.each([
    [{ version: 2, current: null, history: [] }],
    [{ version: 1, current: { ...req(), bakeId: 'bk-X' }, history: [] }],
    [{ version: 1, current: { ...req(), status: 'fini' }, history: [] }],
    [{ version: 1, current: { ...req(), items: [] }, history: [] }],
    [{ version: 1, current: { ...req(), touchedFiles: ['a\nb'] }, history: [] }],
    [{ version: 1, current: { ...req(), items: [req().items[0], req().items[0]] }, history: [] }],
    [{ version: 1, current: null, history: new Array(21).fill(req()) }],
  ])('refuse un document invalide (%#)', input => {
    expect(parseBakeDoc(input).ok).toBe(false)
  })

  it('isBakeOpen', () => {
    expect(isBakeOpen(null)).toBe(false)
    expect(isBakeOpen(req())).toBe(true)
    expect(isBakeOpen(req({ status: 'applied' }))).toBe(true)
    expect(isBakeOpen(req({ status: 'verified' }))).toBe(false)
  })
})

describe('compareRects', () => {
  const t = { x: 10, y: 10, width: 100, height: 40 }
  it('accepte un écart ≤ 1 px', () => {
    expect(compareRects(t, { x: 10.6, y: 9.2, width: 101, height: 40 }).ok).toBe(true)
  })
  it('refuse au-delà, et un élément introuvable', () => {
    expect(compareRects(t, { x: 12, y: 10, width: 100, height: 40 })).toMatchObject({
      ok: false,
      delta: { x: 2 },
    })
    expect(compareRects(t, null)).toEqual({ ok: false, delta: null })
  })
})

describe('messages de figeage', () => {
  it('bake:request, bake:verify, bake:revert, bake:cancel', () => {
    const target = { x: 1, y: 2, width: 3, height: 4 }
    expect(
      parseClientToBridge(wrap({ type: 'bake:request', items: [{ id: 'a', target }] })).ok,
    ).toBe(true)
    expect(
      parseClientToBridge(
        wrap({ type: 'bake:verify', bakeId: 'bk-abcdef', results: [{ id: 'a', actual: null }] }),
      ).ok,
    ).toBe(true)
    expect(parseClientToBridge(wrap({ type: 'bake:revert', bakeId: 'bk-abcdef' })).ok).toBe(true)
    expect(parseClientToBridge(wrap({ type: 'bake:cancel', bakeId: 'bk-abcdef' })).ok).toBe(true)
  })

  it('refuse liste vide, doublon, cible nulle, id de demande invalide', () => {
    const target = { x: 1, y: 2, width: 3, height: 4 }
    expect(parseClientToBridge(wrap({ type: 'bake:request', items: [] })).ok).toBe(false)
    expect(
      parseClientToBridge(
        wrap({
          type: 'bake:request',
          items: [
            { id: 'a', target },
            { id: 'a', target },
          ],
        }),
      ).ok,
    ).toBe(false)
    expect(
      parseClientToBridge(wrap({ type: 'bake:request', items: [{ id: 'a', target: null }] })).ok,
    ).toBe(false)
    expect(parseClientToBridge(wrap({ type: 'bake:revert', bakeId: '../x' })).ok).toBe(false)
  })

  it('bake:state côté concepteur', () => {
    expect(parseBridgeToClient(wrap({ type: 'bake:state', bake: emptyBake() })).ok).toBe(true)
  })
})

describe('corps des routes HTTP', () => {
  it('applied : dédoublonne, refuse les chemins douteux', () => {
    expect(parseBakeAppliedBody({ bakeId: 'bk-abcdef', touchedFiles: ['a.css', 'a.css'] })).toEqual(
      {
        ok: true,
        value: { bakeId: 'bk-abcdef', touchedFiles: ['a.css'] },
      },
    )
    expect(parseBakeAppliedBody({ bakeId: 'bk-abcdef', touchedFiles: ['\u0000'] }).ok).toBe(false)
  })
  it('cancel', () => {
    expect(parseBakeCancelBody({ bakeId: 'bk-abcdef', note: 'interrompu' }).ok).toBe(true)
    expect(parseBakeCancelBody({ bakeId: 'bk-abcdef', note: 'x'.repeat(501) }).ok).toBe(false)
  })
})

describe('consigne pour Claude', () => {
  it('liste éléments, géométrie, cible et règles', () => {
    const text = bakeInstructions(req())
    expect(text).toContain('bk-a1b2c3d4')
    expect(text).toContain('btn-ok : dx 12 px, width 120 px → visé x 40, y 10, 120×32')
    expect(text).toContain('data-dz-id')
    expect(text).toContain('.delphia/')
  })
})
