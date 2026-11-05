# Parangon (après le niveau 200)

`python tools/parangon/generer.py` écrit `src/data/parangon/{iop,cra,osamodas}.json`.

- `sorts_officiels.json` : les 44 sorts de chaque classe (id, nom, niveau minimal officiel, élément, description), extraits des tables
  `spellvariants` / `spells` / `spelllevels` de Dofus 3 (breeds 8, 9, 2). Crapipou et Crapipaud sont classés Eau (lignée de l'Éveil).
- `contenu.py` : les textes écrits à la main (notables, clés de voûte avec leur prix, transformations des sorts du niveau 140+).
- Règles (choix de Mathis du 2026-11-05) : un arbre par classe, 5 zones ; chaque sort a un nœud à `6 + (niveau - 1) * 34 / 189`
  points du départ ; petit bonus jusqu'au niveau 60, moyen jusqu'au 139, transformation au-delà ; aucun nœud de sort n'a de
  contrepartie ; une seule clé de voûte active ; runes Rune / Pa / Ra = +50 / +100 / +150 %.
- Temps réel : jamais de vocabulaire de tour (1 tour officiel = 3 s).

`tests/parangon.test.ts` vérifie ces règles. Rien n'est encore branché dans la partie.
