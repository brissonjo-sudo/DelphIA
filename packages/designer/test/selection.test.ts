import { describe, expect, it } from 'vitest'
import {
  primaryOf,
  pruneSelection,
  singleSelection,
  toggleSelection,
} from '../src/core/selection.js'

describe('sélection multiple', () => {
  it('Maj+clic ajoute puis retire ; le principal est le dernier', () => {
    let ids = singleSelection('a')
    ids = toggleSelection(ids, 'b')
    expect(ids).toEqual(['a', 'b'])
    expect(primaryOf(ids)).toBe('b')
    ids = toggleSelection(ids, 'b')
    expect(primaryOf(ids)).toBe('a')
    expect(primaryOf(toggleSelection(ids, 'a'))).toBeNull()
  })
  it('retire les ids disparus', () => {
    expect(pruneSelection(['a', 'b'], ['b'])).toEqual(['b'])
    expect(singleSelection(null)).toEqual([])
  })
})
