# @vite-plugin-delphia/vite-plugin

Plugin Vite à installer dans l'application cible. Il applique les ajustements manuels du
concepteur DelphIA (`.delphia/overrides.json`) et, en développement, mesure les éléments
`[data-dz-id]` pour le concepteur.

## Usage

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import delphia from '@vite-plugin-delphia/vite-plugin'

export default defineConfig({
  plugins: [delphia()],
})
```

Options (toutes facultatives) :

| Option            | Défaut                                                 | Rôle                                     |
| ----------------- | ------------------------------------------------------ | ---------------------------------------- |
| `root`            | racine de Vite                                         | dossier contenant `delphia.config.json`  |
| `designerOrigins` | `http://127.0.0.1:<port>` et `http://localhost:<port>` | origines autorisées à piloter le runtime |

`<port>` vient de `delphia.config.json` (`4317` par défaut).

## Ce que fait le plugin

- **CSS de surcouche** : `overridesToCss(overrides.json)` est injecté en dernier dans `<head>`
  (`<style data-delphia>`), en développement comme au `build`. Fichier absent : rien ;
  fichier invalide : avertissement et document vide.
- **Rechargement à chaud** : en `serve`, le fichier est surveillé ; le CSS est remplacé sans
  recharger la page (événement HMR `delphia:overrides`).
- **Runtime** (`serve` seulement, module virtuel `virtual:delphia/runtime`) : dans une iframe,
  envoie `runtime:hello` et `runtime:elements` au concepteur, répond à `designer:measure` et
  applique `designer:preview`. Les messages entrants sont filtrés par `event.origin` puis
  validés par `parseDesignerToRuntime`.

Le build de production n'embarque jamais le runtime.
