import type { HtmlTagDescriptor } from 'vite'
import { toPosix } from './runtime-files.js'

export const RUNTIME_ID = 'virtual:delphia/runtime'
export const RESOLVED_RUNTIME_ID = `\0${RUNTIME_ID}`
/** URL de ce module telle que Vite la sert au navigateur. */
export const RUNTIME_URL = `/@id/__x00__${RUNTIME_ID}`

/** Code du module virtuel : démarre le runtime avec la config du projet et le HMR de Vite. */
export function runtimeModuleCode(entry: string, designerOrigins: readonly string[]): string {
  return [
    `import { startDelphia } from ${JSON.stringify(toPosix(entry))}`,
    `startDelphia({ designerOrigins: ${JSON.stringify(designerOrigins)}, hot: import.meta.hot })`,
    '',
  ].join('\n')
}

/** Balise du CSS de surcouche, insérée en fin de `<head>`. */
export function styleTag(css: string): HtmlTagDescriptor {
  return { tag: 'style', attrs: { 'data-delphia': true }, children: css, injectTo: 'head' }
}

export function runtimeScriptTag(): HtmlTagDescriptor {
  return { tag: 'script', attrs: { type: 'module', src: RUNTIME_URL }, injectTo: 'head' }
}
