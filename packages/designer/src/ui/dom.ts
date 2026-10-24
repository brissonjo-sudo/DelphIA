/** Crée un élément ; le texte passe par `textContent` et les attributs par `setAttribute`. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  for (const c of children) el.append(c)
  return el
}

/** Positionne un élément en pixels (valeurs numériques uniquement). */
export function place(el: HTMLElement, x: number, y: number, w?: number, hgt?: number): void {
  el.style.left = `${x}px`
  el.style.top = `${y}px`
  if (w !== undefined) el.style.width = `${w}px`
  if (hgt !== undefined) el.style.height = `${hgt}px`
}
