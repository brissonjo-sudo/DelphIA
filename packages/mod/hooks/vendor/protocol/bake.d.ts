/**
 * « Figer » : faire passer des ajustements de la surcouche CSS dans le code (ADR 0003).
 *
 * Cycle d'une demande, toujours écrit par le pont dans `.delphia/bake.json` :
 *   requested ─(mod : tour de Claude terminé)→ applied ─(concepteur : mesure)→ verified | mismatch
 *   requested ─(tour interrompu / refusé / abandon)→ cancelled
 *   applied | mismatch ─(utilisateur : « Rétablir »)→ reverted
 */
import { type Geometry } from './geometry.js';
import { type Rect } from './rect.js';
import { type Result } from './result.js';
export declare const BAKE_FILE = ".delphia/bake.json";
export declare const BAKE_VERSION = 1;
export declare const BAKE_ID_PATTERN: RegExp;
export declare const MAX_BAKE_ITEMS = 200;
export declare const MAX_BAKE_HISTORY = 20;
export declare const MAX_TOUCHED_FILES = 200;
/** Écart toléré, en px, entre la position visée et la position mesurée après figeage. */
export declare const BAKE_TOLERANCE_PX = 1;
export type BakeStatus = 'requested' | 'applied' | 'verified' | 'mismatch' | 'cancelled' | 'reverted';
/** Un élément à figer : l'ajustement à reproduire et le rectangle visé (mesuré avec la surcouche). */
export interface BakeItem {
    id: string;
    geometry: Geometry;
    target: Rect;
}
/** Résultat de la vérification d'un élément. `actual: null` = élément introuvable après figeage. */
export interface BakeResult {
    id: string;
    ok: boolean;
    actual: Rect | null;
}
export interface BakeRequest {
    bakeId: string;
    status: BakeStatus;
    createdAt: string;
    updatedAt: string;
    items: BakeItem[];
    /** Fichiers modifiés par Claude pendant le tour de figeage (renseigné par le mod). */
    touchedFiles: string[];
    results: BakeResult[];
    /** Raison d'une annulation, d'un écart ou d'un refus (texte court). */
    note?: string;
}
export interface BakeDoc {
    version: typeof BAKE_VERSION;
    /** Demande en cours (au plus une), ou `null`. */
    current: BakeRequest | null;
    /** Demandes terminées, la plus récente en premier. */
    history: BakeRequest[];
}
export declare const emptyBake: () => BakeDoc;
/** Une demande est « en cours » tant que Claude ou la vérification n'a pas conclu. */
export declare const isBakeOpen: (r: BakeRequest | null) => boolean;
/** Génère un identifiant de demande à partir d'octets aléatoires fournis par l'appelant. */
export declare function makeBakeId(random: Uint8Array): string;
export declare function parseBakeRequest(v: unknown, where?: string): Result<BakeRequest>;
/** Valide le contenu de `.delphia/bake.json`. */
export declare function parseBakeDoc(input: unknown): Result<BakeDoc>;
/** `POST` : le tour de figeage est terminé ; le pont retire les éléments de la surcouche. */
export declare const BAKE_APPLIED_ROUTE = "/api/bake/applied";
/** `POST` : le tour de figeage n'a pas abouti ; rien n'est retiré. */
export declare const BAKE_CANCEL_ROUTE = "/api/bake/cancel";
export interface BakeAppliedBody {
    bakeId: string;
    touchedFiles: string[];
}
export interface BakeCancelBody {
    bakeId: string;
    note: string;
}
export declare function parseBakeAppliedBody(v: unknown): Result<BakeAppliedBody>;
export declare function parseBakeCancelBody(v: unknown): Result<BakeCancelBody>;
/** Compare la position mesurée après figeage à la position visée, à `tolerance` px près. */
export declare function compareRects(target: Rect, actual: Rect | null, tolerance?: number): {
    ok: boolean;
    delta: null;
} | {
    ok: boolean;
    delta: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
};
/** Phrase courte, visible dans la zone de saisie, qui déclenche le tour de figeage. */
export declare const bakeTrigger: (bakeId: string) => string;
/** Retrouve l'identifiant de demande dans un texte de prompt. */
export declare function findBakeId(text: string): string | null;
/**
 * Consigne détaillée, ajoutée en contexte au tour de figeage (le texte visible reste court).
 * Claude doit reproduire chaque ajustement dans le code, sans toucher `.delphia/`.
 */
export declare function bakeInstructions(req: BakeRequest): string;
