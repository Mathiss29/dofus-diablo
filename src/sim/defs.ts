/** Types des données de jeu (src/data/*.json). La simulation ne lit que ça. */

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
  /** Effet visuel (FX) : arc, line, burst, land. */
  fx: 'arc' | 'line' | 'burst' | 'land';
  /** Description officielle (spellsdataroot.descriptionId), pour l'infobulle. */
  desc?: string;
  /** Animation du lanceur, si ce n'est pas l'identifiant du sort (auto-attaque à l'arme : arme6...). */
  anim?: string;
  /** Icône d'objet (planche des objets) au lieu d'une icône de sort. */
  itemIcon?: number;
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
  rage: { name: string; max: number; perHit: number; perHurt: number; bonus: number; area: number };
  /** Attaque de base (clic gauche maintenu) : combo de 3 coups au corps à corps, ou un sort sans coût (basic) pour les classes à distance. */
  basic?: string;
  attaque: { name: string; element: Element; comboWindow: number; combo: ComboHit[] };
  spells: Record<string, SpellDef>;
  /** Barre de 6 sorts (touches 1 à 6), le déplacement (Espace) et le sort favori (clic droit). */
  bar: string[];
  mobility: string;
  favorite: string;
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
  /** Attaque à distance : il s'arrête à portée et lance un projectile (ligne d'avertissement pendant windup s). */
  ranged?: { range: number; speed: number; width: number; windup: number; element: Element; dmg?: number };
}

interface Count { base: number; perWave: number; fromWave?: number }
export interface WavesDef {
  pack: (Count & { monster: string })[];
  bossEvery: number; boss: string;
  escort: Count & { monsters: string[] };
  archimonstres: { monsters: string[]; chance: { fromWave: number; value: number }[] };
}
/** Une sous-zone Dofus dans un monde ouvert : ses monstres officiels et la taille des groupes. */
export interface SubAreaDef { name: string; level: number; monsters: string[]; groupsPerMap: number; groupSize: [number, number] }
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
