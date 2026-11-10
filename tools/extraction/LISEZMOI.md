# Extraire un monstre Dofus 3 en planche de sprites

Chaîne testée sur le Bouftou (`bones_assets_bone_563.bundle`, Dofus 3.7, Unity 6000.3.16f1).

1. `python b_dump.py bones_assets_bone_563.bundle out/`
   Ouvre le bundle avec UnityPy (`pip install UnityPy`). Écrit la texture des morceaux (`tex_*.png`),
   les définitions (`mb_*.json`) et une animation binaire par fichier (`ta_563_Anim*.bin`).
2. `python build_scene.py out/`
   Décode les animations (format Ankama Animator2D, voir `anim_parse.py`) et écrit `out/scene.json` :
   les maillages des morceaux + pour chaque frame la liste des morceaux avec leur matrice.
3. `node render.cjs out/scene.json out/tex_563-0.png bouftou AnimStatique_1,AnimCourse_1,... 1 1.1`
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
- Rendu à cellule fixe : `BOX=-150,-280,150,50 node render.cjs scene.json - iop "AnimCourse_1:16,..." 1 0.5`.
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

## Monde ouvert (plusieurs cartes collées)
- Les cartes voisines se raccordent bord à bord : [x+1,y] est 14 cases (1204 px) à droite, [x,y+1] 40 demi-lignes (860 px) plus bas,
  donc un monde = une grande grille 14·nx × 40·ny (même origine, même décalage des lignes impaires).
