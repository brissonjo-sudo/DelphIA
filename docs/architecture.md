# Architecture

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

## Paquets

| Paquet        | Rôle                                                                                   | Dépendances                                                           |
| ------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `protocol`    | Contrat partagé : ids, géométrie, document d'ajustements, messages, CSS, résumé prompt | aucune                                                                |
| `vite-plugin` | Ajoute à l'app cible le runtime de mesure et le CSS de surcouche                       | protocol, vite                                                        |
| `bridge`      | Serveur local : sert le concepteur, WebSocket, écrit `.delphia/`                       | protocol                                                              |
| `designer`    | UI du concepteur                                                                       | protocol                                                              |
| `mod`         | Mod Claude Code                                                                        | protocol (copié au build : un mod ne charge que ses propres fichiers) |

## Flux d'un ajustement

1. L'utilisateur glisse un élément dans le concepteur.
2. Pendant le glisser : `designer:preview` → runtime (aperçu instantané, rien n'est écrit).
3. Au relâcher : `override:set` → pont → validation → `overrides.json` (révision +1).
4. Le plugin Vite voit le fichier changer → CSS régénéré → HMR → l'app se met à jour.
5. Au prochain tour, le mod lit le document et ajoute les verrous au prompt système.

Décisions : voir [docs/adr](adr/).
