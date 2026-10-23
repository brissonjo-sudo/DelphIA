# @delphia/bridge

Pont local DelphIA : sert le concepteur, expose un WebSocket (`/ws`) et reste le **seul** à écrire
`<projet>/.delphia/overrides.json`.

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
import { startBridge } from '@delphia/bridge'
const { port, close } = await startBridge({ project, designerDir, port: 0, log: console.log })
```

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
