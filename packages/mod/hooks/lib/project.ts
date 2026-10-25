// Lecture du projet cible : activation, configuration, ajustements, pont.
// Toute erreur d'IO ou de JSON donne un résultat neutre (undefined) et une trace debug.
import type { EngineInterface } from 'claude-code'

import {
  BAKE_FILE,
  BRIDGE_FILE,
  CONFIG_FILE,
  DEFAULT_APP_PORT,
  DEFAULT_BRIDGE_PORT,
  OVERRIDES_FILE,
  parseBakeDoc,
  parseBridgeInfo,
  parseConfig,
  parseOverrides,
} from '../vendor/protocol/index.js'
import type { BakeDoc, BridgeInfo, DelphiaConfig, OverridesDoc } from '../vendor/protocol/index.js'

export type Ctx = EngineInterface

export const join = (root: string, rel: string): string => `${root.replace(/[\\/]+$/, '')}/${rel}`

/**
 * `start` puis ses dossiers parents (au plus `max`), séparateurs normalisés en `/`.
 * Sert à chercher `node_modules` comme Node.js : dans un workspace npm, les dépendances sont
 * installées à la racine du dépôt, pas dans le sous-projet.
 */
export function ancestors(start: string, max = 16): string[] {
  const out: string[] = []
  let dir = start.replaceAll('\\', '/').replace(/\/+$/, '')
  while (dir && out.length < max) {
    out.push(dir)
    const cut = dir.lastIndexOf('/')
    if (cut < 0) break
    dir = dir.slice(0, cut)
  }
  return out
}

function debug($: Ctx, text: string): void {
  $.ui.log(`delphia: ${text}`, { to: 'debug' })
}

async function readJson($: Ctx, path: string): Promise<unknown> {
  try {
    if (!(await $.fs.exists(path))) return undefined
    return JSON.parse(await $.fs.read(path))
  } catch (err) {
    debug($, `lecture de ${path} impossible (${err instanceof Error ? err.message : 'erreur'})`)
    return undefined
  }
}

/** Vrai si le projet de la session est un projet DelphIA (delphia.config.json présent). */
export async function isActive($: Ctx, cwd: string): Promise<boolean> {
  try {
    return await $.fs.exists(join(cwd, CONFIG_FILE))
  } catch {
    return false
  }
}

/** Configuration du projet ; valeurs par défaut si le fichier est invalide. */
export async function readConfig($: Ctx, cwd: string): Promise<DelphiaConfig> {
  const parsed = parseConfig((await readJson($, join(cwd, CONFIG_FILE))) ?? {})
  if (parsed.ok) return parsed.value
  debug($, `${CONFIG_FILE} invalide : ${parsed.errors.join('; ')}`)
  return { port: DEFAULT_BRIDGE_PORT, appPort: DEFAULT_APP_PORT }
}

/** Ajustements du projet ; undefined si le fichier est absent ou invalide. */
export async function readOverrides($: Ctx, cwd: string): Promise<OverridesDoc | undefined> {
  const raw = await readJson($, join(cwd, OVERRIDES_FILE))
  if (raw === undefined) return undefined
  const parsed = parseOverrides(raw)
  if (parsed.ok) return parsed.value
  debug($, `${OVERRIDES_FILE} invalide : ${parsed.errors.join('; ')}`)
  return undefined
}

/** Contenu de bridge.json ; undefined si absent ou invalide. */
export async function readBridgeInfo($: Ctx, cwd: string): Promise<BridgeInfo | undefined> {
  const parsed = parseBridgeInfo(await readJson($, join(cwd, BRIDGE_FILE)))
  return parsed.ok ? parsed.value : undefined
}

/** Contenu de bake.json (demande de figeage) ; undefined si absent ou invalide. */
export async function readBake($: Ctx, cwd: string): Promise<BakeDoc | undefined> {
  const raw = await readJson($, join(cwd, BAKE_FILE))
  if (raw === undefined) return undefined
  const parsed = parseBakeDoc(raw)
  if (parsed.ok) return parsed.value
  debug($, `${BAKE_FILE} invalide : ${parsed.errors.join('; ')}`)
  return undefined
}
