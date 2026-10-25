/** Sélection multiple : le dernier id de la liste est l'élément principal. */

/** Maj+clic : ajoute `id`, ou le retire s'il est déjà sélectionné. */
export function toggleSelection(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
}

/** Clic simple ou liste : sélection d'un seul élément (ou aucune). */
export const singleSelection = (id: string | null): string[] => (id === null ? [] : [id])

/** Après une mesure : retire les ids qui n'existent plus dans la page. */
export const pruneSelection = (ids: readonly string[], present: readonly string[]): string[] =>
  ids.filter(id => present.includes(id))

export const primaryOf = (ids: readonly string[]): string | null => ids.at(-1) ?? null
