import { type Geometry } from './geometry.js';
import { type Result } from './result.js';
export declare const OVERRIDES_VERSION = 1;
export declare const MAX_ELEMENTS = 2000;
/** Ajustement d'un élément, horodaté (ISO 8601 UTC). */
export interface ElementOverride extends Geometry {
    updatedAt: string;
}
/**
 * Contenu de `.delphia/overrides.json` : source de vérité des ajustements manuels.
 * `revision` augmente à chaque écriture ; le mod s'en sert pour détecter les changements.
 */
export interface OverridesDoc {
    version: typeof OVERRIDES_VERSION;
    revision: number;
    elements: Record<string, ElementOverride>;
}
/** Patch d'ajustement : une clé à `null` la retire, une clé absente la conserve. */
export type GeometryPatch = {
    [K in keyof Geometry]?: number | null;
};
export declare function emptyOverrides(): OverridesDoc;
/** Valide un document d'ajustements lu sur disque (JSON déjà parsé). */
export declare function parseOverrides(input: unknown): Result<OverridesDoc>;
/**
 * Applique un ajustement et renvoie un nouveau document (l'original n'est pas modifié).
 * `patch` fusionne avec l'existant ; `patch === null` retire tout l'ajustement de l'élément.
 */
export declare function applyPatch(doc: OverridesDoc, id: string, patch: GeometryPatch | null, now: Date): OverridesDoc;
export interface OverridesDiff {
    added: string[];
    changed: string[];
    removed: string[];
}
/** Éléments ajoutés, modifiés ou retirés entre deux versions du document. */
export declare function diffOverrides(prev: OverridesDoc, next: OverridesDoc): OverridesDiff;
