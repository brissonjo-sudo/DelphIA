import { describe, expect, it } from 'vitest'

import {
  emptyOverrides,
  parseBridgeInfo,
  parseBridgeToClient,
  parseClientToBridge,
  parseDesignerToRuntime,
  parseRuntimeToDesigner,
  wrap,
} from '../src/index.js'

describe('enveloppe', () => {
  it('ignore les messages étrangers', () => {
    expect(parseRuntimeToDesigner({ type: 'runtime:hello', url: 'x' }).ok).toBe(false)
    expect(parseRuntimeToDesigner('hello').ok).toBe(false)
    expect(parseRuntimeToDesigner(wrap({ type: 'autre' })).ok).toBe(false)
  })
})

describe('runtime → concepteur', () => {
  it('accepte une liste d’éléments mesurés', () => {
    const r = parseRuntimeToDesigner(
      wrap({
        type: 'runtime:elements',
        viewport: { width: 800, height: 600 },
        elements: [
          { id: 'root', tag: 'div', parentId: null, rect: { x: 0, y: 0, width: 800, height: 600 } },
        ],
      }),
    )
    expect(r.ok).toBe(true)
  })

  it('refuse un élément au rectangle non fini', () => {
    const r = parseRuntimeToDesigner(
      wrap({
        type: 'runtime:elements',
        viewport: { width: 800, height: 600 },
        elements: [
          { id: 'root', tag: 'div', parentId: null, rect: { x: NaN, y: 0, width: 1, height: 1 } },
        ],
      }),
    )
    expect(r.ok).toBe(false)
  })
})

describe('concepteur → runtime', () => {
  it('aperçu et retrait d’aperçu', () => {
    expect(
      parseDesignerToRuntime(wrap({ type: 'designer:preview', id: 'a', geometry: { dx: 1 } })).ok,
    ).toBe(true)
    expect(
      parseDesignerToRuntime(wrap({ type: 'designer:preview', id: 'a', geometry: null })).ok,
    ).toBe(true)
    expect(
      parseDesignerToRuntime(wrap({ type: 'designer:preview', id: 'a', geometry: { dx: 0.5 } })).ok,
    ).toBe(false)
  })
})

describe('concepteur ⇄ pont', () => {
  it('patch avec suppression de clé', () => {
    const r = parseClientToBridge(
      wrap({ type: 'override:set', id: 'a', patch: { dx: 3, width: null } }),
    )
    expect(r).toEqual({
      ok: true,
      value: { type: 'override:set', id: 'a', patch: { dx: 3, width: null } },
    })
  })

  it('refuse une clé inconnue, même à null', () => {
    expect(
      parseClientToBridge(wrap({ type: 'override:set', id: 'a', patch: { color: null } })).ok,
    ).toBe(false)
  })

  it('état du pont', () => {
    expect(parseBridgeToClient(wrap({ type: 'overrides:state', doc: emptyOverrides() })).ok).toBe(
      true,
    )
    expect(
      parseBridgeToClient(wrap({ type: 'bridge:error', message: 'x'.repeat(900) })),
    ).toMatchObject({
      ok: true,
      value: { message: 'x'.repeat(500) },
    })
  })
})

describe('bridge.json', () => {
  it('valide les ports', () => {
    const base = { pid: 42, port: 4317, appPort: 1420, startedAt: '2026-10-24T12:00:00.000Z' }
    expect(parseBridgeInfo(base).ok).toBe(true)
    expect(parseBridgeInfo({ ...base, port: 70_000 }).ok).toBe(false)
  })
})
