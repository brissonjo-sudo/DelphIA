import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  OVERRIDES_FILE,
  parseBridgeToClient,
  wrap,
  type BakeDoc,
  type BridgeToClient,
  type OverridesDoc,
} from '@vite-plugin-delph-ia/protocol'
import { WebSocket } from 'ws'
import { startBridge, type BridgeHandle } from '../src/server.js'

export interface Fixture {
  /** Racine temporaire : contient `project/` et `designer/`, et un `secret.txt` voisin. */
  root: string
  project: string
  designer: string
  bridge: BridgeHandle
  cleanup(): Promise<void>
}

export async function setup(): Promise<Fixture> {
  const root = await mkdtemp(join(tmpdir(), 'delphia-bridge-'))
  const project = join(root, 'project')
  const designer = join(root, 'designer')
  await mkdir(project)
  await mkdir(designer)
  await writeFile(join(designer, 'index.html'), '<!doctype html><title>designer</title>')
  await writeFile(join(designer, 'app.js'), 'console.log(1)')
  await writeFile(join(designer, 'notes.exe'), 'nope')
  await writeFile(join(root, 'secret.txt'), 'secret')
  await writeFile(join(project, 'delphia.config.json'), JSON.stringify({ appPort: 1420 }))
  const bridge = await startBridge({ project, designerDir: designer, port: 0 })
  return {
    root,
    project,
    designer,
    bridge,
    cleanup: async () => {
      await bridge.close()
      await rm(root, { recursive: true, force: true })
    },
  }
}

export const overridesPath = (project: string): string => join(project, OVERRIDES_FILE)

/** Requête HTTP brute : le chemin et l'en-tête Host sont envoyés tels quels. */
export function raw(
  port: number,
  path: string,
  headers: Record<string, string> = {},
): Promise<{
  status: number
  body: string
  headers: Record<string, string | string[] | undefined>
}> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, headers }, res => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', chunk => (body += chunk))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body, headers: res.headers }))
    })
    req.on('error', reject)
    req.end()
  })
}

export class Client {
  private queue: BridgeToClient[] = []
  private waiters: Array<(m: BridgeToClient) => void> = []
  // `bake:state` a sa propre file : les tests d'ajustements ne le voient pas.
  private bakeQueue: BridgeToClient[] = []
  private bakeWaiters: Array<(m: BridgeToClient) => void> = []
  closed = false

  private constructor(readonly ws: WebSocket) {
    ws.on('message', data => {
      const parsed = parseBridgeToClient(JSON.parse(data.toString()))
      if (!parsed.ok) throw new Error(`message du pont invalide : ${parsed.errors.join(' ; ')}`)
      const isBake = parsed.value.type === 'bake:state'
      const waiter = (isBake ? this.bakeWaiters : this.waiters).shift()
      if (waiter) waiter(parsed.value)
      else (isBake ? this.bakeQueue : this.queue).push(parsed.value)
    })
    ws.on('close', () => (this.closed = true))
  }

  static connect(port: number, origin = `http://127.0.0.1:${port}`): Promise<Client> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin })
      const client = new Client(ws)
      ws.once('open', () => resolve(client))
      ws.once('error', reject)
    })
  }

  next(timeoutMs = 2_000): Promise<BridgeToClient> {
    return this.take(this.queue, this.waiters, timeoutMs)
  }

  private take(
    queue: BridgeToClient[],
    waiters: Array<(m: BridgeToClient) => void>,
    timeoutMs: number,
  ): Promise<BridgeToClient> {
    const queued = queue.shift()
    if (queued) return Promise.resolve(queued)
    return new Promise((resolve, reject) => {
      const waiter = (m: BridgeToClient): void => {
        clearTimeout(timer)
        resolve(m)
      }
      const timer = setTimeout(() => {
        waiters.splice(waiters.indexOf(waiter), 1) // sinon il avalerait le message suivant
        reject(new Error('aucun message reçu'))
      }, timeoutMs)
      waiters.push(waiter)
    })
  }

  async nextBake(timeoutMs = 2_000): Promise<BakeDoc> {
    const m = await this.take(this.bakeQueue, this.bakeWaiters, timeoutMs)
    if (m.type !== 'bake:state') throw new Error(`bake:state attendu, reçu ${m.type}`)
    return m.bake
  }

  async nextState(): Promise<OverridesDoc> {
    const m = await this.next()
    if (m.type !== 'overrides:state') throw new Error(`état attendu, reçu ${m.type}`)
    return m.doc
  }

  /** Vrai si aucun message n'arrive pendant `ms`. */
  async silentFor(ms: number): Promise<boolean> {
    try {
      await this.next(ms)
      return false
    } catch {
      return true
    }
  }

  send(msg: unknown): void {
    this.ws.send(JSON.stringify(wrap(msg)))
  }

  close(): void {
    this.ws.close()
  }
}

/** `POST` JSON brut (sans en-tête par défaut hormis ceux fournis). */
export function post(
  port: number,
  path: string,
  body: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: '127.0.0.1',
        port,
        path,
        method: 'POST',
        headers: { Host: `127.0.0.1:${port}`, 'content-type': 'application/json', ...headers },
      },
      res => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', chunk => (text += chunk))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: text }))
      },
    )
    req.on('error', reject)
    req.end(body)
  })
}
