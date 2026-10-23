# ADR 0002 — Pont mod ↔ concepteur : fichiers d'abord, processus lancé par le mod

- Date : 2026-10-24
- Statut : accepté (lancement par le mod : à confirmer par la sonde, cf. journal)

## Contexte

Faits vérifiés dans les types du moteur Claude Code 2.1.308 :

- un mod n'a ni DOM ni Node ; il ne peut pas ouvrir de port ;
- `$.process.spawn` lancé depuis `session.start` garde un processus enfant **pendant la
  session**, mais le tue quand le module du mod se recharge ;
- `$.process` est documenté « CLI only » ;
- `$.fs` lit et écrit des fichiers ; `$.http.fetch` fait des requêtes sortantes.

## Décision

1. Le serveur pont (`packages/bridge`) est un processus Node autonome.
2. Le mod le lance via `$.process.spawn` au démarrage de session. Solution de repli
   documentée : `npm run delphia` dans un terminal.
3. **Canal de référence = fichiers** dans `.delphia/` :
   - `overrides.json` : ajustements (écrit par le pont) ;
   - `bridge.json` : pid et ports (écrit par le pont au démarrage).
     Le mod lit ces fichiers ; il survit ainsi à un redémarrage du pont ou du mod.
4. `$.http.fetch` vers `127.0.0.1` sert seulement de notification rapide (optionnelle).
5. Le pont n'écoute que sur `127.0.0.1`.

## Conséquences

- (+) Robuste aux rechargements du mod pendant le développement.
- (+) Fonctionne même si le lancement par le mod est refusé dans un hôte donné.
- (−) Latence de lecture fichier côté mod (négligeable : lecture à chaque tour).
