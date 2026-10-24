import type { IncomingMessage, Server } from 'node:http'
import type { Duplex } from 'node:stream'
import {
  parseClientToBridge,
  wrap,
  type BridgeToClient,
  type OverridesDoc,
} from '@vite-plugin-delph-ia/protocol'
import { WebSocket, WebSocketServer } from 'ws'
import { hostAllowed } from './http.js'
import type { Store } from './store.js'

export const WS_PATH = '/ws'
export const MAX_MESSAGE_BYTES = 64 * 1024

export interface WsHub {
  broadcast(doc: OverridesDoc): void
  close(): void
}

/** `Origin` obligatoire : seul le concepteur servi par ce pont peut ouvrir le WebSocket. */
export function originAllowed(origin: string | undefined, port: number): boolean {
  return origin === `http://127.0.0.1:${port}` || origin === `http://localhost:${port}`
}

const send = (ws: WebSocket, msg: BridgeToClient): void => {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(wrap(msg)))
}

const reject = (socket: Duplex, status: string): void => {
  socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
}

export function attachWs(
  server: Server,
  store: Store,
  getPort: () => number,
  log: (line: string) => void,
): WsHub {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES })

  const hub: WsHub = {
    broadcast(doc) {
      for (const client of wss.clients) send(client, { type: 'overrides:state', doc })
    },
    close() {
      for (const client of wss.clients) client.terminate()
      wss.close()
    },
  }

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const port = getPort()
    const path = (req.url ?? '').split('?')[0]
    if (!hostAllowed(req.headers.host, port) || !originAllowed(req.headers.origin, port)) {
      return reject(socket, '403 Forbidden')
    }
    if (path !== WS_PATH) return reject(socket, '404 Not Found')
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req))
  })

  wss.on('connection', ws => {
    ws.on('error', e => log(`client WebSocket : ${e.message}`)) // ex. message trop gros (1009)
    send(ws, { type: 'overrides:state', doc: store.current() })

    ws.on('message', (data, isBinary) => {
      const fail = (message: string): void => send(ws, { type: 'bridge:error', message })
      if (isBinary) return fail('message binaire refusé')
      let json: unknown
      try {
        json = JSON.parse(data.toString('utf8'))
      } catch {
        return fail('JSON invalide')
      }
      const msg = parseClientToBridge(json)
      if (!msg.ok) return fail(msg.errors.join(' ; ').slice(0, 300))
      const patch = msg.value.type === 'override:set' ? msg.value.patch : null
      store.apply(msg.value.id, patch).then(
        doc => hub.broadcast(doc),
        (e: Error) => fail(e.message.slice(0, 300)),
      )
    })
  })

  return hub
}
