import { fail, isRecord, ok, type Result } from './result.js'

/** Contenu de `.delphia/bridge.json`, écrit par le pont à son démarrage. */
export interface BridgeInfo {
  pid: number
  /** Port local du concepteur et du WebSocket (127.0.0.1 uniquement). */
  port: number
  /** Port du serveur Vite de l'app cible, affichée dans le concepteur. */
  appPort: number
  startedAt: string
}

const isPort = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 65_536

export function parseBridgeInfo(input: unknown): Result<BridgeInfo> {
  if (!isRecord(input)) return fail(['objet attendu'])
  const { pid, port, appPort, startedAt } = input
  if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) return fail(['pid'])
  if (!isPort(port)) return fail(['port'])
  if (!isPort(appPort)) return fail(['appPort'])
  if (typeof startedAt !== 'string') return fail(['startedAt'])
  return ok({ pid, port, appPort, startedAt })
}
