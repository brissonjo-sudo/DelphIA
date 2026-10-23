// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { previewById } from '../src/runtime/preview.js'

let el: HTMLElement
beforeEach(() => {
  document.body.innerHTML = '<div data-dz-id="b" style="width: 10px"></div>'
  el = document.querySelector<HTMLElement>('[data-dz-id="b"]')!
})

describe('aperçu', () => {
  it('applique translate, taille et box-sizing en !important', () => {
    previewById(document, 'b', { dx: 5, dy: -3, width: 100, height: 40 })
    expect(el.style.getPropertyValue('translate')).toBe('5px -3px')
    expect(el.style.getPropertyPriority('translate')).toBe('important')
    expect(el.style.getPropertyValue('width')).toBe('100px')
    expect(el.style.getPropertyValue('height')).toBe('40px')
    expect(el.style.getPropertyValue('box-sizing')).toBe('border-box')
  })

  it('géométrie sans taille : pas de box-sizing ; dx seul : dy à 0', () => {
    previewById(document, 'b', { dx: 7 })
    expect(el.style.getPropertyValue('translate')).toBe('7px 0px')
    expect(el.style.getPropertyValue('box-sizing')).toBe('')
  })

  it('un nouvel aperçu remplace le précédent (géométrie complète)', () => {
    previewById(document, 'b', { dx: 1, dy: 1, height: 20 })
    previewById(document, 'b', { dx: 2, dy: 2 })
    expect(el.style.getPropertyValue('height')).toBe('')
    expect(el.style.getPropertyValue('translate')).toBe('2px 2px')
  })

  it('geometry null retire tout et restaure le style inline initial', () => {
    previewById(document, 'b', { dx: 5, dy: 5, width: 100 })
    previewById(document, 'b', null)
    expect(el.style.getPropertyValue('translate')).toBe('')
    expect(el.style.getPropertyValue('box-sizing')).toBe('')
    expect(el.style.getPropertyValue('width')).toBe('10px')
    expect(el.style.getPropertyPriority('width')).toBe('')
  })

  it('id introuvable : sans effet', () => {
    expect(() => previewById(document, 'absent', { dx: 1 })).not.toThrow()
  })
})
