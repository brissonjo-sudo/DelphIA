/* global process */
// Lance le binaire Claude Code 2.1.308+ (le `claude` du PATH est trop ancien).
// Variable CLAUDE=<chemin> pour le surcharger.
import { spawnSync } from 'node:child_process'

const DEFAULT =
  'C:/Users/Krn/AppData/Local/Claude-Data/claude_pzs8sxrjxfjjc/claude-code/2.1.308/c17a819afb40/claude.exe'
const result = spawnSync(process.env.CLAUDE ?? DEFAULT, process.argv.slice(2), { stdio: 'inherit' })
process.exit(result.status ?? 1)
