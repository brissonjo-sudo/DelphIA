import { isRecord } from './result.js';
export const isFiniteNum = (v) => typeof v === 'number' && Number.isFinite(v);
/** Valide un rectangle ; `null` si invalide. */
export function parseRect(v) {
    if (!isRecord(v))
        return null;
    const { x, y, width, height } = v;
    if (![x, y, width, height].every(isFiniteNum))
        return null;
    return { x: x, y: y, width: width, height: height };
}
//# sourceMappingURL=rect.js.map