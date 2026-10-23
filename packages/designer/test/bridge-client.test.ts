import { PROTOCOL_TAG } from '@delphia/protocol'
import { describe, expect, it } from 'vitest'
import {
  createBridgeClient,
  reconnectDelay,
  type BridgeStatus,
  type SocketLike,
} from '../src/io/bridge-client.js'

class FakeSocket implements SocketLike {
  readyState = 0
  sent: string[] = []
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onmessage: ((ev: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null
  constructor(readonly url: string) {}
  send(data: string) {
    this.sent.push(data)
  }
  close() {
    this.readyState = 3
    this.onclose?.()
  }
  open() {
    this.readyState = 1
    this.onopen?.()
  }
  receive(data: unknown) {
    this.onmessage?.({ data })
  }
}

function setup() {
  const sockets: FakeSocket[] = []
  const timers: Array<{ fn: () => void; ms: number }> = []
  const statuses: BridgeStatus[] = []
  const messages: unknown[] = []
  const invalid: string[][] = []
  const client = createBridgeClient({
    url: 'ws://127.0.0.1:4317/ws',
    createSocket: url => {
      const s = new FakeSocket(url)
      sockets.push(s)
      return s
    },
    setTimer: (fn, ms) => timers.push({ fn, ms }),
    clearTimer: () => {},
    onStatus: s => statuses.push(s),
    onMessage: m => messages.push(m),
    onInvalid: e => invalid.push(e),
  })
  return { client, sockets, timers, statuses, messages, invalid }
}

const state = { version: 1, revision: 3, elements: {} }
const envelope = (msg: unknown) => JSON.stringify({ tag: PROTOCOL_TAG, msg })

describe('reconnectDelay', () => {
  it('croît puis plafonne', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(reconnectDelay)).toEqual([
      500, 1000, 2000, 4000, 8000, 8000, 8000,
    ])
  })
})

describe('createBridgeClient', () => {
  it('passe connecting -> open et valide les messages entrants', () => {
    const t = setup()
    const s = t.sockets[0]!
    s.open()
    s.receive(envelope({ type: 'overrides:state', doc: state }))
    expect(t.statuses).toEqual(['connecting', 'open'])
    expect(t.messages).toEqual([{ type: 'overrides:state', doc: state }])
  })

  it('ignore (et signale) les messages invalides, sans fermer', () => {
    const t = setup()
    const s = t.sockets[0]!
    s.open()
    s.receive('pas du json')
    s.receive(JSON.stringify({ tag: 'autre', msg: { type: 'bridge:error', message: 'x' } }))
    s.receive(envelope({ type: 'inconnu' }))
    s.receive(envelope({ type: 'overrides:state', doc: { version: 9 } }))
    s.receive(new ArrayBuffer(2))
    expect(t.messages).toEqual([])
    expect(t.invalid).toHaveLength(5)
    expect(s.readyState).toBe(1)
  })

  it('envoie des enveloppes protocole seulement quand la connexion est ouverte', () => {
    const t = setup()
    const s = t.sockets[0]!
    expect(t.client.send({ type: 'override:clear', id: 'a' })).toBe(false)
    s.open()
    expect(t.client.send({ type: 'override:set', id: 'a', patch: { dx: 3 } })).toBe(true)
    expect(JSON.parse(s.sent[0]!)).toEqual({
      tag: PROTOCOL_TAG,
      msg: { type: 'override:set', id: 'a', patch: { dx: 3 } },
    })
  })

  it('se reconnecte avec un délai croissant, remis à zéro après une connexion réussie', () => {
    const t = setup()
    t.sockets[0]!.close()
    expect(t.timers.map(x => x.ms)).toEqual([500])
    t.timers[0]!.fn()
    t.sockets[1]!.close()
    expect(t.timers.map(x => x.ms)).toEqual([500, 1000])
    t.timers[1]!.fn()
    t.sockets[2]!.open()
    t.sockets[2]!.close()
    expect(t.timers.map(x => x.ms)).toEqual([500, 1000, 500])
    expect(t.statuses.at(-1)).toBe('closed')
  })

  it('close() arrête la reconnexion', () => {
    const t = setup()
    t.sockets[0]!.open()
    t.client.close()
    expect(t.timers).toHaveLength(0)
    expect(t.sockets).toHaveLength(1)
  })
})
