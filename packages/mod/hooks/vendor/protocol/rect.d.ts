/** Rectangle mesuré (`getBoundingClientRect`, relatif au viewport de l'app), en px CSS. */
export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}
export declare const isFiniteNum: (v: unknown) => v is number;
/** Valide un rectangle ; `null` si invalide. */
export declare function parseRect(v: unknown): Rect | null;
