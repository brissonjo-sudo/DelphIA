# @vite-plugin-delph-ia/mod — mod Claude Code de DelphIA

Hooks fonctionnels (moteur Claude Code 2.1.308+). Actif seulement si `delphia.config.json`
existe à la racine du projet de la session.

- `session.start` : lance le pont (`node <cli> --project <cwd>`), statut `DelphIA : concepteur <url>` ; commande `/delphia`.
- `tool.call` : refuse l'écriture dans `.delphia/` (Write/Edit/MultiEdit/NotebookEdit, et Bash/PowerShell en best-effort) et toute édition qui retire le `data-dz-id` d'un élément épinglé.
- `prompt.compose` : ajoute en dernière section la liste des éléments verrouillés.
- `turn.start` : toast quand `revision` d'`overrides.json` a changé.

## Figer (ADR 0003)

Le concepteur écrit une demande dans `.delphia/bake.json` (statut `requested`). Cycle côté mod :

1. **Détection** : `$.clock.every(1000)` (démarré à `session.start`) et `turn.start` lisent `bake.json`. Une demande `requested` jamais vue est proposée une seule fois.
2. **Lancement** : option `figer` (userConfig, menu `/config`) : `preremplir` (défaut) met « Fige les ajustements DelphIA dans le code (demande bk-…) » dans la zone de saisie, vous validez par Entrée ; `direct` l'envoie sans attendre.
3. **Tour** : le hook `prompt.submit` reconnaît l'identifiant de demande et ajoute la consigne détaillée en contexte ; pendant le tour, la section « géométrie verrouillée » exclut les éléments à figer ; les fichiers écrits avec succès (Write/Edit/MultiEdit/NotebookEdit) sont notés.
4. **Fin de tour** (`turn.complete`) : réponse normale → `POST /api/bake/applied` (fichiers touchés) ; interruption, refus ou erreur → `POST /api/bake/cancel`. Jeton `x-delphia-token` lu dans `bridge.json`, sans `Origin`. Échec réseau : toast, jamais d'exception.

`/delphia` affiche aussi la demande de figeage courante.

## Installation

Dans une session Claude Code (terminal) :

```text
/plugin install delphia --marketplace brissonjo-sudo/DelphIA
```

Depuis un shell : `claude plugin install delphia --marketplace brissonjo-sudo/DelphIA`.
Depuis ce dépôt, sans installation : `claude --plugin-dir packages/mod`.

## Développement

- `npm run sync-protocol -w @vite-plugin-delph-ia/mod` : recopie `packages/protocol/dist` dans `hooks/vendor/protocol/`
  (fichiers committés ; `test/vendor-sync.spec.ts` échoue si la copie est périmée). Builder `protocol` avant.
- `npm run typecheck -w @vite-plugin-delph-ia/mod` : `scripts/typecheck.mjs` génère un tsconfig **hors du dossier du mod**
  (dossier temporaire) et cherche la déclaration `claude-code` (`CLAUDE_CODE_TYPES`,
  `.claude-plugin/types/claude-code/index.d.ts`, ou le skill plugin-authoring livré avec Claude Code).
  Introuvable : avertissement, succès (`--strict` : échec).
- `npm run validate -w @vite-plugin-delph-ia/mod` / `npm run test:mod -w @vite-plugin-delph-ia/mod` : `claude plugin validate|test` avec le binaire 2.1.308
  (`scripts/claude.mjs` : `CLAUDE=<chemin>`, sinon la version la plus récente de l'app desktop, sinon `claude` du PATH). Les tests du moteur sont dans `test-mod/` ; `plugin test` exécute tous les `*.test.ts`, d'où
  le test Vitest nommé `*.spec.ts`.
