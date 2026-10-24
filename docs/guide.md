# Guide d'utilisation

Parcours complet, de l'installation à l'ajustement d'un élément. Vue d'ensemble :
[README](../README.md). Fonctionnement interne : [architecture](architecture.md).

## 1. Installer

Prérequis : **Node ≥ 22**. Pour un vrai projet Tauri 2, Rust et les prérequis Tauri ; pour la
démo, Node suffit.

```bash
git clone https://github.com/brissonjo-sudo/DelphIA.git
cd DelphIA
npm install
npm run build
```

`npm run build` compile le protocole, le plugin Vite, le pont, le concepteur et la démo. Le
pont sert le concepteur depuis `packages/designer/dist` : sans build, `/` n'affiche qu'une page
d'aide.

### Le mod Claude Code (facultatif pour essayer)

```text
/plugin install delphia --marketplace brissonjo-sudo/DelphIA
```

(ou `claude plugin install delphia --marketplace brissonjo-sudo/DelphIA` dans un shell). Moteur
Claude Code **2.1.308 ou plus** requis. Sans le mod, le concepteur fonctionne, mais rien
n'empêche Claude d'écraser vos ajustements ni ne l'en informe.

Limite actuelle : le mod trouve le pont seulement dans
`<projet>/node_modules/@vite-plugin-delph-ia/bridge/dist/cli.js` ou à côté de lui (`../bridge/dist/cli.js`,
quand il est chargé depuis ce dépôt). Autrement, il affiche « pont indisponible » : lancez le
pont vous-même (étape 2).

## 2. Lancer

Deux terminaux, depuis la racine du dépôt (exemple avec la démo) :

```bash
npm run dev -w @vite-plugin-delph-ia/demo                 # l'app : http://localhost:1420
npm run delphia -- --project examples/demo   # le pont : http://127.0.0.1:4317/
```

Le pont affiche `DelphIA bridge listening on http://127.0.0.1:4317/`. Il lit
`delphia.config.json` du projet (`port`, `appPort`) et écrit `.delphia/bridge.json` (pid et
ports) à son démarrage ; `Ctrl+C` le supprime.

Avec le mod installé et un `delphia.config.json` à la racine du projet de la session, le mod
lance le pont lui-même au démarrage de la session, quand il le trouve. La barre d'état de
Claude Code indique alors `DelphIA : concepteur http://127.0.0.1:4317/`. Si un pont répond
déjà, le statut ajoute `(pont déjà actif)`.

Ouvrez **http://127.0.0.1:4317/** dans le navigateur. La barre d'état du concepteur doit
afficher `Pont : connecté` et `App : connectée (http://localhost:1420)`.

## 3. Ajuster un élément

Seuls les éléments portant `data-dz-id` sont ajustables. Ils apparaissent dans la liste
« Éléments » à gauche, avec leur balise.

1. **Sélectionner** : cliquez l'élément dans l'app (le plus petit cadre qui contient le point),
   ou son nom dans la liste.
2. **Déplacer** : glissez-le. Pendant le glisser, l'aperçu est instantané et rien n'est écrit.
   Au relâcher, l'ajustement est enregistré.
3. **Redimensionner** : glissez l'une des 8 poignées.
4. **Repères** : le bouton **Accrochage** active l'alignement magnétique sur les bords et
   centres des autres éléments et du parent (seuil de 5 px). Le bouton **Grille** active une
   grille de 8 px. Les deux se basculent d'un clic dans la barre d'outils.
5. **Clavier** : flèches ±1 px, Maj + flèches ±10 px, `Échap` désélectionne.
6. **Inspecteur** (à droite) : `Décalage X (dx)`, `Décalage Y (dy)`, `Largeur`, `Hauteur`
   éditables. Valeurs entières ; les décalages sont bornés à ±10 000, la taille à 0–10 000.
7. **Remesurer** (barre d'outils) force une nouvelle mesure si la page a changé sans que le
   concepteur s'en soit aperçu.

L'élément reçoit le badge **épinglé** : son ajustement est dans `.delphia/overrides.json` et
s'applique par CSS (`translate`, `width`, `height`, `!important`). Le code source de l'app n'est
pas modifié.

## 4. Libérer un élément

Sélectionnez-le, puis **Libérer** dans l'inspecteur : l'ajustement est supprimé et l'élément
reprend la géométrie du code. La section **Orphelins** liste les ajustements dont l'id
n'existe plus dans la page (élément renommé ou supprimé) ; chacun a son bouton **Libérer**.

Limite connue : `translate` décale l'élément sans libérer l'espace qu'il occupait (ADR 0001).

## 5. Ce que voit Claude

Avec le mod actif, à chaque tour, s'il y a au moins un élément épinglé, Claude reçoit en
dernière section du prompt système (exemple) :

```text
# DelphIA — géométrie verrouillée par l'utilisateur (2 élément(s))
L'utilisateur a ajusté ces éléments au pixel dans le concepteur DelphIA.
Règles : ne change pas leur position, taille, marges ni transformations dans le code ;
ne supprime ni ne renomme leur attribut data-dz-id ; n'édite jamais .delphia/overrides.json.
Si une demande exige de bouger l'un d'eux, dis-le et demande d'abord.
- btn-new-task : décalé de (8, 0) px
- search-box : largeur 320 px, hauteur 36 px
```

En plus, le mod **refuse** :

- toute écriture (Write, Edit, MultiEdit, NotebookEdit) dont la cible est dans `.delphia/` ;
- toute édition qui ferait disparaître le `data-dz-id` d'un élément épinglé (le message de
  refus demande à Claude de passer par vous) ;
