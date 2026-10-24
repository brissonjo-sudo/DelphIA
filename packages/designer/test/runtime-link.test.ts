import { PROTOCOL_TAG, wrap } from '@vite-plugin-delphia/protocol'
import { describe, expect, it } from 'vitest'
import { parseDesignerConfig } from '../src/io/config.js'
import { acceptRuntimeMessage, createRuntimeLink } from '../src/io/runtime-link.js'

const ORIGIN = 'http://localhost:1420'
const win = { name: 'iframe-window' }
const hello = wrap({ type: 'runtime:hello', url: 'http://localhost:1420/' })
const elements = wrap({
  type: 'runtime:elements',
  viewport: { width: 800, height: 600 },
  elements: [{ id: 'a', tag: 'div', parentId: null, rect: { x: 0, y: 0, width: 10, height: 10 } }],
})

describe('acceptRuntimeMessage', () => {
  it('accepte un message valide venu de l’iframe', () => {
    expect(acceptRuntimeMessage({ source: win, origin: ORIGIN, data: hello }, win, ORIGIN)).toEqual(
      { type: 'runtime:hello', url: 'http://localhost:1420/' },
    )
  })

  it('refuse une autre source (autre fenêtre, parent, null)', () => {
    expect(
      acceptRuntimeMessage({ source: {}, origin: ORIGIN, data: hello }, win, ORIGIN),
    ).toBeNull()
    expect(
      acceptRuntimeMessage({ source: null, origin: ORIGIN, data: hello }, win, ORIGIN),
    ).toBeNull()
  })

  it('refuse tout quand l’iframe n’a pas de fenêtre', () => {
    expect(
      acceptRuntimeMessage({ source: null, origin: ORIGIN, data: hello }, null, ORIGIN),
    ).toBeNull()
  })

  it('refuse une autre origine', () => {
    expect(
      acceptRuntimeMessage({ source: win, origin: 'http://evil.test', data: hello }, win, ORIGIN),
    ).toBeNull()
  })

  it('refuse les messages invalides ou hors protocole', () => {
    const bad = [
      'texte',
      null,
      { tag: PROTOCOL_TAG, msg: { type: 'designer:measure' } },
      { tag: 'x', msg: { type: 'runtime:hello', url: 'u' } },
      wrap({
        type: 'runtime:elements',
        viewport: { width: 1, height: 1 },
        elements: [{ id: 'A"]' }],
      }),
    ]
    for (const data of bad) {
      expect(acceptRuntimeMessage({ source: win, origin: ORIGIN, data }, win, ORIGIN)).toBeNull()
    }
  })
})

describe('createRuntimeLink', () => {
  function setup() {
    let listener: ((ev: MessageEvent) => void) | null = null
    const posted: Array<{ data: unknown; origin: string }> = []
    const received: unknown[] = []
    const iframe = {
      contentWindow: {
        postMessage: (data: unknown, origin: string) => posted.push({ data, origin }),
      },
    }
    const link = createRuntimeLink({
      iframe,
      appUrl: 'http://localhost:1420/index.html',
      onMessage: m => received.push(m),
      host: {
        addEventListener: ((_: string, l: (ev: MessageEvent) => void) => (listener = l)) as never,
        removeEventListener: (() => (listener = null)) as never,
      },
    })
    const emit = (source: unknown, data: unknown) =>
      listener?.({ source, origin: ORIGIN, data } as unknown as MessageEvent)
    return { link, iframe, posted, received, emit, hasListener: () => listener !== null }
  }

  it('ne relaie que les messages de l’iframe, valides', () => {
    const t = setup()
    t.emit({}, hello)
    t.emit(t.iframe.contentWindow, 'bruit')
    t.emit(t.iframe.contentWindow, elements)
    expect(t.received).toHaveLength(1)
    expect(t.received[0]).toMatchObject({ type: 'runtime:elements' })
  })

  it('envoie des enveloppes vers l’origine de appUrl (jamais *)', () => {
    const t = setup()
    t.link.send({ type: 'designer:preview', id: 'a', geometry: { dx: 1 } })
    expect(t.posted).toEqual([
      {
        data: wrap({ type: 'designer:preview', id: 'a', geometry: { dx: 1 } }),
        origin: ORIGIN,
      },
    ])
  })

  it('dispose retire l’écouteur', () => {
    const t = setup()
    t.link.dispose()
    expect(t.hasListener()).toBe(false)
  })
})

describe('parseDesignerConfig', () => {
  it('accepte la forme du contrat', () => {
    expect(parseDesignerConfig({ appUrl: 'http://localhost:1420', port: 4317 }).ok).toBe(true)
  })

  it('refuse les URL non http(s) et les formes invalides', () => {
    expect(parseDesignerConfig({ appUrl: 'javascript:alert(1)', port: 1 }).ok).toBe(false)
    expect(parseDesignerConfig({ appUrl: 'pas une url', port: 1 }).ok).toBe(false)
    expect(parseDesignerConfig({ appUrl: 'http://a.b', port: '1' }).ok).toBe(false)
    expect(parseDesignerConfig(null).ok).toBe(false)
  })
})
