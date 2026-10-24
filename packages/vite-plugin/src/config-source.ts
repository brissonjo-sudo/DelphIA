import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  CONFIG_FILE,
  DEFAULT_APP_PORT,
  DEFAULT_BRIDGE_PORT,
  parseConfig,
  type DelphiaConfig,
} from '@delphia/protocol'

export type Warn = (message: string) => void

const defaults = (): DelphiaConfig => ({ port: DEFAULT_BRIDGE_PORT, appPort: DEFAULT_APP_PORT })

/** Origines du concepteur servi par le pont (loopback uniquement). */
export function defaultDesignerOrigins(port: number): string[] {
  return [`http://127.0.0.1:${port}`, `http://localhost:${port}`]
}

/** Lit `delphia.config.json` ; absent → défauts en silence, invalide → défauts + avertissement. */
export async function readConfig(root: string, warn: Warn): Promise<DelphiaConfig> {
  let raw: string
  try {
    raw = await readFile(join(root, CONFIG_FILE), 'utf8')
  } catch {
    return defaults()
  }
  try {
    const res = parseConfig(JSON.parse(raw))
    if (res.ok) return res.value
    warn(`${CONFIG_FILE} invalide, valeurs par défaut utilisées : ${res.errors.join(' ; ')}`)
  } catch (e) {
    warn(`${CONFIG_FILE} illisible, valeurs par défaut utilisées : ${(e as Error).message}`)
  }
  return defaults()
}

/** `explicit` l'emporte ; sinon dérivé du port du pont. */
export async function resolveDesignerOrigins(
  root: string,
  explicit: string[] | undefined,
  warn: Warn,
): Promise<string[]> {
  if (explicit) return explicit
  return defaultDesignerOrigins((await readConfig(root, warn)).port)
}
