import { fail, isRecord, ok } from './result.js';
export const BRIDGE_TOKEN_HEADER = 'x-delphia-token';
export const BRIDGE_TOKEN_PATTERN = /^[a-f0-9]{32,128}$/;
const isPort = (v) => typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 65_536;
export function parseBridgeInfo(input) {
    if (!isRecord(input))
        return fail(['objet attendu']);
    const { pid, port, appPort, startedAt, token } = input;
    if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0)
        return fail(['pid']);
    if (!isPort(port))
        return fail(['port']);
    if (!isPort(appPort))
        return fail(['appPort']);
    if (typeof startedAt !== 'string')
        return fail(['startedAt']);
    if (typeof token !== 'string' || !BRIDGE_TOKEN_PATTERN.test(token))
        return fail(['token']);
    return ok({ pid, port, appPort, startedAt, token });
}
//# sourceMappingURL=bridge-info.js.map