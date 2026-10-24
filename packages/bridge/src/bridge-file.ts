import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { BRIDGE_FILE, parseBridgeInfo, type BridgeInfo } from '@vite-plugin-delph-ia/protocol'

/** Écrit `.delphia/bridge.json` (atomique : fichier temporaire puis renommage). */
export async function writeBridgeInfo(project: string, info: BridgeInfo): Promise<void> {
  const file = join(project, BRIDGE_FILE)
  const tmp = `${file}.${process.pid}.tmp`
  await mkdir(dirname(file), { recursive: true })
  await writeFile(tmp, `${JSON.stringify(info, null, 2)}\n`)
  await rename(tmp, file)
}

/** Supprime `bridge.json` seulement s'il décrit ce pont (pid et port), jamais celui d'un autre. */
export async function removeBridgeInfo(project: string, own: BridgeInfo): Promise<void> {
  const file = join(project, BRIDGE_FILE)
  try {
    const parsed = parseBridgeInfo(JSON.parse(await readFile(file, 'utf8')))
    if (parsed.ok && (parsed.value.pid !== own.pid || parsed.value.port !== own.port)) return
  } catch {
    // illisible ou absent : rien de plus sûr à faire que de tenter la suppression
  }
  await rm(file, { force: true })
}
