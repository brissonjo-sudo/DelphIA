# @vite-plugin-delph-ia/bridge

Pont local DelphIA : sert le concepteur, expose un WebSocket (`/ws`) et reste le **seul** à écrire
`<projet>/.delphia/overrides.json` et `<projet>/.delphia/bake.json` (« Figer », ADR 0003).

## Lancer

```
npm run build
npm run delphia -- --project <dossier-du-projet> [--designer-dir <dossier>]
# ou : node packages/bridge/dist/cli.js --project <dossier-du-projet>
```

- Ports lus dans `<projet>/delphia.config.json` (`port`, `appPort` ; défauts 4317 / 1420).
- `--designer-dir` : défaut `packages/designer/dist`. S'il n'existe pas, `/` affiche une page d'aide.
- Démarrage : `DelphIA bridge listening on http://127.0.0.1:<port>/` sur stdout.
- Port occupé : message sur stderr, code 1. Erreur d'usage : code 2.
- Arrêt (`SIGINT`, `SIGTERM`, `SIGBREAK`) : supprime `.delphia/bridge.json`. Un arrêt brutal
  (`taskkill /F`, `kill -9`) laisse un `bridge.json` périmé, écrasé au prochain démarrage.

## Usage programmatique

```ts
import { startBridge } from '@vite-plugin-delph-ia/bridge'
const { port, token, close } = await startBridge({
  project,
  designerDir,
  port: 0,
  log: console.log,
})
```

## Figer

- WebSocket : `bake:request`, `bake:cancel`, `bake:verify`, `bake:revert` ; `bake:state` envoyé après
  `overrides:state` à la connexion, puis diffusé à chaque changement. Un refus renvoie
  `bridge:error` à l'émetteur seul.
- HTTP `POST` (utilisées par le mod), corps JSON `application/json` ≤ 64 Ko :
  `/api/bake/applied` (retire les éléments de la surcouche) et `/api/bake/cancel`.
  Codes : 200 `{"ok":true}`, 400 corps invalide, 401 jeton absent/faux, 403 `Host` invalide ou
  en-tête `Origin` présent, 409 mauvais état ou `bakeId`, 413 corps trop gros, 415 type non JSON.
- Jeton : 32 octets aléatoires (hex), régénéré à chaque démarrage, écrit dans
  `.delphia/bridge.json` (`token`) et exigé dans l'en-tête `x-delphia-token`. Il protège des pages
  web, pas d'un processus local qui peut lire le fichier.
- `bake.json` invalide au démarrage : le pont refuse de démarrer (jamais écrasé).
- Les transitions qui touchent aux deux fichiers sont sérialisées avec les ajustements ; ordre
  d'écriture : `overrides.json` puis `bake.json` (le premier est remis si le second échoue).

## Sécurité

- Écoute `127.0.0.1` uniquement ; `Host` ∈ {`127.0.0.1:<port>`, `localhost:<port>`} sinon 403.
- WebSocket : `Origin` obligatoire et identique (`http://127.0.0.1:<port>` ou `http://localhost:<port>`),
  messages ≤ 64 Ko, texte JSON seulement, validés par `parseClientToBridge`.
- Statique : chemin confiné au dossier du concepteur (`..`, `%2e%2e`, `\`, `:` refusés ; `realpath`
  contre les liens sortants), types MIME en liste blanche, `X-Content-Type-Options: nosniff`.
- Écriture atomique (fichier temporaire + renommage), écritures sérialisées ; un `overrides.json`
  invalide n'est jamais écrasé (erreur renvoyée à l'émetteur).

## Tests

`npm test` (serveur réel sur port aléatoire, projet dans un dossier temporaire).
