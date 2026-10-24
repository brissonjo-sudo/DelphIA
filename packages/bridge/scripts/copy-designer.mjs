/* global process, console, URL */
// Embarque le concepteur buildé dans le paquet du pont : packages/designer/dist → dist/designer.
// Échoue s'il manque, pour qu'un paquet publié ne parte jamais sans son interface.
import { cpSync, existsSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = fileURLToPath(new URL('../../designer/dist', import.meta.url))
const target = fileURLToPath(new URL('../dist/designer', import.meta.url))

if (!existsSync(`${source}/index.html`)) {
  console.error(
    `Concepteur non buildé (${source}) : lancez d'abord npm run build -w @vite-plugin-delphia/designer`,
  )
  process.exit(1)
}
rmSync(target, { recursive: true, force: true })
cpSync(source, target, { recursive: true })
console.log(`Concepteur copié dans ${target}`)
