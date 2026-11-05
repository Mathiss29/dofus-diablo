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
  /** Planche sur plusieurs pages (multiatlas Phaser, faite par perso_planche.py). */
  multi?: boolean;
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

// Auto-attaque à l'arme (src/data/armes.json) : AnimArme<typeId>, même squelette pour toutes les classes.
// Bornes : le repère SHOT de l'animation tombe sur l'impact du coup (impactAt / duration).
const WEAPON_MAP: Record<string, AnimSlice> = {
  arme6: { anim: 'AnimArme6', from: 0, to: 0.66 },    // Épée
  arme5: { anim: 'AnimArme5', from: 0, to: 0.87 },    // Dague
  arme7: { anim: 'AnimArme7', from: 0, to: 0.79 },    // Marteau
  arme19: { anim: 'AnimArme19', from: 0, to: 0.58 },  // Hache
  arme8: { anim: 'AnimArme8', from: 0.04, to: 1 },    // Pelle
  arme4: { anim: 'AnimArme4', from: 0.06, to: 1 },    // Bâton
  arme22: { anim: 'AnimArme22', from: 0, to: 0.7 },   // Faux
  arme2: { anim: 'AnimArme2', from: 0.24, to: 1 },    // Arc
  arme3: { anim: 'AnimArme3', from: 0.12, to: 1 },    // Baguette
};

// Iop : squelette joueur n° 1 + skin 80 (corps) + 2124 (tête). Animations officielles lues dans
// les données de sorts (spellscripts -> casterAnimation) : Épée Céleste = AnimAttaque801,
// Bond = AnimAttaque811, Colère de Iop = AnimAttaque800, attaque sans arme = AnimArme0.
// Planche refaite avec tools/extraction/iop_planche.sh (toutes les animations utiles en une passe).
const IOP_MAP: Record<string, AnimSlice> = {
  ...WEAPON_MAP,
  idle: { anim: 'AnimStatiqueCombat0', loop: true, fps: 20 },
  run: { anim: 'AnimCourse', loop: true, fps: 32 },
  attack1: { anim: 'AnimArme0', from: 3 / 28, to: 17 / 28 },
  attack2: { anim: 'AnimArme0', from: 3 / 28, to: 17 / 28 },
  attack3: { anim: 'AnimArme0', from: 3 / 28, to: 24 / 28 },
  epee: { anim: 'AnimAttaque801', from: 6 / 32, to: 1 },
  bond: { anim: 'AnimAttaque811', from: 0, to: 12 / 30 },
  // Animations officielles (casterAnimation des sorts) : Pression 802, Intimidation 803, Déferlement 809, Fureur 808.
  // Bornes choisies pour que le coup de l'animation tombe sur l'impact du sort.
  pression: { anim: 'AnimAttaque802', from: 0.1, to: 0.75 },
  intimidation: { anim: 'AnimAttaque803', from: 0, to: 0.6 },
  deferlement: { anim: 'AnimAttaque809', from: 0, to: 0.55 },
  fureur: { anim: 'AnimAttaque808', from: 0, to: 0.25 },
  hit: { anim: 'AnimHit', from: 0, to: 1 },
  colere_charge: { anim: 'AnimAttaque800', from: 0, to: 21 / 32 },
  colere_hit: { anim: 'AnimAttaque800', from: 21 / 32, to: 1 },
  die: { anim: 'AnimMort', from: 0, to: 19 / 20 },
};

// Crâ : squelette joueur n° 1 + skin 90 (corps) + 2140 (tête), planche faite par tools/extraction/perso_planche.py.
// Bornes : to = SHOT × durée / impactAt du sort, pour que la flèche parte avec l'animation.
const CRA_MAP: Record<string, AnimSlice> = {
  ...WEAPON_MAP,
  idle: { anim: 'AnimStatiqueCombat0', loop: true, fps: 20 },
  run: { anim: 'AnimCourse', loop: true, fps: 32 },
  cinglante: { anim: 'AnimAttaque911', from: 0, to: 0.6 },
  recul: { anim: 'AnimAttaque919', from: 0, to: 0.82 },
  glacee: { anim: 'AnimAttaque910', from: 0, to: 0.6 },
  barrage: { anim: 'AnimAttaque901', from: 0, to: 0.77 },
  explosive: { anim: 'AnimAttaque916', from: 0, to: 0.63 },
  abolition: { anim: 'AnimAttaque913', from: 0, to: 0.62 },
  dispersion: { anim: 'AnimAttaque915', from: 0, to: 0.51 },
  pas_chasse: { anim: 'AnimAttaque923', from: 0.1, to: 0.6 },
  hit: { anim: 'AnimHit', from: 0, to: 1 },
  die: { anim: 'AnimMort', from: 0, to: 0.75 },
};

const GOLD = 0xffd87a;

export const LOOKS: Record<string, Look> = {
  iop: { atlas: 'iop', scale: 0.82, map: IOP_MAP, height: 120, ignoreZ: true, portraitZoom: 1.7, multi: true },
  cra: { atlas: 'cra', scale: 0.82, map: CRA_MAP, height: 120, ignoreZ: true, portraitZoom: 1.7, multi: true },
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
  // Incarnam (monstres spectraux). Attaque = animId du sort officiel du monstre (spells -> spellscripts) ;
  // fraction = repère SHOT de l'animation / nombre de frames.
  tofu_chimerique: { atlas: 'tofu_chimerique', scale: 0.55, map: MONSTER_MAP(9 / 30), height: 90 },
  pissenlit_miroitant: { atlas: 'pissenlit_miroitant', scale: 0.6, map: MONSTER_MAP(14 / 27, 'AnimAttaque1'), height: 121 },
  rose_vaporeuse: { atlas: 'rose_vaporeuse', scale: 0.55, map: MONSTER_MAP(13 / 27, 'AnimAttaque1'), height: 138 },
  tournesol_nebuleux: { atlas: 'tournesol_nebuleux', scale: 0.42, map: MONSTER_MAP(10 / 21, 'AnimAttaque1'), height: 262 },
  bouftou_nuageux: { atlas: 'bouftou_nuageux', scale: 0.5, map: MONSTER_MAP(9 / 32), height: 161 },
  boufton_palichon: { atlas: 'boufton_palichon', scale: 0.55, map: MONSTER_MAP(8 / 17, 'AnimAttaque1'), height: 95 },
  boufton_orageux: { atlas: 'boufton_orageux', scale: 0.5, map: MONSTER_MAP(9 / 32), height: 115 },
  bouftor_ethere: { atlas: 'bouftor_ethere', scale: 0.48, map: MONSTER_MAP(10 / 37), height: 225 },
  feu_vif: { atlas: 'feu_vif', scale: 0.55, map: MONSTER_MAP(17 / 38), height: 120 },
  feu_de_joie: { atlas: 'feu_de_joie', scale: 0.5, map: MONSTER_MAP(17 / 38), height: 160 },
  feu_furieux: { atlas: 'feu_furieux', scale: 0.5, map: MONSTER_MAP(5 / 38), height: 152 },
  feu_follet: { atlas: 'feu_follet', scale: 0.55, map: MONSTER_MAP(5 / 32), height: 132 },
};
