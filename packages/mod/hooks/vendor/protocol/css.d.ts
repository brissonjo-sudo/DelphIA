import type { OverridesDoc } from './overrides.js';
export declare const CSS_HEADER = "/* G\u00E9n\u00E9r\u00E9 par DelphIA depuis .delphia/overrides.json \u2014 ne pas \u00E9diter \u00E0 la main. */";
/**
 * Transforme les ajustements en CSS, chargé après le CSS de l'application.
 * `!important` garantit que la retouche manuelle l'emporte sur le code écrit par Claude.
 * Sortie déterministe (ids triés) pour des diffs stables.
 */
export declare function overridesToCss(doc: OverridesDoc): string;
