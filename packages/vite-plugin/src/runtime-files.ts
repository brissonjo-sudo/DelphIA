import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/** Dossier du runtime navigateur : `dist/runtime` une fois compilé, `src/runtime` sous Vitest. */
export const runtimeDir = join(here, 'runtime')

export function runtimeEntry(): string {
  const js = join(runtimeDir, 'index.js')
  return existsSync(js) ? js : join(runtimeDir, 'index.ts')
}

/** Point d'entrée de `@vite-plugin-delphia/protocol`, résolu depuis ce paquet. */
export const protocolEntry = (): string =>
  createRequire(import.meta.url).resolve('@vite-plugin-delphia/protocol')

export const toPosix = (p: string): string => p.replaceAll('\\', '/')

const norm = (p: string): string =>
  process.platform === 'win32' ? toPosix(p).toLowerCase() : toPosix(p)

export const samePath = (a: string, b: string): boolean => norm(a) === norm(b)

/** Vrai si `file` (éventuellement suffixé d'une requête `?v=…`) est dans `dir`. */
export const isInside = (dir: string, file: string): boolean =>
  norm(file.split('?')[0] ?? '').startsWith(norm(dir) + '/')
