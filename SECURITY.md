# Politique de sécurité

## Surface exposée

DelphIA est un outil de développement local. Il n'est pas conçu pour être exposé sur un réseau.

- **Serveur local uniquement** : le pont n'écoute que sur `127.0.0.1` (jamais `0.0.0.0`).
- **Contrôle de l'en-tête `Host`** : seuls `127.0.0.1:<port>` et `localhost:<port>` sont
  acceptés, sinon 403 (anti DNS-rebinding).
- **Contrôle de l'`Origin`** : l'ouverture du WebSocket `/ws` exige une `Origin` égale à
  `http://127.0.0.1:<port>` ou `http://localhost:<port>`. Côté app, le runtime injecté par le
  plugin Vite n'accepte les `postMessage` que des origines autorisées (`designerOrigins`), et le
  concepteur n'accepte que ceux de son iframe.
- **Fichiers statiques confinés** : le pont ne sert que le dossier du concepteur ; `..`,
  `%2e%2e`, `\` et `:` sont refusés, les liens symboliques sortants sont écartés (`realpath`),
  les types MIME sont en liste blanche, `X-Content-Type-Options: nosniff`.
- **Tous les messages sont validés** : WebSocket (texte JSON, 64 Ko au plus), `postMessage` et
  fichiers (`overrides.json`, `bridge.json`, `delphia.config.json`) passent par les `parse*` de
  `@delphia/protocol`. Un message invalide reçoit une erreur, la connexion reste ouverte.
- **CSS généré seulement depuis des ids validés** : un id `data-dz-id` doit respecter
  `^[a-z][a-z0-9-]{0,63}$` et n'entre dans un sélecteur que via `dzSelector` ; les valeurs
  numériques sont des entiers bornés à ±10 000.
- **Écriture atomique** de `.delphia/overrides.json` (fichier temporaire puis renommage) ; le
  pont en est le seul écrivain, et un fichier invalide n'est jamais écrasé.
- **`.delphia/` protégé par le mod** : le mod Claude Code refuse les écritures de Claude dans
  `.delphia/` et le retrait d'un `data-dz-id` épinglé.

### Limites assumées

- La garde du mod sur les commandes Bash/PowerShell est **heuristique** (analyse de texte) ;
  une commande construite de façon détournée peut la contourner.
- La garde « id épinglé » ne voit pas les ids construits dynamiquement.
- DelphIA ne défend pas contre du code déjà exécuté sur votre poste sous votre compte : un tel
  code peut écrire `.delphia/` directement ou parler au pont.
- Le mod lance un processus Node (`node <cli> --project <projet>`) : n'installez que des
  versions de DelphIA dont vous avez examiné le code.

## Signaler une vulnérabilité

**N'ouvrez pas d'issue publique.** Utilisez le signalement privé de GitHub :
[Security → Report a vulnerability](https://github.com/brissonjo-sudo/DelphIA/security/advisories/new)
sur le dépôt `brissonjo-sudo/DelphIA` (GitHub Security Advisories). Indiquez la version ou le
commit, les étapes de reproduction et l'impact estimé.

Projet personnel, sans équipe dédiée : aucun délai de réponse n'est garanti, mais un signalement
sérieux sera traité avant toute divulgation publique.

## Versions supportées

Projet en `0.x` : seule la **dernière version** (branche `main`) reçoit des correctifs de
sécurité.
