# @vite-plugin-delph-ia/designer

Interface du concepteur DelphIA (Vite + TypeScript, sans framework). Voir `docs/contrats.md` §4 et §6.

- `npm run dev -w @vite-plugin-delph-ia/designer` puis `http://localhost:5173/?mock=1` : mode démo (faux pont, fausse app).
- Vérifications visuelles : `scripts/verify-mock.mjs` (ajustements) et `scripts/verify-figer.mjs` (Figer), via Playwright.

## Sélection

Clic : un élément. **Maj+clic** : ajoute ou retire de la sélection ; l'élément principal (le dernier cliqué)
s'affiche dans l'inspecteur et reçoit glisser, poignées et flèches.

## Figer (ADR 0003)

Le bouton « Figer » (barre d'outils et inspecteur) est actif si au moins un élément sélectionné est
épinglé et qu'aucune demande n'est ouverte. Les éléments sélectionnés non épinglés sont ignorés.

1. Mesure fraîche (`designer:measure`), puis `bake:request` avec les rectangles des éléments épinglés.
2. Bandeau d'état selon `bake:state` : en attente (« Annuler » = `bake:cancel`), vérification, « Figé »,
   ou écart (delta en px par élément, fichiers touchés, « Rétablir » = `bake:revert`). 5 dernières demandes
   dans l'inspecteur.
3. Quand la demande passe à `applied` : attente d'un nouvel `overrides:state` puis d'un `runtime:elements`
   (5 s au plus), nouvelle mesure, puis `bake:verify` (une seule fois par `bakeId`). Si l'app ne répond pas à
   la mesure, la vérification est abandonnée et le bandeau le dit.

Logique pure et testée : `src/core/bake-flow.ts`, `src/core/selection.ts`. Raccord : `src/bake-controller.ts`.
En mode démo, le faux pont simule le tour de Claude (1,5 s) puis juge avec `compareRects`.
