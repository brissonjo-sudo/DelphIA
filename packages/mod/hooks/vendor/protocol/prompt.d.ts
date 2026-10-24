import type { OverridesDiff, OverridesDoc } from './overrides.js';
/**
 * Section ajoutée au prompt système par le mod : liste des éléments dont
 * l'utilisateur a fixé la géométrie à la main. Vide s'il n'y en a aucun.
 */
export declare function summarizeForPrompt(doc: OverridesDoc, maxItems?: number): string;
/** Phrase courte pour l'interface (statut, notification) après un changement. */
export declare function describeDiff(diff: OverridesDiff): string;
