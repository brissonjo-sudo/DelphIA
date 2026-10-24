import { stepVerify, initialFlow, buildVerify, type VerifyEvent } from './core/bake-flow.js'
import type { BridgeClient } from './io/bridge-client.js'
import type { RuntimeLink } from './io/runtime-link.js'
import type { Store } from './state.js'

export interface BakeController {
  onBake(): void
  onOverrides(): void
  /** À appeler à chaque `runtime:elements`, le store étant déjà à jour. */
  onElements(): void
  tick(): void
}

/** Colle la machine d'état « quand vérifier » (pure) au pont, au runtime et au store. */
export function createBakeController(
  store: Store,
  bridge: BridgeClient,
  runtime: RuntimeLink,
  now: () => number = Date.now,
): BakeController {
  let flow = initialFlow()
  const feed = (ev: VerifyEvent): void => {
    const r = stepVerify(flow, ev)
    const bakeId = flow.pending?.bakeId
    flow = r.flow
    if (r.action === 'measure') runtime.send({ type: 'designer:measure' })
    else if (r.action === 'verify' && bakeId) {
      const s = store.get()
      const ids = s.bake.current?.items.map(i => i.id) ?? []
      bridge.send(buildVerify(bakeId, ids, s.elements))
    } else if (r.action === 'stalled') {
      store.set({ bakeNotice: 'Vérification impossible : l’app ne répond pas. Relancez-la.' })
    }
  }
  return {
    onBake() {
      store.set({ bakeNotice: null })
      const { bake, overrides } = store.get()
      const current = bake.current
      const overlayCleared =
        current !== null && current.items.every(it => !(it.id in overrides.elements))
      feed({ kind: 'bake', current, now: now(), overlayCleared })
    },
    onOverrides: () => feed({ kind: 'overrides' }),
    onElements: () => feed({ kind: 'elements', now: now() }),
    tick: () => feed({ kind: 'tick', now: now() }),
  }
}
