import { parseGeometry } from './geometry.js';
import { isDzId } from './ids.js';
import { parseOverrides } from './overrides.js';
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
const isFiniteNum = (v) => typeof v === 'number' && Number.isFinite(v);
function unwrap(input) {
    if (!isRecord(input) || input.tag !== PROTOCOL_TAG)
        return fail(['enveloppe DelphIA absente']);
    if (!isRecord(input.msg) || typeof input.msg.type !== 'string')
        return fail(['message sans type']);
    return ok(input.msg);
}
function parseRect(v) {
    if (!isRecord(v))
        return null;
    const { x, y, width, height } = v;
    if (![x, y, width, height].every(isFiniteNum))
        return null;
    return { x: x, y: y, width: width, height: height };
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
export function parseClientToBridge(input) {
    const m = unwrap(input);
    if (!m.ok)
        return m;
    const msg = m.value;
    if (!isDzId(msg.id))
        return fail(['id']);
    switch (msg.type) {
        case 'override:set': {
            const p = parsePatch(msg.patch);
            return p.ok ? ok({ type: msg.type, id: msg.id, patch: p.value }) : p;
        }
        case 'override:clear':
            return ok({ type: msg.type, id: msg.id });
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
        case 'bridge:error':
            return typeof msg.message === 'string'
                ? ok({ type: msg.type, message: msg.message.slice(0, 500) })
                : fail(['message']);
        default:
            return fail([`type inconnu : ${String(msg.type)}`]);
    }
}
//# sourceMappingURL=messages.js.map