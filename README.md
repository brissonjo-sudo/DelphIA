# DelphIA

**Un concepteur visuel façon Delphi pour Claude Code.**

> **EN —** DelphIA is a Delphi-style visual designer for Claude Code. Claude writes the UI of a
> desktop app (Tauri 2, Vite + TypeScript); the DelphIA designer shows it live in your browser;
> you nudge and resize any `[data-dz-id]` element pixel by pixel with the mouse, snap guides and
> keyboard. Your tweaks are stored in `.delphia/overrides.json` and applied as a CSS overlay, so
> Claude never overwrites them. A Claude Code mod starts the local bridge, forbids Claude from
> writing to `.delphia/` or removing a pinned id, and tells it which elements are locked.
> Install: `npm install -D @vite-plugin-delphia/vite-plugin @vite-plugin-delphia/bridge` (Vite 8); the mod needs Claude Code
> engine 2.1.308+. MIT licence. Docs are in French.

## En bref

1. **Claude écrit** l'interface d'une application de bureau (Tauri 2, Vite + TypeScript).
2. **Le concepteur DelphIA l'affiche en direct** dans le navigateur (`http://127.0.0.1:4317/`), dans une iframe.
3. **Vous ajustez chaque élément `[data-dz-id]` au pixel** : glisser, 8 poignées, repères d'alignement, grille de 8 px, flèches du clavier.
4. **Un mod Claude Code fait le pont** : il lance le serveur, interdit à Claude d'écrire dans `.delphia/` ou de supprimer un id épinglé, et ajoute au prompt système la liste des éléments verrouillés.

Vos ajustements ne touchent **jamais** le code écrit par Claude : ils vivent dans
`.delphia/overrides.json` et sont appliqués par une surcouche CSS (voir
[ADR 0001](docs/adr/0001-geometrie-en-surcouche.md)).

## Schéma de principe

```
┌───────────── Claude Code ─────────────┐          ┌──────── Navigateur (localhost) ────────┐
│  Claude écrit src/** de l'app cible   │          │  Concepteur DelphIA (packages/designer) │
│                                       │          │  ┌──────────────────────────────────┐   │
│  Mod DelphIA (packages/mod)           │          │  │ iframe : app cible (Vite dev)    │   │
│   • lance le pont (session.start)     │          │  │  + runtime injecté (vite-plugin) │   │
│   • bloque les écritures .delphia/    │          │  └──────────────────────────────────┘   │
│   • injecte les verrous dans le prompt│          │  poignées, repères, grille, inspecteur  │
└───────────────┬───────────────────────┘          └───────────────┬─────────────────────────┘
                │ lit .delphia/*.json                              │ WebSocket 127.0.0.1
                ▼                                                  ▼
        ┌──────────────── Pont (packages/bridge, Node) ────────────────┐
        │ sert le concepteur, valide les messages, écrit overrides.json │
        └───────────────────────────────┬───────────────────────────────┘
                                        ▼
                     .delphia/overrides.json ──► vite-plugin ──► CSS de surcouche
```

| Paquet                                | Rôle                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------- |
| [`protocol`](packages/protocol/src)   | Contrat partagé (ids, géométrie, messages, CSS), sans dépendance           |
| [`vite-plugin`](packages/vite-plugin) | Plugin Vite de l'app cible : CSS de surcouche et runtime de mesure         |
| [`bridge`](packages/bridge)           | Serveur local 127.0.0.1 : sert le concepteur, WebSocket, écrit `.delphia/` |
| [`designer`](packages/designer)       | Interface du concepteur (Vite + TypeScript, sans framework)                |
| [`mod`](packages/mod)                 | Mod Claude Code (hooks)                                                    |
| [`examples/demo`](examples/demo)      | Application de démonstration (gestionnaire de tâches)                      |

Détails : [architecture](docs/architecture.md), [contrats entre modules](docs/contrats.md),
[décisions (ADR)](docs/adr/).

## Démarrage rapide (avec la démo)

Prérequis : **Node ≥ 22**. Rust n'est pas nécessaire pour la démo (front Vite seul).

```bash
npm install
npm run build
npm run dev -w @vite-plugin-delphia/demo                 # terminal 1 : l'app, sur http://localhost:1420
npm run delphia -- --project examples/demo   # terminal 2 : le concepteur, sur http://127.0.0.1:4317/
```

Ouvrez **http://127.0.0.1:4317/**, cliquez un élément de l'app, glissez-le : l'ajustement est
écrit dans `examples/demo/.delphia/overrides.json` et l'app se met à jour. Pas à pas :
[docs/guide.md](docs/guide.md).

## Installer le mod Claude Code

