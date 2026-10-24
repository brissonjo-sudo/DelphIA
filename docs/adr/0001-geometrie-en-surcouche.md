# ADR 0001 — Les ajustements manuels vivent dans une surcouche, pas dans le code

- Date : 2026-10-24
- Statut : accepté

## Contexte

Claude écrit le code de l'interface. L'utilisateur ajuste ensuite des éléments au pixel
dans le concepteur. Si ces ajustements étaient écrits dans les fichiers sources, Claude les
écraserait à la prochaine réécriture, et l'utilisateur et Claude se disputeraient les
mêmes lignes.

## Décision

1. **Identité stable** : chaque élément ajustable porte `data-dz-id="<id>"`
   (motif `^[a-z][a-z0-9-]{0,63}$`). C'est Claude qui pose ces attributs.
2. **Source de vérité séparée** : les ajustements vont dans `.delphia/overrides.json`, à la
   racine du projet cible. Seuls le pont et l'utilisateur écrivent dans `.delphia/`.
3. **Application par CSS** : le plugin Vite génère, en dev comme au build, un CSS chargé
   en dernier :
   - déplacement → propriété `translate` (n'écrase pas `transform`, ne casse pas le flux) ;
   - taille → `width` / `height` avec `box-sizing: border-box` (cohérent avec
     `getBoundingClientRect` côté concepteur) ;
   - tout en `!important`, pour que la retouche manuelle l'emporte.
4. **Pixels entiers bornés** à ±10 000. Ids validés avant toute injection dans un sélecteur.
5. **Le mod fait respecter la règle** :
   - `tool.call` : refuse tout Write/Edit visant `.delphia/` ;
   - `prompt.compose` : ajoute au prompt système la liste des éléments verrouillés ;
   - signal quand une édition supprime un `data-dz-id` épinglé.

## Conséquences

- (+) Claude et l'utilisateur ne modifient jamais le même fichier : aucun écrasement possible.
- (+) Les ajustements survivent aux refactorisations tant que l'id est conservé.
- (+) Le build Tauri embarque les ajustements (CSS généré au build).
- (−) Un id renommé ou supprimé rend son ajustement orphelin : le concepteur doit le
  signaler.
- (−) `translate` décale visuellement sans libérer l'espace d'origine : c'est le
  comportement voulu (retouche fine), pas une mise en page absolue façon Delphi pure.
  Un mode « positionnement absolu » pourra faire l'objet d'un ADR ultérieur.
