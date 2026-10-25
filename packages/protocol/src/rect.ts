import { isRecord } from './result.js'

/** Rectangle mesuré (`getBoundingClientRect`, relatif au viewport de l'app), en px CSS. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Valide un rectangle ; `null` si invalide. */
export function parseRect(v: unknown): Rect | null {
  if (!isRecord(v)) return null
  const { x, y, width, height } = v
  if (![x, y, width, height].every(isFiniteNum)) return null
  return { x: x as number, y: y as number, width: width as number, height: height as number }
}
