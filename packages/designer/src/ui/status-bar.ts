import type { BridgeStatus } from '../io/bridge-client.js'
import type { AppState } from '../state.js'
import { h } from './dom.js'

const BRIDGE_TEXT: Record<BridgeStatus, string> = {
  open: 'Pont : connecté',
  connecting: 'Pont : connexion…',
  closed: 'Pont : déconnecté (nouvelle tentative…)',
}

/** Barre d'état : connexion au pont, à l'app, erreurs. */
export function createStatusBar(container: HTMLElement): (s: AppState) => void {
  const bridge = h('span', { id: 'status-bridge' })
  const app = h('span', { id: 'status-app' })
  const info = h('span', { id: 'status-info', class: 'grow' })
  container.setAttribute('role', 'status')
  container.append(bridge, app, info)
  return s => {
    bridge.textContent = BRIDGE_TEXT[s.bridge]
    bridge.dataset.state = s.bridge
    app.textContent = s.appConnected
      ? `App : connectée (${s.appUrl ?? '?'})`
      : 'App : non connectée'
    app.dataset.state = s.appConnected ? 'open' : 'closed'
    info.textContent = s.fatal ?? s.bridgeError ?? `${s.elements.length} élément(s) mesuré(s)`
    info.dataset.state = s.fatal || s.bridgeError ? 'error' : ''
  }
}
