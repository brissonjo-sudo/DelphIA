// @vitest-environment happy-dom
import { wrap, type RuntimeToDesigner } from '@vite-plugin-delphia/protocol'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startCssLive } from '../src/runtime/css-live.js'
import { startIframeRuntime } from '../src/runtime/iframe-runtime.js'
import { pickTargetOrigin } from '../src/runtime/origin.js'

const ORIGIN = 'http://127.0.0.1:4317'
let stop: () => void
let postMessage: ReturnType<typeof vi.fn>

const sent = (): { msg: RuntimeToDesigner; origin: string }[] =>
  postMessage.mock.calls.map(([env, origin]) => ({
    msg: (env as { msg: RuntimeToDesigner }).msg,
    origin: origin as string,
  }))

const fromDesigner = (data: unknown, origin = ORIGIN): void => {
  window.dispatchEvent(new MessageEvent('message', { data, origin }))
}

beforeEach(() => {
  vi.useFakeTimers()
  document.body.innerHTML = '<div data-dz-id="a"></div>'
  postMessage = vi.fn()
  stop = startIframeRuntime({
    win: window,
    origins: [ORIGIN],
    parent: { postMessage } as unknown as Window,
  })
})
afterEach(() => {
  stop()
  vi.useRealTimers()
})

describe('runtime iframe', () => {
  it('envoie hello puis elements au démarrage', () => {
    expect(sent().map(s => s.msg.type)).toEqual(['runtime:hello', 'runtime:elements'])
  })

  it('designer:measure depuis une origine autorisée renvoie les éléments', () => {
    postMessage.mockClear()
    fromDesigner(wrap({ type: 'designer:measure' }))
    expect(sent().map(s => s.msg.type)).toEqual(['runtime:elements'])
    expect(sent()[0]?.origin).toBe(ORIGIN)
  })

  it('ignore une origine non autorisée et les messages invalides', () => {
    postMessage.mockClear()
    fromDesigner(wrap({ type: 'designer:measure' }), 'http://evil.test')
    fromDesigner({ type: 'designer:measure' })
    fromDesigner(wrap({ type: 'designer:preview', id: 'a', geometry: { dx: 1.5 } }))
    expect(postMessage).not.toHaveBeenCalled()
    expect(document.querySelector<HTMLElement>('[data-dz-id="a"]')?.style.translate).toBe('')
  })

  it('designer:preview applique puis retire le style inline', () => {
    const el = document.querySelector<HTMLElement>('[data-dz-id="a"]')!
    fromDesigner(wrap({ type: 'designer:preview', id: 'a', geometry: { dx: 3, dy: 4 } }))
    expect(el.style.getPropertyValue('translate')).toBe('3px 4px')
    fromDesigner(wrap({ type: 'designer:preview', id: 'a', geometry: null }))
    expect(el.style.getPropertyValue('translate')).toBe('')
  })

  it('une mutation du DOM déclenche une seule mesure anti-rebondie', async () => {
    postMessage.mockClear()
    document.body.insertAdjacentHTML('beforeend', '<div data-dz-id="b"></div>')
    document.body.insertAdjacentHTML('beforeend', '<div data-dz-id="c"></div>')
    await vi.advanceTimersByTimeAsync(60)
    const elements = sent().filter(s => s.msg.type === 'runtime:elements')
    expect(elements).toHaveLength(1)
    const msg = elements[0]?.msg
    expect(msg?.type === 'runtime:elements' && msg.elements.map(e => e.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('origine cible', () => {
  it('préfère le parent connu s’il est autorisé, sinon *', () => {
    expect(pickTargetOrigin([ORIGIN], ['http://x', ORIGIN])).toBe(ORIGIN)
    expect(pickTargetOrigin([ORIGIN], [undefined, 'http://x'])).toBe('*')
  })
})

describe('css live', () => {
  it('met à jour la balise par HMR et la garde en dernier du head', async () => {
    document.head.innerHTML = '<style data-delphia>old</style>'
    let handler: ((d: unknown) => void) | undefined
    startCssLive(document, { on: (_e, cb) => (handler = cb) })
    handler?.({ css: 'new{}' })
    handler?.({ css: 42 })
    document.head.insertAdjacentHTML('beforeend', '<style>app{}</style>')
    await vi.advanceTimersByTimeAsync(10)
    const tag = document.head.querySelector('style[data-delphia]')
    expect(tag?.textContent).toBe('new{}')
    expect(document.head.lastElementChild).toBe(tag)
  })
})
