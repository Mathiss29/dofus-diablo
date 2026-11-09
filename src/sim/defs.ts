/** Types des données de jeu (src/data/*.json). La simulation ne lit que ça. */
import type { Stat } from './items';

export interface ComboHit {
  duration: number; impactAt: number; cancelAt: number;
  dmg: number; range: number; arc: number; knock: number; step: number; hitstop: number; shake: number;
}
/** Élément d'un sort (Dofus) : terre = Force, feu = Intelligence, eau = Chance, air = Agilité ;
 *  « meilleur » = l'élément où le lanceur est le plus fort. */
export type Element = 'neutre' | 'terre' | 'feu' | 'eau' | 'air' | 'meilleur';

/** Zone touchée par un sort, en coordonnées monde. */
export type HitZone =
  | { shape: 'cone'; range: number; arc: number }
  | { shape: 'line'; length: number; width: number }
  /** Cercle autour du lanceur (ou du point d'arrivée d'un déplacement). */
  | { shape: 'circle'; radius: number }
  /** Sort ciblé (zone officielle autour de la case visée, à portée du grade) : frappe autour du point visé, ramené à la portée. */
  | { shape: 'point'; range: number; radius: number }
  /** Flèche (Crâ) : part vers le point visé, touche le premier ennemi (ou tous avec pierce), explose en zone si explode. */
  | { shape: 'projectile'; speed: number; range: number; width: number; explode?: number; pierce?: boolean;
      /** Auto-attaque à l'Arc : la flèche officielle de l'animation vole jusqu'à la cible (maquette Armes 4B). */
      fleche?: boolean };

