import { dzSelector } from './ids.js'
import type { OverridesDoc } from './overrides.js'

export const CSS_HEADER =
  '/* Généré par DelphIA depuis .delphia/overrides.json — ne pas éditer à la main. */'

/**
 * Transforme les ajustements en CSS, chargé après le CSS de l'application.
 * `!important` garantit que la retouche manuelle l'emporte sur le code écrit par Claude.
 * Sortie déterministe (ids triés) pour des diffs stables.
 */
export function overridesToCss(doc: OverridesDoc): string {
  const rules: string[] = [CSS_HEADER]
  for (const id of Object.keys(doc.elements).sort()) {
    const o = doc.elements[id]
    if (!o) continue
    const decls: string[] = []
    if (o.dx !== undefined || o.dy !== undefined) {
      decls.push(`translate: ${o.dx ?? 0}px ${o.dy ?? 0}px !important;`)
    }
    if (o.width !== undefined || o.height !== undefined) {
      decls.push('box-sizing: border-box !important;')
    }
    if (o.width !== undefined) decls.push(`width: ${o.width}px !important;`)
    if (o.height !== undefined) decls.push(`height: ${o.height}px !important;`)
    if (decls.length) rules.push(`${dzSelector(id)} {\n  ${decls.join('\n  ')}\n}`)
  }
  return rules.join('\n') + '\n'
}
