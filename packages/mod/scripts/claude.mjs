/* global process */
// Lance un binaire Claude Code assez récent pour les mods (moteur 2.1.308+).
// Ordre : variable CLAUDE=<chemin> ; sous Windows, la version la plus récente installée par
// l'app desktop (%LOCALAPPDATA%/Claude-Data/*/claude-code/<version>/*/claude.exe) ;
// sinon `claude` du PATH.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const subdirs = dir => {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
  } catch {
    return []
  }
}

const compareVersions = (a, b) => {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

function desktopClaude() {
  const local = process.env.LOCALAPPDATA
  if (process.platform !== 'win32' || !local) return undefined
  const root = join(local, 'Claude-Data')
  const found = []
  for (const install of subdirs(root)) {
    const versionsDir = join(root, install, 'claude-code')
    for (const version of subdirs(versionsDir).filter(v => /^\d+(\.\d+)*$/.test(v))) {
      for (const build of subdirs(join(versionsDir, version))) {
        const exe = join(versionsDir, version, build, 'claude.exe')
        if (existsSync(exe)) found.push({ version, exe })
      }
    }
  }
  found.sort((a, b) => compareVersions(b.version, a.version))
  return found[0]?.exe
}

const bin = process.env.CLAUDE ?? desktopClaude() ?? 'claude'
const result = spawnSync(bin, process.argv.slice(2), { stdio: 'inherit' })
if (result.error) console.error(`Impossible de lancer ${bin} : ${result.error.message}`)
process.exit(result.status ?? 1)
