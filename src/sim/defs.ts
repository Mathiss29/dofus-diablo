/** Types des données de jeu (src/data/*.json). La simulation ne lit que ça. */

export interface ComboHit {
  duration: number; impactAt: number; cancelAt: number;
  dmg: number; range: number; arc: number; knock: number; step: number; hitstop: number; shake: number;
}
export interface SkillBase { name: string; key: string; cooldown: number; pa?: number; duration: number; cancelAt?: number; hitstop: number; shake: number }
export interface ClassDef {
  name: string; hp: number; speed: number; radius: number; iframesOnHit: number; healOnKill: number;
  critChance: number; critMult: number;
  /** PA : ressource des sorts (max, PA regagnés par seconde). PM : charges de Bond (max, secondes par charge). */
  pa: { max: number; regen: number };
  pm: { max: number; recharge: number };
  /** Potion de soin : charges, part des PV max rendue, délai entre deux gorgées ; +1 charge à chaque vague. */
  potion: { charges: number; heal: number; cooldown: number };
  /** XP pour passer du niveau n au niveau n+1 = xpBase × n. */
  xpBase: number; maxLevel: number;
  skills: {
    attaque: { name: string; key: string; cooldown: number; comboWindow: number; combo: ComboHit[] };
    epee: SkillBase & { impactAt: number; dmg: number; length: number; width: number; knock: number };
    bond: SkillBase & { maxRange: number; height: number; dmg: number; radius: number; knock: number; stun: number };
    colere: SkillBase & { impactAt: number; dmg: number; radius: number; knock: number };
  };
}
export type SkillId = keyof ClassDef['skills'];
export const SKILL_IDS: SkillId[] = ['attaque', 'epee', 'bond', 'colere'];

export interface MonsterDef {
  dofusId?: number; name: string; hp: number; speed: number; radius: number; mass: number; dmg: number;
  /** XP rapportée (par défaut PV / 5). */
  xp?: number;
  attackRange: number; windup: number; lungeSpeed: number; lungeTime: number; recover: number;
  slamRange?: number; slamRadius?: number; slamWindup?: number;
  look: string; color: string; boss?: boolean; elite?: boolean;
  /** Monde ouvert : distance à laquelle il repère le joueur (défaut : OpenDef.aggro). */
  aggro?: number;
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
