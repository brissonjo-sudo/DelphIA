/* global process, console */
// Type-check du mod. La déclaration `claude-code` est écrite par le moteur : on la cherche
// (CLAUDE_CODE_TYPES, .claude-plugin/types/ du mod, puis le skill plugin-authoring livré avec
// Claude Code). Le tsconfig est généré dans le dossier temporaire, donc HORS du dossier du mod.
// Types introuvables : avertissement et succès (CI sans Claude Code) ; --strict échoue.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const mod = join(dirname(fileURLToPath(import.meta.url)), '..')
const strict = process.argv.includes('--strict')
const slash = p => p.replaceAll('\\', '/')

function bundled() {
  const base = join(tmpdir(), 'claude', 'bundled-skills')
  const out = []
  for (const version of existsSync(base) ? readdirSync(base) : []) {
    for (const hash of readdirSync(join(base, version))) {
      out.push(join(base, version, hash, 'plugin-authoring', 'types', 'claude-code.d.ts'))
    }
  }
  return out.sort().reverse()
}

const types = [
  process.env.CLAUDE_CODE_TYPES,
  join(mod, '.claude-plugin/types/claude-code/index.d.ts'),
  ...bundled(),
].find(p => p && existsSync(p))

if (!types) {
  console.warn('typecheck du mod ignoré : déclaration claude-code introuvable (CLAUDE_CODE_TYPES)')
  process.exit(strict ? 1 : 0)
}

const dir = join(tmpdir(), 'delphia-mod-typecheck')
mkdirSync(dir, { recursive: true })
writeFileSync(
  join(dir, 'tsconfig.json'),
  JSON.stringify({
    compilerOptions: {
      target: 'es2023',
      lib: ['es2023'],
      types: [],
      module: 'esnext',
      moduleResolution: 'bundler',
      strict: true,
      noUncheckedIndexedAccess: true,
      noEmit: true,
      skipLibCheck: true,
      jsx: 'react',
      jsxFactory: 'h',
      jsxFragmentFactory: 'Fragment',
    },
    include: [slash(types), ...['hooks', 'types', 'test-mod'].map(d => slash(join(mod, d)))],
  }),
)
const tsc = join(mod, '..', '..', 'node_modules', 'typescript', 'bin', 'tsc')
console.log(`types : ${types}`)
process.exit(
  spawnSync(process.execPath, [tsc, '-p', join(dir, 'tsconfig.json')], { stdio: 'inherit' })
    .status ?? 1,
)
