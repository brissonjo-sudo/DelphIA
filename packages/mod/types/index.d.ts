// Contrat de $.state du mod DelphIA (voir "types" dans .claude-plugin/plugin.json).
// Autonome : aucun import. Les formes recopient OverridesDoc du protocole.

export type DelphiaOverrideSeen = {
  dx?: number
  dy?: number
  width?: number
  height?: number
  updatedAt: string
}

/** Dernier document d'ajustements vu par le mod (sert à décrire ce qui a changé). */
export type DelphiaSeenDoc = {
  version: 1
  revision: number
  elements: Record<string, DelphiaOverrideSeen>
}

/** État du pont tel que le mod le connaît. */
export type DelphiaBridgeState = {
  status: 'starting' | 'running' | 'external' | 'stopped' | 'failed'
  /** URL du concepteur, quand le pont répond. */
  url: string | null
  /** Détail lisible (cause d'un échec, code de sortie). */
  detail: string | null
}

declare module 'claude-code' {
  interface PluginState {
    delphia: {
      seen: DelphiaSeenDoc | null
      bridge: DelphiaBridgeState
    }
  }
}
