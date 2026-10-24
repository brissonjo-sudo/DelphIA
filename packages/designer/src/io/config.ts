import { fail, isRecord, ok, type Result } from '@vite-plugin-delphia/protocol'

export interface DesignerConfig {
  appUrl: string
  port: number
}

/** Valide la réponse de `/api/config` : l'URL de l'app doit être http(s). */
export function parseDesignerConfig(input: unknown): Result<DesignerConfig> {
  if (!isRecord(input)) return fail(['configuration : objet attendu'])
  const { appUrl, port } = input
  if (typeof appUrl !== 'string') return fail(['appUrl : texte attendu'])
  try {
    const u = new URL(appUrl)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return fail(['appUrl : http(s) attendu'])
  } catch {
    return fail(['appUrl : URL invalide'])
  }
  if (typeof port !== 'number' || !Number.isInteger(port)) return fail(['port : entier attendu'])
  return ok({ appUrl, port })
}

export async function loadConfig(): Promise<Result<DesignerConfig>> {
  try {
    const res = await fetch('/api/config', { headers: { accept: 'application/json' } })
    if (!res.ok) return fail([`/api/config : HTTP ${res.status}`])
    return parseDesignerConfig(await res.json())
  } catch {
    return fail(['/api/config injoignable'])
  }
}

/** URL du WebSocket du pont, sur le même hôte que le concepteur. */
export const bridgeSocketUrl = (loc: Pick<Location, 'protocol' | 'host'>): string =>
  `${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.host}/ws`
