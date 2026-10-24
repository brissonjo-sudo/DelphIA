import { randomBytes } from 'node:crypto'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BridgeInfo } from '@vite-plugin-delph-ia/protocol'
import { createBakeRoutes } from './bake-routes.js'
import { openBakeStore } from './bake-store.js'
import { removeBridgeInfo, writeBridgeInfo } from './bridge-file.js'
import { readConfig } from './config.js'
import { createRequestHandler } from './http.js'
import { openStore } from './store.js'
import { attachWs } from './ws.js'

export interface BridgeOptions {
  /** Racine du projet cible (contient `delphia.config.json` et `.delphia/`). */
  project: string
  /** Dossier du concepteur buildé ; défaut : `dist/designer` embarqué, sinon `packages/designer/dist`. */
  designerDir?: string
  /** Surcharge du port du pont (0 = port libre aléatoire, pour les tests). */
  port?: number
  /** Surcharge du port de l'app cible. */
  appPort?: number
  /** Journal ; silencieux par défaut. */
  log?: (line: string) => void
}

export interface BridgeHandle {
  port: number
  /** Jeton des routes HTTP du mod (aussi dans `bridge.json`). */
  token: string
  close(): Promise<void>
}

/**
 * Emplacements du concepteur buildé, par ordre de préférence :
 * 1. `dist/designer`, embarqué dans le paquet publié (copié au build) ;
 * 2. `packages/designer/dist`, dans le monorepo.
 */
const DESIGNER_CANDIDATES = [
  fileURLToPath(new URL('./designer', import.meta.url)),
  fileURLToPath(new URL('../../designer/dist', import.meta.url)),
]

const isDir = (path: string): Promise<boolean> =>
  stat(path).then(
    s => s.isDirectory(),
    () => false,
  )

async function defaultDesignerDir(): Promise<string> {
  for (const dir of DESIGNER_CANDIDATES) if (await isDir(dir)) return dir
  return DESIGNER_CANDIDATES[0] as string
}

export async function startBridge(options: BridgeOptions): Promise<BridgeHandle> {
  const log = options.log ?? (() => undefined)
  const project = resolve(options.project)
  const config = await readConfig(project)
  const appPort = options.appPort ?? config.appPort
  const wanted = options.port ?? config.port
  const designerDir = resolve(options.designerDir ?? (await defaultDesignerDir()))

  let port = wanted
  // `hub` est affecté avant tout événement du watcher (aucun tour de boucle entre les deux).
  const store = await openStore(project, doc => hub.broadcast(doc), log)
  const token = randomBytes(32).toString('hex')
  let bake: Awaited<ReturnType<typeof openBakeStore>>
  try {
    bake = await openBakeStore(project, store, change => {
      if (change.overrides) hub.broadcast(change.overrides)
      hub.broadcastBake(change.bake)
    })
  } catch (e) {
    store.close()
    throw e
  }
  const bakeRoutes = createBakeRoutes({ bake, token })
  const server = createServer(
    createRequestHandler({ designerDir, appPort, getPort: () => port, bakeRoutes }),
  )
  const hub = attachWs(server, store, bake, () => port, log)

  try {
    await new Promise<void>((ok, ko) => {
      server.once('error', ko)
      server.listen(wanted, '127.0.0.1', () => {
        server.off('error', ko)
        ok()
      })
    })
  } catch (e) {
    store.close()
    hub.close()
    if ((e as NodeJS.ErrnoException).code === 'EADDRINUSE') {
      throw new Error(
        `Le port ${wanted} est déjà utilisé (127.0.0.1). Libérez-le ou changez "port" dans delphia.config.json.`,
        { cause: e },
      )
    }
    throw e
  }
  port = (server.address() as AddressInfo).port

  const info: BridgeInfo = {
    pid: process.pid,
    port,
    appPort,
    startedAt: new Date().toISOString(),
    token,
  }
  let closed: Promise<void> | undefined
  const close = (): Promise<void> =>
    (closed ??= (async () => {
      store.close()
      hub.close()
      await new Promise<void>(done => {
        server.close(() => done())
        server.closeAllConnections()
      })
      await removeBridgeInfo(project, info)
    })())

  try {
    await writeBridgeInfo(project, info)
  } catch (e) {
    await close()
    throw e
  }
  if (!(await isDir(designerDir))) {
    log(`concepteur non buildé (${designerDir}) : page d'aide servie à la racine`)
  }
  log(`DelphIA bridge listening on http://127.0.0.1:${port}/`)
  return { port, token, close }
}
