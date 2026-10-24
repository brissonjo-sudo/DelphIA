import { describe, expect, it } from 'vitest'
import { computeDrag } from '../src/core/drag.js'
import { findGuides, snapAxis, snapToGrid } from '../src/core/snap.js'

const R = { x: 100, y: 100, width: 100, height: 40 }
const base = { mode: 'move' as const, startRect: R, startGeometry: {}, snap: true, grid: false }

describe('snapAxis / snapToGrid', () => {
  it('retient la plus petite correction dans le seuil', () => {
    expect(snapAxis([100], [103, 96])).toBe(3)
    expect(snapAxis([100], [102, 96])).toBe(2)
  })

  it('aucune correction hors seuil', () => {
    expect(snapAxis([100], [106])).toBeNull()
    expect(snapAxis([100], [105])).toBe(5)
  })

  it('grille de 8 px', () => {
    expect(snapToGrid(13)).toBe(16)
    expect(snapToGrid(11)).toBe(8)
    expect(snapToGrid(-5)).toBe(-8)
  })
})

describe('computeDrag : accrochage', () => {
  const other = { x: 300, y: 300, width: 60, height: 60 }

  it('accroche le bord droit sur le bord gauche d’un autre élément', () => {
    const r = computeDrag({ ...base, targets: [other], dx: 98, dy: 0 })
    expect(r.rect.x).toBe(200)
    expect(r.patch).toEqual({ dx: 100, dy: 0 })
    expect(r.guides.some(g => g.axis === 'x' && g.pos === 300)).toBe(true)
  })

  it('accroche le centre sur un centre', () => {
    const r = computeDrag({ ...base, targets: [other], dx: 178, dy: 0 })
    expect(r.rect.x + r.rect.width / 2).toBe(330)
    expect(r.guides.some(g => g.axis === 'x' && g.pos === 330)).toBe(true)
  })

  it('aucun repère ni correction hors seuil', () => {
    const r = computeDrag({ ...base, targets: [other], dx: 80, dy: 10 })
    expect(r.rect.x).toBe(180)
    expect(r.rect.y).toBe(110)
    expect(r.guides).toEqual([])
  })

  it('accrochage désactivé : pas de correction ni de repère', () => {
    const r = computeDrag({ ...base, targets: [other], snap: false, dx: 98, dy: 0 })
    expect(r.rect.x).toBe(198)
    expect(r.guides).toEqual([])
  })

  it('l’accrochage l’emporte sur la grille, la grille s’applique sinon', () => {
    const grid = computeDrag({ ...base, targets: [], snap: false, grid: true, dx: 5, dy: 3 })
    expect([grid.rect.x, grid.rect.y]).toEqual([104, 104])
    const both = computeDrag({ ...base, targets: [other], grid: true, dx: 98, dy: 3 })
    expect(both.rect.x).toBe(200) // aimant (bord droit sur 300), pas la grille (200 est aussi un multiple de 8)
    expect(both.rect.y).toBe(104) // pas de repère en y : grille
  })

  it('redimensionnement : accroche seulement le bord mobile', () => {
    const r = computeDrag({ ...base, mode: 'e', targets: [other], dx: 98, dy: 50 })
    expect(r.rect).toEqual({ x: 100, y: 100, width: 200, height: 40 })
    expect(r.patch).toEqual({ width: 200 })
    expect(r.changed).toBe(true)
  })

  it('changed est faux quand on revient au point de départ', () => {
    const r = computeDrag({ ...base, targets: [], snap: false, dx: 0, dy: 0 })
    expect(r.changed).toBe(false)
  })

  it('géométrie d’aperçu complète : conserve la taille déjà ajustée', () => {
    const r = computeDrag({
      ...base,
      targets: [],
      snap: false,
      startGeometry: { dx: 10, dy: 0, width: 120 },
      dx: 5,
      dy: 5,
    })
    expect(r.geometry).toEqual({ dx: 15, dy: 5, width: 120 })
  })
})

describe('findGuides', () => {
  it('fusionne les repères de même position', () => {
    const a = { x: 0, y: 0, width: 50, height: 10 }
    const b = { x: 0, y: 100, width: 80, height: 10 }
    const g = findGuides({ x: 0, y: 40, width: 50, height: 10 }, [a, b])
    const left = g.filter(x => x.axis === 'x' && x.pos === 0)
    expect(left).toHaveLength(1)
    expect(left[0]).toMatchObject({ from: 0, to: 110 })
  })

  it('vide quand rien n’est aligné', () => {
    expect(findGuides(R, [{ x: 500, y: 500, width: 7, height: 9 }])).toEqual([])
  })
})
