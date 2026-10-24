import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { CONFIG_FILE, parseConfig, type DelphiaConfig } from '@vite-plugin-delphia/protocol'

/** Lit `delphia.config.json` du projet ; absent → valeurs par défaut ; invalide → erreur lisible. */
export async function readConfig(project: string): Promise<DelphiaConfig> {
  let raw: unknown = {}
  try {
    raw = JSON.parse(await readFile(join(project, CONFIG_FILE), 'utf8'))
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new Error(`${CONFIG_FILE} illisible : ${(e as Error).message}`, { cause: e })
    }
  }
  const parsed = parseConfig(raw)
  if (!parsed.ok) throw new Error(`${CONFIG_FILE} invalide : ${parsed.errors.join(' ; ')}`)
  return parsed.value
}
