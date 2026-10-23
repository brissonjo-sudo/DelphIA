# CLAUDE.md — DelphIA

## Mémoire externe

Ce projet utilise le vault Obsidian local comme mémoire de fond :
`C:\Users\Krn\Documents\ClaudeMemory\02-Projects\DelphIA\`

Avant toute tâche non-triviale, lire dans cet ordre :

1. `overview.md` — comprendre le projet
2. `architecture.md` — composants et flux (et `docs/architecture.md` ici)
3. `decisions.md` — ADR (et `docs/adr/` ici ; ne pas les contredire sans raison)
4. `journal.md` — où on en est resté

## Mises à jour

Après une session significative : `journal.md` (entrée datée), `decisions.md` et
`docs/adr/` si décision d'architecture, `CHANGELOG.md`.

## Spécifique au projet

- Stack : TypeScript strict, npm workspaces, Vite, Tauri 2, Vitest.
- Commandes :
  - Tout vérifier : `npm run check`
  - Tester : `npm test`
  - Build : `npm run build`
- Valider le mod : utiliser le binaire Claude Code de l'app desktop (2.1.308+), pas le
  `claude` du PATH (2.1.302, trop ancien pour les `modules` de hooks).
- Branche par défaut : `main`.

## Règles du projet

- `packages/protocol` reste **sans dépendance** : le mod en embarque une copie.
- Tout ce qui entre (WebSocket, postMessage, fichiers) passe par les `parse*` du protocole.
- Un id `data-dz-id` n'est jamais injecté dans du CSS sans `dzSelector`.
- Le pont n'écoute que sur `127.0.0.1`.

## À éviter

- Écrire dans `.delphia/` d'un projet cible (réservé à l'utilisateur et au pont).
- Ajouter une dépendance à `protocol`.
