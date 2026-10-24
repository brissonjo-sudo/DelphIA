/**
 * Identifiants d'éléments DelphIA.
 *
 * Chaque élément ajustable porte `data-dz-id="<id>"`. Le motif est volontairement
 * étroit : l'id est réinjecté tel quel dans un sélecteur CSS généré, il ne doit
 * donc contenir ni guillemet, ni crochet, ni barre oblique inverse.
 */
export const DZ_ATTR = 'data-dz-id';
export const DZ_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
export const isDzId = (value) => typeof value === 'string' && DZ_ID_PATTERN.test(value);
/** Sélecteur CSS d'un élément ; lève une erreur si l'id est invalide. */
export function dzSelector(id) {
    if (!isDzId(id))
        throw new Error(`Identifiant DelphIA invalide : ${JSON.stringify(id)}`);
    return `[${DZ_ATTR}="${id}"]`;
}
//# sourceMappingURL=ids.js.map