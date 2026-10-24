import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const dist = join(here, '..', '..', 'protocol', 'dist')
const vendor = join(here, '..', 'hooks', 'vendor', 'protocol')
const wanted = (dir: string): string[] =>
  readdirSync(dir)
    .filter(f => f.endsWith('.js') || f.endsWith('.d.ts'))
    .sort()

describe('copie embarquée du protocole', () => {
  it('protocol est buildé', () => {
    expect(existsSync(dist), 'npm run build -w @vite-plugin-delph-ia/protocol').toBe(true)
  })

  it('hooks/vendor/protocol est identique à packages/protocol/dist', () => {
    const hint =
      'copie périmée : npm run build -w @vite-plugin-delph-ia/protocol && npm run sync-protocol -w @vite-plugin-delph-ia/mod'
    expect(wanted(vendor), hint).toEqual(wanted(dist))
    for (const file of wanted(dist)) {
      expect(readFileSync(join(vendor, file), 'utf8'), `${file} : ${hint}`).toBe(
        readFileSync(join(dist, file), 'utf8'),
      )
    }
  })
})
