# Changelog

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [Non publié]

### Ajouté

- Socle du monorepo (npm workspaces, TypeScript strict, Vitest, ESLint, Prettier).
- `@delphia/protocol` : identifiants `data-dz-id`, géométrie bornée, document
  `.delphia/overrides.json`, génération CSS de surcouche, messages typés et validés,
  résumé des verrous pour le prompt système.
- ADR 0001 (ajustements en surcouche) et ADR 0002 (pont par fichiers).
- `delphia.config.json` (`parseConfig`) et contrats d'interfaces (`docs/contrats.md`).
- `@delphia/vite-plugin` : CSS de surcouche (dev et build), runtime de mesure et d'aperçu
  dans l'app, filtrage des origines, mise à jour à chaud.
- `@delphia/bridge` : serveur local 127.0.0.1 (concepteur, `/api/config`, WebSocket `/ws`),
  contrôle Host/Origin, écriture atomique de `.delphia/overrides.json`, `bridge.json`.
- `@delphia/designer` : concepteur (iframe, sélection, glisser, 8 poignées, accrochage,
  grille 8 px, clavier, inspecteur, orphelins, mode démo `?mock=1`).
- Mod Claude Code (`packages/mod`) : lancement du pont, garde des écritures sur `.delphia/` et
  des ids épinglés, verrous dans le prompt système, suivi de révision, commande `/delphia`.
- Application de démonstration `examples/demo` (Gestionnaire de tâches, front Tauri 2).
- Documentation d'usage (README, guide, CONTRIBUTING, SECURITY), CI GitHub Actions
  (Windows et Linux, Node 22) et fichier marketplace `.claude-plugin/marketplace.json`.
