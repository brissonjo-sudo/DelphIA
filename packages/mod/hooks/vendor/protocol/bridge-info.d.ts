import { type Result } from './result.js';
/** Contenu de `.delphia/bridge.json`, écrit par le pont à son démarrage. */
export interface BridgeInfo {
    pid: number;
    /** Port local du concepteur et du WebSocket (127.0.0.1 uniquement). */
    port: number;
    /** Port du serveur Vite de l'app cible, affichée dans le concepteur. */
    appPort: number;
    startedAt: string;
}
export declare function parseBridgeInfo(input: unknown): Result<BridgeInfo>;
