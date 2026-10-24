import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  emptyOverrides,
  OVERRIDES_FILE,
  parseOverrides,
  type OverridesDoc,
} from '@vite-plugin-delphia/protocol'
import type { Warn } from './config-source.js'

export const overridesPath = (root: string): string => join(root, OVERRIDES_FILE)

/**
 * Lit et valide `.delphia/overrides.json`.
 * Absent → document vide en silence ; illisible ou invalide → avertissement + document vide.
 * Ne lève jamais : un fichier cassé ne doit pas casser le serveur de développement.
 */
export async function readOverrides(root: string, warn: Warn): Promise<OverridesDoc> {
  let raw: string
  try {
    raw = await readFile(overridesPath(root), 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      warn(`${OVERRIDES_FILE} illisible : ${(e as Error).message}`)
    }
    return emptyOverrides()
  }
  try {
    const res = parseOverrides(JSON.parse(raw))
    if (res.ok) return res.value
    warn(`${OVERRIDES_FILE} invalide, ignoré : ${res.errors.join(' ; ')}`)
  } catch (e) {
    warn(`${OVERRIDES_FILE} n'est pas du JSON valide, ignoré : ${(e as Error).message}`)
  }
  return emptyOverrides()
}
