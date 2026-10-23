import { isDzId } from './ids.js';
import { GEOMETRY_KEYS, isEmptyGeometry, normalizeGeometry, parseGeometry, } from './geometry.js';
import { fail, isRecord, ok } from './result.js';
export const OVERRIDES_VERSION = 1;
export const MAX_ELEMENTS = 2_000;
export function emptyOverrides() {
    return { version: OVERRIDES_VERSION, revision: 0, elements: {} };
}
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
/** Valide un document d'ajustements lu sur disque (JSON déjà parsé). */
export function parseOverrides(input) {
    if (!isRecord(input))
        return fail(['document : objet attendu']);
    const errors = [];
    if (input.version !== OVERRIDES_VERSION)
        errors.push(`version : ${OVERRIDES_VERSION} attendu`);
    const revision = input.revision;
    if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0) {
        errors.push('revision : entier positif attendu');
    }
    if (!isRecord(input.elements))
        return fail([...errors, 'elements : objet attendu']);
    const ids = Object.keys(input.elements);
    if (ids.length > MAX_ELEMENTS)
        errors.push(`elements : au plus ${MAX_ELEMENTS}`);
    const elements = {};
    for (const id of ids) {
        if (!isDzId(id)) {
            errors.push(`elements : identifiant invalide ${JSON.stringify(id)}`);
            continue;
        }
        const raw = input.elements[id];
        if (!isRecord(raw)) {
            errors.push(`elements.${id} : objet attendu`);
            continue;
        }
        const { updatedAt, ...geometryInput } = raw;
        if (typeof updatedAt !== 'string' || !ISO_DATE.test(updatedAt)) {
            errors.push(`elements.${id}.updatedAt : date ISO UTC attendue`);
            continue;
        }
        const geometry = parseGeometry(geometryInput, `elements.${id}`);
        if (!geometry.ok) {
            errors.push(...geometry.errors);
            continue;
        }
        if (isEmptyGeometry(geometry.value)) {
            errors.push(`elements.${id} : aucun ajustement`);
            continue;
        }
        elements[id] = { ...geometry.value, updatedAt };
    }
    if (errors.length)
        return fail(errors);
    return ok({ version: OVERRIDES_VERSION, revision: revision, elements });
}
/**
 * Applique un ajustement et renvoie un nouveau document (l'original n'est pas modifié).
 * `patch` fusionne avec l'existant ; `patch === null` retire tout l'ajustement de l'élément.
 */
export function applyPatch(doc, id, patch, now) {
    if (!isDzId(id))
        throw new Error(`Identifiant DelphIA invalide : ${JSON.stringify(id)}`);
    const elements = { ...doc.elements };
    const current = elements[id];
    if (patch === null) {
        delete elements[id];
    }
    else {
        const merged = {};
        for (const key of GEOMETRY_KEYS) {
            const value = key in patch ? patch[key] : current?.[key];
            if (value !== null && value !== undefined)
                merged[key] = value;
        }
        const geometry = normalizeGeometry(merged);
        if (isEmptyGeometry(geometry))
            delete elements[id];
        else
            elements[id] = { ...geometry, updatedAt: now.toISOString() };
    }
    if (Object.keys(elements).length > MAX_ELEMENTS) {
        throw new Error(`Trop d'éléments ajustés (au plus ${MAX_ELEMENTS})`);
    }
    return { version: OVERRIDES_VERSION, revision: doc.revision + 1, elements };
}
/** Éléments ajoutés, modifiés ou retirés entre deux versions du document. */
export function diffOverrides(prev, next) {
    const added = [];
    const changed = [];
    const removed = [];
    for (const id of Object.keys(next.elements).sort()) {
        const before = prev.elements[id];
        const after = next.elements[id];
        if (!before)
            added.push(id);
        else if (GEOMETRY_KEYS.some(k => before[k] !== after?.[k]))
            changed.push(id);
    }
    for (const id of Object.keys(prev.elements).sort()) {
        if (!(id in next.elements))
            removed.push(id);
    }
    return { added, changed, removed };
}
//# sourceMappingURL=overrides.js.map