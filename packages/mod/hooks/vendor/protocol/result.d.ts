/** Résultat d'une validation : la valeur, ou la liste des erreurs lisibles. */
export type Result<T> = {
    ok: true;
    value: T;
} | {
    ok: false;
    errors: string[];
};
export declare const ok: <T>(value: T) => Result<T>;
export declare const fail: <T>(errors: string[]) => Result<T>;
export declare const isRecord: (v: unknown) => v is Record<string, unknown>;
