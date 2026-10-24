# Contrats entre modules (M1–M3)

Ce document fige les interfaces entre paquets. Chaque paquet s'y conforme ; toute
divergence se discute avant d'être codée. Les types et validateurs font foi dans
`packages/protocol/src` (`import { … } from '@vite-plugin-delph-ia/protocol'`).

## 0. Règles communes

- TypeScript strict (`tsconfig.base.json`), ESM, pas de `any`.
- Toute donnée entrante (fichier, WebSocket, `postMessage`, argv) passe par un `parse*` du
  protocole, ou par une validation explicite si le protocole n'en fournit pas.
- `protocol` reste sans dépendance. Il faut l'avoir buildé (`npm run build -w @vite-plugin-delph-ia/protocol`)
  avant de l'importer : ses `exports` pointent sur `dist/`.
- Tests Vitest dans `packages/<paquet>/test/*.test.ts` (inclus par `vitest.config.ts` racine).
- Ne pas committer `package-lock.json` depuis un worktree : l'intégrateur le régénère.

## 1. Projet cible

Un projet est « DelphIA » quand il contient `delphia.config.json` à sa racine
(`parseConfig` → `{ port: 4317, appPort: 1420 }` par défaut).

```
<projet>/
├─ delphia.config.json        { "port": 4317, "appPort": 1420 }
├─ vite.config.ts             plugins: [delphia()]
├─ .delphia/overrides.json    écrit par le pont seulement (OverridesDoc)
└─ .delphia/bridge.json       écrit par le pont au démarrage, supprimé à l'arrêt (BridgeInfo)
```

## 2. `@vite-plugin-delph-ia/vite-plugin` (dans l'app cible)

- Export par défaut : `delphia(options?: { root?: string; designerOrigins?: string[] }): Plugin`.
- Usage : `plugins: [delphia()]`. Aucune autre modification de l'app.
- **CSS de surcouche** : lit `<root>/.delphia/overrides.json` (absent → document vide ;
  invalide → avertissement console + document vide), produit `overridesToCss(doc)`,
  l'injecte **en dernier** dans `<head>`, en `serve` comme en `build`.
- **Rechargement** : en `serve`, surveille `overrides.json` ; à chaque changement, met à jour le CSS
  sans recharger la page (HMR / module virtuel), en moins de 300 ms.
- **Runtime** (en `serve` uniquement, et seulement si `window.parent !== window`) :
  - mesure tous les `[data-dz-id]` (`getBoundingClientRect`, relatif au viewport de l'iframe) ;
    `parentId` = id du plus proche ancêtre `[data-dz-id]`, sinon `null` ;
  - envoie `wrap({ type: 'runtime:hello', url })` au chargement, puis
    `wrap({ type: 'runtime:elements', viewport, elements })` au chargement, au
    redimensionnement, au défilement, sur mutation du DOM et après chaque mise à jour HMR
    (anti-rebond ~50 ms) ;
  - accepte seulement les messages dont `event.origin` figure dans `designerOrigins`
    (défaut : `http://127.0.0.1:<port>` et `http://localhost:<port>`, port lu dans
    `delphia.config.json`), validés par `parseDesignerToRuntime` ;
  - `designer:measure` → renvoie `runtime:elements` ;
  - `designer:preview { id, geometry }` → applique en style inline
    (`style.setProperty(…, 'important')`) `translate`, `width`, `height` (+ `box-sizing:
border-box` si taille) ; `geometry: null` retire ces propriétés inline. **La géométrie de
    l'aperçu est complète** (valeurs finales de l'ajustement, pas un delta).

## 3. `@vite-plugin-delph-ia/bridge` (serveur Node local)

- CLI : `node packages/bridge/dist/cli.js --project <dir> [--designer-dir <dir>]`.
  Ports lus dans `<dir>/delphia.config.json` (absent → valeurs par défaut).
  Script racine : `npm run delphia -- --project <dir>`.
