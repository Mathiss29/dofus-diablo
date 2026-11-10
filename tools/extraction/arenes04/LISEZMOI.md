# Arènes de la 0.4 (11 donjons d'Amakna et des Wabbits)

Ligne « Arènes finales : 1A 2A » (10 nov. 2026). Les cours sont composées avec les pièces des vraies salles
de chaque donjon (`grp_<id>.json` = cadres choisis dans les cartes officielles, `djs.json` = cartes des donjons).

- `cour_auto.py` : cour ronde façon Astrub (`../arenes.py`) garnie des pièces d'un donjon ;
  `cours6.py`, `squel.py`, `kwakwa.py`, `craq.py`, `chateau_ww.py` : compositions des maquettes.
- `dilate.py` : Scarafeuilles = vraie salle (carte 94115840) agrandie ×1,6.
- `export04.py mondes_dir [apercu|-] [ids]` : écrit sol + décor + cases marchables dans
  `public/assets/mondes/astrub` (rangées sous Astrub en attendant Amakna) et les points dans `arenes04_points.json`.
  À lancer depuis un dossier de travail qui contient `tex/` (gfx), `cartes/`, `djs.json`, `grp_*.json`.
- Les donjons (vagues, boss, points) sont dans `src/data/zones.json` → `astrub.open.donjonsTest`,
  ajoutés aux donjons seulement en partie de test (`World`, `opts.test`).
- Monstres : `lot_monstres.json` (squelette → clé), planches par `../monster_planche.py`
  (SCALE=1.6 pour bwork_archer, bworkette, forgeron_sombre, craqueleur_des_plaines, wa_wobot ; SKIP_MASKS=1 pour gobaliste, sinon ses masques sortent en vert fluo),
  sorts et stats par `../monster_spells.py` et `../monster_stats.py`. Le Wobot (squelette 323) n'a pas de texture.
