import { describe, expect, it } from 'vitest'

import {
  applyPatch,
  diffOverrides,
  dzSelector,
  emptyOverrides,
  isDzId,
  isProtectedPath,
  MAX_PX,
  overridesToCss,
  parseOverrides,
  summarizeForPrompt,
} from '../src/index.js'

const NOW = new Date('2026-10-24T12:00:00.000Z')

describe('identifiants', () => {
  it('accepte les ids simples', () => {
    expect(isDzId('header-title')).toBe(true)
    expect(isDzId('btn2')).toBe(true)
  })

  it.each(['', 'Header', '1abc', 'a"]{}', 'a b', '__proto__', 'a'.repeat(65), 'é'])(
    'refuse %j',
    id => expect(isDzId(id)).toBe(false),
  )

  it('dzSelector refuse une injection CSS', () => {
    expect(() => dzSelector('x"] body { display:none } [x="')).toThrow()
    expect(dzSelector('ok-id')).toBe('[data-dz-id="ok-id"]')
  })
})

describe('chemins protégés', () => {
  it.each([
    '.delphia/overrides.json',
    'C:\\proj\\.delphia\\overrides.json',
    '/home/x/proj/.DELPHIA/bridge.json',
  ])('protège %s', p => expect(isProtectedPath(p)).toBe(true))

  it.each(['src/main.ts', 'docs/delphia.md', '.delphiarc'])('laisse %s', p =>
    expect(isProtectedPath(p)).toBe(false),
  )
})

describe('applyPatch', () => {
  it('ajoute, fusionne, incrémente la révision', () => {
    const a = applyPatch(emptyOverrides(), 'title', { dx: 10.4, dy: -3.6 }, NOW)
    expect(a.revision).toBe(1)
    expect(a.elements.title).toEqual({ dx: 10, dy: -4, updatedAt: NOW.toISOString() })
    const b = applyPatch(a, 'title', { width: 200 }, NOW)
    expect(b.elements.title).toMatchObject({ dx: 10, dy: -4, width: 200 })
  })

  it("ne modifie pas l'original", () => {
    const a = emptyOverrides()
    applyPatch(a, 'title', { dx: 1 }, NOW)
    expect(a.elements).toEqual({})
  })

  it('retire une clé à null, puis l’élément vide', () => {
    const a = applyPatch(emptyOverrides(), 'box', { dx: 5, width: 50 }, NOW)
    const b = applyPatch(a, 'box', { dx: null }, NOW)
    expect(b.elements.box).toMatchObject({ width: 50 })
    expect(b.elements.box?.dx).toBeUndefined()
    const c = applyPatch(b, 'box', { width: null }, NOW)
    expect(c.elements.box).toBeUndefined()
  })

  it('borne les valeurs extrêmes', () => {
    const a = applyPatch(emptyOverrides(), 'box', { dx: 1e9, width: -50 }, NOW)
    expect(a.elements.box).toMatchObject({ dx: MAX_PX, width: 0 })
  })

  it('refuse un id invalide', () => {
    expect(() => applyPatch(emptyOverrides(), 'Bad Id', { dx: 1 }, NOW)).toThrow()
  })
})

describe('parseOverrides', () => {
  it('relit ce que applyPatch produit', () => {
    const doc = applyPatch(emptyOverrides(), 'title', { dx: 3, height: 40 }, NOW)
    const parsed = parseOverrides(JSON.parse(JSON.stringify(doc)))
    expect(parsed).toEqual({ ok: true, value: doc })
  })

  it.each([
    [{ version: 2, revision: 0, elements: {} }, 'version'],
    [{ version: 1, revision: -1, elements: {} }, 'revision'],
    [
      { version: 1, revision: 0, elements: { 'a"b': { dx: 1, updatedAt: NOW.toISOString() } } },
      'identifiant',
    ],
    [
      { version: 1, revision: 0, elements: { a: { dx: 1.5, updatedAt: NOW.toISOString() } } },
      'entier',
    ],
    [
      {
        version: 1,
        revision: 0,
        elements: { a: { dx: 1, evil: 1, updatedAt: NOW.toISOString() } },
      },
      'inconnue',
    ],
    [{ version: 1, revision: 0, elements: { a: { updatedAt: NOW.toISOString() } } }, 'aucun'],
    [{ version: 1, revision: 0, elements: { a: { dx: 1, updatedAt: 'hier' } } }, 'date'],
  ])('refuse un document invalide (%#)', (input, fragment) => {
    const r = parseOverrides(input)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.join(' ')).toContain(fragment)
  })
})

describe('overridesToCss', () => {
  it('produit un CSS déterministe et prioritaire', () => {
    let doc = applyPatch(emptyOverrides(), 'zeta', { width: 120 }, NOW)
    doc = applyPatch(doc, 'alpha', { dx: 4 }, NOW)
    const css = overridesToCss(doc)
    expect(css.indexOf('alpha')).toBeLessThan(css.indexOf('zeta'))
    expect(css).toContain('[data-dz-id="alpha"] {\n  translate: 4px 0px !important;\n}')
    expect(css).toContain('box-sizing: border-box !important;')
    expect(css).toContain('width: 120px !important;')
  })
})

describe('diff et résumé', () => {
  it('détecte ajouts, changements, retraits', () => {
    const a = applyPatch(applyPatch(emptyOverrides(), 'a', { dx: 1 }, NOW), 'b', { dx: 1 }, NOW)
    const b = applyPatch(applyPatch(a, 'a', { dx: 2 }, NOW), 'b', null, NOW)
    const c = applyPatch(b, 'c', { width: 9 }, NOW)
    expect(diffOverrides(a, c)).toEqual({ added: ['c'], changed: ['a'], removed: ['b'] })
  })

  it('résume pour le prompt, vide sans ajustement', () => {
    expect(summarizeForPrompt(emptyOverrides())).toBe('')
    const doc = applyPatch(emptyOverrides(), 'title', { dx: 2, dy: 3, width: 100 }, NOW)
    const text = summarizeForPrompt(doc)
    expect(text).toContain('title : décalé de (2, 3) px, largeur 100 px')
    expect(text).toContain('.delphia/overrides.json')
  })
})
