import type { Geometry, GeometryPatch } from '@vite-plugin-delph-ia/protocol'
import type { BridgeClient } from './io/bridge-client.js'
import type { RuntimeLink } from './io/runtime-link.js'
import { bakeTargets, buildBakeRequest, canBake } from './core/bake-flow.js'
import { primaryOf, singleSelection, toggleSelection } from './core/selection.js'
import type { Store } from './state.js'

/** Délai avant de retirer l'aperçu après l'écriture (0 = tout de suite, comme le contrat). */
export const PREVIEW_CLEAR_DELAY_MS = 0

export interface Actions {
  select(id: string | null): void
  /** Maj+clic : ajoute ou retire `id` de la sélection (le dernier ajouté devient principal). */
  toggleSelect(id: string): void
  /** « Figer » : mesure fraîche, puis `bake:request` (voir `onMeasured`). */
  bake(): void
  /** À appeler à chaque `runtime:elements` (store déjà à jour) : envoie la demande en attente. */
  onMeasured(): void
  cancelBake(): void
  revertBake(): void
  dismissBake(): void
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
    select: id => store.set({ selectedId: id, selectedIds: singleSelection(id) }),
    toggleSelect(id) {
      const ids = toggleSelection(store.get().selectedIds, id)
      store.set({ selectedIds: ids, selectedId: primaryOf(ids) })
    },
    bake() {
      const s = store.get()
      if (!canBake(s.selectedIds, new Set(Object.keys(s.overrides.elements)), s.bake)) return
      store.set({ bakeAwaiting: true, bakeNotice: null })
      runtime.send({ type: 'designer:measure' })
    },
    onMeasured() {
      const s = store.get()
      if (!s.bakeAwaiting) return
      store.set({ bakeAwaiting: false })
      const pinned = new Set(Object.keys(s.overrides.elements))
      if (!canBake(s.selectedIds, pinned, s.bake)) return
      const { items } = bakeTargets(s.selectedIds, pinned, s.elements)
      if (!items.length) return
      send(buildBakeRequest(items))
    },
    cancelBake() {
      const c = store.get().bake.current
      if (c?.status === 'requested') send({ type: 'bake:cancel', bakeId: c.bakeId })
    },
    revertBake() {
      const b = store.get().bake
      const r = b.current?.status === 'applied' ? b.current : b.history[0]
      if (r) send({ type: 'bake:revert', bakeId: r.bakeId })
    },
    dismissBake: () => store.set({ bakeDismissed: store.get().bake.history[0]?.bakeId ?? null }),
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