- les commandes Bash/PowerShell qui semblent écrire dans `.delphia/` (garde heuristique : un
  filet de sécurité, pas une barrière).

Quand vous ajustez un élément pendant une session, un toast du type `DelphIA : 1 épinglé(s)`
(ou `modifié(s)`, `libéré(s)`) apparaît au tour suivant.

### La commande `/delphia`

Affiche l'état du pont et les éléments épinglés :

```text
Pont : actif — concepteur http://127.0.0.1:4317/
Éléments épinglés : 2 (révision 5)
- btn-new-task
- search-box
```

(10 ids au plus ; « … et N autre(s) » au-delà.) La commande n'est enregistrée que dans un
projet qui contient `delphia.config.json`.

## 6. Dépannage

**Port occupé.** Le pont s'arrête avec le code 1 et le message
`Le port 4317 est déjà utilisé (127.0.0.1). Libérez-le ou changez "port" dans delphia.config.json.`
Un autre pont tourne peut-être déjà (ouvrez simplement son URL), sinon changez `port`. Côté
app, la démo configure Vite en `strictPort` : 1420 occupé fait échouer `vite` ; libérez-le ou
changez `appPort` **et** le port de Vite.

**« App : non connectée ».** Vérifiez, dans l'ordre :

1. l'app tourne bien (`npm run dev -w @vite-plugin-delph-ia/demo`, ou le `vite` de votre projet) ;
2. `appPort` dans `delphia.config.json` est le port réel de Vite ;
3. `plugins: [delphia()]` est présent dans `vite.config.ts` (c'est lui qui injecte le runtime) ;
4. vous ouvrez le concepteur par `http://127.0.0.1:<port>/` ou `http://localhost:<port>/`
   (le runtime n'écoute que ces origines par défaut ; l'option `designerOrigins` les change) ;
5. cliquez « Remesurer » dans la barre d'outils.

« 0 élément(s) mesuré(s) » alors que l'app est connectée : aucun élément ne porte
`data-dz-id` (ou un id viole le motif `^[a-z][a-z0-9-]{0,63}$`).

**`bridge.json` périmé.** Un arrêt brutal (`taskkill /F`, `kill -9`) laisse
`.delphia/bridge.json` derrière lui. Sans danger : le mod vérifie que le pont répond
réellement (`/api/config`) et sinon en lance un nouveau, qui réécrit le fichier ; le pont
l'écrase aussi à son démarrage. Vous pouvez supprimer le fichier à la main (vous, pas Claude :
le mod bloque ses écritures dans `.delphia/`).

**« DelphIA : pont indisponible — cli du pont introuvable ».** Le mod ne trouve pas
`<projet>/node_modules/@vite-plugin-delph-ia/bridge`. Installez-le (`npm install -D @vite-plugin-delph-ia/bridge`) puis
ouvrez une nouvelle session, ou lancez-le à la main : `npx delphia-bridge --project .`
(depuis le dépôt DelphIA : `npm run delphia -- --project <projet>`).

**Le mod ne se charge pas / `plugin validate` échoue sur les `modules`.** Le `claude` de votre
`PATH` est trop ancien : les `modules` de hooks demandent le moteur 2.1.308 ou plus. Mettez
Claude Code à jour ou, pour valider et tester le mod, pointez la variable `CLAUDE` vers un
binaire récent : `npm run validate -w @vite-plugin-delph-ia/mod` et `npm run test:mod -w @vite-plugin-delph-ia/mod`
l'utilisent (sans elle, un chemin par défaut propre à la machine de l'auteur, à surcharger).

**Un ajustement n'apparaît pas dans le build.** Le CSS est généré au `build` à partir de
`.delphia/overrides.json` : reconstruisez après avoir ajusté. Le runtime de mesure n'est
jamais embarqué dans le build de production.

**`overrides.json` invalide.** Le pont ne l'écrase jamais et renvoie l'erreur au concepteur ;
le plugin Vite affiche un avertissement et ignore le fichier. Corrigez-le ou supprimez-le
vous-même.
