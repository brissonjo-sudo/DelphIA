import type {
  ClientToBridge,
  OverridesDoc,
  RuntimeToDesigner,
} from '@vite-plugin-delph-ia/protocol'
import { createActions } from './actions.js'
import { createBridgeClient, type BridgeCallbacks, type BridgeClient } from './io/bridge-client.js'
import { bridgeSocketUrl, loadConfig } from './io/config.js'
import { createMockBridge, type MockBridge } from './io/mock-bridge-client.js'
import { createMockRuntime, type MockRuntime } from './io/mock-runtime-link.js'
import { createRuntimeLink, type RuntimeLink } from './io/runtime-link.js'
import { createStore, initialState } from './state.js'
import { createElementList } from './ui/element-list.js'
import { createInspector } from './ui/inspector.js'
import { attachInteraction } from './ui/interaction.js'
import { renderOverlay } from './ui/overlay.js'
import { buildShell } from './ui/shell.js'
import { createStatusBar } from './ui/status-bar.js'
import { createToolbar } from './ui/toolbar.js'

const PING_MS = 2000
const SILENCE_MS = 6000

declare global {
  interface Window {
    /** Exposé en mode démo seulement, pour les vérifications automatisées. */
    __delphiaMock?: { sent: ClientToBridge[]; doc: MockBridge['doc'] }
  }
}

/** Démo : un élément déjà épinglé, et un ajustement orphelin (son id n'existe plus). */
const MOCK_DOC: OverridesDoc = {
  version: 1,
  revision: 1,
  elements: {
    titre: { dx: 8, dy: 0, updatedAt: '2026-10-24T08:00:00.000Z' },
    'ancien-bouton': { dx: 12, dy: -4, updatedAt: '2026-10-23T18:30:00.000Z' },
  },
}

function main(): void {
  const root = document.getElementById('app')
  if (!root) return
  const mock = new URLSearchParams(location.search).get('mock') === '1'
  const shell = buildShell(root)
  const store = createStore(initialState())
  let lastSeen = 0

  // Redirection tardive : les liens sont créés après la lecture de la configuration.
  let bridge: BridgeClient = { send: () => false, close() {} }
  let runtime: RuntimeLink = { send() {}, dispose() {} }
  const actions = createActions(
    store,
    { send: m => bridge.send(m), close: () => bridge.close() },
    { send: m => runtime.send(m), dispose: () => runtime.dispose() },
  )

  const renders = [
    createToolbar(shell.toolbar, actions),
    createElementList(shell.list, actions),
    createInspector(shell.inspector, actions, store.get),
    createStatusBar(shell.status),
  ]
  store.subscribe(s => {
    for (const r of renders) r(s)
    renderOverlay(shell.overlay, s)
    shell.banner.hidden = s.appConnected
    shell.banner.textContent = s.fatal ?? 'App non connectée (lancez son serveur de dev)'
  })
  attachInteraction(shell.overlay, store, actions)
  store.set({})

  const bridgeCallbacks: BridgeCallbacks = {
    onStatus: status => store.set({ bridge: status }),
    onMessage: m => {
      if (m.type === 'bridge:error') store.set({ bridgeError: m.message })
      else {
        store.set({ overrides: m.doc, bridgeError: null })
        mockRuntime?.setOverrides(m.doc)
      }
    },
    onInvalid: errors => store.set({ bridgeError: `Message du pont refusé : ${errors[0]}` }),
  }
  const onRuntime = (m: RuntimeToDesigner): void => {
    lastSeen = Date.now()
    if (m.type === 'runtime:hello') {
      store.set({ appConnected: true, appUrl: m.url })
      runtime.send({ type: 'designer:measure' })
      return
    }
    const s = store.get()
    store.set({
      appConnected: true,
      measured: true,
      elements: m.elements,
      selectedId: m.elements.some(e => e.id === s.selectedId) ? s.selectedId : null,
    })
  }

  let mockRuntime: MockRuntime | null = null
  if (mock) {
    const mb = createMockBridge(bridgeCallbacks, MOCK_DOC)
    bridge = mb
    mockRuntime = createMockRuntime(shell.viewport, onRuntime)
    runtime = mockRuntime
    store.set({ appUrl: 'mock://app' })
    window.__delphiaMock = { sent: mb.sent, doc: mb.doc }
  } else {
    void loadConfig().then(cfg => {
      if (!cfg.ok) return store.set({ fatal: `Configuration illisible : ${cfg.errors[0]}` })
      const iframe = document.createElement('iframe')
      iframe.title = 'Application affichée'
      shell.viewport.prepend(iframe)
      runtime = createRuntimeLink({ iframe, appUrl: cfg.value.appUrl, onMessage: onRuntime })
      iframe.addEventListener('load', () => runtime.send({ type: 'designer:measure' }))
      iframe.src = cfg.value.appUrl
      bridge = createBridgeClient({ url: bridgeSocketUrl(location), ...bridgeCallbacks })
    })
  }

  // Détecte l'arrêt de l'app : le runtime répond toujours à une mesure.
  setInterval(() => {
    if (!store.get().appConnected) return
    if (Date.now() - lastSeen > SILENCE_MS) store.set({ appConnected: false })
    else runtime.send({ type: 'designer:measure' })
  }, PING_MS)
}

main()