/** Un sort officiel de la classe, adapté au temps réel. Tous les temps sont en secondes. */
export interface SpellDef {
  /** Auto-attaque : attaques par seconde au plus (accélérées par la stat Vitesse d'attaque). */
  aps?: number;
  name: string;
  /** iconId de spellsdataroot (assets/ui/sorts/sort_{icon}.png). */
  icon: number;
  element: Element;
  /** Coût en PA (sorts) ou en PM (déplacement). */
  pa?: number; pm?: number;
  cooldown: number;
  /** Applique la relance officielle du grade même à un sort de déplacement (Pas Chassé). */
  relanceOfficielle?: boolean;
  /** Gros coup (maquette Recharges 5A) : une vraie recharge à la place des lancers par tour, et des dommages multipliés. */
  grosCoup?: { recharge: number; mult: number };
  duration: number; impactAt: number; cancelAt?: number;
  dmg: number; knock: number; stun?: number;
  hit: HitZone;
  hitstop: number; shake: number;
  /** Déplacement vers le point visé : saut (Bond, on survole tout, invulnérable) ou ruée (Déferlement, s'arrête au premier ennemi). */
  move?: { kind: 'leap' | 'dash'; maxRange: number; height?: number };
  /** Animation en deux temps : {id}_charge avant l'impact, {id}_hit après (Colère de Iop). */
  charge?: boolean;
  /** Dommages augmentés à chaque lancer (Fureur) : +per par lancer, jusqu'à max fois, remis à zéro après time sans le lancer. */
  stack?: { per: number; max: number; time: number };
  /** Part des dommages rendue en PV au lanceur (vol de vie). */
  lifesteal?: number;
  /** Effets officiels : Érosion (part des dommages retirée aux PV max, Pression), retrait de PM (ralentit) et de PA (retarde ses attaques). */
  erosion?: number; pmLoss?: number; paLoss?: number;
  /** Retrait de Portée (Flèche Détonante) : cases ôtées aux sorts à distance de la cible pendant un tour (3 s), par grade. */
  poLoss?: number[];
  /** Choix 2B : l'effet qui caractérise le sort, poussé de +50 % (rage.signature) quand la Rage est pleine. */
  rage?: 'knock' | 'length' | 'radius' | 'explode' | 'dash' | 'stack' | 'lifesteal' | 'erosion' | 'pm' | 'pa'
    | 'buff' | 'shield' | 'selfKnock' | 'summon';
  /** Ligne Rage (4A, 12A) : jauge pleine, la cible qui heurte un obstacle ou un monstre prend les dommages de poussée officiels. */
  pushDmg?: boolean;
  /** Effet visuel (FX) : arc, line, burst, land. */
  fx: 'arc' | 'line' | 'burst' | 'land';
  /** Description officielle (spellsdataroot.descriptionId), pour l'infobulle. */
  desc?: string;
  /** Animation du lanceur, si ce n'est pas l'identifiant du sort (auto-attaque à l'arme : arme6...). */
  anim?: string;
  /** Icône d'objet (planche des objets) au lieu d'une icône de sort. */
  itemIcon?: number;
  /** Id du sort dans Dofus (spellsdataroot) : son niveau, ses grades, son coût et sa relance officiels (src/data/sorts.json). */
  dofusId?: number;
  /** Sort sur soi : ne touche aucun ennemi (Tirs Éloignés). */
  self?: boolean;
  /** Bonus sur le lanceur (tours officiels × 3 s) : Dommages de l'Épée Divine, Portée des Tirs Éloignés. */
  /** instinct : un seul bonus « instinct » actif à la fois, le dernier lancé remplace les autres (nerf de l'Osamodas, 2026-11-08). */
  buff?: { stat: Stat; n: number; t: number; instinct?: boolean };
  /** Bouclier : part des PV max (Dofus « % du niveau » : 100 % du niveau = 10 % des PV max, choix 4C), durée en s. */
  shield?: { part: number; t: number };
  /** Recul du lanceur à l'impact, en px (Flèche Vagabonde : « Recule de 3 cases »). */
  selfKnock?: number;
  /** Dommages multipliés sur les invocations (Concentration). */
  vsSummon?: number;
  /** Augmente les dommages subis par les ennemis en zone de n % pendant t s, sans les frapper (Bond : effet officiel 1163). */
  vuln?: { n: number; t: number };
  /** Zone d'explosion de la flèche selon le nombre de lancers sur 3 s (Flèche d'Abolition : la zone grandit à chaque lancer). */
  grow?: number[];
  /** Osamodas : invoque cette bête (src/data/betes.json) au point visé ; soigne les bêtes touchées (Cri du Corbac…) ;
   *  ramène toutes les bêtes autour du lanceur (Charge Bestiale) ; 15A : dompte un monstre affaibli (Laisse Spirituelle). */
  invoque?: string; soinAllies?: boolean; rappel?: boolean; dompte?: { seuil: number; duree: number };
  /** Sacrieur (maquette Sacrieur, 8 nov. 2026) : attire de n cases vers le lanceur (Attirance) ou vers le centre de la zone (Condensation). */
  attire?: { cases: number; vers: 'lanceur' | 'centre' };
  /** Échange de place avec la cible (Assaut, Transposition). */
  echange?: boolean;
  /** Supplice : pendant t s, chaque coup porté à la cible soigne celui qui frappe de part × les dommages (effet officiel 786, 20 %). */
  supplice?: { part: number; t: number };
  /** Dommages en part des PV restants du lanceur (Transfusion : effet officiel 89, « 8 % des PV », × 1,5 comme les autres). */
  dmgPV?: number;
  /** Couronne d'Épines : renvoie part des dommages de mêlée reçus pendant t s. */
  renvoi?: { part: number; t: number };
  /** Mutilation : sacrifie une part des PV (jamais sous 1, 2A) pour de la Puissance, re-sacrifie toutes les `periode` s
   *  (+cran de Puissance, jusqu'à `crans`) ; relancé, il s'arrête et donne la Coagulation (bouclier en part des PV max selon les crans). */
  mutilation?: { sacrifice: number; puissance: number; cran: number; crans: number; periode: number; coagulation: number[] };
  /** Changements à Souffrance 6 ou plus (officiels) : portée en cases, attirance en cases, bouclier en plus par ennemi dans la zone. */
  souffrance6?: { po?: number; attire?: number; bouclierParEnnemi?: number };
  /** Forgelance (maquette Forgelance, 8 nov. 2026) : ce que le sort fait de la Lance.
   *  plante : la Lance se plante au point d'impact (Lance du Lac, Lance-pierre…) ; rappel : la Lance revient d'abord (Charge Héroïque…) ;
   *  rappelApres : Désarmé, la Lance revient après l'impact (Muspel) ; surLance : Désarmé, la zone part de la Lance (5A) ;
   *  epilogue : plante au point visé ou rappelle (clic droit, 7A) ; saut : Saut à la Lance (Espace, 8B). */
  lance?: { plante?: boolean; rappel?: boolean; rappelApres?: boolean; surLance?: boolean; epilogue?: boolean; saut?: boolean };
  /** Forgelance (11A) : bouclier (part des PV max) et Puissance donnés aussi aux alliés dans la zone (autres joueurs, bêtes, Épées). */
  allies?: { shield?: number; puissance?: number; t: number };
  /** Muspel : dommages en plus (part) pour chaque ennemi dans la zone. */
  parEnnemi?: number;
  /** Prélude au Fer : retire les bonus des ennemis touchés (Frénésie, Dommages en plus). */
  dissipe?: boolean;
  /** Kyrja : dommages des ennemis touchés réduits de n % pendant t s. */
  affaiblit?: { n: number; t: number };
  /** Balestra : après le coup, le lanceur passe de l'autre côté de la cible (cases). */
  traverse?: number;
  /** Eniripsa (maquette Eniripsa, ligne du 9 nov. 2026) : soin de base (moyenne officielle × 1,5, comme dmg) donné aux alliés
   *  de la zone (joueurs, bêtes) en plus des dommages aux ennemis (1A) ; soinLanceur = false : le lanceur n'est pas soigné (Lamentations). */
  soin?: number; soinLanceur?: boolean;
  /** Lamentations : soigne les alliés de la zone de cette part des dommages faits (effet officiel 2973, 50 %). */
  soinVol?: number;
  /** Mot Vampirique sur un allié : lui transfère cette part des PV du lanceur (effet officiel 90, 8 %). */
  transfert?: number;
  /** Encouragement (5A) sur l'allié visé, ou Fée (5B, bête `fee`) sur une case libre : un seul Encouragement à la fois par allié.
   *  regen : PA regagnés plus vite (Stimulant) ; pm, vitesse : charge de PM et vitesse en plus (Vivifiant) ; soinPct : soin immédiat
   *  et continu en part des PV max (Jouvence). */
  encourage?: { k: 'stimulant' | 'vivifiant' | 'jouvence'; t: number; fee: string; regen?: number; pm?: number; vitesse?: number; soinPct?: number };
  /** Moquerie (6A) sur l'ennemi visé, ou Feu Follet (6B, bête `feu`) sur une case libre : ralenti (part de vitesse), moitié sur élites et boss. */
  moque?: { k: 'accablant'; t: number; feu: string; ralenti: number };
  /** Retire les malus de l'allié ou les bonus de l'ennemi (Mot Interdit, Mot de Jouvence : « réduit la durée des effets »). */
  purge?: boolean;
  /** Mot Farceur : l'ennemi touché revient au bout de n s là où il était (état Farce). */
  farce?: number;
  /** Peinture de Guerre : t s ; allié = soin toutes les 3 s, ennemi = repoussé plus loin (part). */
  peinture?: { t: number; soin: number; poussee: number };
  /** Mot d'Amitié : invoque le Lapino, ou le téléporte au point visé s'il est déjà là. */
  lapino?: boolean;
  /** Mot d'Envol : sur un allié, échange de place ; sinon petit envol vers le point visé. */
  envol?: boolean;
  /** Mot de Reconstitution : soin total de l'allié (pas le lanceur), Insoignable n s ; relève à distance un allié à terre (10B). */
  reconstitution?: { insoignable: number; releve: number; relanceReleve: number };
}
/** Auto-attaque d'un type d'arme : un sort sans coût dont les dommages viennent de l'arme portée. */
export interface WeaponProfile extends Omit<SpellDef, 'name' | 'icon' | 'element' | 'dmg' | 'cooldown' | 'anim'> {
  /** typeId Dofus de l'arme : animation AnimArme<anim>, icône weapon_<anim>. */
  anim: number;
  base: number; mult: number;
}
export interface ClassDef {
  name: string; hp: number; speed: number; radius: number; iframesOnHit: number; healOnKill: number;
  critChance: number; critMult: number;
  /** PA : ressource des sorts (max, PA regagnés par seconde). PM : charges de déplacement (max, secondes par charge). */
  pa: { max: number; regen: number };
  pm: { max: number; recharge: number };
  /** Potion de soin : charges, part des PV max rendue, délai entre deux gorgées ; +1 charge par groupe vaincu. */
  potion: { charges: number; heal: number; cooldown: number };
  /** XP pour passer du niveau n au niveau n+1 = xpBase × n. */
  xpBase: number; maxLevel: number;
  /** Jauge de classe (Rage du Iop) : se remplit en frappant et en prenant des coups ; pleine, le sort suivant fait +bonus. */
  /** bonus : dommages en plus ; signature : multiplicateur de l'effet propre au sort (SpellDef.rage), 1,5 = +50 %. */
  rage: { name: string; max: number; perHit: number; perHurt: number; bonus: number; signature: number;
    /** Ligne Rage 24B : la Rage du Iop monte plus en mêlée, la Précision du Crâ plus de loin (et pas en prenant des coups). */
    mode?: 'melee' | 'distance' | 'eveil' | 'souffrance' | 'lance' | 'eloquence' };
  /** Eniripsa (maquette Eniripsa) : réglages des soins, voir classes.json > eniripsa._doc. */
  eniripsa?: { soinSoi: number; zoneEloquence: number; parSoin: number; aimant: number; aggro: { portee: number; chance: number; t: number } };
  /** Forgelance : la Lance Immortelle (états officiels Armé 24629 et Désarmé 24630).
   *  garde = part des dommages subis quand Armé (×0,85) ; reprise = Puissance gagnée en reprenant la Lance (rappel), aPied = à pied (3B),
   *  pendant duree s ; glyphe = rayon (px) où marcher reprend la Lance ; portee = distance (px) au-delà de laquelle elle revient seule (4A) ;
   *  tranchant = dommages du Rappel tranchant (1B), meilleur élément. */
  lance?: { garde: number; reprise: number; aPied: number; duree: number; glyphe: number; portee: number; tranchant: number };
  /** Sacrieur : Souffrance officielle (palier 1 à 10 = tranche de 10 % de PV perdus) : % des dommages reçus et % de dommages
   *  en plus par palier ; memoire = secondes où le palier le plus haut tient après un soin (maquette Sacrieur 3B). */
  souffrance?: { subis: number[]; finaux: number[]; memoire: number };
  /** Attaque de base (clic gauche maintenu) : combo de 3 coups au corps à corps, ou un sort sans coût (basic) pour les classes à distance. */
  basic?: string;
  attaque: { name: string; element: Element; comboWindow: number; combo: ComboHit[] };
  spells: Record<string, SpellDef>;
  /** Clé de la classe dans src/data/sorts.json (paires officielles de sorts). */
  sorts: string;
  /** Sorts officiels donnés dès le niveau 1 en plus du déplacement (Osamodas : le Tofu, maquette Osamodas 1A). */
  niveau1?: number[];
  /** Sort placé d'office au clic droit (Osamodas : Cri du Corbac, 6A) ; le clic droit ne prend alors pas d'autre sort. */
  clicDroit?: string;
  /** Sort de déplacement (Espace), donné dès le niveau 1. La barre elle-même est celle du joueur (Player.bar). */
  mobility: string;
}
/** 'attaque' = l'attaque de base ; sinon l'identifiant d'un sort de la classe. */
export type SkillId = string;

