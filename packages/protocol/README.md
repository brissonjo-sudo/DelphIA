# @vite-plugin-delph-ia/protocol

Contrat partagé de [DelphIA](https://github.com/brissonjo-sudo/DelphIA), le concepteur visuel
façon Delphi pour Claude Code. Sans dépendance.

Ce paquet est utilisé par `@vite-plugin-delph-ia/vite-plugin`, `@vite-plugin-delph-ia/bridge` et le mod Claude Code. Vous
n'avez normalement pas à l'installer vous-même.

## Contenu

- **Identifiants** : `DZ_ATTR` (`data-dz-id`), `isDzId`, `dzSelector` (motif
  `^[a-z][a-z0-9-]{0,63}$`, sûr pour un sélecteur CSS).
- **Géométrie** : `Geometry` (`dx`, `dy`, `width`, `height` en pixels entiers, bornés à ±10 000),
  `parseGeometry`, `normalizeGeometry`.
- **Ajustements** : document `.delphia/overrides.json` (`OverridesDoc`), `parseOverrides`,
  `applyPatch`, `diffOverrides`, `emptyOverrides`.
- **CSS** : `overridesToCss` (surcouche `translate` / `width` / `height` en `!important`).
- **Messages** : enveloppe `wrap`, validateurs `parseRuntimeToDesigner`,
  `parseDesignerToRuntime`, `parseClientToBridge`, `parseBridgeToClient`.
- **Configuration** : `delphia.config.json` (`parseConfig`), `bridge.json` (`parseBridgeInfo`).
- **Prompt** : `summarizeForPrompt`, `describeDiff`.

Toute donnée entrante passe par un `parse*`, qui renvoie `{ ok: true, value }` ou
`{ ok: false, errors }`.

## Licence

MIT
