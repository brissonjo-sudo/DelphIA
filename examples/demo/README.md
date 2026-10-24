# DelphIA : application de démonstration

Gestionnaire de tâches (Vite + TypeScript, DOM natif) : exemple et banc d'essai du concepteur DelphIA. Enveloppé dans une fenêtre de bureau Tauri 2 (`src-tauri/`).

## Lancement dans le navigateur (concepteur)

1. `npm run dev -w @delphia/demo` (port 1420, `strictPort`).
2. Pont DelphIA sur ce dossier : `node packages/bridge/dist/cli.js --project examples/demo`.
3. Ouvrir le concepteur sur `http://127.0.0.1:4317`.

## Application de bureau Tauri 2

Depuis la racine du dépôt :

- Développement : `npm run tauri dev -w @delphia/demo` (lance `npm run dev`, ouvre la fenêtre sur `http://localhost:1420`).
- Exécutable Windows : `npm run tauri build -w @delphia/demo` (installeurs NSIS/MSI dans `src-tauri/target/release/bundle/`). Pour l'exécutable seul, sans installeur : `npm run tauri build -w @delphia/demo -- --no-bundle` → `src-tauri/target/release/delphia-demo.exe`.

Les ajustements `.delphia/overrides.json` sont injectés par `@delphia/vite-plugin` dans `<style data-delphia>` ; ils sont donc embarqués dans l'exécutable au build.

### Prérequis (Windows)

- Rust stable (MSVC) : `rustup default stable-msvc`.
- Microsoft C++ Build Tools (charge de travail « Développement Desktop en C++ » de Visual Studio).
- WebView2 (préinstallé sur Windows 10 1803+ et Windows 11).
- Node.js et `npm install` à la racine.
- Détails : <https://v2.tauri.app/start/prerequisites/>.

### Sécurité

`app.security.csp` est stricte (`default-src 'self'`, aucun `unsafe-inline`). Tauri ajoute à la compilation un nonce sur chaque balise `<style>` du HTML embarqué, dont `<style data-delphia>`, qui reste donc appliquée. Il faut donc éviter les attributs `style="..."` et les `<style>` injectés au runtime sans nonce (bloqués). La CSP n'est pas appliquée en `tauri dev` (le serveur Vite sert les pages).
