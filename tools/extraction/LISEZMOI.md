# Extraire un monstre Dofus 3 en planche de sprites

Chaîne testée sur le Bouftou (`bones_assets_bone_563.bundle`, Dofus 3.7, Unity 6000.3.16f1).

1. `python b_dump.py bones_assets_bone_563.bundle out/`
   Ouvre le bundle avec UnityPy (`pip install UnityPy`). Écrit la texture des morceaux (`tex_*.png`),
   les définitions (`mb_*.json`) et une animation binaire par fichier (`ta_563_Anim*.bin`).
2. `python build_scene.py out/`
   Décode les animations (format Ankama Animator2D, voir `anim_parse.py`) et écrit `out/scene.json` :
   les maillages des morceaux + pour chaque frame la liste des morceaux avec leur matrice.
3. `node render.js out/scene.json out/tex_563-0.png bouftou AnimStatique_1,AnimCourse_1,... 1 1.1`
   (Playwright) Rend chaque frame et produit `bouftou.png` + `bouftou.json` (atlas Phaser, frames `{Anim}_{dir}_{i}`).

Format d'une animation (`ta_*.bin`) :
- en-tête : u16 nb frames, u16 nb nœuds, puis repères nommés (ex. `SHOT` = frame d'impact), puis table de u32 (offset de chaque frame).
- chaque frame = liste d'enregistrements : u16 nœud, u8 drapeaux, u8 alpha ;
  0x01 → i16 morceau (index dans `graphics`), i16 parent, u32 ; 0x04 → couleur multiplicative RGBA (0x7f = 1) ;
  0x08 → couleur additive RGBA ; 0x10 → matrice 6 floats (a, c, tx, b, d, ty) ; 0x40 → 6 floats ; 0x02 → alpha valide.
- les nœuds gardent leur état d'une frame à l'autre (seuls les changements sont écrits). Axe Y à inverser.
- `_1` = face (bas-droite), `_5` = dos (haut-gauche) ; les autres diagonales = miroir.

## Personnages joueurs (Iop)
`python build_char.py scene.json bone_1-static,bone_1-movement,bone_1-combat,bone_1-8-combat skin_80,skin_2124 <couleurs> <anims>`
- Squelette commun n° 1, découpé en plusieurs bundles (static, movement, combat, puis `1-{classe}-combat` pour les sorts).
- Les nœuds d'anim avec le drapeau 0x20 pointent vers `exposedNodeNames` (ex. `BrasD_1`), résolus dans les skins
  (skin du corps = look de la classe, skin de tête = `headsdataroot`). Chaque morceau de skin est une liste aplatie
  de groupes nommés + feuilles ; les feuilles sous un groupe `ColorGray_N_*` prennent la couleur N (`maleColors`),
  appliquée en mode « overlay » sur la texture grise.
- Iop mâle : look `{1|80||55}`, tête 2124, couleurs 15704172,15301153,14736065,12200764,484225,12429686.
- Rendu à cellule fixe : `BOX=-150,-280,150,50 node render.js scene.json - iop "AnimCourse_1:16,..." 1 0.5`.
Identifiants utiles : Bouftou 563, Boufton Blanc 567, Bouftou Royal 571 (`data_assets_monstersdataroot`, champ `look`).

## Animation officielle d'un sort
`spellsdataroot` -> `boundScriptUsageData[].scriptId` -> `spellscriptsdataroot.rawParams` (JSON) -> `casterAnimation`.
Iop : Pression 802, Épée Céleste 801, Bond 811, Colère de Iop (13124) 800, Coup de poing (sort 0) AnimArme0 (bundle `bone_1-combat-armes`).
`dataload.py` résout les références (`rid`) des tables. `trim_pack.py` rogne chaque frame et produit un atlas Phaser « trimmed »
(rendre d'abord avec une grande BOX, ex. -260,-1000,260,120, pour ne rien couper).

## Cartes (Dofus 3)
- Données : `Content/Map/Data/mapdata_assets_world_N.bundle` (MonoBehaviour `map_{id}` : backgroundElements, sortableElements, cellsData...).
  Trouver le bundle d'une carte : `python catalog_find.py Map/Data/catalog_1.0.bin map_{id}.asset`.
- Carte d'une sous-zone : `subareasdataroot.mapIds`, coordonnées dans `mapsinformationdataroot` (posX/posY).
- Textures : `Content/Map/Textures/1x/mapgfx_1x_*_assets_all.bundle` (une Texture2D par gfxId) ; `gfx_bundles.py map.json` liste les bundles nécessaires (gros : 50000 et 60000 font ~260 Mo).
- Rendu : élément centré en (m31, -m32), miroir/échelle m11/m22, couleur ARGB multiplicative (0x80 = neutre). Ordre : fond, triables par (cellId, innerCellRenderOrder). Les foregroundElements sont des effets de lumière (ignorés).
- Grille : 14 x 40 cases losanges 86 x 43, origine (-620, -490) en unités carte (calée à l'œil avec `grid_overlay.py`). `cellsData[i].mov` = marchable.
- `map_export.py map.json dossier` produit sol.webp, decor.webp/json et carte.json pour le jeu.

## Ombre au sol
Les ombres Dofus sont faites de 4 quarts semi-transparents qui se chevauchent (croix sombre au rendu). `python drop_shadow.py scene.json [tex.png]` les retire avant le rendu ; le jeu dessine sa propre ellipse.

## Interface (HUD de Dofus 3)
- `python ui_extract.py <StreamingAssets> <sortie>` exporte en PNG toutes les Texture2D/Sprite des bundles d'UI
  (`aa/StandaloneWindows64/uielements_assets_all`, `uidarkstone_assets_all`, `figs_assets_1x`, `uiassets_*`, `icons_assets_1x`,
  `spriteassets_assets_1x`, `graphics_assets_all`) et les icônes de sorts (`Content/Picto/Spells/spell_assets_1x`), avec un `index.csv`.
- Icône d'un sort : `iconId` de `spellsdataroot` -> `png/spells/sort_{iconId}.png`. `python spell_icons.py spells.json fr.bin 8` liste ceux du Iop
  (Pression 11830, Bond 11831, Épée Céleste 11843, Colère de Iop 11851).
- Pièces du HUD de combat : cœur de PV = `figs/gaugeHeartBackground` + `gaugeHeartFilledRed` (rogné par le haut) + `gaugeHeartShadeEdge`
  + `uielements/gaugeHeartBorder` ; PA = `figs/paCounter`, PM = `figs/pmCounter` ; emplacements = `uidarkstone/slot_dark_background_full`,
  `slot_light_lock` ; timeline = `uidarkstone/background_timeline_{blue,red}_*` + `uielements/border_turn_timeline` (blanc, à teinter) ;
  bannières = `uidarkstone/background_levelup_banner`, `background_defeat_banner`. Copies utilisées par le jeu : `public/assets/ui/`.
