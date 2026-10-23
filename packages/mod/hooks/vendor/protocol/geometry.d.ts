import { type Result } from './result.js';
/** Borne absolue d'une valeur en pixels : protège le CSS généré des valeurs aberrantes. */
export declare const MAX_PX = 10000;
/**
 * Ajustement manuel d'un élément, en pixels CSS entiers.
 * - `dx`, `dy` : décalage par rapport à la position calculée par le code (propriété `translate`).
 * - `width`, `height` : taille imposée (bordure comprise).
 * Un champ absent laisse le code décider.
 */
export interface Geometry {
    dx?: number;
    dy?: number;
    width?: number;
    height?: number;
}
export declare const GEOMETRY_KEYS: readonly ["dx", "dy", "width", "height"];
export type GeometryKey = (typeof GEOMETRY_KEYS)[number];
export declare function isEmptyGeometry(g: Geometry): boolean;
/** Valide une géométrie inconnue. Les clés inconnues sont refusées. */
export declare function parseGeometry(input: unknown, where?: string): Result<Geometry>;
/** Arrondit et borne une géométrie issue de mesures (souris, getBoundingClientRect). */
export declare function normalizeGeometry(g: Geometry): Geometry;