export interface MonsterDef {
  dofusId?: number; name: string; hp: number; speed: number; radius: number; mass: number; dmg: number;
  /** XP rapportée (par défaut PV / 5). */
  xp?: number;
  attackRange: number; windup: number; lungeSpeed: number; lungeTime: number; recover: number;
  slamRange?: number; slamRadius?: number; slamWindup?: number;
  look: string; color: string; boss?: boolean; elite?: boolean;
  /** Archimonstre (0.3, 15B ; tools/contenu/archimonstres.py) : son monstre (même planche) et le rapport des échelles officielles. */
  archiDe?: string; archiEchelle?: number;
  /** Monde ouvert : distance à laquelle il repère le joueur (défaut : OpenDef.aggro). */
  aggro?: number;
  /** Officiel (tools/extraction/monster_stats.py) : niveau, résistances par élément en %, caractéristiques. */
  level?: number;
  res?: Partial<Record<Element, number>>;
  caracs?: Partial<Record<'force' | 'intelligence' | 'chance' | 'agilite' | 'sagesse' | 'esquivePA' | 'esquivePM' | 'tacle' | 'fuite' | 'retraitPA', number>>;
  /** Les vrais sorts du monstre dans Dofus 3 (tools/extraction/monster_spells.py). Sans sorts : simple charge au corps à corps. */
  spells?: MonsterSpell[];
  /** Boss : id du sort officiel joué en attaque signature (maquette « Danger » 4A : zone agrandie, long télégraphe, gros dégâts). */
  signature?: number;
}

