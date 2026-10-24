import { resolve } from 'node:path'
import { overridesToCss } from '@vite-plugin-delphia/protocol'
import type { Plugin, ViteDevServer } from 'vite'
import { resolveDesignerOrigins } from './config-source.js'
import { overridesPath, readOverrides } from './overrides-source.js'
import { OVERRIDES_EVENT } from './runtime/hot.js'
import { isInside, protocolEntry, runtimeDir, runtimeEntry, samePath } from './runtime-files.js'
import {
  RESOLVED_RUNTIME_ID,
  RUNTIME_ID,
  runtimeModuleCode,
  runtimeScriptTag,
  styleTag,
} from './virtual.js'

export interface DelphiaOptions {
  /** Racine du projet cible (celle de `delphia.config.json`). Défaut : racine de Vite. */
  root?: string
  /** Origines du concepteur autorisées. Défaut : `127.0.0.1` et `localhost` au port du pont. */
  designerOrigins?: string[]
}

export function delphia(options: DelphiaOptions = {}): Plugin {
  let root = ''
  let warn: (message: string) => void = console.warn
  let css = ''
  let hasRules = false
  let origins: string[] = []
  let seq = 0
  let loading: Promise<void> | undefined

  /** Relit overrides.json ; retourne vrai si le CSS a changé. Les lectures périmées sont écartées. */
  const refreshCss = async (): Promise<boolean> => {
    const gen = ++seq
    const doc = await readOverrides(root, warn)
    if (gen !== seq) return false
    const next = overridesToCss(doc)
    hasRules = Object.keys(doc.elements).length > 0
    const changed = next !== css
    css = next
    return changed
  }

  // Initialisation paresseuse : ne dépend pas de l'ordre des hooks serve / build.
  const ready = (): Promise<void> =>
    (loading ??= (async () => {
      await refreshCss()
      origins = await resolveDesignerOrigins(root, options.designerOrigins, warn)
    })())

  const watchOverrides = (server: ViteDevServer): void => {
    const file = overridesPath(root)
    // Vite surveille déjà sa racine. N'ajouter le fichier que s'il est ailleurs : ajouter un chemin
    // absent pendant le scan initial fait perdre les événements de création (constaté sous Windows).
    if (!isInside(server.config.root, file)) server.watcher.add(file)
    const onFsEvent = (changed: string): void => {
      if (!samePath(changed, file)) return
      void refreshCss().then(changed => {
        if (changed) server.ws.send({ type: 'custom', event: OVERRIDES_EVENT, data: { css } })
      })
    }
    server.watcher.on('add', onFsEvent).on('change', onFsEvent).on('unlink', onFsEvent)
  }

  return {
    name: 'delphia',
    enforce: 'pre',

    configResolved(config) {
      root = options.root ? resolve(config.root, options.root) : config.root
      warn = message => config.logger.warn(`[delphia] ${message}`)
      // Le runtime est servi depuis ce paquet, parfois hors de la racine du projet (monorepo, lien).
      config.server.fs.allow.push(runtimeDir, resolve(protocolEntry(), '..'))
    },

    configureServer: watchOverrides,

    buildStart: ready,

    resolveId(id, importer) {
      if (id === RUNTIME_ID) return RESOLVED_RUNTIME_ID
      // Le runtime importe le protocole par son nom : on le sert comme source, sans pré-bundling
      // (qui déclencherait un rechargement complet au premier chargement).
      if (id === '@vite-plugin-delphia/protocol' && importer && isInside(runtimeDir, importer)) {
        return protocolEntry()
      }
      return null
    },

    async load(id) {
      if (id !== RESOLVED_RUNTIME_ID) return null
      await ready()
      return runtimeModuleCode(runtimeEntry(), origins)
    },

    transformIndexHtml: {
      order: 'post',
      async handler(_html, ctx) {
        await ready()
        const serving = ctx.server !== undefined
        const tags = serving ? [runtimeScriptTag()] : []
        // En build, rien à embarquer s'il n'y a aucun ajustement.
        if (serving || hasRules) tags.push(styleTag(css))
        return tags
      },
    },
  }
}
