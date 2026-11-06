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
  | { shape: 'projectile'; speed: number; range: number; width: number; explode?: number; pierce?: boolean };

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
  buff?: { stat: Stat; n: number; t: number };
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
    mode?: 'melee' | 'distance' };
  /** Attaque de base (clic gauche maintenu) : combo de 3 coups au corps à corps, ou un sort sans coût (basic) pour les classes à distance. */
  basic?: string;
  attaque: { name: string; element: Element; comboWindow: number; combo: ComboHit[] };
  spells: Record<string, SpellDef>;
  /** Clé de la classe dans src/data/sorts.json (paires officielles de sorts). */
  sorts: string;
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
  /** Monde ouvert : distance à laquelle il repère le joueur (défaut : OpenDef.aggro). */
  aggro?: number;
  /** Officiel (tools/extraction/monster_stats.py) : niveau, résistances par élément en %, caractéristiques. */
  level?: number;
  res?: Partial<Record<Element, number>>;
  caracs?: Partial<Record<'force' | 'intelligence' | 'chance' | 'agilite' | 'sagesse' | 'esquivePA' | 'esquivePM' | 'tacle' | 'fuite' | 'retraitPA', number>>;
  /** Les vrais sorts du monstre dans Dofus 3 (tools/extraction/monster_spells.py). Sans sorts : simple charge au corps à corps. */
  spells?: MonsterSpell[];
}

/** Effet d'un sort de monstre, tel que dans les données de Dofus 3 (n < 0 = retrait, dur en tours). */
export type MonsterEffect =
  | { k: 'dmg'; element: Element; min: number; max: number; steal?: boolean; perPa?: boolean }
  | { k: 'pa' | 'pm' | 'puissance'; n: number; dur: number }
  | { k: 'attire' | 'repousse' | 'avance'; n: number }
  | { k: 'soin'; min: number; max: number }
  /** Dommages en plus (pct : en %) pendant dur tours, ex. Frénésie ; invocation d'un monstre, ex. Appel de Kardorib. */
  | { k: 'dommages'; n: number; pct?: boolean; dur: number }
  | { k: 'invoque'; monster: string };
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
  /** Sous-zone faite d'intérieurs (Mine…) : ses monstres apparaissent aussi dedans. Sinon les intérieurs (maisons) restent vides. */
  interieur?: boolean;
  /** Seulement sur ces cartes (ex. Temple Céleste : la salle des Dofus reste calme, les deux autres servent au tutoriel). */
  cartes?: string[];
}
/** Porte entre deux cartes du monde (dehors -> intérieur, ou d'une salle à l'autre) : [tag de la carte, case Dofus 0-559]. */
/** verrou : la salle du côté a doit être vidée avant de passer ; sens : on ne passe que de a vers b (donjons). */
export interface PorteDef { a: [string, number]; b: [string, number]; nom: string; verrou?: number; sens?: number }
/** Donjon : ses salles (tag de carte) et, pour chacune, ses groupes de monstres officiels (fixes). */
export interface DonjonDef { nom: string; salles: Record<string, string[][]> }
/** Monde ouvert : cartes Dofus collées, groupes de monstres posés sur chaque carte, qui réapparaissent. */
export interface OpenDef {
  /** Dossier public/assets/mondes/<world>. */
  world: string;
  /** Carte Dofus de départ [x, y]. */
  start: [number, number];
  /** Distance de repérage, distance de laisse (retour au point de départ), délai de réapparition (s). */
  aggro: number; leash: number; respawn: number;
  /** Points de retour après une mort (Zaaps) : le dernier atteint est gardé. Le premier est le départ. */
  checkpoints: { name: string; map: [number, number] }[];
  subareas: Record<string, SubAreaDef>;
  /** Portes vers les intérieurs, reliées à la main (tools/extraction/interieurs.py). */
  portes?: PorteDef[];
  donjons?: DonjonDef[];
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
