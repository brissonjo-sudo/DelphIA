/**
 * Emplacements des fichiers DelphIA, relatifs à la racine du projet cible.
 * `.delphia/` appartient à l'utilisateur et au pont : Claude n'y écrit jamais.
 */
export declare const DELPHIA_DIR = ".delphia";
export declare const OVERRIDES_FILE = ".delphia/overrides.json";
export declare const BRIDGE_FILE = ".delphia/bridge.json";
/** Vrai si le chemin (absolu ou relatif, séparateurs Windows ou POSIX) vise `.delphia/`. */
export declare function isProtectedPath(path: string): boolean;
