# @delphia/mod — mod Claude Code de DelphIA

Hooks fonctionnels (moteur Claude Code 2.1.308+). Actif seulement si `delphia.config.json`
existe à la racine du projet de la session.

- `session.start` : lance le pont (`node <cli> --project <cwd>`), statut `DelphIA : concepteur <url>` ; commande `/delphia`.
- `tool.call` : refuse l'écriture dans `.delphia/` (Write/Edit/MultiEdit/NotebookEdit, et Bash/PowerShell en best-effort) et toute édition qui retire le `data-dz-id` d'un élément épinglé.
- `prompt.compose` : ajoute en dernière section la liste des éléments verrouillés.
- `turn.start` : toast quand `revision` d'`overrides.json` a changé.

## Installation

Dans une session Claude Code (terminal) :

```text
/plugin install delphia --marketplace brissonjo-sudo/DelphIA
```

Depuis un shell : `claude plugin install delphia --marketplace brissonjo-sudo/DelphIA`.
Depuis ce dépôt, sans installation : `claude --plugin-dir packages/mod`.

## Développement

- `npm run sync-protocol -w @delphia/mod` : recopie `packages/protocol/dist` dans `hooks/vendor/protocol/`
  (fichiers committés ; `test/vendor-sync.spec.ts` échoue si la copie est périmée). Builder `protocol` avant.
- `npm run typecheck -w @delphia/mod` : `scripts/typecheck.mjs` génère un tsconfig **hors du dossier du mod**
  (dossier temporaire) et cherche la déclaration `claude-code` (`CLAUDE_CODE_TYPES`,
  `.claude-plugin/types/claude-code/index.d.ts`, ou le skill plugin-authoring livré avec Claude Code).
  Introuvable : avertissement, succès (`--strict` : échec).
- `npm run validate -w @delphia/mod` / `npm run test:mod -w @delphia/mod` : `claude plugin validate|test` avec le binaire 2.1.308
  (`scripts/claude.mjs` : `CLAUDE=<chemin>`, sinon la version la plus récente de l'app desktop, sinon `claude` du PATH). Les tests du moteur sont dans `test-mod/` ; `plugin test` exécute tous les `*.test.ts`, d'où
  le test Vitest nommé `*.spec.ts`.
