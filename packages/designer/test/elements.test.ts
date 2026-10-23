import type { ElementInfo } from '@delphia/protocol'
import { describe, expect, it } from 'vitest'
import { descendantsOf, findOrphans, hitTest, snapTargets } from '../src/core/elements.js'
import { parseField } from '../src/core/fields.js'
import { keyStep } from '../src/core/keyboard.js'

const el = (id: string, parentId: string | null, x: number, y: number, w: number, h: number) =>
  ({ id, tag: 'div', parentId, rect: { x, y, width: w, height: h } }) satisfies ElementInfo

const tree = [
  el('page', null, 0, 0, 800, 600),
  el('carte', 'page', 50, 50, 300, 200),
  el('bouton', 'carte', 60, 60, 80, 30),
  el('autre', 'page', 400, 50, 100, 100),
]

describe('hitTest', () => {
  it('choisit le plus petit rectangle contenant le point', () => {
    expect(hitTest(tree, 70, 70)?.id).toBe('bouton')
    expect(hitTest(tree, 200, 200)?.id).toBe('carte')
    expect(hitTest(tree, 700, 500)?.id).toBe('page')
  })

  it('bords inclus, null hors de tout', () => {
    expect(hitTest(tree, 60, 60)?.id).toBe('bouton')
    expect(hitTest(tree, 140, 90)?.id).toBe('bouton')
    expect(hitTest(tree, 900, 10)).toBeNull()
  })

  it('à aire égale, le dernier (plus profond) l’emporte', () => {
    const same = [el('a', null, 0, 0, 10, 10), el('b', 'a', 0, 0, 10, 10)]
    expect(hitTest(same, 5, 5)?.id).toBe('b')
  })

  it('ignore les éléments sans surface', () => {
    expect(hitTest([el('vide', null, 0, 0, 0, 0)], 0, 0)).toBeNull()
  })
})

describe('arbre', () => {
  it('descendantsOf est transitif', () => {
    expect([...descendantsOf(tree, 'page')].sort()).toEqual(['autre', 'bouton', 'carte'])
    expect([...descendantsOf(tree, 'carte')]).toEqual(['bouton'])
    expect(descendantsOf(tree, 'bouton').size).toBe(0)
  })

  it('snapTargets exclut l’élément et ses descendants, garde le parent', () => {
    const t = snapTargets(tree, 'carte')
    expect(t).toHaveLength(2)
    expect(t).toContainEqual(tree[0]?.rect)
    expect(t).not.toContainEqual(tree[2]?.rect)
  })

  it('findOrphans', () => {
    expect(findOrphans(['carte', 'zombie', 'ancien'], ['carte', 'page'])).toEqual([
      'ancien',
      'zombie',
    ])
    expect(findOrphans([], ['a'])).toEqual([])
  })
})

describe('keyStep', () => {
  it('±1 px, ±10 px avec Maj', () => {
    expect(keyStep('ArrowLeft', false)).toEqual({ dx: -1, dy: 0 })
    expect(keyStep('ArrowDown', true)).toEqual({ dx: 0, dy: 10 })
    expect(keyStep('a', false)).toBeNull()
    expect(keyStep('constructor', false)).toBeNull()
  })
})

describe('parseField', () => {
  it('accepte des entiers, vide = retirer', () => {
    expect(parseField('dx', ' -12 ')).toEqual({ ok: true, value: -12 })
    expect(parseField('width', '')).toEqual({ ok: true, value: null })
  })

  it('refuse décimaux, texte, hors bornes, taille nulle', () => {
    expect(parseField('dx', '1.5').ok).toBe(false)
    expect(parseField('dy', 'abc').ok).toBe(false)
    expect(parseField('dx', '10001').ok).toBe(false)
    expect(parseField('width', '0').ok).toBe(false)
    expect(parseField('height', '-3').ok).toBe(false)
  })
})
