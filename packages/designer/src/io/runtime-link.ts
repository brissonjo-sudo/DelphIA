import {
  parseRuntimeToDesigner,
  wrap,
  type DesignerToRuntime,
  type RuntimeToDesigner,
} from '@vite-plugin-delphia/protocol'

/** Interface commune au vrai lien (iframe) et à sa doublure de démonstration. */
export interface RuntimeLink {
  send(msg: DesignerToRuntime): void
  dispose(): void
}

export interface MessageLike {
  source: unknown
  origin: string
  data: unknown
}

/**
 * Filtre d'un message reçu : il doit venir de la fenêtre de l'iframe, de l'origine de l'app,
 * et passer la validation du protocole. `null` = ignoré.
 */
export function acceptRuntimeMessage(
  ev: MessageLike,
  expectedSource: unknown,
  expectedOrigin: string,
): RuntimeToDesigner | null {
  if (expectedSource === null || ev.source !== expectedSource) return null
  if (ev.origin !== expectedOrigin) return null
  const parsed = parseRuntimeToDesigner(ev.data)
  return parsed.ok ? parsed.value : null
}

export interface RuntimeLinkOptions {
  iframe: { contentWindow: { postMessage(data: unknown, targetOrigin: string): void } | null }
  appUrl: string
  onMessage(msg: RuntimeToDesigner): void
  /** Fenêtre écoutée (par défaut `window`). */
  host?: Pick<Window, 'addEventListener' | 'removeEventListener'>
}

export function createRuntimeLink(opts: RuntimeLinkOptions): RuntimeLink {
  const origin = new URL(opts.appUrl).origin
  const host = opts.host ?? window
  const listener = (ev: MessageEvent): void => {
    const msg = acceptRuntimeMessage(ev, opts.iframe.contentWindow, origin)
    if (msg) opts.onMessage(msg)
  }
  host.addEventListener('message', listener)
  return {
    send(msg) {
      opts.iframe.contentWindow?.postMessage(wrap(msg), origin)
    },
    dispose() {
      host.removeEventListener('message', listener)
    },
  }
}