/** Effet d'un sort de monstre, tel que dans les données de Dofus 3 (n < 0 = retrait, dur en tours). */
export type MonsterEffect =
  | { k: 'dmg'; element: Element; min: number; max: number; steal?: boolean; perPa?: boolean }
  | { k: 'pa' | 'pm' | 'puissance'; n: number; dur: number }
  | { k: 'attire' | 'repousse' | 'avance'; n: number }
  | { k: 'soin'; min: number; max: number }
  /** Dommages en plus (pct : en %) pendant dur tours, ex. Frénésie ; invocation d'un monstre, ex. Appel de Kardorib. */
  | { k: 'dommages'; n: number; pct?: boolean; dur: number }
  | { k: 'invoque'; monster: string }
  /** Dommages subis × n % pendant dur tours (Cuirasse Laineuse : 70 sur ses alliés ; Grognement : 120 sur le joueur). */
  | { k: 'subis'; n: number; dur: number }
  /** Durée des effets -n tours (Rinçage) : raccourcit les bonus et malus en cours. */
  | { k: 'desenvoute'; n: number }
  /** État officiel (Pacifiste : ne peut plus infliger de dommages) sur tout ce qui est à r cases. */
  | { k: 'etat'; etat: 'pacifiste'; dur: number; r: number };
