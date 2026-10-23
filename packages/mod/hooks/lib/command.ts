// Commande /delphia : état du pont et éléments épinglés.
import { readBridgeState } from './bridge.js'
import { readOverrides } from './project.js'
import type { Ctx } from './project.js'

const SHOWN = 10

export async function delphiaReport($: Ctx, cwd: string): Promise<string> {
  const bridge = await readBridgeState($)
  const doc = await readOverrides($, cwd)
  const ids = Object.keys(doc?.elements ?? {}).sort()
  const lines = [
    bridge.url
      ? `Pont : actif — concepteur ${bridge.url}`
      : `Pont : arrêté${bridge.detail ? ` (${bridge.detail})` : ''}`,
    `Éléments épinglés : ${ids.length}${doc ? ` (révision ${doc.revision})` : ' (aucun overrides.json valide)'}`,
  ]
  lines.push(...ids.slice(0, SHOWN).map(id => `- ${id}`))
  if (ids.length > SHOWN) lines.push(`- … et ${ids.length - SHOWN} autre(s)`)
  return lines.join('\n')
}
