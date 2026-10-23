import { startCssLive } from './css-live.js'
import type { HotLike } from './hot.js'
import { startIframeRuntime } from './iframe-runtime.js'

export interface DelphiaRuntimeOptions {
  designerOrigins: readonly string[]
  hot?: HotLike | undefined
}

/**
 * Point d'entrée navigateur (importé par le module virtuel, en `serve` seulement).
 * Le CSS vit dans toute page ; la mesure et le dialogue seulement dans une iframe.
 */
export function startDelphia(opts: DelphiaRuntimeOptions, win: Window = window): void {
  startCssLive(win.document, opts.hot)
  if (win.parent !== win) {
    startIframeRuntime({ win, origins: opts.designerOrigins, hot: opts.hot })
  }
}
