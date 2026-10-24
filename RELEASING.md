# Publier une version sur npm

Paquets publiés, dans cet ordre (chacun dépend des précédents) :

1. `@vite-plugin-delph-ia/protocol`
2. `@vite-plugin-delph-ia/vite-plugin`
3. `@vite-plugin-delph-ia/bridge` (embarque l'interface du concepteur dans `dist/designer`)

`@vite-plugin-delph-ia/designer`, `@vite-plugin-delph-ia/mod` et `@vite-plugin-delph-ia/demo` sont privés : ils ne sont jamais publiés.
Le mod se distribue par la marketplace du dépôt (`.claude-plugin/marketplace.json`).

## Une seule fois

1. Compte npm avec **double authentification** activée.
2. Organisation npm **`vite-plugin-delph-ia`** (gratuite pour des paquets publics ;
   l'organisation `delphia` était déjà prise) :
   npmjs.com → _Add Organization_. Sans elle, le scope `@vite-plugin-delph-ia` est refusé.
3. `npm login` dans un terminal.

## À chaque version

1. Mettre la même version dans les trois `package.json` publiés, et la plage
   `@vite-plugin-delph-ia/protocol` correspondante dans `vite-plugin`, `bridge` et `designer`.
   Puis `npm install` pour mettre à jour le lockfile.
2. Vérifier :

   ```bash
   npm run build
   npm run check
   npm run release:dry-run
   ```

   `release:dry-run` simule les trois publications et liste les fichiers envoyés : seulement
   `dist/`, `LICENSE`, `README.md` et `package.json`, et `dist/designer/index.html` pour le pont.

3. Publier, dans l'ordre (npm demande le code de double authentification à chaque fois) :

   ```bash
   npm publish -w @vite-plugin-delph-ia/protocol
   npm publish -w @vite-plugin-delph-ia/vite-plugin
   npm publish -w @vite-plugin-delph-ia/bridge
   ```

4. Contrôler : `npm view @vite-plugin-delph-ia/bridge version`, puis installer dans un projet vide
   (`npm install -D @vite-plugin-delph-ia/vite-plugin @vite-plugin-delph-ia/bridge`) et lancer `npx delphia-bridge --help`.
5. Ajouter l'entrée de version au `CHANGELOG.md`, créer le tag `vX.Y.Z` et la release GitHub.

Une version publiée ne peut pas être republiée sous le même numéro. En cas d'erreur, publier
une version corrective ; `npm deprecate` signale une version à éviter.
