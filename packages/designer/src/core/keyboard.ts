const DIRECTIONS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

/** Pas clavier : ±1 px, ±10 px avec Maj. `null` si la touche n'est pas une flèche. */
export function keyStep(key: string, shift: boolean): { dx: number; dy: number } | null {
  const d = Object.hasOwn(DIRECTIONS, key) ? DIRECTIONS[key] : undefined
  if (!d) return null
  const n = shift ? 10 : 1
  return { dx: d[0] * n, dy: d[1] * n }
}
