# Contribuer à DelphIA

Merci de votre intérêt. Le projet est en `0.x` : les interfaces entre paquets
([docs/contrats.md](docs/contrats.md)) peuvent encore bouger ; ouvrez une issue avant un
changement important.

## Prérequis

- **Node ≥ 22** et npm.
- Rust et les [prérequis Tauri 2](https://v2.tauri.app/start/prerequisites/) seulement si vous
  travaillez sur une vraie app Tauri ; la démo (`examples/demo`) n'en a pas besoin.
- Pour le mod : un binaire **Claude Code ≥ 2.1.308** (les `modules` de hooks). Le `claude` du
  `PATH` est souvent trop ancien ; surchargez avec la variable `CLAUDE=<chemin>`.

## Mise en route

```bash
npm install
npm run build
npm run check
```

`npm run check` enchaîne `typecheck`, `lint` (ESLint), `format:check` (Prettier) et `test`
(Vitest). Il doit passer avant toute PR. `npm run format` corrige la mise en forme.

Le typecheck du mod cherche la déclaration `claude-code` écrite par le moteur ; introuvable
(cas de la CI), il avertit et réussit. Pour l'exiger : `node packages/mod/scripts/typecheck.mjs --strict`.

## Conventions

- **Commits conventionnels, en français** : `feat(bridge): …`, `fix(designer): …`,
  `docs: …`, `chore: …`, `test: …`, `refactor: …`. Un commit = un changement cohérent.
- **TypeScript strict**, ESM, pas de `any`.
- **Une responsabilité par module**, fichiers courts (cible : moins de 300 lignes) ; logique pure
  séparée de l'IO et du DOM.
- **`packages/protocol` reste sans dépendance.** Le mod en embarque une copie
  (`packages/mod/hooks/vendor/protocol/`) : après avoir modifié le protocole, lancez
  `npm run build -w @vite-plugin-delph-ia/protocol && npm run sync-protocol -w @vite-plugin-delph-ia/mod` et committez la
  copie (un test échoue si elle est périmée).
- **Toute entrée passe par un `parse*` du protocole** (WebSocket, `postMessage`, fichiers, argv).
  Un id `data-dz-id` n'entre jamais dans du CSS sans `dzSelector`. Le pont n'écoute que sur
  `127.0.0.1`.
- **Ne pas écrire dans `.delphia/`** d'un projet cible : réservé au pont et à l'utilisateur.
- **Décision d'architecture** : ajoutez un ADR dans [docs/adr](docs/adr/) ; ne supprimez pas un
  ADR existant, écrivez-en un nouveau qui le remplace.
- Mettez à jour [CHANGELOG.md](CHANGELOG.md) (section « Non publié »).

## Tests

- **Vitest** : `npm test`. Les tests vivent dans `packages/<paquet>/test/*.test.ts`. Pour toute
  logique nouvelle, un test ; pour un correctif, un test qui échoue sans lui.
- **Mod** : les tests du moteur sont dans `packages/mod/test-mod/` et se lancent avec
  `claude plugin test packages/mod` (Claude Code ≥ 2.1.308), ou
  `npm run test:mod -w @vite-plugin-delph-ia/mod`. Le test Vitest du mod est nommé `*.spec.ts` pour que
  `plugin test` ne l'exécute pas. Validation du manifeste : `claude plugin validate .` (le
  `marketplace.json` de la racine) et `claude plugin validate packages/mod`.
- La CI (`.github/workflows/ci.yml`) lance `npm ci`, `npm run build` et `npm run check` sous
  Windows et Linux. Elle ne lance ni les tests du moteur Claude Code ni de build Rust.

## Workflow de PR

1. Forkez, créez une branche (`feat/…`, `fix/…`, `docs/…`) depuis `main`.
2. Faites de petits commits conventionnels.
3. Lancez `npm run build && npm run check` ; si vous touchez au mod, aussi
   `claude plugin test packages/mod`.
4. Ne commitez pas `package-lock.json` sauf si vous changez une dépendance.
5. Ouvrez la PR en remplissant le [modèle](.github/pull_request_template.md) : description,
   changements, vérifications, points d'attention.
6. Les failles de sécurité ne se signalent pas par PR ni issue publique : voir
   [SECURITY.md](SECURITY.md).

En contribuant, vous acceptez que votre code soit publié sous la licence [MIT](LICENSE).
