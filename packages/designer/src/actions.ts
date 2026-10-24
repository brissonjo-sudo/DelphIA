import type { Geometry, GeometryPatch } from '@vite-plugin-delph-ia/protocol'
import type { BridgeClient } from './io/bridge-client.js'
import type { RuntimeLink } from './io/runtime-link.js'
import type { Store } from './state.js'

/** Délai avant de retirer l'aperçu après l'écriture (0 = tout de suite, comme le contrat). */
export const PREVIEW_CLEAR_DELAY_MS = 0

export interface Actions {
  select(id: string | null): void
  preview(id: string, geometry: Geometry | null): void
  /** Écrit un ajustement dans le pont, puis retire l'aperçu. */
  commit(id: string, patch: GeometryPatch): void
  clear(id: string): void
  toggleGrid(): void
  toggleSnap(): void
  remeasure(): void
}

export function createActions(store: Store, bridge: BridgeClient, runtime: RuntimeLink): Actions {
  const clearPreview = (id: string): void => {
    const run = (): void => runtime.send({ type: 'designer:preview', id, geometry: null })
    if (PREVIEW_CLEAR_DELAY_MS > 0) setTimeout(run, PREVIEW_CLEAR_DELAY_MS)
    else run()
  }
  const send = (msg: Parameters<BridgeClient['send']>[0]): void => {
    if (!bridge.send(msg)) {
      store.set({ bridgeError: 'Pont déconnecté : ajustement non enregistré.' })
    }
  }
  return {
    select: id => store.set({ selectedId: id }),
    preview: (id, geometry) => runtime.send({ type: 'designer:preview', id, geometry }),
    commit(id, patch) {
      send({ type: 'override:set', id, patch })
      clearPreview(id)
    },
    clear(id) {
      send({ type: 'override:clear', id })
      clearPreview(id)
    },
    toggleGrid: () => store.set({ gridOn: !store.get().gridOn }),
    toggleSnap: () => store.set({ snapOn: !store.get().snapOn }),
    remeasure: () => runtime.send({ type: 'designer:measure' }),
  }
}
