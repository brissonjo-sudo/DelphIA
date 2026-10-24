import { MAX_PX, type GeometryKey } from '@vite-plugin-delphia/protocol'

export type FieldParse = { ok: true; value: number | null } | { ok: false; reason: string }

/** Valide la saisie d'un champ de l'inspecteur. Vide = retirer l'ajustement de ce champ. */
export function parseField(key: GeometryKey, text: string): FieldParse {
  const t = text.trim()
  if (t === '') return { ok: true, value: null }
  if (!/^-?\d+$/.test(t)) return { ok: false, reason: 'entier attendu' }
  const value = Number(t)
  const min = key === 'dx' || key === 'dy' ? -MAX_PX : 1
  if (value < min || value > MAX_PX) return { ok: false, reason: `entre ${min} et ${MAX_PX}` }
  return { ok: true, value }
}
