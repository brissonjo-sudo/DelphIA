import {
  applyPatch,
  compareRects,
  emptyBake,
  emptyOverrides,
  isBakeOpen,
  makeBakeId,
  type BakeDoc,
  type BakeRequest,
  type ClientToBridge,
  type OverridesDoc,
} from '@vite-plugin-delph-ia/protocol'
import { pickGeometry } from '../core/geometry.js'
import type { BridgeCallbacks, BridgeClient } from './bridge-client.js'

export interface MockBridge extends BridgeClient {
  /** Messages reçus du concepteur, dans l'ordre (pour les vérifications). */
  readonly sent: ClientToBridge[]
  readonly doc: () => OverridesDoc
  readonly bake: () => BakeDoc
}

/** Délai simulé du tour de Claude (mode démo). */
export const MOCK_APPLY_DELAY_MS = 1500
const MOCK_FILES = ['src/App.css']

/** Faux pont en mémoire : mêmes messages que le vrai, sans réseau ni fichier. */
export function createMockBridge(
  cb: BridgeCallbacks,
  initial?: OverridesDoc,
  applyDelayMs = MOCK_APPLY_DELAY_MS,
): MockBridge {
  let doc = initial ?? emptyOverrides()
  let bake = emptyBake()
  const sent: ClientToBridge[] = []
  const publish = (): void => cb.onMessage({ type: 'overrides:state', doc })
  const publishBake = (): void => cb.onMessage({ type: 'bake:state', bake })
  const error = (message: string): void => cb.onMessage({ type: 'bridge:error', message })
  const iso = (): string => new Date().toISOString()
  const archive = (r: BakeRequest): void => {
    bake = { ...bake, current: null, history: [r, ...bake.history].slice(0, 20) }
  }
  cb.onStatus('connecting')
  setTimeout(() => {
    cb.onStatus('open')
    publish()
    publishBake()
  }, 0)

  /** Simule le tour de Claude : retire les éléments de la surcouche, puis passe à `applied`. */
  function simulateApply(bakeId: string): void {
    const cur = bake.current
    if (cur?.bakeId !== bakeId || cur.status !== 'requested') return
    for (const it of cur.items) doc = applyPatch(doc, it.id, null, new Date())
    bake = {
      ...bake,
      current: { ...cur, status: 'applied', updatedAt: iso(), touchedFiles: MOCK_FILES },
    }
    publishBake()
    publish()
  }

  return {
    sent,
    doc: () => doc,
    bake: () => bake,
    send(msg) {
      sent.push(msg)
      const cur = bake.current
      switch (msg.type) {
        case 'override:set':
        case 'override:clear':
          doc = applyPatch(
            doc,
            msg.id,
            msg.type === 'override:clear' ? null : msg.patch,
            new Date(),
          )
          publish()
          break
        case 'bake:request': {
          if (isBakeOpen(cur)) return (error('Une demande de figeage est déjà ouverte.'), true)
          const missing = msg.items.find(i => !doc.elements[i.id])
          if (missing) return (error(`Pas d’ajustement pour ${missing.id}.`), true)
          const bakeId = makeBakeId(crypto.getRandomValues(new Uint8Array(8)))
          bake = {
            ...bake,
            current: {
              bakeId,
              status: 'requested',
              createdAt: iso(),
              updatedAt: iso(),
              items: msg.items.map(i => ({
                id: i.id,
                target: i.target,
                geometry: pickGeometry(doc.elements[i.id]),
              })),
              touchedFiles: [],
              results: [],
            },
          }
          publishBake()
          setTimeout(() => simulateApply(bakeId), applyDelayMs)
          break
        }
        case 'bake:cancel':
          if (cur?.bakeId === msg.bakeId && cur.status === 'requested') {
            archive({ ...cur, status: 'cancelled', updatedAt: iso(), note: 'annulée' })
            publishBake()
          }
          break
        case 'bake:verify':
          if (cur?.bakeId === msg.bakeId && cur.status === 'applied') {
            const results = cur.items.map(it => {
              const actual = msg.results.find(r => r.id === it.id)?.actual ?? null
              return { id: it.id, ok: compareRects(it.target, actual).ok, actual }
            })
            const okAll = results.every(r => r.ok)
            archive({ ...cur, status: okAll ? 'verified' : 'mismatch', updatedAt: iso(), results })
            publishBake()
          }
          break
        case 'bake:revert': {
          const r =
            cur?.bakeId === msg.bakeId ? cur : bake.history.find(h => h.bakeId === msg.bakeId)
          if (!r) break
          for (const it of r.items) doc = applyPatch(doc, it.id, it.geometry, new Date())
          const reverted: BakeRequest = { ...r, status: 'reverted', updatedAt: iso() }
          bake =
            cur?.bakeId === r.bakeId
              ? { ...bake, current: null, history: [reverted, ...bake.history] }
              : { ...bake, history: bake.history.map(h => (h.bakeId === r.bakeId ? reverted : h)) }
          publish()
          publishBake()
          break
        }
      }
      return true
    },
    close() {},
  }
}
