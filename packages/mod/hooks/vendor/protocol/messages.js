import { BAKE_ID_PATTERN, MAX_BAKE_ITEMS, parseBakeDoc } from './bake.js';
import { parseGeometry } from './geometry.js';
import { isDzId } from './ids.js';
import { parseOverrides } from './overrides.js';
import { isFiniteNum, parseRect } from './rect.js';
import { fail, isRecord, ok } from './result.js';
/** Marqueur d'enveloppe : distingue les messages DelphIA des autres `postMessage`. */
export const PROTOCOL_TAG = 'delphia/1';
/** Enveloppe sur le fil : `{ tag, msg }`. */
export const wrap = (msg) => ({
    tag: PROTOCOL_TAG,
    msg,
});
// ── Validation ──────────────────────────────────────────────────────────────
const MAX_LIST = 5_000;
function unwrap(input) {
    if (!isRecord(input) || input.tag !== PROTOCOL_TAG)
        return fail(['enveloppe DelphIA absente']);
    if (!isRecord(input.msg) || typeof input.msg.type !== 'string')
        return fail(['message sans type']);
    return ok(input.msg);
}
function parseElement(v) {
    if (!isRecord(v) || !isDzId(v.id) || typeof v.tag !== 'string' || v.tag.length > 32)
        return null;
    if (v.parentId !== null && !isDzId(v.parentId))
        return null;
    const rect = parseRect(v.rect);
    return rect ? { id: v.id, tag: v.tag, parentId: v.parentId, rect } : null;
}
export function parseRuntimeToDesigner(input) {
    const m = unwrap(input);
    if (!m.ok)
        return m;
    const msg = m.value;
    switch (msg.type) {
        case 'runtime:hello':
            return typeof msg.url === 'string' ? ok({ type: msg.type, url: msg.url }) : fail(['url']);
        case 'runtime:elements': {
            const vp = msg.viewport;
            if (!isRecord(vp) || !isFiniteNum(vp.width) || !isFiniteNum(vp.height))
                return fail(['viewport']);
            if (!Array.isArray(msg.elements) || msg.elements.length > MAX_LIST)
                return fail(['elements']);
            const elements = [];
            for (const raw of msg.elements) {
                const el = parseElement(raw);
                if (!el)
                    return fail(['élément invalide']);
                elements.push(el);
            }
            return ok({ type: msg.type, viewport: { width: vp.width, height: vp.height }, elements });
        }
        default:
            return fail([`type inconnu : ${String(msg.type)}`]);
    }
}
export function parseDesignerToRuntime(input) {
    const m = unwrap(input);
    if (!m.ok)
        return m;
    const msg = m.value;
    switch (msg.type) {
        case 'designer:measure':
            return ok({ type: msg.type });
        case 'designer:preview': {
            if (!isDzId(msg.id))
                return fail(['id']);
            if (msg.geometry === null)
                return ok({ type: msg.type, id: msg.id, geometry: null });
            const g = parseGeometry(msg.geometry);
            return g.ok ? ok({ type: msg.type, id: msg.id, geometry: g.value }) : g;
        }
        default:
            return fail([`type inconnu : ${String(msg.type)}`]);
    }
}
function parsePatch(v) {
    if (!isRecord(v))
        return fail(['patch : objet attendu']);
    const removed = {};
    const kept = {};
    for (const [k, val] of Object.entries(v)) {
        if (val === null)
            removed[k] = null;
        else
            kept[k] = val;
    }
    const g = parseGeometry(kept, 'patch');
    if (!g.ok)
        return g;
    for (const k of Object.keys(removed)) {
        if (!['dx', 'dy', 'width', 'height'].includes(k))
            return fail([`patch.${k} : clé inconnue`]);
    }
    return ok({ ...g.value, ...removed });
}
const isBakeId = (v) => typeof v === 'string' && BAKE_ID_PATTERN.test(v);
/** Liste `{ id, <champ>: Rect }` sans doublon, 1 à MAX_BAKE_ITEMS entrées. */
function parseIdRects(v, field, nullable) {
    if (!Array.isArray(v) || v.length === 0 || v.length > MAX_BAKE_ITEMS) {
        return fail([`liste de 1 à ${MAX_BAKE_ITEMS} éléments attendue`]);
    }
    const out = [];
    const seen = new Set();
    for (const raw of v) {
        if (!isRecord(raw) || !isDzId(raw.id) || seen.has(raw.id))
            return fail(['id invalide ou doublon']);
        seen.add(raw.id);
        const rect = nullable && raw[field] === null ? null : parseRect(raw[field]);
        if (rect === null && !(nullable && raw[field] === null))
            return fail([`${field} invalide`]);
        out.push({ id: raw.id, [field]: rect });
    }
    return ok(out);
}
export function parseClientToBridge(input) {
    const m = unwrap(input);
    if (!m.ok)
        return m;
    const msg = m.value;
    switch (msg.type) {
        case 'override:set': {
            if (!isDzId(msg.id))
                return fail(['id']);
            const p = parsePatch(msg.patch);
            return p.ok ? ok({ type: msg.type, id: msg.id, patch: p.value }) : p;
        }
        case 'override:clear':
            return isDzId(msg.id) ? ok({ type: msg.type, id: msg.id }) : fail(['id']);
        case 'bake:request': {
            const items = parseIdRects(msg.items, 'target', false);
            if (!items.ok)
                return items;
            return ok({
                type: msg.type,
                items: items.value.map(i => ({ id: i.id, target: i.target })),
            });
        }
        case 'bake:verify': {
            if (!isBakeId(msg.bakeId))
                return fail(['bakeId']);
            const results = parseIdRects(msg.results, 'actual', true);
            return results.ok
                ? ok({ type: msg.type, bakeId: msg.bakeId, results: results.value })
                : results;
        }
        case 'bake:revert':
        case 'bake:cancel':
            return isBakeId(msg.bakeId) ? ok({ type: msg.type, bakeId: msg.bakeId }) : fail(['bakeId']);
        default:
            return fail([`type inconnu : ${String(msg.type)}`]);
    }
}
export function parseBridgeToClient(input) {
    const m = unwrap(input);
    if (!m.ok)
        return m;
    const msg = m.value;
    switch (msg.type) {
        case 'overrides:state': {
            const d = parseOverrides(msg.doc);
            return d.ok ? ok({ type: msg.type, doc: d.value }) : d;
        }
        case 'bake:state': {
            const b = parseBakeDoc(msg.bake);
            return b.ok ? ok({ type: msg.type, bake: b.value }) : b;
        }
        case 'bridge:error':
            return typeof msg.message === 'string'
                ? ok({ type: msg.type, message: msg.message.slice(0, 500) })
                : fail(['message']);
        default:
            return fail([`type inconnu : ${String(msg.type)}`]);
    }
}
//# sourceMappingURL=messages.js.map