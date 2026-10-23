/**
 * Emplacements des fichiers DelphIA, relatifs à la racine du projet cible.
 * `.delphia/` appartient à l'utilisateur et au pont : Claude n'y écrit jamais.
 */
export const DELPHIA_DIR = '.delphia'
export const OVERRIDES_FILE = `${DELPHIA_DIR}/overrides.json`
export const BRIDGE_FILE = `${DELPHIA_DIR}/bridge.json`

/** Vrai si le chemin (absolu ou relatif, séparateurs Windows ou POSIX) vise `.delphia/`. */
export function isProtectedPath(path: string): boolean {
  const segments = path.replace(/\\/g, '/').toLowerCase().split('/')
  return segments.includes(DELPHIA_DIR)
}
