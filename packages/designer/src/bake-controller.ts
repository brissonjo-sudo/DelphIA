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
  /** Taille de la fenêtre de l'app au moment de chaque demande (comparaison honnête). */
  const requestViewports = new Map<string, { width: number; height: number }>()
  const feed = (ev: VerifyEvent): void => {
    const r = stepVerify(flow, ev)
    const bakeId = flow.pending?.bakeId
    flow = r.flow
    if (r.action === 'measure') runtime.send({ type: 'designer:measure' })
    else if (r.action === 'verify' && bakeId) {
      const s = store.get()
      const ids = s.bake.current?.items.map(i => i.id) ?? []
      const before = requestViewports.get(bakeId)
      const after = s.appViewport
      if (before && after && !sameViewport(before, after)) {
        store.set({
          bakeNotice:
            `La fenêtre de l’app a changé de taille depuis la demande (` +
            `${fmt(before)} → ${fmt(after)}) : un écart peut venir de là, pas du code.`,
        })
      }
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
      const vp = store.get().appViewport
      if (current?.status === 'requested' && vp && !requestViewports.has(current.bakeId)) {
        requestViewports.set(current.bakeId, vp)
      }
      const overlayCleared =
        current !== null && current.items.every(it => !(it.id in overrides.elements))
      feed({ kind: 'bake', current, now: now(), overlayCleared })
    },
    onOverrides: () => feed({ kind: 'overrides' }),
    onElements: () => feed({ kind: 'elements', now: now() }),
    tick: () => feed({ kind: 'tick', now: now() }),
  }
}

const sameViewport = (a: { width: number; height: number }, b: { width: number; height: number }) =>
  Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5

const fmt = (v: { width: number; height: number }): string =>
  `${Math.round(v.width)}×${Math.round(v.height)}`
