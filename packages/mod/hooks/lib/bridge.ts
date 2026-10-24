// Lancement et suivi du serveur pont (processus Node autonome, ADR 0002).
import { join, readBridgeInfo, readConfig } from './project.js'
import type { Ctx } from './project.js'

export type BridgeState = {
  status: 'starting' | 'running' | 'external' | 'stopped' | 'failed'
  url: string | null
  detail: string | null
}

const BRIDGE = { plugin: 'delphia', key: 'bridge' } as const
const LISTENING = /DelphIA bridge listening on (http:\/\/127\.0\.0\.1:\d+\/)/

const STATUS_TEXT: Record<BridgeState['status'], (s: BridgeState) => string> = {
  starting: () => 'DelphIA : démarrage du pont…',
  running: s => `DelphIA : concepteur ${s.url}`,
  external: s => `DelphIA : concepteur ${s.url} (pont déjà actif)`,
  stopped: s => `DelphIA : pont arrêté${s.detail ? ` (${s.detail})` : ''}`,
  failed: s => `DelphIA : pont indisponible${s.detail ? ` — ${s.detail}` : ''}`,
}

const message = (err: unknown): string => (err instanceof Error ? err.message : 'erreur')

async function publish($: Ctx, state: BridgeState): Promise<void> {
  $.ui.status(STATUS_TEXT[state.status](state))
  await $.state.set(BRIDGE, state).catch(() => undefined)
}

export async function readBridgeState($: Ctx): Promise<BridgeState> {
  const { value } = await $.state.get(BRIDGE)
  return value ?? { status: 'stopped', url: null, detail: 'jamais lancé' }
}

/** Chemin du CLI du pont : copie locale du projet, sinon dépôt voisin du mod. */
export async function findBridgeCli($: Ctx, cwd: string): Promise<string | undefined> {
  const candidates = [
    join(cwd, 'node_modules/@vite-plugin-delphia/bridge/dist/cli.js'),
    `${$.plugin.root}/../bridge/dist/cli.js`,
  ]
  for (const path of candidates) {
    if (
      await $.fs.stat(path).then(
        s => s.kind === 'file',
        () => false,
      )
    )
      return path
  }
  return undefined
}

/** Un pont répond-il déjà sur le port de bridge.json ? Renvoie son URL. */
async function findRunningBridge($: Ctx, cwd: string): Promise<string | undefined> {
  const info = await readBridgeInfo($, cwd)
  if (!info) return undefined
  const url = `http://127.0.0.1:${info.port}/`
  try {
    const res = await $.http.fetch(`${url}api/config`)
    return res.ok ? url : undefined
  } catch {
    return undefined
  }
}

/** Lance le pont (ou reconnaît un pont déjà actif). Ne bloque pas : la lecture tourne en tâche de fond. */
export async function startBridge($: Ctx, cwd: string): Promise<void> {
  try {
    const running = await findRunningBridge($, cwd)
    if (running) return await publish($, { status: 'external', url: running, detail: null })

    const cli = await findBridgeCli($, cwd)
    if (!cli) {
      return await publish($, {
        status: 'failed',
        url: null,
        detail:
          'cli du pont introuvable (npm install @vite-plugin-delphia/bridge, ou npm run delphia)',
      })
    }
    const { port } = await readConfig($, cwd)
    await publish($, { status: 'starting', url: null, detail: `port ${port}` })
    void followBridge($, cwd, cli)
  } catch (err) {
    await publish($, { status: 'failed', url: null, detail: message(err) })
  }
}

/** Lit la sortie du pont ; la boucle vit autant que l'enfant (ou que le module). */
async function followBridge($: Ctx, cwd: string, cli: string): Promise<void> {
  let buffer = ''
  let url: string | null = null
  try {
    for await (const { stream, text } of $.process.spawn({
      argv: ['node', cli, '--project', cwd],
    })) {
      $.ui.log(`delphia bridge ${stream}: ${text.trim()}`, { to: 'debug' })
      buffer = (buffer + text).slice(-4096)
      const match = url === null ? LISTENING.exec(buffer) : null
      if (match) {
        url = match[1] as string
        await publish($, { status: 'running', url, detail: null })
      }
    }
    // La boucle ne rend pas le code de sortie : la dernière ligne de sortie explique l'arrêt.
    const last = buffer.trim().split(/\r?\n/).pop() ?? ''
    await publish($, {
      status: url ? 'stopped' : 'failed',
      url: null,
      detail: last.slice(0, 200) || 'processus terminé',
    })
  } catch (err) {
    await publish($, { status: 'failed', url: null, detail: message(err) })
  }
}
