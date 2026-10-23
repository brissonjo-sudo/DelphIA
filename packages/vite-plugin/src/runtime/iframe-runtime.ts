import { parseDesignerToRuntime, wrap, type RuntimeToDesigner } from '@delphia/protocol'
import { collectElements } from './elements.js'
import type { HotLike } from './hot.js'
import { guessParentOrigin, pickTargetOrigin } from './origin.js'
import { previewById } from './preview.js'

export interface IframeRuntimeOptions {
  win: Window
  /** Origines du concepteur autorisées à nous écrire (et auxquelles on répond). */
  origins: readonly string[]
  hot?: HotLike | undefined
  /** Destinataire des mesures ; par défaut `win.parent`. */
  parent?: Pick<Window, 'postMessage'>
  debounceMs?: number
}

type ElementsMessage = Extract<RuntimeToDesigner, { type: 'runtime:elements' }>

/** Mesure l'app et dialogue avec le concepteur. Retourne la fonction d'arrêt. */
export function startIframeRuntime(opts: IframeRuntimeOptions): () => void {
  const { win, hot, debounceMs = 50 } = opts
  const doc = win.document
  const parent = opts.parent ?? win.parent
  const allowed = new Set(opts.origins)
  let target = pickTargetOrigin(opts.origins, guessParentOrigin(win))
  const post = (msg: RuntimeToDesigner): void => parent.postMessage(wrap(msg), target)

  const warned = new Set<string>()
  const watched = new Set<Element>()
  let lastSent = ''
  let timer: ReturnType<typeof setTimeout> | undefined

  const resizeObserver =
    typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => schedule())

  const syncResizeObserver = (current: Map<string, Element>): void => {
    if (!resizeObserver) return
    const live = new Set(current.values())
    for (const el of watched) {
      if (!live.has(el)) {
        resizeObserver.unobserve(el)
        watched.delete(el)
      }
    }
    for (const el of live) {
      if (!watched.has(el)) {
        resizeObserver.observe(el)
        watched.add(el)
      }
    }
  }

  /** `force` : répondre même si rien n'a changé depuis le dernier envoi. */
  const measure = (force: boolean): void => {
    const { elements, byId, warnings } = collectElements(doc)
    for (const w of warnings) {
      if (!warned.has(w)) {
        warned.add(w)
        console.warn(`[delphia] ${w}`)
      }
    }
    syncResizeObserver(byId)
    const msg: ElementsMessage = {
      type: 'runtime:elements',
      viewport: { width: win.innerWidth, height: win.innerHeight },
      elements,
    }
    const key = JSON.stringify(msg)
    if (!force && key === lastSent) return
    lastSent = key
    post(msg)
  }

  function schedule(): void {
    clearTimeout(timer)
    timer = setTimeout(() => measure(false), debounceMs)
  }

  const onMessage = (event: MessageEvent): void => {
    if (!allowed.has(event.origin)) return
    const res = parseDesignerToRuntime(event.data)
    if (!res.ok) return
    target = event.origin
    const msg = res.value
    if (msg.type === 'designer:measure') measure(true)
    else previewById(doc, msg.id, msg.geometry)
  }

  const mutations = new MutationObserver(schedule)
  mutations.observe(doc.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  })
  win.addEventListener('message', onMessage)
  win.addEventListener('resize', schedule)
  win.addEventListener('scroll', schedule, true)
  win.addEventListener('load', schedule)
  hot?.on('vite:afterUpdate', schedule)

  post({ type: 'runtime:hello', url: win.location.href })
  measure(true)

  return () => {
    clearTimeout(timer)
    mutations.disconnect()
    resizeObserver?.disconnect()
    win.removeEventListener('message', onMessage)
    win.removeEventListener('resize', schedule)
    win.removeEventListener('scroll', schedule, true)
    win.removeEventListener('load', schedule)
  }
}
