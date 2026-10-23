import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultDesignerOrigins, readConfig, resolveDesignerOrigins } from '../src/config-source.js'
import { readOverrides } from '../src/overrides-source.js'
import { RUNTIME_URL, runtimeModuleCode, styleTag } from '../src/virtual.js'

let root: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'delphia-src-'))
})
afterEach(() => rm(root, { recursive: true, force: true }))

const writeOverrides = async (content: string): Promise<void> => {
  await mkdir(join(root, '.delphia'), { recursive: true })
  await writeFile(join(root, '.delphia', 'overrides.json'), content)
}

describe('readOverrides', () => {
  it('fichier absent : document vide, sans avertissement', async () => {
    const warn = vi.fn()
    const doc = await readOverrides(root, warn)
    expect(doc.elements).toEqual({})
    expect(warn).not.toHaveBeenCalled()
  })

  it('JSON cassé : avertit et renvoie un document vide', async () => {
    await writeOverrides('{ pas du json')
    const warn = vi.fn()
    expect((await readOverrides(root, warn)).elements).toEqual({})
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('structure invalide : avertit et renvoie un document vide', async () => {
    await writeOverrides(JSON.stringify({ version: 9, revision: 1, elements: {} }))
    const warn = vi.fn()
    expect((await readOverrides(root, warn)).elements).toEqual({})
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('fichier valide : document renvoyé', async () => {
    const doc = {
      version: 1,
      revision: 3,
      elements: { titre: { dx: 4, width: 120, updatedAt: '2026-10-24T10:00:00Z' } },
    }
    await writeOverrides(JSON.stringify(doc))
    const warn = vi.fn()
    expect(await readOverrides(root, warn)).toEqual(doc)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('configuration et origines', () => {
  it('origines par défaut dérivées du port', () => {
    expect(defaultDesignerOrigins(5000)).toEqual(['http://127.0.0.1:5000', 'http://localhost:5000'])
  })

  it('config absente : port 4317', async () => {
    const origins = await resolveDesignerOrigins(root, undefined, vi.fn())
    expect(origins).toEqual(defaultDesignerOrigins(4317))
  })

  it('config présente : port lu', async () => {
    await writeFile(join(root, 'delphia.config.json'), JSON.stringify({ port: 4999 }))
    expect(await resolveDesignerOrigins(root, undefined, vi.fn())).toEqual(
      defaultDesignerOrigins(4999),
    )
  })

  it('config invalide : défauts + avertissement', async () => {
    await writeFile(join(root, 'delphia.config.json'), JSON.stringify({ port: 80 }))
    const warn = vi.fn()
    expect((await readConfig(root, warn)).port).toBe(4317)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('option explicite prioritaire', async () => {
    expect(await resolveDesignerOrigins(root, ['https://x.test'], vi.fn())).toEqual([
      'https://x.test',
    ])
  })
})

describe('code généré', () => {
  it('module virtuel : import du runtime et origines sérialisées', () => {
    const code = runtimeModuleCode('C:\\a b\\runtime\\index.js', ['http://localhost:4317'])
    expect(code).toContain('"C:/a b/runtime/index.js"')
    expect(code).toContain('["http://localhost:4317"]')
    expect(code).toContain('hot: import.meta.hot')
  })

  it('balise de style en fin de head, URL du runtime encodée', () => {
    expect(styleTag('a{}')).toMatchObject({ tag: 'style', children: 'a{}', injectTo: 'head' })
    expect(RUNTIME_URL).toBe('/@id/__x00__virtual:delphia/runtime')
  })
})
