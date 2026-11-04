/** Apparence de chaque entité : quelle planche, quelle échelle, et quelle animation Dofus
 *  jouer pour chaque état de gameplay. from/to = fractions de l'animation d'origine,
 *  choisies pour que la frame d'impact tombe au moment du dégât. */

export interface AnimSlice { anim: string; from?: number; to?: number; loop?: boolean; fps?: number }
export interface Look {
  atlas: string;
  scale: number;
  /** Hauteur du sprite (pixels planche), pour placer la barre de vie. */
  height: number;
  map: Record<string, AnimSlice>;
  /** Le sprite reste au sol pendant les sauts (le saut est déjà dans l'animation). */
  ignoreZ?: boolean;
  tint?: number;
  /** Zoom du portrait dans la timeline du HUD (1 = tout le corps tient dans le cadre). */
  portraitZoom?: number;
}

const MONSTER_MAP = (shot: number, atk = 'AnimAttaque0'): Record<string, AnimSlice> => ({
  idle: { anim: 'AnimStatique' },
  spawn: { anim: 'AnimStatique' },
  run: { anim: 'AnimCourse', loop: true, fps: 30 },
  windup: { anim: atk, from: 0, to: shot },
  slam_charge: { anim: atk, from: 0, to: shot },
  lunge: { anim: atk, from: shot, to: Math.min(1, shot + 0.35) },
  stun: { anim: 'AnimHit', loop: true, fps: 20 },
  die: { anim: 'AnimMort' },
});

// Iop : squelette joueur n° 1 + skin 80 (corps) + 2124 (tête). Animations officielles lues dans
// les données de sorts (spellscripts -> casterAnimation) : Épée Céleste = AnimAttaque801,
// Bond = AnimAttaque811, Colère de Iop = AnimAttaque800, attaque sans arme = AnimArme0.
const IOP_MAP: Record<string, AnimSlice> = {
  idle: { anim: 'AnimStatiqueCombat0', loop: true, fps: 20 },
  run: { anim: 'AnimCourse', loop: true, fps: 32 },
  attack1: { anim: 'AnimArme0', from: 3 / 28, to: 17 / 28 },
  attack2: { anim: 'AnimArme0', from: 3 / 28, to: 17 / 28 },
  attack3: { anim: 'AnimArme0', from: 3 / 28, to: 24 / 28 },
  epee: { anim: 'AnimAttaque801', from: 6 / 32, to: 1 },
  leap: { anim: 'AnimAttaque811', from: 0, to: 12 / 30 },
  colere_charge: { anim: 'AnimAttaque800', from: 0, to: 21 / 32 },
  colere_hit: { anim: 'AnimAttaque800', from: 21 / 32, to: 1 },
  die: { anim: 'AnimMort', from: 0, to: 19 / 20 },
};

const GOLD = 0xffd87a;

export const LOOKS: Record<string, Look> = {
  iop: { atlas: 'iop', scale: 1.15, map: IOP_MAP, height: 120, ignoreZ: true, portraitZoom: 1.7 },
  bouftou: { atlas: 'bouftou', scale: 0.85, map: MONSTER_MAP(9 / 32), height: 70 },
  boufton: { atlas: 'boufton', scale: 0.8, map: MONSTER_MAP(9 / 32), height: 55 },
  royal: { atlas: 'royal', scale: 1.05, map: MONSTER_MAP(10 / 20), height: 140 },
  // Plantes des Champs d'Astrub : attaque = animation du sort officiel du monstre
  pissenlit: { atlas: 'pissenlit', scale: 0.62, map: MONSTER_MAP(9 / 25, 'AnimAttaque1'), height: 80 },
  rose: { atlas: 'rose', scale: 0.55, map: MONSTER_MAP(9 / 33), height: 100 },
  tournesol: { atlas: 'tournesol', scale: 0.66, map: MONSTER_MAP(12 / 25), height: 120 },
  epouvanteur: { atlas: 'epouvanteur', scale: 1.0, map: MONSTER_MAP(8 / 20), height: 140 },
  // Archimonstres : même planche, plus grands et dorés
  archi_pissenlit: { atlas: 'pissenlit', scale: 0.74, map: MONSTER_MAP(9 / 25, 'AnimAttaque1'), height: 80, tint: GOLD },
  archi_rose: { atlas: 'rose', scale: 0.66, map: MONSTER_MAP(9 / 33), height: 100, tint: GOLD },
  archi_tournesol: { atlas: 'tournesol', scale: 0.78, map: MONSTER_MAP(12 / 25), height: 120, tint: GOLD },
};