- Écoute **uniquement `127.0.0.1:<port>`**. Port occupé → message clair, code de sortie 1.
- HTTP :
  - `GET /` et fichiers statiques : le concepteur buildé (`packages/designer/dist` par défaut) ;
    aucun accès en dehors de ce dossier (pas de `..`, pas de lien symbolique sortant).
  - `GET /api/config` → `{ "appUrl": "http://localhost:<appPort>", "port": <port> }`.
  - En-tête `Host` vérifié : `127.0.0.1:<port>` ou `localhost:<port>`, sinon 403 (anti
    DNS-rebinding).
- WebSocket sur `/ws` : `Origin` vérifié (`http://127.0.0.1:<port>` ou
  `http://localhost:<port>`), sinon refus. Messages = enveloppes du protocole.
  - à la connexion : `overrides:state` ;
  - `override:set` / `override:clear` → `applyPatch` → écriture atomique (fichier
    temporaire + renommage) → `overrides:state` diffusé à tous les clients ;
  - message invalide → `bridge:error` au seul émetteur, la connexion reste ouverte.
- Surveille `overrides.json` (changement externe) → revalide → diffuse. Ignore ses propres
  écritures.
- Écrit `bridge.json` (`BridgeInfo`) au démarrage ; le supprime sur `SIGINT`/`SIGTERM`/sortie.

## 4. `@vite-plugin-delph-ia/designer` (UI navigateur, Vite + TypeScript sans framework)

- Servi par le pont. Lit `/api/config`, affiche l'app dans une `<iframe src=appUrl>`, se
  connecte à `ws://<host>/ws`.
- N'accepte que les `postMessage` dont `event.source === iframe.contentWindow`, validés par
  `parseRuntimeToDesigner`.
- Calque au-dessus de l'iframe : cadres des éléments mesurés, sélection au clic (le plus petit
  rectangle contenant le point), déplacement, 8 poignées de redimensionnement.
- Aides : repères magnétiques (bords et centres des autres éléments et du parent, seuil 5 px),
  grille 8 px activable, flèches ±1 px, Maj+flèches ±10 px, Échap désélectionne.
- Pendant un glisser : `designer:preview` (géométrie complète) ; au relâcher :
  `override:set` au pont puis `designer:preview { geometry: null }`.
- Inspecteur : `dx`, `dy`, `width`, `height` éditables, bouton « Libérer » (`override:clear`).
- Liste des éléments, badge « épinglé », section « orphelins » (ajustements dont l'id n'est
  plus dans la page).
- Logique pure (accrochage, poignées, calculs de géométrie) dans des modules sans DOM, testés.

## 5. Mod Claude Code (`packages/mod`)

- Actif seulement si `<cwd>/delphia.config.json` existe.
- `session.start` : lance le pont par `$.process.spawn({ argv: ['node', <cli>, '--project', cwd] })`.
  `<cli>` : `<cwd>/node_modules/@vite-plugin-delph-ia/bridge/dist/cli.js`, sinon
  `${$.plugin.root}/../bridge/dist/cli.js`. Statut affiché (`$.ui.status`).
- `tool.call` (Write, Edit, MultiEdit, NotebookEdit) : refuse toute cible où
  `isProtectedPath` est vrai ; refuse une édition qui fait disparaître un `data-dz-id`
  épinglé, avec un message qui demande de passer par l'utilisateur.
- `prompt.compose` : ajoute `summarizeForPrompt(doc)` comme section (rien si vide).
- `turn.start` : compare la révision à la dernière vue (`$.state`) ; s'il y a du nouveau,
  `describeDiff` en statut/toast.
- Commande `/delphia` : état (pont, URL du concepteur, nombre d'éléments épinglés).
- Le protocole est copié dans le mod au build (`hooks/vendor/protocol/`) : un mod ne charge
  que ses propres fichiers.
