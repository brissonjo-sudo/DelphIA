// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { collectElements } from '../src/runtime/elements.js'

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('collectElements', () => {
  it('calcule parentId : plus proche ancêtre valide, sinon null', () => {
    document.body.innerHTML = `
      <div data-dz-id="page">
        <section><div data-dz-id="carte"><span data-dz-id="titre"></span></div></section>
      </div>
      <p data-dz-id="seul"></p>`
    const { elements } = collectElements(document)
    const parent = Object.fromEntries(elements.map(e => [e.id, e.parentId]))
    expect(parent).toEqual({ page: null, carte: 'page', titre: 'carte', seul: null })
    expect(elements.find(e => e.id === 'titre')?.tag).toBe('span')
  })

  it('ignore ids invalides et doublons, en gardant le premier', () => {
    document.body.innerHTML = `
      <div data-dz-id="a"></div>
      <div data-dz-id="a"></div>
      <div data-dz-id="Mauvais"></div>
      <div data-dz-id=""></div>`
    const { elements, byId, warnings } = collectElements(document)
    expect(elements.map(e => e.id)).toEqual(['a'])
    expect(byId.get('a')).toBe(document.querySelector('[data-dz-id="a"]'))
    expect(warnings).toHaveLength(3)
  })

  it('un ancêtre invalide est sauté pour le parentId', () => {
    document.body.innerHTML = `
      <div data-dz-id="racine"><div data-dz-id="Bad"><i data-dz-id="enfant"></i></div></div>`
    const { elements } = collectElements(document)
    expect(elements.find(e => e.id === 'enfant')?.parentId).toBe('racine')
  })
})
