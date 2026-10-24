import { type Result } from './result.js';
/** Nom du fichier de configuration, à la racine du projet cible. Sa présence active DelphIA. */
export declare const CONFIG_FILE = "delphia.config.json";
export declare const DEFAULT_BRIDGE_PORT = 4317;
/** Port par défaut du serveur Vite d'une app Tauri 2. */
export declare const DEFAULT_APP_PORT = 1420;
/** Contenu de `delphia.config.json`. Tous les champs sont optionnels sur disque. */
export interface DelphiaConfig {
    /** Port local du pont (concepteur + WebSocket). */
    port: number;
    /** Port du serveur Vite de l'app cible. */
    appPort: number;
}
/** Valide la configuration ; les champs absents prennent leur valeur par défaut. */
export declare function parseConfig(input: unknown): Result<DelphiaConfig>;
