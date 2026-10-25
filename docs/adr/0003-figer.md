# ADR 0003 — « Figer » : passer un ajustement de la surcouche au code

- Date : 2026-10-24
- Statut : accepté

## Contexte

Les ajustements manuels vivent dans une surcouche CSS (ADR 0001). L'utilisateur veut pouvoir
les intégrer au vrai code, écrit par Claude, puis vider la surcouche. Deux risques :

1. **Double application** : si la surcouche reste active pendant que le code reproduit
   l'ajustement, l'élément est décalé deux fois.
2. **Fidélité** : Claude peut traduire un décalage par une marge, un `gap`… le rendu doit
   rester identique au pixel près.

## Décision

1. **État dans `.delphia/bake.json`**, écrit par le pont seul (un seul écrivain, comme
   `overrides.json`). Une demande en cours au plus. Cycle :
   `requested → applied → verified | mismatch`, `requested → cancelled`,
   `applied | mismatch → reverted`.
2. **Le concepteur fige ce qu'il voit** : il envoie les rectangles mesurés avec la surcouche
   (`bake:request`). Le pont reprend la géométrie depuis `overrides.json` (pas depuis le client).
3. **Le mod déclenche le tour de Claude.** Par défaut, il **préremplit** la zone de saisie
   (`$.prompt.fill`) avec une phrase courte (`bakeTrigger`) ; l'utilisateur valide par Entrée.
   Option `figer: "direct"` : `$.prompt.submit`. Dans les deux cas, le hook `prompt.submit`
   ajoute en contexte la consigne détaillée (`bakeInstructions`).
4. **Pendant le tour**, la section « géométrie verrouillée » exclut les éléments à figer ; la
   garde de `.delphia/` et des `data-dz-id` reste active. Le mod note les fichiers modifiés.
5. **Fin de tour** (`turn.complete`) : tour abouti → `POST /api/bake/applied` ; sinon →
   `POST /api/bake/cancel`. Le pont retire les éléments de la surcouche **seulement** sur
   `applied` : la double application est impossible.
6. **Vérification par la mesure** : après rechargement, le concepteur remesure et envoie
   `bake:verify` ; le pont compare lui-même (`compareRects`, tolérance 1 px) →
   `verified` ou `mismatch`.
7. **Rétablir** (`bake:revert`) remet les ajustements dans la surcouche. Le code modifié par
   Claude reste en place ; le concepteur liste les fichiers touchés (annulation par git).
8. **Sécurité des routes HTTP du mod** : jeton aléatoire régénéré à chaque démarrage, écrit
   dans `bridge.json`, exigé dans l'en-tête `x-delphia-token` ; `Host` vérifié ; requête
   refusée si un en-tête `Origin` est présent (un navigateur en envoie toujours pour un
   `POST` inter-sites ; le mod n'en envoie pas). Comparaison du jeton à temps constant.
   Limite assumée : un processus local qui lit `bridge.json` (y compris Claude via `Read`)
   peut appeler ces routes ; la protection vise les pages web.

## Conséquences

- (+) Pas de double décalage ; résultat prouvé par la mesure.
- (+) L'utilisateur garde la main (préremplissage par défaut).
- (−) Vérification impossible si l'app n'est pas lancée : la demande reste `applied`, le
  concepteur l'indique.
- (−) Le code modifié n'est pas annulé par « Rétablir » : git reste l'outil d'annulation.
