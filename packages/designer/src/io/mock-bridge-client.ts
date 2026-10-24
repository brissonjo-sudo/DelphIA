import {
  applyPatch,
  emptyOverrides,
  type ClientToBridge,
  type OverridesDoc,
} from '@delphia/protocol'
import type { BridgeCallbacks, BridgeClient } from './bridge-client.js'

export interface MockBridge extends BridgeClient {
  /** Messages reçus du concepteur, dans l'ordre (pour les vérifications). */
  readonly sent: ClientToBridge[]
  readonly doc: () => OverridesDoc
}

/** Faux pont en mémoire : mêmes messages que le vrai, sans réseau ni fichier. */
export function createMockBridge(cb: BridgeCallbacks, initial?: OverridesDoc): MockBridge {
  let doc = initial ?? emptyOverrides()
  const sent: ClientToBridge[] = []
  const publish = (): void => cb.onMessage({ type: 'overrides:state', doc })
  cb.onStatus('connecting')
  setTimeout(() => {
    cb.onStatus('open')
    publish()
  }, 0)
  return {
    sent,
    doc: () => doc,
    send(msg) {
      sent.push(msg)
      doc = applyPatch(doc, msg.id, msg.type === 'override:clear' ? null : msg.patch, new Date())
      publish()
      return true
    },
    close() {},
  }
}
