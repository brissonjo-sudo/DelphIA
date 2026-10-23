import { describe, expect, it } from 'vitest'
import {
  geometryPatch,
  handlePoint,
  mergeGeometry,
  moveRect,
  pickGeometry,
  resizeRect,
} from '../src/core/geometry.js'

const R = { x: 100, y: 50, width: 200, height: 80 }

describe('moveRect / geometryPatch (déplacement)', () => {
  it('déplace le rectangle', () => {
    expect(moveRect(R, 7, -3)).toEqual({ x: 107, y: 47, width: 200, height: 80 })
  })

  it('nouveau dx = ancien dx + delta (le rectangle mesuré inclut déjà le translate)', () => {
    const next = moveRect(R, 7, -3)
    expect(geometryPatch('move', R, { dx: 20, dy: 5 }, next)).toEqual({ dx: 27, dy: 2 })
  })

  it('part de 0 quand aucun ajustement', () => {
    expect(geometryPatch('move', R, {}, moveRect(R, 4, 4))).toEqual({ dx: 4, dy: 4 })
  })
})

describe('resizeRect', () => {
  it('poignée sud-est : agrandit sans bouger l’origine', () => {
    expect(resizeRect(R, 'se', 10, 20)).toEqual({ x: 100, y: 50, width: 210, height: 100 })
  })

  it('poignée est seule : ignore dy', () => {
    expect(resizeRect(R, 'e', 10, 99)).toEqual({ x: 100, y: 50, width: 210, height: 80 })
  })

  it('poignée nord-ouest : l’origine suit, le coin opposé reste fixe', () => {
    const out = resizeRect(R, 'nw', -10, -5)
    expect(out).toEqual({ x: 90, y: 45, width: 210, height: 85 })
    expect([out.x + out.width, out.y + out.height]).toEqual([300, 130])
  })

  it('poignée nord-ouest qui dépasse le coin opposé : le rectangle s’inverse', () => {
    const out = resizeRect(R, 'nw', 250, 100)
    expect(out).toEqual({ x: 300, y: 130, width: 50, height: 20 })
  })

  it('poignée est qui passe à gauche du bord fixe : inversion', () => {
    expect(resizeRect(R, 'e', -250, 0)).toEqual({ x: 50, y: 50, width: 50, height: 80 })
  })

  it('taille minimale 1 px, côté d’origine conservé', () => {
    expect(resizeRect(R, 'e', -200, 0)).toEqual({ x: 100, y: 50, width: 1, height: 80 })
    expect(resizeRect(R, 'w', 200, 0)).toEqual({ x: 299, y: 50, width: 1, height: 80 })
    expect(resizeRect(R, 'n', 0, 80).height).toBe(1)
  })
})

describe('geometryPatch (redimensionnement)', () => {
  it('poignée est : seule la largeur change', () => {
    const next = resizeRect(R, 'e', 10, 0)
    expect(geometryPatch('e', R, { dx: 5 }, next)).toEqual({ width: 210 })
  })

  it('poignée ouest : la largeur ET dx changent (dx cumulé)', () => {
    const next = resizeRect(R, 'w', -10, 0)
    expect(geometryPatch('w', R, { dx: 5 }, next)).toEqual({ width: 210, dx: -5 })
  })

  it('poignée nord-ouest : quatre clés', () => {
    const next = resizeRect(R, 'nw', -10, -5)
    expect(geometryPatch('nw', R, {}, next)).toEqual({ width: 210, height: 85, dx: -10, dy: -5 })
  })

  it('arrondit les rectangles fractionnaires', () => {
    const frac = { x: 10.4, y: 10.4, width: 100.6, height: 20.2 }
    expect(geometryPatch('se', frac, {}, resizeRect(frac, 'se', 1, 1))).toEqual({
      width: 102,
      height: 21,
    })
  })
})

describe('utilitaires', () => {
  it('mergeGeometry renvoie la géométrie complète', () => {
    expect(mergeGeometry({ dx: 1, width: 50 }, { dx: 9, height: 7 })).toEqual({
      dx: 9,
      width: 50,
      height: 7,
    })
  })

  it('pickGeometry écarte updatedAt', () => {
    expect(pickGeometry({ dx: 1, updatedAt: 'x' } as never)).toEqual({ dx: 1 })
    expect(pickGeometry(undefined)).toEqual({})
  })

  it('handlePoint', () => {
    expect(handlePoint(R, 'nw')).toEqual({ x: 100, y: 50 })
    expect(handlePoint(R, 's')).toEqual({ x: 200, y: 130 })
    expect(handlePoint(R, 'e')).toEqual({ x: 300, y: 90 })
  })
})
