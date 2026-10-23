import { fail, isRecord, ok } from './result.js';
/** Borne absolue d'une valeur en pixels : protège le CSS généré des valeurs aberrantes. */
export const MAX_PX = 10_000;
export const GEOMETRY_KEYS = ['dx', 'dy', 'width', 'height'];
const minFor = (key) => (key === 'dx' || key === 'dy' ? -MAX_PX : 0);
export function isEmptyGeometry(g) {
    return GEOMETRY_KEYS.every(k => g[k] === undefined);
}
/** Valide une géométrie inconnue. Les clés inconnues sont refusées. */
export function parseGeometry(input, where = 'geometry') {
    if (!isRecord(input))
        return fail([`${where} : objet attendu`]);
    const errors = [];
    const out = {};
    for (const key of Object.keys(input)) {
        if (!GEOMETRY_KEYS.includes(key)) {
            errors.push(`${where}.${key} : clé inconnue`);
        }
    }
    for (const key of GEOMETRY_KEYS) {
        const v = input[key];
        if (v === undefined)
            continue;
        if (typeof v !== 'number' || !Number.isInteger(v)) {
            errors.push(`${where}.${key} : entier attendu`);
            continue;
        }
        if (v < minFor(key) || v > MAX_PX) {
            errors.push(`${where}.${key} : hors bornes [${minFor(key)}, ${MAX_PX}]`);
            continue;
        }
        out[key] = v;
    }
    return errors.length ? fail(errors) : ok(out);
}
/** Arrondit et borne une géométrie issue de mesures (souris, getBoundingClientRect). */
export function normalizeGeometry(g) {
    const out = {};
    for (const key of GEOMETRY_KEYS) {
        const v = g[key];
        if (v === undefined || !Number.isFinite(v))
            continue;
        out[key] = Math.min(MAX_PX, Math.max(minFor(key), Math.round(v)));
    }
    return out;
}
//# sourceMappingURL=geometry.js.map