```text
/plugin install delphia --marketplace brissonjo-sudo/DelphIA
```

ou depuis un shell :

```bash
claude plugin install delphia --marketplace brissonjo-sudo/DelphIA
```

Le dépôt contient [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json), qui
déclare le mod `delphia` (source : `packages/mod`). Le mod ne s'active que dans un projet qui
contient `delphia.config.json`.

Pour lancer le pont, le mod cherche son CLI dans
`<projet>/node_modules/@vite-plugin-delphia/bridge/dist/cli.js` (installé à l'étape 2 ci-dessous), puis à
côté de lui-même (`../bridge/dist/cli.js`, quand le mod est chargé depuis ce dépôt). S'il ne le
trouve pas, il affiche « DelphIA : pont indisponible » et protège quand même `.delphia/` et les
ids épinglés ; lancez alors le pont à la main (`npx delphia-bridge --project .`).

Le mod nécessite le moteur Claude Code **2.1.308 ou plus** (hooks fonctionnels :
`hooks/hooks.json` contient `{ "modules": ["./register.ts"] }`). Un `claude` plus ancien ne
sait pas charger ces modules.

## Utiliser DelphIA dans votre propre projet Tauri

1. **`delphia.config.json`** à la racine du projet (sa présence active DelphIA) :

   ```json
   { "port": 4317, "appPort": 1420 }
   ```

   `port` : concepteur et WebSocket ; `appPort` : serveur Vite de l'app (1420 par défaut dans Tauri 2).
   Entiers entre 1024 et 65535, différents l'un de l'autre. Tout est facultatif.

2. **Paquets npm** (le pont embarque l'interface du concepteur) :

   ```bash
   npm install -D @vite-plugin-delphia/vite-plugin @vite-plugin-delphia/bridge
   ```

   Puis le **plugin Vite** dans `vite.config.ts` :

   ```ts
   import { defineConfig } from 'vite'
   import delphia from '@vite-plugin-delphia/vite-plugin'

   export default defineConfig({
     server: { port: 1420, strictPort: true },
     plugins: [delphia()],
   })
   ```

3. **Identifiants stables** : chaque élément ajustable porte `data-dz-id="<id>"`, avec un id qui
   respecte `^[a-z][a-z0-9-]{0,63}$` (minuscules, chiffres, tirets ; commence par une lettre).
   C'est Claude qui pose ces attributs, par exemple `<button data-dz-id="btn-new-task">`.

4. Lancez l'app (`npx vite` ou `npm run tauri dev`) et ouvrez le concepteur
   (`http://127.0.0.1:4317/`). Avec le mod, le pont démarre avec la session Claude Code ; sans
   le mod : `npx delphia-bridge --project .`. Le CSS d'ajustement est aussi injecté au
   `build` : le build Tauri l'embarque.

Ce parcours (paquets installés depuis leurs archives npm dans un projet extérieur au
monorepo, concepteur, ajustement au clavier, build, mod qui lance le pont depuis
`node_modules`) a été vérifié avant publication. Plugin Vite : Vite 8.

## Limites connues

- **Version 0.1** : `@vite-plugin-delphia/vite-plugin` exige Vite 8 (non testé sur Vite 5 à 7).
- **Mod en accès anticipé** de Claude Code : moteur 2.1.308 ou plus ; API susceptible de changer.
- **`translate` décale sans libérer l'espace** : un élément déplacé laisse sa place d'origine
  vide dans la mise en page. C'est voulu pour la retouche fine ; ce n'est pas du positionnement
  absolu façon Delphi ([ADR 0001](docs/adr/0001-geometrie-en-surcouche.md)).
- **Garde Bash/PowerShell heuristique** : le mod repère les commandes shell qui écrivent dans
  `.delphia/` par analyse de texte (verbes d'écriture, redirections). C'est un filet de
  sécurité, pas une barrière étanche. Les outils Write/Edit/MultiEdit/NotebookEdit sont, eux,
  contrôlés sur le chemin cible.
- **Ids construits dynamiquement non détectés** : la garde « id épinglé » lit les attributs
  littéraux `data-dz-id="..."` dans le texte édité ; un id assemblé par code (concaténation,
  variable) n'est pas vu.
- **Zoom fixe à 100 %** dans le concepteur ; un seul projet à la fois.

## Développement

```bash
npm install
npm run build     # protocole, plugin, pont, concepteur, démo
npm run check     # typecheck + lint + format + tests (Vitest)
```

Voir [CONTRIBUTING.md](CONTRIBUTING.md). Sécurité : [SECURITY.md](SECURITY.md).

## Licence

MIT — voir [LICENSE](LICENSE). Auteur : Murukan.
