/** Partie de `import.meta.hot` (Vite) dont le runtime a besoin. */
export interface HotLike {
  on(event: string, callback: (data: unknown) => void): void
}

/** Événement HMR personnalisé émis par le plugin quand `overrides.json` change. */
export const OVERRIDES_EVENT = 'delphia:overrides'
