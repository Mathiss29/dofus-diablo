/** Types des données de jeu (src/data/*.json). La simulation ne lit que ça. */

export interface ComboHit {
  duration: number; impactAt: number; cancelAt: number;
  dmg: number; range: number; arc: number; knock: number; step: number; hitstop: number; shake: number;
}
export interface SkillBase { name: string; key: string; cooldown: number; duration: number; cancelAt?: number; hitstop: number; shake: number }
export interface ClassDef {
  name: string; hp: number; speed: number; radius: number; iframesOnHit: number; healOnKill: number;
  critChance: number; critMult: number;
  /** PA et PM affichés dans le HUD (pas encore consommés par les sorts). */
  pa?: number; pm?: number;
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
  attackRange: number; windup: number; lungeSpeed: number; lungeTime: number; recover: number;
  slamRange?: number; slamRadius?: number; slamWindup?: number;
  look: string; color: string; boss?: boolean; elite?: boolean;
}

interface Count { base: number; perWave: number; fromWave?: number }
export interface WavesDef {
  pack: (Count & { monster: string })[];
  bossEvery: number; boss: string;
  escort: Count & { monsters: string[] };
  archimonstres: { monsters: string[]; chance: { fromWave: number; value: number }[] };
}
export interface ZoneDef {
  name: string; dofusSubArea: number; level: number;
  map: { coords: [number, number]; dofusMapId: number };
  waves: WavesDef;
}

/** Tout ce dont la simulation a besoin, injecté (les tests passent leurs propres données). */
export interface GameData {
  classes: Record<string, ClassDef>;
  monsters: Record<string, MonsterDef>;
  zones: Record<string, ZoneDef>;
}
