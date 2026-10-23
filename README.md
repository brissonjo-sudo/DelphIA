# DelphIA

Un concepteur visuel façon Delphi pour Claude Code.

- **Claude écrit** l'interface d'une application de bureau (Tauri 2, Vite + TypeScript).
- **Le concepteur DelphIA l'affiche en direct** dans le navigateur, pendant la construction.
- **Vous ajustez chaque élément au pixel** à la souris, avec repères d'alignement.
- **Le mod DelphIA prévient Claude** de vos ajustements pour qu'il ne les écrase pas.

> Statut : en construction (jalon M0 — socle et protocole).

## Principe

Vos ajustements ne touchent jamais le code écrit par Claude. Ils vivent dans
`.delphia/overrides.json` et sont appliqués par une surcouche CSS. Le mod interdit à Claude
d'écrire dans `.delphia/` et lui rappelle, à chaque tour, quels éléments sont verrouillés.
Détails : [docs/architecture.md](docs/architecture.md) et [docs/adr](docs/adr/).

## Développement

Prérequis : Node ≥ 22. Rust et les prérequis Tauri 2 pour l'application d'exemple.

```bash
npm install
npm run check
```

## Licence

MIT — voir [LICENSE](LICENSE).
