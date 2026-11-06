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
  Puis TOUJOURS `python3 decor_par_carte.py public/assets/mondes/astrub` : chaque carte reçoit SES pages (seulement les images qu'elle pose).
  Sans ça, la carte du joueur et ses 8 voisines touchaient ~81 pages communes, soit 1,1 Go (jusqu'à 2,3 Go) de mémoire graphique pour ~84 Mo utiles :
  le navigateur plantait après quelques déplacements. Les nouvelles pages prennent des numéros neufs.
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

- Icônes d'objets ajoutées à la planche `public/assets/ui/objets.webp` : `python icones_ajout.py <item_assets_1x.bundle> <iconId>...`
  (le bundle est copié dans `/mnt/project-files/cache-dofus/astrub/item_assets_1x.bundle`).
- PNJ dont le look a un skin et des couleurs (`{bone|skin|1=couleur}`) : `SKINS=<skins_assets_skin_N.bundle> COULEURS=1=<couleur>`
  devant `monster_planche.py`. Emp : `PNJ=1 SCALE=1.32 SKINS=.../skins_assets_skin_1981.bundle COULEURS=1=15788464 python monster_planche.py 1979 pnj_emp <bones> <sortie>`.
- Cadenas : icône officielle `icons_assets_1x/lockShadowOutline` dans `public/assets/ui/emp/`.

## Métiers de récolte (0.2b, 6 nov. 2026)

- `tools/contenu/recoltes.py <liste.json> <cartes> <tables> <fr.bin> <monde.json>` écrit `src/data/recoltes.json` : emplacements officiels
  (éléments interactifs animés des cartes) et ressources officielles des sous-zones (subareas.harvestables, skills).
- Les animations des ressources (looks `{650}`, `{660}`…) ne sont ni dans le client ni dans son cache : la ressource d'un gfx est déduite
  (famille par sous-zone, puis rang de fréquence = rang de niveau) et l'affichage pose l'icône officielle de l'objet.
- `tools/contenu/drops_ajout.py <tables> <fr.bin>` ajoute le butin officiel des monstres qui n'en ont pas encore, sans réécrire items.json.
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
- `python equipement_export.py <Skins> src/data/items.json equipement_correspondances.json public/assets/sprites/squelette <tables>` :
  `skin_<id>.json/.webp` de chaque objet et `equipement.json` { objets, caches }. `PART=i/n` + `TRAVAIL` différent : plusieurs en parallèle.
- Une coiffe se pose dans les emplacements vides de la tête (`Chapeau_1`, `ChapeauB_1`, `Masque_1`... = `trou` + transformation
  dans le skin de tête, écrits par `squelette_export.py`), la cape et le bouclier sur les nœuds du même nom.
- `caches` : parties de la tête qu'une coiffe cache (table `skinslotsrules` : règle par défaut, par classe, par tête).
  Les numéros d'emplacement ne sont pas nommés dans le client : 13 = cheveux, 5 = crâne, 0/1 = oreilles, 11/12 = pattes, déduits des coiffes.
- À venir (0.2b) : coiffe, cape, bouclier, familier et apparat = d'autres skins posés sur les mêmes nœuds ; leurs dessins
  ne sont pas dans le cache (`Characters/Skins` complet à copier depuis le PC de Mathis).

## Ressources à récolter (dessins)
Les animations des éléments interactifs (blé 660, frêne 650, fer 4918, ortie 3212, pêche 1018…) ne sont pas dans le client de Dofus 3.
Elles viennent du client Stasis (format msgpack, voir l'en-tête de `recoltes_planches.py`) ; les 639 éléments animés sont gardés
dans `/mnt/project-files/cache-dofus/elements-animes/` (LISEZMOI là-bas).
1. `python tools/contenu/recoltes.py <liste.json> <cartes> <tables> <fr.bin> <monde.json> <monde>` : emplacements + gfx + décalage + miroir.
2. `python tools/extraction/recoltes_planches.py <dossier b> public/assets/sprites/recoltes <gfx,…>` : une planche AVIF par gfx.
3. `node tools/hebergement/envoi.mjs`.

## Cité d'Astrub, Vilinsekts, Cache de Kankreblath (0.2b, 6 nov. 2026)

- Intérieurs utiles (maquette 0.2 : Banque, Taverne, Milice, Tour du Conseil, ateliers) : un intérieur a les mêmes [x, y] que la carte du dehors
  (`mapsinformation`, `worldMap` -1). La porte du dehors = l'élément interactif du bâtiment dans `boundingBoxes` (`m_interactionId`),
  sinon une porte `62977/62986-62989/62995` des `interactiveElements` repérée à l'œil. Salles exportées comme les donjons (atlas par salle,
  deux cartes factices), rangées y = -2, 0, 2 du monde ; portes, ateliers (`open.ateliers`), donjon et sous-zones dans `src/data/zones.json`.
- Cache de Kankreblath : salles = `dungeons[88].mapIds` (entrée 146676736), porte 39697 case 290 de [3,-17], clé 15991.
  Planque des Vilinsekts (sous-zone 843) : trois caves de la Cité ([6,-21], [4,-19], [1,-16]), monstres qui réapparaissent (Antennes pour la clé).
- Kankreblath : `SCALE=1.6 monster_planche.py 3053 kankreblath … 0,2` (son AnimAttaque1 envoie un projectile très loin : planche trop grande).
- Recettes : `tools/contenu/recettes.py <tables> <fr.bin>` ajoute les recettes officielles des métiers de récolte (consommables, jusqu'au niveau 60).