- `python world_export.py liste.json cartes/ textures/ public/assets/mondes/<nom>` ; `liste.json` = `{"x,y": [mapId, sousZone]}`
  (cartes `worldMap` = 2 pour Incarnam, prises dans `subareasdataroot.mapIds`), `cartes/` = les `map_{id}.json` sortis des bundles mapdata.
  - Puis TOUJOURS `python bords_fondu.py public/assets/mondes/<nom>` : un seul débord par raccord (celui de la carte du haut ou de gauche), sinon une bande nette sépare les cartes. Les bords déjà traités sont notés `"fondu": 1` dans `monde.json`.
  - Puis `python decor_doublons.py public/assets/mondes/<nom>` : chaque carte Dofus reprend le décor de ses voisines qui déborde sur elle ; en monde continu on garde un seul exemplaire (celui de la carte où il se trouve), sinon ordre d’affichage faux et ombres doublées. Cartes traitées notées `"doublons": 1`.
  - Puis `python batiments.py public/assets/mondes/<nom> <dossier des cartes map_<id>.json>` (choix de Mathis « Cartes : 1B 2A 3A », 2026-11-07) : retire les bâtiments recopiés par la carte voisine sous une autre image (la Banque d'Astrub était posée deux fois, à 41 px), range chaque image dans son bâtiment (`bt`, le fondu efface tout le bâtiment d'un bloc) et range chaque porte sur la case de son bâtiment. Cartes traitées notées `"batiments": 1`.
  - MÉTHODE « FAÇON SANSTOUR » (Mathis, 2026-11-07, Astrub) : ne PAS lancer `decor_doublons.py`, et lancer `COURANTE=1 python batiments.py …`.
  - Puis `python portes_contour.py public/assets/mondes/<nom>/monde.json <dossier des cartes map_<id>.json>` : marque `po` (gfx officiel de porte, 62977 à 62999) sur les portes dessinées à part ; le jeu les entoure au survol, façon Sanstour. Les portes peintes dans l'image du bâtiment (Taverne, Banque…) n'ont pas d'image à elles.
  - Puis `python survols.py public/assets/mondes/<nom>/monde.json <dossier des cartes> <dossier des bundles mapgfx_1x> public/assets/ui/survols_<nom>` : le contour officiel de chaque porte (boîtes de survol `mapData.boundingBoxes` de Dofus 3, même pour les portes peintes dans le bâtiment, et portes dessinées à part), en trait lilas comme Sanstour. Le jeu montre le plus proche de la porte survolée (WorldView.montrerSurvol). Incarnam n'en a pas près de ses portes.
    Chaque carte Dofus contient tout ce qui l'entoure (±1000 px), mais Dofus n'affiche que la carte courante. Le jeu affiche la carte du joueur
    en entier et les voisines en objets entiers : une image dont le centre sort du cadre de sa carte est notée `h` (montrée seulement sur sa
    carte), et l'original d'une voisine que ce débord recopie note la carte dans `cc` (caché quand on y est). Plus aucune image coupée au raccord.
    Réexport du décor seul : `DECOR_ONLY=1 CALQUES=aucun PARTAGE=1 TEXDIR=… world_export.py <liste du dehors> …` dans un dossier à part, puis
    batiments.py COURANTE=1, decor_par_carte.py, et on remplace `decor`/`pages` des cartes du dehors (pages renumérotées au-dessus des anciennes).
    PUIS `python3 fige.py public/assets/mondes/<nom>` (Mathis, 2026-11-07 : « je ne veux pas ce déplacement de bâtiment ») : un seul jeu de bâtiments,
    le même depuis toutes les cartes. Les débords recopiés (`h` qui recouvrent un original caché `cc`) sont retirés, l'original est toujours montré ;
    les débords sans original deviennent visibles de partout, sauf s'ils doublent un élément d'une voisine. Plus aucun `h`/`cc` : rien ne change au passage du bord.
  - Enfin la tournée en images (« Cartes : 4A ») : `npm run build && npx vite preview --port 4173`, puis `node tools/verification/tournee.cjs <monde> <sortie>` et `python tools/verification/planche.py <sortie> <monde>` : planches de 16 cartes à regarder. Les détecteurs de `tests/cartes.test.ts` (« 4B ») bloquent la PR si une image manque ou si un bâtiment est posé deux fois.
    Il retire aussi les copies DÉCALÉES (Cité d'Astrub, Cimetière, Tainéla) : entre certaines voisines, la copie est posée une ou deux cases à côté de l'original, toujours du même décalage pour la paire ; sinon la maison apparaît deux fois côte à côte. Cartes traitées notées `"decales": 1`.
  - Puis `python voiles.py public/assets/mondes/<nom>` : retire les grands voiles de lumière semi-transparents posés sur toute une carte (gfx 63044 dans la Cité, 2000 x 868 : lueur des coins de l'écran dans Dofus, grandes zones claires à bords nets chez nous). Noté dans `"voiles"` de `monde.json` ; `world_export.py` les met aussi dans `VOILES`.
  - Bords du monde (monde sans ciel) : le jeu fond lui-même dans la brume les côtés de carte sans voisine (`WorldView.brume`).
  Sortie : `monde.json` (grille, cases marchables, sous-zone et décor de chaque carte), un `sol_x_y.webp` par carte (rogné pile au raccord
  côté voisin pour que le ciel d'une carte ne recouvre pas le sol de l'autre), et tout le décor dédoublonné dans `decor.json` + `decor_N.webp`
  (multiatlas Phaser, pages de 4096).
- Incarnam (zone 45) : 50 cartes du dehors (`incarnam_cartes.json`) : Route des âmes 450, Champs 444, Pâturages 445, Lac 442, Forêt 443,
  Cimetière 449 ; bundles mapdata `world_468` et `world_587`. Les cartes en (0,0) et celles de `worldMap` -1 sont des intérieurs
  (Mine, Taverne, Crypte, Queue du Dragon, maisons) : le lien porte → intérieur n'est pas dans le client (`m_interactionId`, côté serveur).
- Copier les gros bundles de textures UN PAR APPEL depuis le PC (en parallèle, les copies échouent).

## Monstres d'une sous-zone
- `subareasdataroot.monsters` -> `monstersdataroot` (`look` = `{squelette|...|échelle}` ; c'est ce squelette-là qu'il faut, PAS `gfxId` qui est un ancien numéro : le Sergent Chafer a gfxId 180 mais look {313}) ; attaque = `animId` du premier sort
  (`spells.boundScriptUsageData[].scriptId` -> `spellscriptsdataroot.rawParams`, ex. `animId:1` = `AnimAttaque1`).
- Planche : `b_dump.py`, `build_scene.py`, `drop_shadow.py`, puis
  `BOX=-200,-400,200,100 node render.cjs scene.json tex.png raw "AnimStatique_1:1,AnimStatique_5:1,AnimCourse_1,AnimCourse_5,AnimAttaque0_1,AnimAttaque0_5,AnimHit_1,AnimHit_5,AnimMort_1,AnimMort_5" 1 2.5`
  et `trim_pack.py raw nom 2048` (les Feux d'Incarnam : BOX=-130,-260,130,60 et échelle 2, sinon la planche dépasse la taille max du canvas).

- `python monster_planche.py <squelette> <nom> <Bones> public/assets/sprites 0,1` fait tout d'un coup (planche multiatlas en pages de 4096,
  repère SHOT de chaque attaque à reporter dans looks.ts). `SCALE` (2,5 par défaut ; 1,6 pour les gros), `BOX` (auto), `SKIP_MASKS=1` (Chafers).
  Grand Splatch (3249) et Chakrobat (3250) : bundles illisibles par UnityPy (LZMA « corrupt »), pas encore en jeu.

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

## Effets visuels officiels des sorts (choix 8A)

`python3 tools/extraction/spell_fx.py <tables json> <Content/Characters/Bones>` (depuis la racine du dépôt) :
lit les spellscripts des sorts du joueur (`classes.json` → `dofusId`) et des monstres (`monsters.json` → `spells[].id`),
rend chaque gfx `bones_assets_bone_<gfx>.bundle` (FX_0, ou FX_1/3/5/7 orientés) avec les couleurs du jeu
(render.html applique mul/add des bones ; `SKIP_MASKS=1` ignore les nœuds masques 0x40), puis écrit
`public/assets/fx/fx_<gfx>.webp/json` et `src/data/spellfx.json`. Les gfx déjà rendus sont gardés (`FORCE=1` pour tout refaire).
Les bundles d'effets ne sont pas dans le cache : les copier depuis le PC de Mathis.

## Métiers (choix 6A)

`items_export.py` ajoute aussi : `chasse` sur les armes à effet 795 « Arme de chasse », le critère officiel des viandes
(`Pj>41,N&CU>0` → `metier: {id: 41, min: N+1}`, `chasse: true`), les recettes du Chasseur faisables avec le butin du jeu
(`recipes`), et `soin` (effet 110) sur les plats.

## Caractéristiques (choix 10C + 10D)

`items_export.py` lit toutes les caractéristiques des objets dans la table des effets (`characteristic` + `characteristicOperator`)
et les range selon `CARAC` (mot-clé de `characteristics` → caractéristique du jeu). `monster_stats.py` donne aux monstres leurs
caractéristiques officielles (grade 1). Rôle de chacune en temps réel : `src/sim/caracs.ts`.

## Intérieurs (maisons, Mine, Taverne…)

Les cartes d'intérieur (worldMap -1 dans MapsInformation) n'ont pas de sortie par les bords. Le lien entre une porte et une salle n'existe que sur le serveur de Dofus. On le relie donc à la main dans `incarnam_interieurs.json`, d'après les éléments interactifs officiels :
- dehors : cadres de mine 50077, portes 425xx ;
- dedans : arches et passages 39767.

1. `python interieurs.py incarnam_interieurs.json incarnam_cartes.json cartes/ liste.json ../../src/data/zones.json incarnam`
   - Range les salles sous le dehors dans la grande grille, avec une carte vide entre chaque salle.
   - Écrit les portes dans `zones.json` (`open.portes`).
2. `ONLY_INSIDE=1 python world_export.py liste.json cartes/ textures/ ../../public/assets/mondes/incarnam` : ne réécrit que les images des intérieurs.
   - `DECOR_ONLY=1` ne réécrit que les atlas de décor.

Temple Céleste (départ du tutoriel, sous-zone 446) : 3 salles du bundle `mapdata_assets_world_921`, posées à la main (`places` dans `incarnam_interieurs.json`, rangée 15) car leur sol déborde de ~2 cartes vers le haut. Export fait seul, sans réécrire le reste : `world_export.py` sur une liste avec les 3 salles + deux cartes factices en (-3,-6) et (5,15) (même origine et même largeur que le monde), `ONLY=temple_1,temple_2,temple_3 SKY=805542`, puis fusion des entrées `temple_*` et des cases marchables de la rangée 15 dans `monde.json`. Textures extraites une fois dans `/mnt/project-files/cache-dofus/temple-celeste/` (tex/, cartes/). Les 3 salles ont `"ciel": 1` dans la liste : le ciel 805542 sort du sol (le jeu le pose derrière, comme dehors) et le fond n'est pas rempli sous les pierres animées. Pour relancer sans les bundles : un pickle `{gfxId: image}` fait depuis `tex/*.png`, passé en `CACHE`.

Éléments à matériau additif (`ShaderBlendingParameters` avec `destinationFactor` = 1, ex. lueurs des Dofus du Temple) : posés en lumières (mode additif), plus en décor normal (ils sortaient noirs). Éléments de couleur d'alpha 0 : cachés (montrés par une mise en scène du serveur).

Raccords entre cartes : chaque carte a un calque `bord_x_y.webp` avec ce qu'elle dessine au-delà de son cadre. Il est posé en entier là où la voisine est vide (falaises), et en fondu sur 160 px ailleurs (ombres, fonds de ciel). Pour le refaire sans réécrire le reste : `DECOR_ONLY=1 NO_DECOR=1 CALQUES=bord`.

Raccords de la mer et du sable (maquette « Raccords : 1A 2A 3A 4A », 2026-11-08) :
- Calque `bord` : sur le sol d'une voisine, le débord ne se fond (160 px) que là où sa couleur moyenne ressemble à celle de la voisine (`ECART`, 110 par défaut : herbe sur herbe, sable sur sable) ; les ombres translucides (arbres, rochers, îles) continuent partout. Avant, l'eau qu'une carte peint hors de son cadre passait en bande sur le sable de la voisine. Toujours suivi de `bords_fondu.py`. `OMBRES_SEULES=0` : ancien calque.
- Losanges de sable hors du cadre (et sur la dernière case d'un côté sans voisine) : rognés par le contour arrondi de la plage, au lieu de finir en escalier sur la mer (`SABLE_ESCALIER=1` : ancien).
- `mer.py` écrit aussi `rivage` (terre/mer par carrés de 16 px du cadre) : le jeu (`WorldView.poserRivage`) fond l'eau officielle dans la couleur de la mer depuis la vraie côte ; le bord du monde (`WorldView.poserBrume`) est une seule image floutée qui suit le contour des cartes.
- Réexport des sols seuls : `NO_DECOR=1 TEXDIR=… world_export.py <liste du dehors> … <export à part>`, `bords_fondu.py <export à part>`, puis `sols_fusion.py <export à part> public/assets/mondes/<nom>` (ne touche ni au décor ni aux portes), puis `SOLS=… mer.py` sur les cartes du rivage.

Les éléments interactifs qui ont une image fixe (portes, cadres de mine, panneaux) sont posés avec le décor. Les animés (minerais, céréales) manquent encore.

## Donjons (Crypte de Kardorim)

Les salles d'un donjon sont des intérieurs comme les autres (`incarnam_interieurs.json`, `dungeons` dans les données pour leur ordre). Un lien peut porter un 4e champ `{"verrou": 1, "sens": 1}` : on ne passe que de a vers b, et seulement quand la salle a est vidée. Les monstres de chaque salle sont dans `zones.json` (`open.donjons`), d'après les groupes officiels (8 par salle).
`ONLY=1_-4 DECOR_ONLY=1 python world_export.py …` réécrit une seule carte (ex. une image abîmée par un export interrompu). Les gros squelettes à plusieurs atlas (Kardorim) sont gérés par `build_scene.py` (`textureIndex`).

## Lumières des cartes (halos, lueurs, rayons)

Dofus dessine certains éléments de carte en les **ajoutant** à l'image (`ShaderBlendingParameters` du matériau : facteurs de mélange Unity), avec un masque de dissolution animé : halos sur l'eau (305396), lueurs des feux (57871, 305477…), rayons de soleil (42481, 44653…). Posés comme du décor normal, ils faisaient de grandes taches blanches. `world_export.py` les sort du sol (liste `LUMIERES`) et les met dans le décor avec `b` (`a` additif, `s` écran), `k` (intensité) et `z` (image réduite au tiers, le jeu l'agrandit) ; `c = -1` pour ceux du sol. Le jeu les dessine en mode additif, en entier (plus de coupure au raccord), et plus fort la nuit (`src/render/ambiance.ts` : cycle sur l'heure du PC, réglages touche O). Le rectangle blanc 62942 (mode « multiplier », sans effet dans Dofus) est retiré (`VOILES`).

## Sorts de classe et onglet Sorts (maquette Sorts, 2026-11-06)

`python3 tools/extraction/class_spells.py <tables json> <I18n/fr.bin> src/data/sorts.json iop:8 cra:9`
écrit les 22 paires officielles de chaque classe (`spellvariantsdataroot` : sort ⇄ variante), triées par niveau
d'obtention puis dans l'ordre officiel (`breeds.breedSpellsId`), avec les grades de `spelllevelsdataroot`
(niveau requis, PA, portée en cases, relance en tours, lancers par tour, dommages). Le jeu (src/sim/sorts.ts, Player)
traduit : 1 tour = 3 s (relance, lancers par tour), 1 case = 48 px (portée des flèches), dommages × 1,5,
grade selon le niveau du perso. Un sort n'est jouable que s'il a sa fiche dans `classes.json` (champ `dofusId`).
Attention : Colère de Iop est la variante de Fureur (niveau 200), pas de l'Épée du Destin (dont la variante est Tumulte).
Animations des nouveaux sorts : `ANIMS=... perso_planche.py` (Ferveur AnimAttaque814 ; Crâ 902, 907, 917).

## Particules des cartes

Les systèmes de particules Unity de chaque carte (`mapData.particlesParameters` : spores, poussière, braises, brume, étoiles, comètes…)
sont simplifiés par `particules.py` et rejoués par `src/render/particles.ts` (case « Particules » dans les Réglages).
Leurs images sont dans `Content/Map/Textures/Effects/mapeffects_assets_all.bundle` (`textures/effects/particles/<gfxId>.png`).
Une copie des 282 images est dans `/mnt/project-files/cache-dofus/particules.tar.gz`.

    python3 tools/extraction/particules.py liste.json <dossier map_*.json> <bundle ou dossier de .png> public/assets/mondes/incarnam

Gardés : les systèmes qui bouclent (pas ceux déclenchés par le jeu, ni les sous-émetteurs). Repris : durée de vie, vitesse, taille,
couleurs et dégradés, débit et salves, forme (sphère, cône, cercle, bord, boîte, rectangle), vitesse sur la vie, gravité, bruit
(dérive douce), planches d'images, étirement. Pas repris : les traînées (trails).

## Écrans d'accueil et de création (choix 17A à 23A)

- Persos femme en jeu : `ANIMS=<mêmes animations que la planche homme> python perso_planche.py <persos> <donnees> 8 f <sortie>/iop_f 32`
  (même chose avec 9 pour la Crâ) ; tête = première tête de création officielle (`heads`, `availableAtCreation`).
- Gros persos animés sur le socle (`public/assets/accueil/<classe>_<m|f>_<repos|garde|attaque>.webp`) : on réutilise la
  `scene.json` de `perso_planche.py` et on la rend en grand :
  `BOX=-150,-280,150,40 node render.cjs scene.json - big "AnimStatiqueExplo0_1:24:repos,AnimStatiqueCombat0_1:24:garde" 1 1.6`
  (flip = 1 avec les scènes de `perso_planche.py`), puis découpe de chaque image en (135,152)-(387,494).
  L'attaque (`AnimArme0_1:23:attaque`, BOX=-150,-280,330,40) est découpée sur 400 px de large : le perso s'élance vers la droite.
- Version fine (2026-11-06, l'Iop du socle était flou : 342 px de haut affichés sur ~460 px en 1080p) : même rendu à l'échelle
  **3,2** au lieu de 1,6, puis `python accueil_grille.py big.png big.json <sortie>/iop_m 270,304,774,988 270,304,1070,988`
  (boîtes doublées). Les images sont rangées en grille de 8192 px de large au plus (une bande de 23 attaques HD dépasserait
  les 16 383 px du WebP) ; `accueil.ts` lit aussi bien les anciennes bandes que les grilles.
- Couleurs : quelques morceaux gris des têtes sont posés à côté de leur groupe `ColorGray_N` au lieu d'être dedans
  (frange de la Crâ, mèche de l'Iopette). `build_char.py` leur donne la couleur du groupe voisin (sinon ils restaient gris).
- Persos en jeu : `SCALE=0.7` (défaut de `perso_planche.py`) reste net jusqu'à un zoom d'environ 1,2 ; la molette va jusqu'à 1,5,
  donc `SCALE=0.9` pour être net partout (planches environ 1,65 fois plus lourdes).
- Textes des classes (titre, description, rôles et difficulté officiels) : `breeds` + `breedroles` + `fr.bin` → `src/data/classes_dofus.json`.

## Sons et musiques (Dofus 3)
- Banques FMOD dans `Dofus_Data/StreamingAssets/Content/Audio/Banks/Desktop/*.bank` (1,9 Go, 7091 banques). Chaque banque contient un FSB5 en Vorbis.
  `<gfxId>.bank` = son d'un effet de sort, `<boneId>.bank` = sons d'un monstre, `Player_Fight_<Classe>.bank` = son de chaque animation de sort
  (`Avatar_Fight_Iop_AnimAttaque801` = casterAnimation 801), `Incarnam.bank` / `Musiques.bank` (690 Mo) = musiques, `UI.bank` = menu et interface,
  `GlobalAmbient` / `AMB_Loc` = ambiances et décor.
- `python sons.py <dossier des .bank> <dossier fsb5> <racine du dépôt>` écrit `public/assets/son/**.mp3` et `src/data/sons.json`.
  `fsb5` : `pip download fsb5` puis le dossier `fsb5/` du paquet (il faut libvorbis). `bones.json` : dofusId du monstre -> squelette (champ `look`).
- Les cartes ont des sons officiels (`mapData.playlistSet`, `localizedSounds` avec position) mais référencés par GUID d'événement FMOD ;
  `Master.strings.bank` contient les noms (arbre compressé STDT, pas encore décodé). En attendant, les sons du décor viennent des particules
  officielles (Feu, Braises, Cascade, Courant, Vortex du Zaap).

## Polices

Les polices de l'interface de Dofus 3 sont des objets `Font` de `tss_assets_all.bundle` (UnityPy : `m_FontData`) :
Lexend (Regular, Medium, SemiBold, Bold) pour les textes, Rowdies pour les boutons, NotoSans en secours.
Elles sont réduites aux caractères latins et converties en woff2 (`fontTools.subset --flavor=woff2`) dans `public/assets/fonts/`.

## Astrub (0.2a)
- Tout ce qu'il faut est dans `/mnt/project-files/cache-dofus/astrub/` (cartes, textures 1x, squelettes des monstres, effets, banques de sons) : plus besoin du PC.
- Monde : `PARTAGE=1 FILS=3 TEXDIR=<tex png> python3 world_export.py liste.json cartes/ /dev/null public/assets/mondes/astrub`.
  `PARTAGE=1` range le décor de toutes les cartes dans des pages communes `decor_p<N>` (2048 x 2048) : une image utilisée sur 50 cartes
  n'est stockée qu'une fois. Chaque décor a son `p` (page), chaque carte la liste de ses `pages`. `TEXDIR` lit les textures en PNG à la demande (mémoire).
  Vérifier la ligne `textures N / M` : avec `TEXDIR`, une texture absente du dossier est sautée SANS erreur (Boutique et grenier de Kerubim
  étaient sortis sans plancher ni murs, 7 nov. 2026). Les textures se tirent des bundles `textures-1x` de cache-dofus.
  Puis TOUJOURS `python3 decor_par_carte.py public/assets/mondes/astrub` : chaque carte reçoit SES pages (seulement les images qu'elle pose).
  Sans ça, la carte du joueur et ses 8 voisines touchaient ~81 pages communes, soit 1,1 Go (jusqu'à 2,3 Go) de mémoire graphique pour ~84 Mo utiles :
  le navigateur plantait après quelques déplacements. Les nouvelles pages prennent des numéros neufs.
  Si les ateliers sont réexportés : `python3 tools/contenu/ateliers_sorties.py` (aucune machine collée à une sortie, règle de Mathis du 8 nov. 2026).
- Carte du monde (touche M) : `python3 carte_monde.py public/assets/mondes/<monde> [0.1]` écrit `carte.webp` (sols + décor réduits) et `monde.json.carte`.
- Sons : `python3 sons_astrub.py <banques .bank> <dossier fsb5> <racine du dépôt>` ajoute la musique d'Astrub, ses ambiances et les sons des nouveaux monstres à `src/data/sons.json`.
- Donjons d'Astrub (Grange, Château Ensablé, Cour du Bouftou Royal) : salles = `dungeons.mapIds`, exportées à part (`PARTAGE` désactivé, atlas par salle)
  avec deux cartes factices aux coins du monde (même origine, même largeur), puis ajoutées à `monde.json` (cartes, lignes de `mov`, `grid.rows`).
  Entrée = case de la porte officielle dehors (arche 63634 de la Grange, porte 42274 de la Cour) ; de salle en salle : case marchable la plus haute
  vers la plus basse de la suivante, verrouillée tant que la salle n'est pas vidée. Monstres = ceux de la sous-zone du donjon, boss dans la dernière salle.

Planches en AVIF (6 nov. 2026, choix « AVIF : 1A ») : `monster_planche.py` et `perso_planche.py` passent `FORMAT=AVIF` à `trim_pack.py`
(qualité 50, −37 % en moyenne par rapport au WebP). Les cartes, décors, bords et effets restent en WebP.
Les anciennes planches ont été converties par `tools/hebergement/planches_avif.py`. Après un export : `node tools/hebergement/envoi.mjs`.

## Emp et la boutique (0.2b, 6 nov. 2026)

- Icônes d'objets ajoutées aux planches `public/assets/ui/objets-hd.webp` (128 px, fenêtres) et `objets.webp` (64 px, Phaser) :
  `python icones_ajout.py <item_assets_2x.bundle> <iconId>...` (le paquet 2x est copié dans `/mnt/project-files/cache-dofus/astrub/item_assets_2x.bundle` ;
  le 1x, 64 px, donnait des icônes floues dans les fenêtres). Sans iconId, refait les deux planches.
- PNJ dont le look a un skin et des couleurs (`{bone|skin|1=couleur}`) : `SKINS=<skins_assets_skin_N.bundle> COULEURS=1=<couleur>`
  devant `monster_planche.py`. Emp : `PNJ=1 SCALE=1.32 SKINS=.../skins_assets_skin_1981.bundle COULEURS=1=15788464 python monster_planche.py 1979 pnj_emp <bones> <sortie>`.
- Cadenas : icône officielle `icons_assets_1x/lockShadowOutline` dans `public/assets/ui/emp/`.

## Métiers de récolte (0.2b, 6 nov. 2026)

- `tools/contenu/recoltes.py <liste.json> <cartes> <tables> <fr.bin> <monde.json>` écrit `src/data/recoltes.json` : emplacements officiels
  (éléments interactifs animés des cartes) et ressources officielles des sous-zones (subareas.harvestables, skills).
- Les animations des ressources (looks `{650}`, `{660}`…) ne sont ni dans le client ni dans son cache : la ressource d'un gfx est déduite
  (famille par sous-zone, puis rang de fréquence = rang de niveau) et l'affichage pose l'icône officielle de l'objet.
- `tools/contenu/drops_ajout.py <tables> <fr.bin>` ajoute le butin officiel des monstres qui n'en ont pas encore, sans réécrire items.json.
- `tools/contenu/drops_conditions.py <tables>` marque les lignes de butin de quête ou d'événement (`cond`, critères officiels, voir `butin_conditions.py`) et retire celles à 0 %. Les deux scripts d'export le font déjà. Les taux du jeu sont dans `src/data/butin.json`.
- Icônes des métiers : `Content/Picto/UI/job_assets_2x.bundle` (iconId de la table jobs) -> `public/assets/ui/metier_<métier>.png`.

## Perso dessiné en direct (maquette Apparence, 6 nov. 2026 : 1A 2A+2C 3A)

Le perso du joueur n'est plus une planche : le jeu assemble squelette + corps + tête + couleurs dans le navigateur
(`src/render/squelette.ts` pour le dessin, `src/render/persoVivant.ts` pour les pages de textures Phaser, images
dessinées à la première utilisation puis gardées). Rendu identique à `render.html` (vérifié image par image contre les planches).

- `python squelette_export.py <persos> <donnees> <classe> public/assets/sprites/squelette` (8 = Iop, 9 = Crâ) écrit :
  `anims_<classe>.json` (mêmes animations et mêmes images que `perso_planche.py`, communes aux deux sexes),
  `skin_<id>.json/.webp` (corps et toutes les têtes de création, morceaux avec leur zone de couleur `ColorGray_N`),
  `os_<bone>.webp` (morceaux propres au squelette : effets des sorts, armes ; à moitié de taille, `OS_ECHELLE`) et `persos.json`.
  Les tables `breeds heads spells spellscripts` viennent de `data_dump.py`. Compter ~5 min par classe.
- `python tetes_vignettes.py <persos> <donnees> public/assets/sprites/squelette` : vignettes des têtes de l'écran de création.
- `skin_mesh.py` : découpe d'un skin en morceaux, partagée avec `build_char.py`.
- Puis `node tools/hebergement/envoi.mjs` (les .webp partent sur R2, les .json restent dans git).
- Les anciennes planches `iop`, `cra`, `iop_f`, `cra_f` ne servent plus qu'en secours (squelette injoignable).
- `entries` d'un groupe de la DisplayList = nombre de TOUS ses descendants (pas de ses enfants directs) : `skin_mesh.py`
  en tient compte depuis le 6 nov. (avant, le masque ou le bandeau rangé dans les cheveux prenait la couleur des cheveux).
  Vérifier les têtes contre les portraits officiels de création : `cosmetic_assets_2x.bundle` (heads.assetId, copie dans cache-dofus/).

## Objets portés et apparat (maquette Apparence 4A+4B 5A 6B)

Coiffe, cape et bouclier se dessinent sur le perso vivant ; l'apparat passe par-dessus (case Apparence de l'inventaire),
acheté chez Emp en Pépites ; la garde-robe (Lykhen à Incarnam, Emp à Astrub) change tête et couleurs, gratuitement.

- Le client ne garde pas le lien objet -> dessin (le serveur l'envoie). `equipement_correspondances.json` { idObjet: idSkin } :
  coiffes, capes et apparats repris de Kaikina/dofus-virtual-try-on (comparaison icône / dessin), boucliers trouvés
  en comparant les icônes aux 606 skins qui ont un morceau `Bouclier` (8 sur 10 ; Bouclier Invisible et Tonbarien sans dessin sûr).
- `python apparat_export.py <tables> <fr.bin> coiffes.json,capes.json <item_assets_1x.bundle>` : `src/data/apparat.json`
  (types 246 coiffe, 247 cape d'apparat), leurs icônes sur `public/assets/ui/apparat.webp`, leurs paires dans les correspondances.
- Objets ajoutés après coup (0.3, niveaux 26 à 40) : coiffes et capes reprises du catalogue Kaikina (`src/data/coiffes.json`, `capes.json`
  de son dépôt) ; boucliers et armes en comparant l'icône à chaque morceau `Bouclier_1` / `Arme_1` des 5 548 skins (forme + couleurs,
  six meilleurs candidats vérifiés à l'œil sur une planche). Arme sans dessin sûr : dessin type de sa famille (voir plus bas).
  Restent sans dessin : Araknacoiffe, Coiffe et Bouclier Invisibles.
- `python equipement_export.py <Skins> src/data/items.json equipement_correspondances.json public/assets/sprites/squelette <tables>` :
  `skin_<id>.json/.webp` de chaque objet et `equipement.json` { objets, caches }. `PART=i/n` + `TRAVAIL` différent : plusieurs en parallèle.
- Une coiffe se pose dans les emplacements vides de la tête (`Chapeau_1`, `ChapeauB_1`, `Masque_1`... = `trou` + transformation
  dans le skin de tête, écrits par `squelette_export.py`), la cape et le bouclier sur les nœuds du même nom.
  Certaines têtes remplissent elles-mêmes un emplacement (cornes de l'Osamodas dans `Chapeau_5`, chignon du Sacrieur dans
  `Chapeau_1`, quelques Iopettes) : `skin_mesh.py` y écrit quand même le `trou`, et marque leur contenu `d: <emplacement>`,
  caché par `squelette.ts` quand un objet s'y pose. Après une modification, réexporter les têtes avec `FORCE=1`.
- `caches` : parties de la tête qu'une coiffe cache (table `skinslotsrules` : règle par défaut, par classe, par tête).
  Les numéros d'emplacement ne sont pas nommés dans le client : 13 = cheveux, 5 = crâne, 0/1 = oreilles, 11/12 = pattes, déduits des coiffes.
- À venir (0.2b) : coiffe, cape, bouclier, familier et apparat = d'autres skins posés sur les mêmes nœuds ; leurs dessins
  ne sont pas dans le cache (`Characters/Skins` complet à copier depuis le PC de Mathis).

## Armes en main, Lance et gestes de récolte (maquette Armes, 2026-11-06)

- Les animations d'arme (`AnimArme<type>` de `bone_1-combat-armes`) ont un nœud `Arme_1`/`Arme_5` (sauf Bâton 4 et Pelle 8) :
  le dessin de l'arme est un skin posé sur ce nœud, comme une cape. 843 skins ont un morceau `Arme_*`.
- Lien arme -> skin absent du client : 98 armes reliées dans `equipement_correspondances.json` en comparant l'icône aux dessins
  (forme alignée + couleurs, vérifié à l'œil) ; 63 dessins sûrs, les 35 autres prennent le dessin type de leur famille
  (Épée 484, Arc 824, Dague 841, Baguette 954, Bâton 636, Marteau 615, Hache 1000, Pelle 714, Faux 975). Puis `equipement_export.py`.
- `squelette_export.py` lit aussi `bone_1-metier` (gestes de récolte AnimFaucher, AnimHache, AnimPioche, AnimCueillir0, AnimPeche)
  et l'anim de la Lance (`AnimArme271`). Ordre des dossiers d'os à garder (static, movement, combat, combat-armes, metier, classe).
- Flèche de l'arc : découpée dans l'atlas de `combat-armes` -> `public/assets/fx/fleche_arme.webp` (le jeu la fait voler).
- Sons de récolte : `python sons_recolte.py <dossier des .bank> <dossier fsb5> <racine>` (banque `Player_Rp.bank`).
- La Lance (type 271) est dans `items_export.py` ; aucune n'est sous le plafond de niveau actuel (la première est niveau 29).

## Ressources à récolter (dessins)
Les animations des éléments interactifs (blé 660, frêne 650, fer 4918, ortie 3212, pêche 1018…) ne sont pas dans le client de Dofus 3.
Elles viennent du client Stasis (format msgpack, voir l'en-tête de `recoltes_planches.py`) ; les 639 éléments animés sont gardés
dans `/mnt/project-files/cache-dofus/elements-animes/` (LISEZMOI là-bas).
1. `python tools/contenu/recoltes.py <liste.json> <cartes> <tables> <fr.bin> <monde.json> <monde>` : emplacements + gfx + décalage + miroir.
   Puis UNE fois `python tools/contenu/recoltes_cases.py <monde> <cartes>` : chaque ressource prend la case la plus proche de son dessin officiel
   (parfois sur la carte voisine) et les copies que les voisines recopient sont retirées (sinon du blé flottait sur le vide, en double).
2. `python tools/extraction/recoltes_planches.py <dossier b> public/assets/sprites/recoltes <gfx,…>` : une planche AVIF par gfx.
3. `node tools/hebergement/envoi.mjs`.

## Familiers (familiers_export.py)

- Un familier (objets type 18) ou un familier d'apparat (type 249) se dessine avec le squelette `bones_assets_bone_<appearanceId>.bundle`
  (pas un skin : les skins de même numéro sont des armes). Copie des squelettes : `cache-dofus/familiers/bones.tgz` et `apparats.tgz`.
- Beaucoup de squelettes de familiers manquent au PC ou n'ont aucune animation (Chacha, Bwaks, Bouloute, Tofoudre…) : le jeu les
  télécharge sans doute à la demande. Seuls ceux qui ont `AnimStatique_1` sont gardés (39 familiers, 110 apparats au 2026-11-06).
- `python familiers_export.py <tables> <fr.bin> <dossier des bones>` écrit `src/data/familiers.json` (bonus evolutiveeffects,
  courbe d'XP evolutiveitemtypes) puis les planches `sprites/fam_<squelette>` (repos + course ou marche, `ANIMS=` de monster_planche.py).
  Puis `icones_ajout.py` pour les icônes et `node tools/hebergement/envoi.mjs`.
- Sources (maquette 1A, 1C) : dictionnaires `SOURCES` (familier -> monstres de sa famille) et `SUCCES` dans le script.

## Cité d'Astrub, Vilinsekts, Cache de Kankreblath (0.2b, 6 nov. 2026)

- Intérieurs utiles (maquette 0.2 : Banque, Taverne, Milice, Tour du Conseil, ateliers) : un intérieur a les mêmes [x, y] que la carte du dehors
  (`mapsinformation`, `worldMap` -1). La porte du dehors = l'élément interactif du bâtiment dans `boundingBoxes` (`m_interactionId`),
  sinon une porte `62977/62986-62989/62995` des `interactiveElements` repérée à l'œil. Salles exportées comme les donjons (atlas par salle,
  deux cartes factices), rangées y = -2, 0, 2 du monde ; portes, ateliers (`open.ateliers`), donjon et sous-zones dans `src/data/zones.json`.
- Cache de Kankreblath : salles = `dungeons[88].mapIds` (entrée 146676736), clé 15991. Entrée officielle : porte 39697 case 290 de [3,-17] → Boutique de Kerubim (103547392) → Grenier de Kerubim (103549440, l'engin 47284 relie les deux) → trou du plancher (case 316) gardé par le Cloportier.
  Planque des Vilinsekts (sous-zone 843) : trois caves de la Cité ([6,-21], [4,-19], [1,-16]), monstres qui réapparaissent (Antennes pour la clé).
- Kankreblath : `SCALE=1.6 monster_planche.py 3053 kankreblath … 0,2` (son AnimAttaque1 envoie un projectile très loin : planche trop grande).
- Recettes : `tools/contenu/recettes.py <tables> <fr.bin>` ajoute les recettes officielles des métiers de récolte (consommables, jusqu'au niveau 60).

## Arènes des donjons (`arenes.py`, maquette « Donjons en vagues », 7 nov. 2026)

Chaque donjon est une seule grande salle **créée** avec les vraies pièces de Dofus 3 (choix de Mathis « Donjons : 1B 2D … 16A »).
`arenes.py` compose les 5 arènes (Grange = la cour ronde choisie, Crypte, Château, Cour, Cache) avec les sols, clôtures,
murs et objets des salles officielles de chaque donjon (pièces = groupes d'images qui se recouvrent, repérés par leur cadre),
puis les range sous les intérieurs de leur monde : une carte de 3 x 3 places (`"n": [3, 3]`), sol + atlas de décor,
cases marchables (l'ellipse et les couloirs des trois entrées), et écrit les points de l'arène dans `zones.json`
(`open.donjons[].arene` : arrivée, entrées, estrade du boss, portail, coffre ; cases de la grande grille).

    TEXDIR=dossier_des_gfx python3 tools/extraction/arenes.py cartes_dir textures_dir public/assets/mondes [apercus]
    node tools/hebergement/envoi.mjs

`TEXDIR` = les textures des cartes sorties une par fichier (`<gfx>.png`, comme pour `world_export.py`) ; `cartes_dir` = les
`map_<id>.json` des salles officielles (bundles `mapdata_assets_world_583/726/739/463/559`). `SEUL=arene_grange,…` pour n'en
refaire qu'une ; `apercus` donne une image de chaque arène avec les cases marchables en vert. Les vagues (`vagues`,
`bossVague` dans `zones.json`) se règlent à la main : groupes officiels des anciennes salles, `?` = tiré parmi les monstres du donjon.

## Donjons en couloirs (`couloirs.py`, maquette « Couloirs : 1C 2B 3A 4A », 9 nov. 2026)

Les vraies salles d'un donjon, reliées par des couloirs façon Diablo, puis la cour en vagues du boss (l'arène d'`arenes.py`)
au bout du dernier couloir, sans porte ni écran noir. L'outil range salles et arène dans une bande neuve sous le monde
(salle | couloir | salle | … | arène), en les déplaçant (sol, décor, cases, points de l'arène : leurs images ne changent pas).
Chaque couloir est une carte `couloir_<salle>` (`dessus: 1`) : un sol en V aligné sur les cases, peint avec le vrai sol de la
salle d'avant. Ses cases ne sont PAS dans `mov` : elles vont dans `zones.json` (`open.donjons[].couloirs.cases`) et le jeu ne
les ouvre qu'en partie de test (la partie publique garde l'arène seule, comme avant).

    node tools/hebergement/envoi.mjs --recuperer     # les sols des salles
    python3 -I tools/extraction/couloirs.py astrub "Grange du Tournesol Affamé"
    node tools/hebergement/envoi.mjs

Un nouveau donjon = une ligne dans `DONJONS` (salles dans l'ordre du trajet, sans la salle du boss ; monstres errants par
couloir). Pour refaire un donjon : repartir de `monde.json` et `zones.json` d'avant (git checkout), puis relancer.

## Bastion des Douze (`bastion.py`, maquette « Ville », 7 nov. 2026)

Notre ville (« Ville : 1A 2A 3C 4B+4C … 10B 11B ») : un monde à part (`public/assets/mondes/bastion`), une seule grande carte
de 4 x 4 places (`"n": [4, 4]`, cases de la grande grille). Archipel : l'île centrale (place du Zaap, maisons d'Astrub, Bonta,
Brâkmar et Pandala, étals, cyprès) et une île par nation (Bonta, Brâkmar, Pandala, Frigost) reliée par un pont coupé, pour les
nations libérées plus tard. Les pièces viennent des vraies cartes (aides d'`arenes.py`), lumières additives et voiles retirés.
Écrit aussi `zones.json > bastion > open.bastion` (arrivée, Zaap, cases des PNJ), que `tools/contenu/quetes.py` relit.

    TEXDIR=dossier_des_gfx python3 -I tools/extraction/bastion.py cartes_dir public/assets/mondes [apercu]
    python3 tools/contenu/quetes.py && node tools/hebergement/envoi.mjs

`cartes_dir` = les `map_<id>.json` des cartes sources : Astrub 191105026 (Zaap) et 191104002 (`cache-dofus/astrub/cartes.tar`),
Bonta 212600837, Brâkmar 212861954, Pandala 206307844, Frigost 54170409 (bundles copiés dans `cache-dofus/villes/`, voir son LISEZMOI).
Le ciel (`ciel.webp`) est celui d'Incarnam.

Les quatre îles des nations sont rendues en grand (`ile_brakmar`, `ile_grande` + `GRANDES` pour Bonta, Pandala, Frigost ; posées aux 3/4,
Bastion de 8 x 8 places) avec les particules et les lumières officielles de leurs pièces. Cartes sources : `map_dump.py` sur les bundles
de `cache-dofus/villes/` (811 Bonta, 812 Brâkmar, 787 Pandala, 206 Frigost) et `cache-dofus/astrub/cartes.tar` (729). Particules :

    python3 -I tools/extraction/bastion.py --liste > liste.json          # les 17 cartes sources des îles
    python3 -I tools/extraction/particules.py liste.json cartes_dir <particles/ de cache-dofus/particules.tar.gz> sortie
    PARTICULES=sortie TEXDIR=… python3 -I tools/extraction/bastion.py cartes_dir public/assets/mondes

Ensuite, `python3 -I tools/extraction/zaap_bastion.py <particules.webp d'Astrub> public/assets/mondes/bastion/particules.webp 4196 2864`
remet le tourbillon officiel du Zaap d'Astrub sur l'arche du Bastion (bastion.py réécrit les particules ; 4196 2864 = milieu de l'arche
avec NS = 8), puis `python3 tools/contenu/quetes.py` et `node tools/hebergement/envoi.mjs`.
Exemples d'îles hors jeu (planches de pièces, essais de plan) : `/mnt/project-files/ville/ex_ile.py`, `conf_<nation>.py`, `pieces.py`.

Ville vivante (maquette Ville 5F, 8 nov. 2026) :
- Habitants qui flânent (`src/data/passants.json`, `src/sim/passants.ts`) : PNJ officiels à look de personnage (table npcs, `{1|corps,tête,skins|couleurs}`),
  planche repos + marche : `BREEDS=breeds.json python3 habitant_planche.py <persos> '<look>' public/assets/sprites/hab_<id>` (skins d'objets
  et `bone_1-movement` pris sur le PC dans `Characters/`). Gardes et crieur = PNJ de `quetes.py` : `PNJ=1 SCALE=1,32 x échelle du look monster_planche.py`
  (6407 Bonta, 6384 Brâkmar, 5795 + `COULEURS` Pandala, 1282 Frigost, 1845 Amakna, 3460 Héraut d'Ecaflip), places dans `bastion.py` (`PNJ_PLACE`, `GARDES`).
- Musique : `python3 sons_bastion.py <Musiques.bank> <fsb5> .` (havres de guilde officiels : base + une couche par nation ; `zones.json > bastion > iles`).

## Zaaps (`zaaps.py`, maquette « Zaap : », 8 nov. 2026)

`python3 -I tools/extraction/zaaps.py <zone>` écrit les Zaaps officiels d'une zone (repères « Zaap » de monde.json, arche = particule
« Vortex » de particules.json) dans `zones.json`. À lancer pour chaque nouvelle zone exportée (Amakna…).

## Osamodas (maquette Osamodas, 8 nov. 2026)

- Données des bêtes : `python osa_betes.py <tables> <fr.bin> src/data/betes.json` (monstres 8070-8083, sorts au grade 1 ; `_regles` gardé).
- Squelettes des 14 bêtes : `/mnt/project-files/cache-dofus/osamodas-bones/`. Planches : `monster_planche.py <os> osa_<bête> <dossier> public/assets/sprites 0,1,2`
  (SCALE=1.6 pour Craquolosse et Sulfénix ; `SCALE=1.25 BOX=-220,-420,220,120` pour Dragonnet, Scarafoudre et Gobgobs, sinon la boîte
  automatique dépasse la taille d'un canevas). Le Dragonnet n'a ni repos ni course : `ANIMS=AnimAttaque0_1:1:AnimStatique_1,...`.
- Perso : `squelette_export.py` (classe 2) ; portraits `ui/perso_osamodas(_f).png` rendus depuis la scène de `perso_planche.py`
  (`ANIMS=AnimStatiqueExplo0`, `render.cjs` BOX=-150,-280,150,40 à l'échelle 3,2, rognés à 437 px de haut).

## Égouts et Souterrains d'Astrub (clôture de la 0.2, 8 nov. 2026)

- Sous-zones 100 (Égouts, 13 cartes, worldMap 3) et 99 (Souterrains, 9 cartes de mine) : bundles `world_388` et `world_719` de `cache-dofus/astrub/cartes.tar`.
  Le lien entre les salles n'est pas dans le client : elles sont reliées en chaîne (porte du bas = case marchable la plus basse, porte du haut = la plus haute),
  dans l'ordre des coordonnées souterraines. Égouts : plaque d'égout officielle (gfx 63587, case 198 de [5,-17], repère « Entrée des égouts ») → `egout_1` … `egout_13` →
  entrée de mine de [7,-9] (gfx 34686, second repère « Entrée des égouts »). Souterrains : porte case 269 de [1,-17] → `souterrain_1` … `souterrain_9` (cul-de-sac).
- Salles rangées sous les intérieurs (rangées y = 8 et 10, plus (8..12, 2) et (12, 4)) : la grille d'Astrub passe de 1640 à 1840 lignes.
  Export à part : `world_export.py` sur une liste des 22 salles + deux cartes factices en (-4,-34) et (13,11) (même origine, même largeur), `ONLY=<les 22 tags>`,
  puis `COURANTE=1 batiments.py` sur ce dossier (sans les factices), puis fusion dans `monde.json` (entrées des salles + cases marchables de leurs régions, lignes ajoutées).

## Pouvoirs légendaires officiels (version 0.3)

- `python3 tools/extraction/pouvoirs.py tools/extraction/panos_classe.json src/data/sorts.json src/data/pouvoirs.json` : les 40 effets de sort
  officiels de la panoplie de chaque classe jouable (Téméraire, Prince des voleurs, Innombrable), 5 par emplacement (choix 2B : les 3 derniers
  de chaque pièce vont à l'amulette, l'arme et le bouclier). La traduction en temps réel est dans `src/sim/pouvoirs.ts`.
- `class_spells.py` écrit aussi les drapeaux officiels de chaque sort (spelllevels `m_flags` du premier grade) : `ligne` (bit 0, lancer en ligne),
  `ldv` (bit 2, ligne de vue), `pom` (bit 6, portée modifiable). Bits retrouvés en croisant les pouvoirs « Portée modifiable », « ligne de vue
  désactivée » et « lancer en ligne désactivé » des panoplies (tous les sorts visés ont le bit attendu).
- Équipements du niveau 26 au 40 (0.3, choix 2A) : `items_export.py … 40` dans un dossier à part, puis `python tools/contenu/equipement_ajout.py <ce items.json>`
  (n'ajoute que les équipements et panoplies, sans toucher aux recettes, au butin et aux runes) et `icones_ajout.py` avec les icônes affichées.
  Le jeu ne les tire et ne les affiche qu'en 0.3 (`NIVEAU_OBJETS_02` dans `src/sim/pouvoirs.ts`). Leurs dessins portés (coiffes, capes,
  boucliers) restent à exporter (`equipement_export.py`, correspondances à compléter).

## Métiers de fabrication (version 0.3, choix 9A 10A+10B)
- `python tools/contenu/recettes_equipement.py <tables> <fr.bin>` (MAX=40 par défaut) : ajoute à `items.json` les 6 métiers de fabrication
  (Bijoutier 16, Cordonnier 15, Tailleur 27, Forgeron 11, Sculpteur 13, Façonneur 60) et leurs recettes officielles d'équipement dont tous
  les ingrédients existent dans le jeu, plus les produits intermédiaires des métiers de récolte qu'elles demandent (Substrats, Eau
  Ferrugineuse). Puis `icones_ajout.py` avec les icônes qu'il liste.
- Icônes des 6 métiers : mêmes images que `job_assets_2x.bundle`, prises sur `api.dofusdb.fr/img/jobs/<iconId>.png` (vérifié : l'icône du
  Paysan est identique à la nôtre).
- En jeu (`src/sim/metiers.ts`) : un objet fabriqué sort Commun ou Rare (10 % au niveau 1 du métier, 50 % au niveau 200) ; un ingrédient
  rare (ressource que seuls des boss ou des élites lâchent, hors objets d'événement à 100 %) garantit Rare. Caché hors partie de test
  tant que `V03_PUBLIC` est faux. Les ateliers de la Cité pour ces métiers restent à exporter.

## Archimonstres d'Astrub (version 0.3, choix 15B)
- `python tools/contenu/archimonstres.py <tables> <fr.bin>` : un `archi_<monstre>` par monstre qui a un archimonstre officiel
  (monsters.correspondingMiniBossId) : stats du grade 1 (PV × 2,5), sorts du monstre (les mêmes dans les données), XP au rapport des
  gradeXp, sons du monstre. Puis `drops_ajout.py` pour leur butin officiel.
- Dessin : dans Dofus, l'archimonstre a le gfxId de son monstre (vérifié pour les 32 d'Astrub et des Champs) ; `render/looks.ts` reprend
  la planche du monstre à l'échelle officielle de l'archimonstre (`archiEchelle`), ×1,15 et dorée. Pas de planche à exporter.
- Pierres d'âme officielles : Petite pierre d'âme (9686, vendue par Otomaï en 0.3) et Pierre d'âme d'Archimonstre (10418, la pierre pleine).

## Almanax (version 0.3, choix 15C)
- `python tools/contenu/almanax.py [almanax_brut.json]` : calendrier officiel (`almanax-calendars`) et offrande de chaque jour
  (`quest-objectives`, « Ramener à … ») lus sur api.dofusdb.fr, écrits dans `src/data/almanax.json` (366 jours). Le bonus officiel est
  traduit en effet temps réel (XP, Prospection, récolte, gibier, XP de métier, chance de Rare) ; sans équivalent : Pépites doublées.
- Offrande : l'objet officiel s'il s'obtient dans le jeu (butin, récolte, fabrication), sinon une ressource du jeu de niveau proche,
  toujours la même pour la date (`officielle: false`). On la fait auprès du Représentant des Temples (Astrub [4,-18]) ; le bonus dure
  jusqu'à minuit (heure du PC). Réglages dans `src/sim/almanax.ts`.

## Dofus (version 0.3, ligne « Dofus 0.3 : 1A 2B 3A 4C 5A+5B », « Onglet Dofus : 1B 2A 3A 4A 5A 6B 7A+7C »)

- `python3 tools/contenu/dofus.py /mnt/project-files/dofus-passifs <tables dofusdb>` écrit `src/data/dofus.json` : les 31 Dofus officiels
  (stats au jet maximum, passif traduit de la maquette des passifs, source). `jeu: true` = passif codé (`src/sim/dofus.ts`, PASSIFS) :
  Argenté et Cacao en 0.3, les autres avec leur zone.
- Icônes : `python3 tools/extraction/icones_ajout.py /mnt/project-files/cache-dofus/astrub/item_assets_2x.bundle <iconIds>`.
- Quêtes « œuf à reconstituer » dans `tools/contenu/quetes.py` (Gawdien du Dofus au Bastion, place dans `bastion.py` PNJ_PLACE).
  Un nouveau Dofus = une quête avec `'recompense': {'dofus': '<id>'}` ; la fenêtre D lit cette clé pour montrer les fragments.
- Planches des PNJ (bones pris sur le PC) : `PNJ=1 SCALE=1.32 ANIMS=AnimStatique_1 monster_planche.py 321 pnj_gawdien …`,
  `ANIMS=AnimStatique_1,AnimAttaque1_1,AnimAttaque2_1,AnimAttaque3_1 … 4930 pnj_rathrosk` (animFunList officielle),
  `PNJ=1 SCALE=1.58 … 3401 pnj_energie_cacao` (look {3401|||120}). Puis `node tools/hebergement/envoi.mjs`.
- Trophées (266, type 151, Façonneur) et prysmaradites (25, type 217) : mêmes 6 cases, sous-onglets grisés jusqu'à Amakna.

## Ateliers de fabrication de la Cité (version 0.3)

- Intérieurs officiels (bundle `world_736` de `cache-dofus/astrub/cartes.tar`) : bijoutiers 192937990 ([6,-15]), cordonniers 192939016 ([4,-16]),
  tailleurs 192940032 ([7,-15]), façonneurs 192940040 ([4,-15]), rangés en (-4..2, 12) : la grille d'Astrub passe de 1840 à 1920 lignes.
  Export comme les Égouts : `world_export.py` sur les 4 salles + deux cartes factices en (-4,-34) et (13,13), `ONLY=<les 4 tags>`, puis
  `COURANTE=1 batiments.py`, puis fusion dans `monde.json` (entrées des salles + lignes de `mov` ajoutées).
- Porte du dehors = `boundingBoxes` (`m_interactionId`) ; arrivée = case marchable la plus basse de la salle. Portes notées `v03` (fermées hors
  partie de test). Forgerons et sculpteurs : salles des mineurs et des bûcherons (mêmes machines, un poste réunit les métiers).
- Postes : `ateliers_postes.py` (machines 49498/49500/49501, 402707, 49499, 49503 ajoutées).

## Sacrieur (classe 11, maquette du 8 nov. 2026)

- Les spellscripts du Sacrieur donnent l'animation en `animId:11xx` (pas `casterAnimation`) : `perso_planche.py` et `squelette_export.py` lisent les deux.
- `python squelette_export.py <persos> <donnees> 11 public/assets/sprites/squelette`, puis `python tetes_vignettes.py <persos> <donnees> public/assets/sprites/squelette 11`.
- Épées alliées : `osa_betes.py` (monstres 434 Épée Vorace, os 8378 ; 5192 Épée Dansante, os 8376) -> atlas `sacri_epee_*`.
  Planches : `SKIP_MASKS=1 python3 monster_planche.py 8378 sacri_epee_vorace <Bones>` (et 8376 sacri_epee_dansante) ; sans `SKIP_MASKS=1`,
  les masques (grande goutte bleue, pentagone cyan) et le sang à masquer (dégradés blancs) sont dessinés : épée toute blanche en jeu.
- Animations 1107 (Pacte de Sang), 1108 (Carnage), 1115 (Châtiment) absentes du squelette 1-11.
- Sorts : `class_spells.py ... sacrieur:11` -> src/data/sorts.json ; icônes `sort_<id>.png`, gouttes de Souffrance `ui/souffrance/s1..10.png` (st_stateSacriNice*).

## Forgelance (classe 20, maquette du 8 nov. 2026)

- `python squelette_export.py <persos> <donnees> 20 public/assets/sprites/squelette`, puis `python tetes_vignettes.py <persos> <donnees> public/assets/sprites/squelette 20`
  (supprimer ensuite `public/assets/sprites/.vignettes-travail/`, sinon `envoi.mjs` l'envoie).
- Sorts : `class_spells.py ... forgelance:20` -> src/data/sorts.json ; icônes `sort_<id>.png` prises dans `Content/Picto/Spells/spell_assets_1x.bundle` du PC.
- Lance plantée = monstre 7139 « Lance Immortelle », os 7139. Ses animations sont rangées dans le squelette (`animations[].dataBytes`), pas en TextAsset :
  `b_dump.py` les écrit en `ta_x_<nom>.bin`. Planche : `ANIMS=AnimStatique_1:1,AnimAttaque0_1 FORMAT=AVIF python3 monster_planche.py 7139 forgelance_lance <Bones>`.
- Lance en main : introuvable (le squelette 1-20 a les nœuds Lance_1/Lance_5, aucun skin du cache n'a de pièce Lance_ ; le 2061 n'est pas la lance).

## Eniripsa (classe 7, maquette du 9 nov. 2026)

- `python squelette_export.py <persos> <donnees> 7 public/assets/sprites/squelette`, puis, UNE FOIS LE PREMIER FINI, `python tetes_vignettes.py <persos> <donnees> public/assets/sprites/squelette 7`
  (supprimer ensuite `public/assets/sprites/.vignettes-travail/` et `.squelette-travail/`, jamais pendant que le script tourne).
- Sorts : `class_spells.py ... eniripsa:7` -> src/data/sorts.json ; icônes `sort_<id>.png` (spell_assets_1x.bundle). Animations : AnimAttaque700 à 709 (voir ENI_MAP de looks.ts).
- Bêtes (os dans le cache : `cache-dofus/eniripsa-bones/`) : Lapino 7370 (os 7599), Fées 7372-7374 (os 7600), Feu Follet Accablant 7378 (os 7601).
  `SCALE=2.5 BOX=-80,-130,80,30 FORMAT=AVIF python3 monster_planche.py 7599 eni_lapino <Bones>` (sans BOX, l'effet d'attaque élargit trop la boîte) ;
  `FORMAT=AVIF python3 monster_planche.py 7600 eni_fee` et `7601 eni_feu_follet`. Entrées de betes.json ajoutées à la main (osa_betes.py réécrirait les bêtes de l'Osamodas).

## Enutrof (classe 3, maquette du 10 nov. 2026)

- `python squelette_export.py <persos> <donnees> 3 public/assets/sprites/squelette`, puis, une fois le premier fini, `python tetes_vignettes.py <persos> <donnees> public/assets/sprites/squelette 3`.
- Sorts : `class_spells.py ... enutrof:3` -> src/data/sorts.json ; icônes `sort_<id>.png`. Animations : AnimAttaque300 à 312 (voir ENU_MAP de looks.ts).
- Bêtes (os dans le cache : `cache-dofus/enutrof-bones/`) : Sac Animé 5830 (os 4147), Pelle Animée 5834 (os 4156), coffre au trésor 5840 (Coffre Animé, os 4166).
  `SCALE=2.5 FORMAT=AVIF python3 monster_planche.py 4147 enu_sac <Bones>`, puis `4156 enu_pelle` et `4166 enu_coffre`.
  Entrées de betes.json ajoutées à la main (comme l'Eniripsa) ; le coffre est passif, sans sort, réglages dans classes.json > enutrof.coffre.
