## Description

<!-- Quel problème cette PR résout-elle, et pourquoi ? Lien vers l'issue si elle existe. -->

## Changements

<!-- Liste courte des changements, par paquet (protocol, vite-plugin, bridge, designer, mod, docs…). -->

-

## Vérifications

- [ ] `npm run build` passe
- [ ] `npm run check` passe (typecheck, lint, format, tests)
- [ ] Tests ajoutés ou mis à jour
- [ ] Si le mod change : `claude plugin test packages/mod` et `claude plugin validate packages/mod` (Claude Code ≥ 2.1.308)
- [ ] Si le protocole change : copie du mod resynchronisée (`npm run sync-protocol -w @vite-plugin-delph-ia/mod`)
- [ ] `CHANGELOG.md` mis à jour ; ADR ajouté si décision d'architecture

## Points d'attention

<!-- Ce que le relecteur doit regarder de près : sécurité (entrées validées, 127.0.0.1, .delphia/), compatibilité, limites connues. -->
