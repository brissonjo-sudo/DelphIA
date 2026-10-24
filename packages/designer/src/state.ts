import {
  emptyBake,
  emptyOverrides,
  type BakeDoc,
  type ElementInfo,
  type Geometry,
  type OverridesDoc,
  type Rect,
} from '@vite-plugin-delph-ia/protocol'
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
  /** Élément principal : le dernier sélectionné (inspecteur, glisser, clavier). */
  selectedId: string | null
  /** Sélection multiple (Maj+clic) ; l'élément principal en est le dernier. */
  selectedIds: string[]
  hoverId: string | null
  gridOn: boolean
  snapOn: boolean
  /** Rectangle visé pendant un glisser (remplace le rectangle mesuré pour l'affichage). */
  ghost: { id: string; rect: Rect; geometry: Geometry } | null
  guides: Guide[]
  bake: BakeDoc
  /** Mesure fraîche demandée avant d'envoyer `bake:request`. */
  bakeAwaiting: boolean
  /** Dernier bakeId dont le résultat a été masqué. */
  bakeDismissed: string | null
  /** Message d'état local (vérification impossible, éléments ignorés…). */
  bakeNotice: string | null
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
  selectedIds: [],
  hoverId: null,
  gridOn: false,
  snapOn: true,
  ghost: null,
  guides: [],
  bake: emptyBake(),
  bakeAwaiting: false,
  bakeDismissed: null,
  bakeNotice: null,
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
