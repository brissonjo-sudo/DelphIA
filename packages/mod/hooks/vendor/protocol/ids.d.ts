/**
 * Identifiants d'éléments DelphIA.
 *
 * Chaque élément ajustable porte `data-dz-id="<id>"`. Le motif est volontairement
 * étroit : l'id est réinjecté tel quel dans un sélecteur CSS généré, il ne doit
 * donc contenir ni guillemet, ni crochet, ni barre oblique inverse.
 */
export declare const DZ_ATTR = "data-dz-id";
export declare const DZ_ID_PATTERN: RegExp;
export declare const isDzId: (value: unknown) => value is string;
/** Sélecteur CSS d'un élément ; lève une erreur si l'id est invalide. */
export declare function dzSelector(id: string): string;
