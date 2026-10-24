import { type Result } from './result.js';
/** Contenu de `.delphia/bridge.json`, écrit par le pont à son démarrage. */
export interface BridgeInfo {
    pid: number;
    /** Port local du concepteur et du WebSocket (127.0.0.1 uniquement). */
    port: number;
    /** Port du serveur Vite de l'app cible, affichée dans le concepteur. */
    appPort: number;
    startedAt: string;
    /**
     * Jeton aléatoire (hexadécimal, ≥ 32 caractères), régénéré à chaque démarrage. Exigé par les
     * routes HTTP qui modifient l'état (`BRIDGE_TOKEN_HEADER`). Protège des pages web, pas d'un
     * processus local qui peut lire le fichier (ADR 0003).
     */
    token: string;
}
export declare const BRIDGE_TOKEN_HEADER = "x-delphia-token";
export declare const BRIDGE_TOKEN_PATTERN: RegExp;
export declare function parseBridgeInfo(input: unknown): Result<BridgeInfo>;
