/* global process, console */
// Copie packages/protocol/dist (*.js et *.d.ts) dans hooks/vendor/protocol/.
// Un mod installé depuis GitHub ne charge que ses propres fichiers : la copie est committée.
// Usage : npm run build -w @vite-plugin-delphia/protocol && npm run sync-protocol -w @vite-plugin-delphia/mod
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, '..', 'protocol', 'dist')
const dest = join(root, 'hooks', 'vendor', 'protocol')

if (!existsSync(join(src, 'index.js'))) {
  console.error('protocol non buildé : npm run build -w @vite-plugin-delphia/protocol')
  process.exit(1)
}
rmSync(dest, { recursive: true, force: true })
mkdirSync(dest, { recursive: true })
const files = readdirSync(src).filter(f => f.endsWith('.js') || f.endsWith('.d.ts'))
for (const f of files) cpSync(join(src, f), join(dest, f))
console.log(`${files.length} fichiers copiés vers ${dest}`)
