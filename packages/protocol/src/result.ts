/** Résultat d'une validation : la valeur, ou la liste des erreurs lisibles. */
export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] }

export const ok = <T>(value: T): Result<T> => ({ ok: true, value })
export const fail = <T>(errors: string[]): Result<T> => ({ ok: false, errors })

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
