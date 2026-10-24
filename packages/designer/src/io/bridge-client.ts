import {
  parseBridgeToClient,
  wrap,
  type BridgeToClient,
  type ClientToBridge,
} from '@vite-plugin-delphia/protocol'

export type BridgeStatus = 'connecting' | 'open' | 'closed'

/** Interface commune au vrai client et à sa doublure de démonstration. */
export interface BridgeClient {
  /** Faux si le message n'a pas pu partir (pont non connecté). */
  send(msg: ClientToBridge): boolean
  close(): void
}

export interface BridgeCallbacks {
  onMessage(msg: BridgeToClient): void
  onStatus(status: BridgeStatus): void
  /** Message reçu mais illégitime ou illisible (ignoré). */
  onInvalid?(errors: string[]): void
}

/** Sous-ensemble de `WebSocket` utilisé ici (permet un faux dans les tests). */
export interface SocketLike {
  readyState: number
  send(data: string): void
  close(): void
  onopen: (() => void) | null
  onclose: (() => void) | null
  onmessage: ((ev: { data: unknown }) => void) | null
  onerror: (() => void) | null
}

export interface BridgeClientOptions extends BridgeCallbacks {
  url: string
  createSocket?: (url: string) => SocketLike
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

const WS_OPEN = 1
const BASE_DELAY_MS = 500
const MAX_DELAY_MS = 8000

/** Délai avant la tentative n° `attempt` (0 = première) : 0,5 s, 1 s, 2 s… plafonné à 8 s. */
export const reconnectDelay = (attempt: number): number =>
  Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt)

export function createBridgeClient(opts: BridgeClientOptions): BridgeClient {
  const create = opts.createSocket ?? ((u: string) => new WebSocket(u) as unknown as SocketLike)
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
  const clearTimer = opts.clearTimer ?? ((h: unknown) => clearTimeout(h as number))
  let socket: SocketLike | null = null
  let timer: unknown = null
  let attempt = 0
  let stopped = false

  function connect(): void {
    opts.onStatus('connecting')
    const s = create(opts.url)
    socket = s
    s.onopen = () => {
      attempt = 0
      opts.onStatus('open')
    }
    s.onmessage = ev => {
      if (typeof ev.data !== 'string') return opts.onInvalid?.(['message non textuel'])
      let json: unknown
      try {
        json = JSON.parse(ev.data)
      } catch {
        return opts.onInvalid?.(['JSON illisible'])
      }
      const parsed = parseBridgeToClient(json)
      if (parsed.ok) opts.onMessage(parsed.value)
      else opts.onInvalid?.(parsed.errors)
    }
    s.onclose = () => {
      if (socket !== s) return
      socket = null
      opts.onStatus('closed')
      if (stopped) return
      timer = setTimer(connect, reconnectDelay(attempt++))
    }
    s.onerror = () => {
      // `onclose` suit toujours une erreur : la reconnexion y est planifiée.
    }
  }

  connect()

  return {
    send(msg) {
      if (!socket || socket.readyState !== WS_OPEN) return false
      socket.send(JSON.stringify(wrap(msg)))
      return true
    },
    close() {
      stopped = true
      if (timer !== null) clearTimer(timer)
      socket?.close()
    },
  }
}
