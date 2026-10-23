import { type Geometry } from './geometry.js';
import { type GeometryPatch, type OverridesDoc } from './overrides.js';
import { type Result } from './result.js';
/** Marqueur d'enveloppe : distingue les messages DelphIA des autres `postMessage`. */
export declare const PROTOCOL_TAG = "delphia/1";
export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}
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
};
export type BridgeToClient = {
    type: 'overrides:state';
    doc: OverridesDoc;
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
