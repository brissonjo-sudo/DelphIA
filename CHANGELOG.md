# Changelog

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [Non publié]

## [bridge 0.2.2] - 2026-10-25

### Corrigé

- Concepteur : un simple clic sur un élément proche d'un autre le déplaçait et le collait à
  son voisin (l'accrochage s'appliquait à un déplacement nul, puis l'ajustement était
  enregistré). Un geste ne devient un glisser qu'au-delà de 3 px ; en dessous, c'est une
  sélection seule, sans aperçu ni ajustement.

## [bridge 0.2.1] - 2026-10-25

### Corrigé

- Concepteur (embarqué dans `@vite-plugin-delph-ia/bridge`) : il restait « App non connectée »
  quand le premier message de l'app partait avant que le concepteur l'écoute, ou quand l'app
  était lancée après lui. Tant que l'app ne répond pas, il redemande une mesure toutes les 2 s
  et recharge l'iframe au bout de 8 s de silence. Constaté dans Chrome 156.

## [mod 0.2.1] - 2026-10-25

### Corrigé

- Mod : le pont est cherché dans le `node_modules` du projet **et de ses dossiers parents**,
  comme Node.js. Dans un workspace npm (dépendances installées à la racine du dépôt), le mod
  affichait « pont indisponible ».

## [0.2.0] - 2026-10-25

Paquets npm `@vite-plugin-delph-ia/protocol`, `vite-plugin`, `bridge` en 0.2.0 ; mod `delphia`
0.2.0. **Changement incompatible** : le pont 0.2.0 écrit un jeton dans `bridge.json`, que le
mod 0.2.0 exige ; mettre à jour les paquets et le mod ensemble.

### Ajouté

- **« Figer »** (ADR 0003) : intégrer des ajustements de la surcouche dans le vrai code.
  Concepteur : sélection multiple (Maj+clic), bouton « Figer », bandeau d'état, vérification
  par la mesure (tolérance 1 px), « Rétablir », historique. Pont : `.delphia/bake.json`,
  messages `bake:*`, routes `POST /api/bake/applied|cancel` protégées par jeton. Mod : option
  `figer` (`preremplir` par défaut, ou `direct`), consigne détaillée ajoutée au prompt, éléments
  déverrouillés pendant le tour, fichiers modifiés suivis, annulation si aucun fichier modifié.
- `bridge.json` contient un jeton aléatoire régénéré à chaque démarrage.

### Corrigé

- Le bandeau du concepteur ne redimensionne plus l'app (il faussait la comparaison des mesures).

### Vérifié

- Cycle réel : demande depuis le concepteur → tour d'une vraie session Claude Code avec le mod
  → surcouche retirée → mesure identique au visé (« Figé ») ; « Rétablir » après un écart.

## [0.1.0] - 2026-10-24

Première version publiée sur npm : `@vite-plugin-delph-ia/protocol`,
`@vite-plugin-delph-ia/vite-plugin`, `@vite-plugin-delph-ia/bridge` (0.1.0). Installation
vérifiée depuis le registre dans un projet vide.

### Ajouté

- Socle du monorepo (npm workspaces, TypeScript strict, Vitest, ESLint, Prettier).
- `@vite-plugin-delph-ia/protocol` : identifiants `data-dz-id`, géométrie bornée, document
  `.delphia/overrides.json`, génération CSS de surcouche, messages typés et validés,
  résumé des verrous pour le prompt système.
- ADR 0001 (ajustements en surcouche) et ADR 0002 (pont par fichiers).
- `delphia.config.json` (`parseConfig`) et contrats d'interfaces (`docs/contrats.md`).
- `@vite-plugin-delph-ia/vite-plugin` : CSS de surcouche (dev et build), runtime de mesure et d'aperçu
  dans l'app, filtrage des origines, mise à jour à chaud.
- `@vite-plugin-delph-ia/bridge` : serveur local 127.0.0.1 (concepteur, `/api/config`, WebSocket `/ws`),
  contrôle Host/Origin, écriture atomique de `.delphia/overrides.json`, `bridge.json`.
- `@vite-plugin-delph-ia/designer` : concepteur (iframe, sélection, glisser, 8 poignées, accrochage,
  grille 8 px, clavier, inspecteur, orphelins, mode démo `?mock=1`).
- Mod Claude Code (`packages/mod`) : lancement du pont, garde des écritures sur `.delphia/` et
  des ids épinglés, verrous dans le prompt système, suivi de révision, commande `/delphia`.
- Application de démonstration `examples/demo` (Gestionnaire de tâches, front Tauri 2).
- Démo Tauri 2 complète (`examples/demo/src-tauri`) : exécutable Windows, CSP stricte sans
  `unsafe-inline` (nonce Tauri sur `<style data-delphia>`), icônes ; mise en page adaptative
  de 420 à 1400 px.
- Documentation d'usage (README, guide, CONTRIBUTING, SECURITY), CI GitHub Actions
  (Windows et Linux, Node 22) et fichier marketplace `.claude-plugin/marketplace.json`.

- Préparation de la publication npm (`@vite-plugin-delph-ia/protocol`, `@vite-plugin-delph-ia/vite-plugin`,
  `@vite-plugin-delph-ia/bridge`) : métadonnées, licence et README par paquet, dépendances internes en
  `^0.1.0`, `ws` en `^8.22.0`, script `release:dry-run`, procédure `RELEASING.md`.

### Modifié

- `@vite-plugin-delph-ia/bridge` embarque l'interface du concepteur (`dist/designer`) et la sert par
  défaut ; ordre de build : protocol, vite-plugin, designer, bridge, demo.

### Vérifié

- Essai de bout en bout : glisser dans le concepteur → `overrides.json` → mise à jour à chaud
  de l'app ; clavier ; « Libérer ».
- Mod en session Claude Code réelle (moteur 2.1.308) : section de prompt injectée, pont lancé,
  écriture dans `.delphia/` et suppression d'un id épinglé refusées.
- Paquets installés depuis leurs archives npm dans un projet extérieur au monorepo : build avec
  surcouche, concepteur servi par le pont, ajustement au clavier écrit, mod qui lance le pont
  depuis `node_modules`, commande `npx delphia-bridge`.
