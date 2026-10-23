import { fail, isRecord, ok, type Result } from './result.js'

/** Nom du fichier de configuration, à la racine du projet cible. Sa présence active DelphIA. */
export const CONFIG_FILE = 'delphia.config.json'

export const DEFAULT_BRIDGE_PORT = 4317
/** Port par défaut du serveur Vite d'une app Tauri 2. */
export const DEFAULT_APP_PORT = 1420

/** Contenu de `delphia.config.json`. Tous les champs sont optionnels sur disque. */
export interface DelphiaConfig {
  /** Port local du pont (concepteur + WebSocket). */
  port: number
  /** Port du serveur Vite de l'app cible. */
  appPort: number
}

const isPort = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1024 && v < 65_536

/** Valide la configuration ; les champs absents prennent leur valeur par défaut. */
export function parseConfig(input: unknown): Result<DelphiaConfig> {
  if (!isRecord(input)) return fail(['configuration : objet attendu'])
  const errors: string[] = []
  for (const key of Object.keys(input)) {
    if (key !== 'port' && key !== 'appPort' && key !== '$schema') {
      errors.push(`${key} : clé inconnue`)
    }
  }
  const port = input.port ?? DEFAULT_BRIDGE_PORT
  const appPort = input.appPort ?? DEFAULT_APP_PORT
  if (!isPort(port)) errors.push('port : entier entre 1024 et 65535 attendu')
  if (!isPort(appPort)) errors.push('appPort : entier entre 1024 et 65535 attendu')
  if (port === appPort) errors.push('port et appPort doivent différer')
  return errors.length ? fail(errors) : ok({ port: port as number, appPort: appPort as number })
}
