import {
  emptyOverrides,
  type ElementInfo,
  type Geometry,
  type OverridesDoc,
  type Rect,
} from '@delphia/protocol'
import type { Guide } from './core/snap.js'
import type { BridgeStatus } from './io/bridge-client.js'

export interface AppState {
  bridge: BridgeStatus
  bridgeError: string | null
  /** Message d'erreur de lecture de configuration (mode réel seulement). */
  fatal: string | null
  appConnected: boolean
  appUrl: string | null
  /** Vrai dès qu'une mesure a été reçue : avant, on ne peut pas parler d'orphelins. */
  measured: boolean
  elements: ElementInfo[]
  overrides: OverridesDoc
  selectedId: string | null
  hoverId: string | null
  gridOn: boolean
  snapOn: boolean
  /** Rectangle visé pendant un glisser (remplace le rectangle mesuré pour l'affichage). */
  ghost: { id: string; rect: Rect; geometry: Geometry } | null
  guides: Guide[]
}

export const initialState = (): AppState => ({
  bridge: 'connecting',
  bridgeError: null,
  fatal: null,
  appConnected: false,
  appUrl: null,
  measured: false,
  elements: [],
  overrides: emptyOverrides(),
  selectedId: null,
  hoverId: null,
  gridOn: false,
  snapOn: true,
  ghost: null,
  guides: [],
})

export interface Store {
  get(): AppState
  set(patch: Partial<AppState>): void
  subscribe(fn: (s: AppState) => void): void
}

/** Magasin minimal : les abonnés sont notifiés une fois par lot de modifications. */
export function createStore(initial: AppState): Store {
  let state = initial
  const subs: Array<(s: AppState) => void> = []
  let queued = false
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch }
      if (queued) return
      queued = true
      queueMicrotask(() => {
        queued = false
        for (const fn of subs) fn(state)
      })
    },
    subscribe: fn => void subs.push(fn),
  }
}
