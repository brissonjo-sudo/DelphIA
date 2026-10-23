export const ok = (value) => ({ ok: true, value });
export const fail = (errors) => ({ ok: false, errors });
export const isRecord = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
//# sourceMappingURL=result.js.map