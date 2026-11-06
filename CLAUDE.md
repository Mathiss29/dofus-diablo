# Dofus diablo — notes pour Claude

- Répondre en français.
- `npm test` (vitest) et `npm run build` (tsc + vite) doivent passer avant chaque push.
- `src/sim/` ne doit jamais importer Phaser, `window` ni `Math.random()` : tout le hasard passe par `world.rng`.
- L'affichage (`src/render/`) lit l'état et consomme `world.drainEvents()`, il ne modifie pas la partie.
- Le contenu (stats, sorts, vagues) est dans `src/data/*.json` ; l'apparence (planche, animations) dans `src/render/looks.ts`.
- Les monstres d'une zone sont ceux de sa sous-zone dans les données de Dofus 3 (choix de Mathis).
- Les animations de sorts sont les animations officielles (spellscripts -> casterAnimation), voir tools/extraction/LISEZMOI.md.
- Journal du jeu (`src/data/journal.json`, onglet Journal de l'accueil) : chaque PR ajoute une ou deux lignes, côté joueur, dans le carnet du jour (un carnet par date, rubriques Nouveautés / Le monde / Combat / Corrections / En coulisses). Nouveau jour = nouveau carnet avec titre, résumé et capture dans `public/assets/journal/<date>.webp`.
- Planches de monstres/PNJ/persos en AVIF (`FORMAT=AVIF`, trim_pack.py), le reste en WebP. Fichiers lourds (`.webp/.avif/.png/.jpg/.mp3` de `mondes/ sprites/ son/ fx/ cartes/`) : après tout export, lancer `node tools/hebergement/envoi.mjs` (empreintes `src/data/fichiers-lourds.json` + envoi sur Cloudflare R2), voir tools/hebergement/LISEZMOI.md. Les JSON restent dans le dépôt. Les fichiers lourds ne sont plus dans git : sur un clone neuf, `node tools/hebergement/envoi.mjs --recuperer` les reprend sur R2.
