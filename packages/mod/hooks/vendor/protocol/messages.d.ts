import { type BakeDoc } from './bake.js';
import { type Geometry } from './geometry.js';
import { type GeometryPatch, type OverridesDoc } from './overrides.js';
import { type Rect } from './rect.js';
import { type Result } from './result.js';
/** Marqueur d'enveloppe : distingue les messages DelphIA des autres `postMessage`. */
export declare const PROTOCOL_TAG = "delphia/1";
/** Un élément ajustable tel que le runtime le mesure dans l'app affichée. */
export interface ElementInfo {
    id: string;
    tag: string;
    parentId: string | null;
    rect: Rect;
}
export type RuntimeToDesigner = {
    type: 'runtime:hello';
    url: string;
} | {
    type: 'runtime:elements';
    viewport: {
        width: number;
        height: number;
    };
    elements: ElementInfo[];
};
export type DesignerToRuntime = {
    type: 'designer:measure';
}
/** Aperçu pendant un glisser ; `geometry: null` retire l'aperçu. */
 | {
    type: 'designer:preview';
    id: string;
    geometry: Geometry | null;
};
export type ClientToBridge = {
    type: 'override:set';
    id: string;
    patch: GeometryPatch;
} | {
    type: 'override:clear';
    id: string;
}
/** « Figer » : rectangles visés, mesurés avec la surcouche ; la géométrie vient du pont. */
 | {
    type: 'bake:request';
    items: {
        id: string;
        target: Rect;
    }[];
}
/** Mesures après figeage ; le pont juge lui-même (`compareRects`). `null` = introuvable. */
 | {
    type: 'bake:verify';
    bakeId: string;
    results: {
        id: string;
        actual: Rect | null;
    }[];
}
/** Remet dans la surcouche les ajustements figés (le code modifié reste : git). */
 | {
    type: 'bake:revert';
    bakeId: string;
}
/** Abandonne une demande pas encore traitée par Claude. */
 | {
    type: 'bake:cancel';
    bakeId: string;
};
export type BridgeToClient = {
    type: 'overrides:state';
    doc: OverridesDoc;
} | {
    type: 'bake:state';
    bake: BakeDoc;
} | {
    type: 'bridge:error';
    message: string;
};
/** Enveloppe sur le fil : `{ tag, msg }`. */
export declare const wrap: <M>(msg: M) => {
    tag: typeof PROTOCOL_TAG;
    msg: M;
};
export declare function parseRuntimeToDesigner(input: unknown): Result<RuntimeToDesigner>;
export declare function parseDesignerToRuntime(input: unknown): Result<DesignerToRuntime>;
export declare function parseClientToBridge(input: unknown): Result<ClientToBridge>;
export declare function parseBridgeToClient(input: unknown): Result<BridgeToClient>;
