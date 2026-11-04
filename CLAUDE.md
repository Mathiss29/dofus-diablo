# Dofus diablo — notes pour Claude

- Répondre en français.
- `npm test` (vitest) et `npm run build` (tsc + vite) doivent passer avant chaque push.
- `src/sim/` ne doit jamais importer Phaser, `window` ni `Math.random()` : tout le hasard passe par `world.rng`.
- L'affichage (`src/render/`) lit l'état et consomme `world.drainEvents()`, il ne modifie pas la partie.
- Le contenu (stats, sorts, vagues) est dans `src/data/*.json` ; l'apparence (planche, animations) dans `src/render/looks.ts`.
- Les monstres d'une zone sont ceux de sa sous-zone dans les données de Dofus 3 (choix de Mathis).
- Les animations de sorts sont les animations officielles (spellscripts -> casterAnimation), voir tools/extraction/LISEZMOI.md.
