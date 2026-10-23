import { fail, isRecord, ok } from './result.js';
const isPort = (v) => typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 65_536;
export function parseBridgeInfo(input) {
    if (!isRecord(input))
        return fail(['objet attendu']);
    const { pid, port, appPort, startedAt } = input;
    if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0)
        return fail(['pid']);
    if (!isPort(port))
        return fail(['port']);
    if (!isPort(appPort))
        return fail(['appPort']);
    if (typeof startedAt !== 'string')
        return fail(['startedAt']);
    return ok({ pid, port, appPort, startedAt });
}
//# sourceMappingURL=bridge-info.js.map