/** Sort officiel d'un monstre : coût, portée en cases (po), relance en tours, animation AnimAttaque<anim>,
 *  zone (P1 = une case, X1 = croix autour), allies = vise ses alliés, missile / gfx = effets visuels officiels. */
export interface MonsterSpell {
  id: number; name: string; pa: number; po: [number, number]; relance: number; anim: number;
  zone: string; allies: boolean; effects: MonsterEffect[]; missile?: number; gfx?: number;
}

interface Count { base: number; perWave: number; fromWave?: number }
export interface WavesDef {
  pack: (Count & { monster: string })[];
  bossEvery: number; boss: string;
  escort: Count & { monsters: string[] };
  archimonstres: { monsters: string[]; chance: { fromWave: number; value: number }[] };
}
/** Une sous-zone Dofus dans un monde ouvert : ses monstres officiels et la taille des groupes. */
export interface SubAreaDef {
  name: string; level: number; monsters: string[]; groupsPerMap: number; groupSize: [number, number];
  /** Élite unique de la sous-zone (maquette 0.2, 4A : Frakacia Leukocytine, Sam Sagaz…) : mène parfois un groupe, un seul à la fois. */
  elite?: string;
  /** Sous-zone faite d'intérieurs (Mine…) : ses monstres apparaissent aussi dedans. Sinon les intérieurs (maisons) restent vides. */
  interieur?: boolean;
  /** Seulement sur ces cartes (ex. Temple Céleste : la salle des Dofus reste calme, les deux autres servent au tutoriel). */
  cartes?: string[];
}
/** Porte entre deux cartes du monde (dehors -> intérieur, ou d'une salle à l'autre) : [tag de la carte, case Dofus 0-559]. */
/** verrou : la salle du côté a doit être vidée avant de passer ; sens : on ne passe que de a vers b (donjons). */
export interface PorteDef { a: [string, number]; b: [string, number]; nom: string; verrou?: number; sens?: number;
  /** Seulement en 0.3 (ateliers de fabrication) : fermée hors partie de test tant que V03_PUBLIC est faux. */
  v03?: number;
  /** Clé officielle demandée et prise en passant de a vers b (entrée d'un donjon, maquette 0.2 5B) : id de la ressource. */
  cle?: string;
  /** Portail vers une autre zone (Incarnam <-> Astrub) : b est une case de cette zone-là. */
  zone?: string;
  /** Portail dessiné hors des cases marchables (le bassin d'Incarnam, l'arche de la tour d'Astrub) : [case du milieu du dessin,
   *  demi-largeur, demi-hauteur] en pixels d'écran (zoom 1). On clique sur le dessin, le perso va jusqu'à a puis passe ;
   *  le frôler à pied ne fait rien (comme les portails de Dofus). */
  dessin?: [number, number, number] }
/** Donjon : ses salles (tag de carte) et, pour chacune, ses groupes de monstres officiels (fixes). */
export interface DonjonDef { nom: string; salles: Record<string, string[][]>;
  /** Arène du donjon (maquette « Donjons en vagues », 1B 2D) : une seule grande salle créée (tools/extraction/arenes.py).
   *  Cases de la grande grille : arrivée du joueur, entrées des monstres, estrade du boss, portail de sortie, coffre.
   *  Avec une arène, les salles officielles ne servent plus qu'au Bestiaire et au butin. */
  arene?: AreneDef;
  /** Vagues (5A + 5B + 5C) : groupes officiels des anciennes salles, '?' = tiré parmi les monstres du donjon ; nom = vague à thème. */
  vagues?: { nom?: string; m: string[] }[];
  /** Dernière vague (8A) : le boss et ses compagnons officiels. */
  bossVague?: string[];
  /** Maquette Coffres 4B : « precieux » = Coffret précieux (Enfers, donjons à clés) ; sinon la Malle Animée. */
  coffre?: 'precieux' }
export interface AreneDef { tag: string; arrivee: number; entrees: number[]; boss: number; sortie: number; coffre: number }
/** Monde ouvert : cartes Dofus collées, groupes de monstres posés sur chaque carte, qui réapparaissent. */
export interface OpenDef {
  /** Dossier public/assets/mondes/<world>. */
  world: string;
  /** Carte Dofus de départ [x, y]. */
  start: [number, number];
  /** Distance de repérage, distance de laisse (retour au point de départ), délai de réapparition (s). */
  aggro: number; leash: number; respawn: number;
  /** Points de retour après une mort (Zaaps) : le dernier atteint est gardé. Le premier est le départ.
   *  zaap : milieu de l'arche officielle (particule « Vortex »), en pixels de la grande carte ; sub : sa sous-zone (tools/extraction/zaaps.py). */
  checkpoints: { name: string; map: [number, number]; zaap?: [number, number]; sub?: number }[];
  subareas: Record<string, SubAreaDef>;
  /** Portes vers les intérieurs, reliées à la main (tools/extraction/interieurs.py). */
  portes?: PorteDef[];
  donjons?: DonjonDef[];
  /** Ateliers officiels (table hints de Dofus 3, maquette Métiers 10A) : cartes (tags) où l'on fabrique pour ces métiers. */
  ateliers?: AtelierDef[];
  /** Coffre partagé (0.3, 12A+12B) : où on l'ouvre (Havre-Sac, Banque d'Astrub). Sans case : la case la plus dégagée de la carte. */
  coffres?: { nom: string; carte: string; case?: number }[];
  /** Le Havre-Sac (maquette Hub) : case d'arrivée et case de l'arche officielle (le Zaap du Havre-Sac, 2C), case du Poutch (7A),
   *  thème officiel en jeu (src/data/havresac_themes.json, 5A : les autres thèmes se débloqueront). */
  havreSac?: { arrivee: number; arche: number; poutch?: number; theme?: number };
  /** Bastion des Douze (maquette Ville, 1A 10B 11B) : notre ville en archipel, hors de la carte officielle. Case d'arrivée,
   *  case du Zaap (il ouvre la liste des Zaaps, 7A) et cases des PNJ de service (tools/extraction/bastion.py). */
  bastion?: { arrivee: number; zaap: number; pnj?: Record<string, number>;
    /** Bord de l'île centrale vers l'île de chaque nation (musique : couche de la nation, Ville 5F). */
    iles?: Record<string, number> };
}
/** Atelier : nom officiel, métiers servis, cartes où il se trouve (la salle de l'atelier, ou la carte du dehors s'il est en plein air). */
export interface AtelierDef {
  nom: string; metiers: string[]; cartes: string[];
  /** Machines officielles (Métiers UI 3A, tools/contenu/ateliers_postes.py) : [carte, case, gfx, décalage x, y du dessin]. */
  postes?: [string, number, number, number, number][];
}
export interface ZoneDef {
  name: string; level: number;
  dofusSubArea?: number; dofusArea?: number;
  /** Zone à vagues sur une seule carte. */
  map?: { coords: [number, number]; dofusMapId: number };
  waves?: WavesDef;
  /** Zone en monde ouvert. */
  open?: OpenDef;
}

/** Tout ce dont la simulation a besoin, injecté (les tests passent leurs propres données). */
export interface GameData {
  classes: Record<string, ClassDef>;
  monsters: Record<string, MonsterDef>;
  zones: Record<string, ZoneDef>;
}
