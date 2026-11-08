import MONSTRES from '../data/monsters.json';
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

/** shot = repère SHOT / nb de frames de l'attaque par défaut ; spells = les autres animations de sorts présentes
 *  dans la planche (animId du sort -> SHOT), jouées par windup<animId> / lunge<animId>. */
const MONSTER_MAP = (shot: number, atk = 'AnimAttaque0', spells: Record<number, number> = {}): Record<string, AnimSlice> => ({
  ...Object.fromEntries(Object.entries(spells).flatMap(([id, s]) => [
    [`windup${id}`, { anim: `AnimAttaque${id}`, from: 0, to: s }],
    [`lunge${id}`, { anim: `AnimAttaque${id}`, from: s, to: Math.min(1, s + 0.35) }],
  ])),
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
  arme271: { anim: 'AnimArme271', from: 0.06, to: 1 }, // Lance (maquette Armes 1A)
  // Récolte (maquette Armes 9A) : animation officielle du métier (bone_1-metier), l'outil est dessiné dedans ; jouée en boucle
  r_AnimFaucher: { anim: 'AnimFaucher', loop: true, fps: 26 },
  r_AnimHache: { anim: 'AnimHache', loop: true, fps: 24 },
  r_AnimPioche: { anim: 'AnimPioche', loop: true, fps: 22 },
  r_AnimCueillir0: { anim: 'AnimCueillir0', loop: true, fps: 14 },
  r_AnimPeche: { anim: 'AnimPeche', loop: true, fps: 20 },
};

// Iop : squelette joueur n° 1 + skin 80 (corps) + 2124 (tête). Animations officielles lues dans
// les données de sorts (spellscripts -> casterAnimation) : Épée Céleste = AnimAttaque801,
// Bond = AnimAttaque811, Colère de Iop = AnimAttaque800, attaque sans arme = AnimArme0.
// Planche refaite avec tools/extraction/iop_planche.sh (toutes les animations utiles en une passe).
const IOP_MAP: Record<string, AnimSlice> = {
  ...WEAPON_MAP,
  idle: { anim: 'AnimStatiqueExplo0', loop: true, fps: 20 },
  run: { anim: 'AnimCourse', loop: true, fps: 32 },
  attack1: { anim: 'AnimArme0', from: 3 / 28, to: 17 / 28 },
  attack2: { anim: 'AnimArme0', from: 3 / 28, to: 17 / 28 },
  attack3: { anim: 'AnimArme0', from: 3 / 28, to: 24 / 28 },
  epee: { anim: 'AnimAttaque801', from: 6 / 32, to: 1 },
  bond: { anim: 'AnimAttaque811', from: 0, to: 12 / 30 },
  // Animations officielles (casterAnimation des sorts) : Pression 802, Intimidation 803, Déferlement 809, Fureur 808.
  // Bornes choisies pour que le coup de l'animation tombe sur l'impact du sort.
  pression: { anim: 'AnimAttaque802', from: 0.1, to: 0.75 },
  // Sorts du niveau 1 à 20 (maquette Sorts, 2026-11-06) : Couperet 802, Épée Divine 800, Ferveur 814, Concentration 801
  couperet: { anim: 'AnimAttaque802', from: 0.1, to: 0.75 },
  epee_divine: { anim: 'AnimAttaque800', from: 0.4, to: 1 },
  ferveur: { anim: 'AnimAttaque814', from: 0, to: 0.33 },
  concentration: { anim: 'AnimAttaque801', from: 6 / 32, to: 1 },
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
  idle: { anim: 'AnimStatiqueExplo0', loop: true, fps: 20 },
  run: { anim: 'AnimCourse', loop: true, fps: 32 },
  // sans arme : Coup de poing, comme toutes les classes de Dofus (AnimArme0)
  attack1: { anim: 'AnimArme0', from: 3 / 28, to: 17 / 28 },
  attack2: { anim: 'AnimArme0', from: 3 / 28, to: 17 / 28 },
  attack3: { anim: 'AnimArme0', from: 3 / 28, to: 24 / 28 },
  cinglante: { anim: 'AnimAttaque911', from: 0, to: 0.6 },
  recul: { anim: 'AnimAttaque919', from: 0, to: 0.82 },
  glacee: { anim: 'AnimAttaque910', from: 0, to: 0.6 },
  barrage: { anim: 'AnimAttaque901', from: 0, to: 0.77 },
  explosive: { anim: 'AnimAttaque916', from: 0, to: 0.63 },
  abolition: { anim: 'AnimAttaque913', from: 0, to: 0.62 },
  dispersion: { anim: 'AnimAttaque915', from: 0, to: 0.51 },
  pas_chasse: { anim: 'AnimAttaque923', from: 0.1, to: 0.6 },
  // Sorts du niveau 1 à 20 (maquette Sorts, 2026-11-06) : Flèche Vagabonde 917, Tirs Éloignés 902, Flèche Détonante 907
  vagabonde: { anim: 'AnimAttaque917', from: 0, to: 0.75 },
  tirs_eloignes: { anim: 'AnimAttaque902', from: 0, to: 0.6 },
  detonante: { anim: 'AnimAttaque907', from: 0, to: 0.6 },
  hit: { anim: 'AnimHit', from: 0, to: 1 },
  die: { anim: 'AnimMort', from: 0, to: 0.75 },
};

// Osamodas : squelette joueur n° 1 + skin 20 (corps), animations officielles (spellscripts -> casterAnimation) :
// Cri du Corbac / Dents de Piranya / Cri de l'Ours 202, Piquants du Prespic 216, Fouet 213, Invocations 204, Cortège 214,
// Piqûre Motivante 208, Saute-granouille 201, Souffle Draconique 200, Charge Bestiale 218, Laisse Spirituelle 19.
const OSA_MAP: Record<string, AnimSlice> = {
  ...WEAPON_MAP,
  idle: { anim: 'AnimStatiqueExplo0', loop: true, fps: 20 },
  run: { anim: 'AnimCourse', loop: true, fps: 32 },
  attack1: { anim: 'AnimArme0', from: 3 / 28, to: 17 / 28 },
  attack2: { anim: 'AnimArme0', from: 3 / 28, to: 17 / 28 },
  attack3: { anim: 'AnimArme0', from: 3 / 28, to: 24 / 28 },
  cri_corbac: { anim: 'AnimAttaque202', from: 0, to: 0.6 },
  pics_prespic: { anim: 'AnimAttaque216', from: 0, to: 0.6 },
  dents_piranya: { anim: 'AnimAttaque202', from: 0, to: 0.6 },
  cri_ours: { anim: 'AnimAttaque202', from: 0, to: 0.6 },
  fouet: { anim: 'AnimAttaque213', from: 0, to: 0.6 },
  tofu: { anim: 'AnimAttaque204', from: 0, to: 0.7 },
  bouftou: { anim: 'AnimAttaque204', from: 0, to: 0.7 },
  crapipou: { anim: 'AnimAttaque204', from: 0, to: 0.7 },
  dragoune: { anim: 'AnimAttaque204', from: 0, to: 0.7 },
  cortege: { anim: 'AnimAttaque214', from: 0, to: 0.7 },
  piqure: { anim: 'AnimAttaque208', from: 0, to: 0.7 },
  saute_granouille: { anim: 'AnimAttaque201', from: 0, to: 0.6 },
  souffle_draconique: { anim: 'AnimAttaque200', from: 0, to: 0.6 },
  charge_bestiale: { anim: 'AnimAttaque218', from: 0, to: 0.6 },
  laisse_spirituelle: { anim: 'AnimAttaque19', from: 0, to: 0.7 },
  hit: { anim: 'AnimHit', from: 0, to: 1 },
  die: { anim: 'AnimMort', from: 0, to: 0.75 },
};

const GOLD = 0xffd87a;

export const LOOKS: Record<string, Look> = {
  iop: { atlas: 'iop', scale: 0.82, map: IOP_MAP, height: 120, ignoreZ: true, portraitZoom: 1.7, multi: true },
  cra: { atlas: 'cra', scale: 0.82, map: CRA_MAP, height: 120, ignoreZ: true, portraitZoom: 1.7, multi: true },
  // Versions femme (création de perso) : même squelette et mêmes animations, skin et tête officielles de création
  iop_f: { atlas: 'iop_f', scale: 0.82, map: IOP_MAP, height: 120, ignoreZ: true, portraitZoom: 1.7, multi: true },
  cra_f: { atlas: 'cra_f', scale: 0.82, map: CRA_MAP, height: 120, ignoreZ: true, portraitZoom: 1.7, multi: true },
  // Osamodas : dessiné en direct depuis son squelette (pas de planche de secours)
  osamodas: { atlas: 'osamodas', scale: 0.82, map: OSA_MAP, height: 120, ignoreZ: true, portraitZoom: 1.7, multi: true },
  // Bêtes de l'Osamodas (src/data/betes.json, monster_planche.py) : échelle = 0,55 x échelle officielle du look,
  // x 2,5 / SCALE de rendu (1,6 pour Craquolosse et Sulfénix, 1,25 pour Dragonnet, Scarafoudre et Gobgobs) ;
  // le Dragonnet n'a ni repos ni course officiels : la première image de son attaque en tient lieu
  osa_tofu: { atlas: 'osa_tofu', scale: 0.55, map: MONSTER_MAP(6 / 28, 'AnimAttaque0', { 0: 6 / 28, 1: 5 / 27 }), height: 60, multi: true },
  osa_ventritofu: { atlas: 'osa_ventritofu', scale: 0.66, map: MONSTER_MAP(9 / 22, 'AnimAttaque0', { 0: 9 / 22, 1: 8 / 15, 2: 10 / 20 }), height: 105, multi: true },
  osa_scarafoudre: { atlas: 'osa_scarafoudre', scale: 1.21, map: MONSTER_MAP(3 / 32, 'AnimAttaque0', { 0: 3 / 32, 1: 3 / 30, 2: 13 / 21 }), height: 63, multi: true },
  osa_bouftou: { atlas: 'osa_bouftou', scale: 0.55, map: MONSTER_MAP(7 / 23, 'AnimAttaque0', { 0: 7 / 23, 1: 5 / 30 }), height: 104, multi: true },
  osa_bouflourd: { atlas: 'osa_bouflourd', scale: 0.66, map: MONSTER_MAP(5 / 38, 'AnimAttaque0', { 0: 5 / 38, 1: 5 / 14, 2: 12 / 24 }), height: 130, multi: true },
  osa_craquolosse: { atlas: 'osa_craquolosse', scale: 0.86, map: MONSTER_MAP(8 / 34, 'AnimAttaque0', { 0: 8 / 34, 1: 10 / 49, 2: 11 / 34 }), height: 190, multi: true },
  osa_crapipou: { atlas: 'osa_crapipou', scale: 0.49, map: MONSTER_MAP(4 / 17, 'AnimAttaque0', { 0: 4 / 17, 1: 3 / 18 }), height: 81, multi: true },
  osa_crapipaud: { atlas: 'osa_crapipaud', scale: 0.66, map: MONSTER_MAP(1 / 17, 'AnimAttaque0', { 0: 1 / 17, 2: 6 / 19 }), height: 104, multi: true },
  osa_crocoleureux: { atlas: 'osa_crocoleureux', scale: 0.55, map: MONSTER_MAP(5 / 38, 'AnimAttaque0', { 0: 5 / 38, 1: 11 / 48, 2: 9 / 56 }), height: 223, multi: true },
  osa_dragoune: { atlas: 'osa_dragoune', scale: 0.55, map: MONSTER_MAP(4 / 37, 'AnimAttaque0', { 0: 4 / 37, 1: 10 / 27 }), height: 176, multi: true },
  // Dragonnet : le squelette de l'invocation de Dofus 3 (9469) n'a ni repos ni course ; on prend celui du Dragonnet Rouge officiel (403, look {403|||105})
  osa_dragonnet: { atlas: 'osa_dragonnet', scale: 0.58, map: MONSTER_MAP(19 / 23, 'AnimAttaque0', { 0: 19 / 23, 1: 28 / 33, 2: 29 / 37 }), height: 135, multi: true },
  osa_sulfenix: { atlas: 'osa_sulfenix', scale: 0.86, map: MONSTER_MAP(5 / 40, 'AnimAttaque0', { 0: 5 / 40, 1: 20 / 48, 2: 14 / 33 }), height: 164, multi: true },
  osa_gobgob_glouton: { atlas: 'osa_gobgob_glouton', scale: 1.1, map: MONSTER_MAP(4 / 38, 'AnimAttaque0', { 0: 4 / 38, 1: 5 / 29, 2: 5 / 21 }), height: 66, multi: true },
  osa_gobgob_facetieux: { atlas: 'osa_gobgob_facetieux', scale: 1.1, map: MONSTER_MAP(8 / 43, 'AnimAttaque0', { 0: 8 / 43, 1: 13 / 26, 2: 11 / 34 }), height: 71, multi: true },
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
  // un sort dont l'animation n'existe pas sur le squelette (ex. 1001 et 6 du Tournesol Nébuleux) joue l'attaque par défaut ;
  // fraction = repère SHOT de l'animation / nombre de frames.
  tofu_chimerique: { atlas: 'tofu_chimerique', scale: 0.55, map: MONSTER_MAP(9 / 30), height: 90 },
  pissenlit_miroitant: { atlas: 'pissenlit_miroitant', scale: 0.6, map: MONSTER_MAP(14 / 27, 'AnimAttaque1'), height: 121 },
  rose_vaporeuse: { atlas: 'rose_vaporeuse', scale: 0.55, map: MONSTER_MAP(13 / 27, 'AnimAttaque1', { 0: 9 / 20, 1: 13 / 27 }), height: 138 },
  tournesol_nebuleux: { atlas: 'tournesol_nebuleux', scale: 0.42, map: MONSTER_MAP(10 / 21, 'AnimAttaque1'), height: 262 },
  bouftou_nuageux: { atlas: 'bouftou_nuageux', scale: 0.5, map: MONSTER_MAP(9 / 32), height: 161 },
  boufton_palichon: { atlas: 'boufton_palichon', scale: 0.55, map: MONSTER_MAP(8 / 17, 'AnimAttaque1', { 0: 9 / 32, 1: 8 / 17 }), height: 95 },
  boufton_orageux: { atlas: 'boufton_orageux', scale: 0.5, map: MONSTER_MAP(9 / 32, 'AnimAttaque0', { 0: 9 / 32, 1: 8 / 17 }), height: 115 },
  bouftor_ethere: { atlas: 'bouftor_ethere', scale: 0.48, map: MONSTER_MAP(10 / 37, 'AnimAttaque0', { 0: 10 / 37, 1: 14 / 24 }), height: 225 },
  feu_vif: { atlas: 'feu_vif', scale: 0.55, map: MONSTER_MAP(17 / 38), height: 120 },
  feu_de_joie: { atlas: 'feu_de_joie', scale: 0.5, map: MONSTER_MAP(17 / 38), height: 160 },
  feu_furieux: { atlas: 'feu_furieux', scale: 0.5, map: MONSTER_MAP(5 / 38), height: 152 },
  feu_follet: { atlas: 'feu_follet', scale: 0.55, map: MONSTER_MAP(5 / 32), height: 132 },
  // Lac, Forêt, Cimetière et Mine d'Incarnam (tools/extraction/monster_planche.py)
  plikplok: { atlas: 'plikplok', scale: 0.55, map: MONSTER_MAP(17 / 30, 'AnimAttaque0'), height: 93, multi: true },
  petit_gloot: { atlas: 'petit_gloot', scale: 0.55, map: MONSTER_MAP(10 / 29, 'AnimAttaque0'), height: 74, multi: true },
  ronronchon: { atlas: 'ronronchon', scale: 0.86, map: MONSTER_MAP(16 / 42, 'AnimAttaque0', { 0: 16 / 42, 1: 22 / 44, 2: 6 / 20 }), height: 198, multi: true },
  tigrimas: { atlas: 'tigrimas', scale: 0.86, map: MONSTER_MAP(16 / 42, 'AnimAttaque0', { 0: 16 / 42, 2: 11 / 43 }), height: 165, multi: true },
  chafer_debutant: { atlas: 'chafer_debutant', scale: 0.66, map: MONSTER_MAP(8 / 24, 'AnimAttaque0', { 0: 8 / 24, 1: 8 / 24 }), height: 189, multi: true },
  chafer_furtif: { atlas: 'chafer_furtif', scale: 0.69, map: MONSTER_MAP(8 / 24, 'AnimAttaque0', { 0: 8 / 24, 1: 8 / 24 }), height: 192, multi: true },
  chafer_eclaireur: { atlas: 'chafer_eclaireur', scale: 0.63, map: MONSTER_MAP(23 / 50, 'AnimAttaque2', { 2: 23 / 50, 901: 23 / 50 }), height: 199, multi: true },
  chafer_piquier: { atlas: 'chafer_piquier', scale: 1.22, map: MONSTER_MAP(10 / 41, 'AnimAttaque0', { 0: 10 / 41, 1: 17 / 41 }), height: 149, multi: true },
  aminite: { atlas: 'aminite', scale: 0.55, map: MONSTER_MAP(16 / 35, 'AnimAttaque0', { 0: 16 / 35, 1: 8 / 43 }), height: 154, multi: true },
  // Crypte de Kardorim : Sergent Chafer, Kardorim (rendu à SCALE 1,6 : gros squelette) et son invocation Kardorib
  sergent_chafer: { atlas: 'sergent_chafer', scale: 0.55, map: MONSTER_MAP(8 / 24, 'AnimAttaque0', { 0: 8 / 24, 1: 7 / 24 }), height: 288, multi: true },
  kardorim: { atlas: 'kardorim', scale: 0.95, map: MONSTER_MAP(14 / 24, 'AnimAttaque0', { 0: 14 / 24, 1: 29 / 44, 2: 5 / 22 }), height: 196, multi: true },
  kardorib: { atlas: 'kardorib', scale: 0.66, map: MONSTER_MAP(21 / 33, 'AnimAttaque0', { 0: 21 / 33, 1: 10 / 27, 2: 19 / 39 }), height: 224, multi: true },
  // Élites des quêtes d'Incarnam (quetes.json) : Milimilou (SCALE 1,6), Caporale Mynerve (2), Kruella Freuz (2,5), Percy Klop (1,6), Rat Soiffé (2,5)
  milimilou: { atlas: 'milimilou', scale: 0.95, map: MONSTER_MAP(21 / 42, 'AnimAttaque0', { 0: 21 / 42 }), height: 173, multi: true },
  caporale_mynerve: { atlas: 'caporale_mynerve', scale: 0.62, map: MONSTER_MAP(8 / 30, 'AnimAttaque0', { 0: 8 / 30 }), height: 209, multi: true },
  kruella_freuz: { atlas: 'kruella_freuz', scale: 0.62, map: MONSTER_MAP(8 / 33, 'AnimAttaque0', { 0: 8 / 33, 1: 8 / 33 }), height: 246, multi: true },
  percy_klop: { atlas: 'percy_klop', scale: 0.95, map: MONSTER_MAP(7 / 23, 'AnimAttaque0', { 0: 7 / 23, 1: 7 / 22 }), height: 133, multi: true },
  rat_soiffe: { atlas: 'rat_soiffe', scale: 0.7, map: MONSTER_MAP(5 / 18, 'AnimAttaque0', { 0: 5 / 18, 1: 3 / 21 }), height: 87, multi: true },
  // Astrub (0.2a, monster_planche.py) : échelle = 0,55 x échelle officielle du look (planche à SCALE 2,5 ; 1,6 pour les gros :
  // Pichon Vert, Pyrasite, Céglumen, Sakarien, Milimulou, Sanglier), hauteur = haut de la pose de repos x 1,1
  chef_de_guerre_bouftou: { atlas: 'chef_de_guerre_bouftou', scale: 0.55, map: MONSTER_MAP(14 / 24, 'AnimAttaque1', { 0: 10 / 37, 1: 14 / 24, 2: 9 / 26 }), height: 210, multi: true },
  boufton_noir: { atlas: 'boufton_noir', scale: 0.55, map: MONSTER_MAP(9 / 32, 'AnimAttaque0', { 0: 9 / 32, 1: 8 / 17, 2: 39 / 78 }), height: 76, multi: true },
  ballotin_le_bouftou: { atlas: 'ballotin_le_bouftou', scale: 0.55, map: MONSTER_MAP(9 / 32, 'AnimAttaque0', { 0: 9 / 32, 1: 10 / 22, 2: 5 / 27 }), height: 119, multi: true },
  bouftou_noir: { atlas: 'bouftou_noir', scale: 0.55, map: MONSTER_MAP(9 / 32, 'AnimAttaque0', { 0: 9 / 32, 1: 10 / 22, 2: 5 / 27 }), height: 164, multi: true },
  piou_violet: { atlas: 'piou_violet', scale: 0.55, map: MONSTER_MAP(16 / 32, 'AnimAttaque1', { 1: 16 / 32, 2: 22 / 44 }), height: 132, multi: true },
  fouduglen_l_ecureuil: { atlas: 'ecurouille', scale: 0.61, map: MONSTER_MAP(8 / 28, 'AnimAttaque0', { 0: 8 / 28, 1: 16 / 26, 2: 18 / 37 }), height: 90, multi: true },
  piou_rouge: { atlas: 'piou_rouge', scale: 0.55, map: MONSTER_MAP(16 / 32, 'AnimAttaque1', { 1: 16 / 32, 2: 22 / 44 }), height: 133, multi: true },
  piou_vert: { atlas: 'piou_vert', scale: 0.55, map: MONSTER_MAP(16 / 32, 'AnimAttaque1', { 1: 16 / 32, 2: 22 / 44 }), height: 129, multi: true },
  piou_bleu: { atlas: 'piou_bleu', scale: 0.55, map: MONSTER_MAP(16 / 32, 'AnimAttaque1', { 1: 16 / 32, 2: 22 / 44 }), height: 133, multi: true },
  piou_rose: { atlas: 'piou_rose', scale: 0.55, map: MONSTER_MAP(16 / 32, 'AnimAttaque1', { 1: 16 / 32, 2: 22 / 44 }), height: 105, multi: true },
  piou_jaune: { atlas: 'piou_jaune', scale: 0.55, map: MONSTER_MAP(16 / 32, 'AnimAttaque1', { 1: 16 / 32, 2: 13 / 26 }), height: 118, multi: true },
  poutch_ingball: { atlas: 'poutch_ingball', scale: 0.55, map: MONSTER_MAP(9 / 31, 'AnimAttaque1', { 1: 9 / 31 }), height: 307, multi: true },
  martoa: { atlas: 'martoa', scale: 0.61, map: MONSTER_MAP(9 / 32, 'AnimAttaque0', { 0: 9 / 32, 1: 13 / 36 }), height: 133, multi: true },
  sherpoa: { atlas: 'sherpoa', scale: 0.55, map: MONSTER_MAP(12 / 38, 'AnimAttaque0', { 0: 12 / 38, 1: 14 / 33 }), height: 156, multi: true },
  douzdoa: { atlas: 'douzdoa', scale: 0.66, map: MONSTER_MAP(10 / 40, 'AnimAttaque0', { 0: 10 / 40, 1: 11 / 32 }), height: 178, multi: true },
  pikdoa: { atlas: 'pikdoa', scale: 0.55, map: MONSTER_MAP(12 / 37, 'AnimAttaque0', { 0: 12 / 37, 1: 9 / 30 }), height: 167, multi: true },
  prespic: { atlas: 'prespic', scale: 0.66, map: MONSTER_MAP(9 / 37, 'AnimAttaque0', { 0: 9 / 37, 1: 11 / 27 }), height: 115, multi: true },
  sanglier: { atlas: 'sanglier', scale: 1.03, map: MONSTER_MAP(10 / 25, 'AnimAttaque0', { 0: 10 / 25, 1: 8 / 26, 2: 19 / 39 }), height: 84, multi: true },
  milimulou: { atlas: 'milimulou', scale: 1.03, map: MONSTER_MAP(9 / 33, 'AnimAttaque1', { 0: 9 / 35, 1: 9 / 33 }), height: 155, multi: true },
  frakacia_leukocytine: { atlas: 'frakacia_leukocytine', scale: 0.55, map: MONSTER_MAP(14 / 26, 'AnimAttaque2', { 0: 14 / 21, 1: 14 / 21, 2: 14 / 26 }), height: 261, multi: true },
  ecurouille: { atlas: 'ecurouille', scale: 0.61, map: MONSTER_MAP(8 / 28, 'AnimAttaque0', { 0: 8 / 28, 1: 16 / 26, 2: 18 / 37 }), height: 90, multi: true },
  tofu_malade: { atlas: 'tofu_malade', scale: 0.61, map: MONSTER_MAP(8 / 30, 'AnimAttaque0', { 0: 8 / 30, 1: 8 / 30, 2: 50 / 100 }), height: 71, multi: true },
  arakne_malade: { atlas: 'arakne_malade', scale: 0.55, map: MONSTER_MAP(17 / 38, 'AnimAttaque0', { 0: 17 / 38, 1: 20 / 38 }), height: 54, multi: true },
  araknose: { atlas: 'araknose', scale: 0.55, map: MONSTER_MAP(10 / 40, 'AnimAttaque0', { 0: 10 / 40, 1: 16 / 37 }), height: 53, multi: true },
  arakmute: { atlas: 'arakmute', scale: 0.55, map: MONSTER_MAP(19 / 39, 'AnimAttaque1', { 0: 11 / 36, 1: 19 / 39 }), height: 64, multi: true },
  arakne_des_egouts: { atlas: 'arakne_des_egouts', scale: 0.71, map: MONSTER_MAP(11 / 28, 'AnimAttaque0', { 0: 11 / 28, 1: 12 / 32 }), height: 54, multi: true },
  scelerat_strubien: { atlas: 'scelerat_strubien', scale: 0.88, map: MONSTER_MAP(4 / 18, 'AnimAttaque0', { 0: 4 / 18, 1: 4 / 18, 2: 29 / 71 }), height: 63, multi: true },
  milirat_strubien: { atlas: 'milirat_strubien', scale: 0.61, map: MONSTER_MAP(18 / 34, 'AnimAttaque0', { 0: 18 / 34, 1: 10 / 34, 2: 8 / 29 }), height: 175, multi: true },
  ramane_strubien: { atlas: 'ramane_strubien', scale: 0.77, map: MONSTER_MAP(24 / 32, 'AnimAttaque2', { 0: 18 / 27, 1: 8 / 18, 2: 24 / 32 }), height: 131, multi: true },
  la_ouassingue: { atlas: 'la_ouassingue', scale: 0.66, map: MONSTER_MAP(19 / 41, 'AnimAttaque0', { 0: 19 / 41, 1: 45 / 56, 2: 19 / 41 }), height: 55, multi: true },
  le_ouassingue: { atlas: 'le_ouassingue', scale: 0.66, map: MONSTER_MAP(46 / 50, 'AnimAttaque1', { 0: 19 / 41, 1: 46 / 50, 2: 19 / 41 }), height: 56, multi: true },
  gargrouille: { atlas: 'gargrouille', scale: 0.55, map: MONSTER_MAP(9 / 32, 'AnimAttaque2', { 0: 7 / 22, 1: 7 / 24, 2: 9 / 32 }), height: 266, multi: true },
  garglyphe: { atlas: 'garglyphe', scale: 0.61, map: MONSTER_MAP(10 / 22, 'AnimAttaque0', { 0: 10 / 22, 1: 10 / 26 }), height: 219, multi: true },
  larve_bleue: { atlas: 'larve_bleue', scale: 0.71, map: MONSTER_MAP(6 / 27, 'AnimAttaque0', { 0: 6 / 27, 1: 10 / 25, 2: 7 / 26 }), height: 61, multi: true },
  larve_verte: { atlas: 'larve_verte', scale: 0.71, map: MONSTER_MAP(6 / 27, 'AnimAttaque0', { 0: 6 / 27, 1: 10 / 25 }), height: 52, multi: true },
  larve_orange: { atlas: 'larve_orange', scale: 0.71, map: MONSTER_MAP(6 / 27, 'AnimAttaque0', { 0: 6 / 27, 1: 10 / 25, 2: 7 / 26 }), height: 80, multi: true },
  dopeul_iop: { atlas: 'dopeul_iop', scale: 0.8, map: MONSTER_MAP(18 / 30, 'AnimAttaque0', { 0: 18 / 30, 1: 31 / 48, 2: 37 / 49 }), height: 124, multi: true },
  dopeul_cra: { atlas: 'dopeul_cra', scale: 0.8, map: MONSTER_MAP(18 / 30, 'AnimAttaque0', { 0: 18 / 30, 1: 31 / 48, 2: 37 / 49 }), height: 124, multi: true },
  sam_sagaz: { atlas: 'sam_sagaz', scale: 0.55, map: MONSTER_MAP(15 / 32, 'AnimAttaque1', { 0: 18 / 40, 1: 15 / 32, 2: 35 / 70 }), height: 204, multi: true },
  larve_jaune: { atlas: 'larve_jaune', scale: 0.71, map: MONSTER_MAP(6 / 27, 'AnimAttaque0', { 0: 6 / 27, 1: 10 / 25 }), height: 67, multi: true },
  tournesol_affame: { atlas: 'tournesol_affame', scale: 0.47, map: MONSTER_MAP(11 / 25, 'AnimAttaque0', { 0: 11 / 25, 1: 7 / 15, 2: 7 / 20 }), height: 400, multi: true },
  gardienne_champetre: { atlas: 'gardienne_champetre', scale: 0.55, map: MONSTER_MAP(10 / 23, 'AnimAttaque0', { 0: 10 / 23, 2: 18 / 37 }), height: 129, multi: true },
  pichon_orange: { atlas: 'pichon_orange', scale: 0.44, map: MONSTER_MAP(8 / 29, 'AnimAttaque0', { 0: 8 / 29, 1: 11 / 32 }), height: 147, multi: true },
  pichon_bleu: { atlas: 'pichon_bleu', scale: 0.44, map: MONSTER_MAP(5 / 31, 'AnimAttaque0', { 0: 5 / 31, 1: 7 / 27 }), height: 140, multi: true },
  pichon_blanc: { atlas: 'pichon_blanc', scale: 0.5, map: MONSTER_MAP(10 / 34, 'AnimAttaque0', { 0: 10 / 34, 1: 12 / 34 }), height: 148, multi: true },
  pichon_vert: { atlas: 'pichon_vert', scale: 0.69, map: MONSTER_MAP(10 / 32, 'AnimAttaque0', { 0: 10 / 32, 1: 8 / 30 }), height: 122, multi: true },
  pichon_kloune: { atlas: 'pichon_kloune', scale: 0.44, map: MONSTER_MAP(13 / 41, 'AnimAttaque0', { 0: 13 / 41, 1: 13 / 39 }), height: 141, multi: true },
  mob_l_eponge: { atlas: 'mob_l_eponge', scale: 0.71, map: MONSTER_MAP(10 / 25, 'AnimAttaque2', { 1: 21 / 46, 2: 10 / 25 }), height: 109, multi: true },
  cafarcher: { atlas: 'cafarcher', scale: 0.44, map: MONSTER_MAP(20 / 40, 'AnimAttaque0', { 0: 20 / 40, 1: 11 / 34, 2: 10 / 20 }), height: 354, multi: true },
  pyrasite: { atlas: 'pyrasite', scale: 0.69, map: MONSTER_MAP(38 / 60, 'AnimAttaque0', { 0: 38 / 60, 1: 10 / 33, 2: 29 / 59 }), height: 214, multi: true },
  mirgrillon: { atlas: 'mirgrillon', scale: 0.44, map: MONSTER_MAP(14 / 37, 'AnimAttaque0', { 0: 14 / 37, 1: 15 / 28, 2: 14 / 37 }), height: 479, multi: true },
  sakarien: { atlas: 'sakarien', scale: 0.69, map: MONSTER_MAP(11 / 27, 'AnimAttaque1', { 0: 23 / 48, 1: 11 / 27, 2: 19 / 39 }), height: 252, multi: true },
  ceglumen: { atlas: 'ceglumen', scale: 0.9, map: MONSTER_MAP(22 / 40, 'AnimAttaque1', { 0: 16 / 34, 1: 22 / 40, 2: 10 / 20 }), height: 352, multi: true },
  // Kankreblath (0.2b) : planche à SCALE 1,6 ; AnimAttaque1 (projectile qui part très loin) rendue à part, 30 frames, recalée sur le même pied
  kankreblath: { atlas: 'kankreblath', scale: 0.77, map: MONSTER_MAP(28 / 64, 'AnimAttaque0', { 0: 28 / 64, 1: 36 / 61, 2: 45 / 57 }), height: 244, multi: true },
};

/** Archimonstres d'Astrub (0.3, 15B ; tools/contenu/archimonstres.py) : dans Dofus, un archimonstre a le dessin de son monstre
 *  (même gfxId) à sa propre échelle officielle. Même planche, à cette échelle, un peu plus grand et doré comme ceux des Champs. */
for (const [k, d] of Object.entries(MONSTRES as Record<string, { archiDe?: string; archiEchelle?: number }>)) {
  const base = d.archiDe && LOOKS[d.archiDe];
  if (base && !LOOKS[k]) LOOKS[k] = { ...base, scale: base.scale * (d.archiEchelle ?? 1) * 1.15, tint: GOLD };
}

/** PNJ dans le monde (planches tools/extraction/monster_planche.py, PNJ=1, SCALE = 1,32 x échelle officielle du look).
 *  Dofus montre un PNJ immobile (AnimStatique, une seule image) qui joue de temps en temps une de ses animations « fun »
 *  (npcsdataroot.animFunList : nom et poids du tirage). `scale` = échelle d'affichage (0,82 comme le perso : même netteté).
 *  Ganymède n'a que l'orientation 3, animée en boucle (60 images). */
export interface PnjLook { scale: number; anim: string; boucle?: number; fun?: [string, number][] }
export const PNJ_LOOKS: Record<string, PnjLook> = {
  ganymede: { scale: 0.82, anim: 'AnimStatique_3', boucle: 60 },
  ternette: { scale: 0.82, anim: 'AnimStatique_1', fun: [['AnimAttaque0_1', 8], ['AnimAttaque1_1', 6], ['AnimAttaque2_1', 4]] },
  lykhen: { scale: 0.82, anim: 'AnimStatique_1', fun: [['AnimAttaque0_1', 9], ['AnimAttaque1_1', 7], ['AnimAttaque2_1', 5]] },
  fecaline: { scale: 0.82, anim: 'AnimStatique_1' },
  berb_nhin: { scale: 0.82, anim: 'AnimStatique_1', fun: [['AnimAttaque0_1', 9], ['AnimAttaque1_1', 5], ['AnimAttaque2_1', 3]] },
  capitaine: { scale: 0.82, anim: 'AnimStatique_1', fun: [['AnimAttaque0_1', 9], ['AnimAttaque1_1', 7], ['AnimAttaque2_1', 5], ['AnimAttaque3_1', 3]] },
  klasmor: { scale: 0.82, anim: 'AnimStatique_1', fun: [['AnimAttaque0_1', 9], ['AnimAttaque1_1', 7], ['AnimAttaque2_1', 4]] },
  anta_brok: { scale: 0.82, anim: 'AnimStatique_1', fun: [['AnimAttaque0_1', 9], ['AnimAttaque1_1', 7], ['AnimAttaque2_1', 7], ['AnimAttaque3_1', 4]] },
  // Emp, le Méryde du Recyclage (PNJ 1640, look {1979|1981|1=15788464}) : animFunList officielle
  emp: { scale: 0.82, anim: 'AnimStatique_1', fun: [['AnimAttaque0_1', 2], ['AnimAttaque12_1', 2], ['AnimAttaque13_1', 1], ['AnimAttaque15_1', 3], ['AnimAttaque2_1', 2], ['AnimAttaque4_1', 3], ['AnimAttaque8_1', 1], ['AnimAttaque5_1', 1]] },
  marylork: { scale: 0.82, anim: 'AnimStatique_1', fun: [['AnimAttaque0_1', 3], ['AnimAttaque1_1', 1]] },
  // gardiens des donjons d'Astrub (maquette Gardiens) : Mawy Ingalsse {4980|||90}, Capitaine Igloute {4981|||95} (sans anim fun),
  // Rotabla le berger {950} (animFunList officielle)
  mawy: { scale: 0.82, anim: 'AnimStatique_1' },
  igloute: { scale: 0.82, anim: 'AnimStatique_1' },
  rotabla: { scale: 0.82, anim: 'AnimStatique_1', fun: [['AnimAttaque0_1', 1], ['AnimAttaque1_1', 2], ['AnimAttaque2_1', 3]] },
  // Cloportier (PNJ 2766, {3050}), gardien de la Cache de Kankreblath
  // Metag Robill (PNJ 4370, {1125}), qui donne le tour du monde devant la Grange
  metag: { scale: 0.82, anim: 'AnimStatique_1' },
  geolier: { scale: 0.74, anim: 'AnimStatique_1' },
  cindy: { scale: 0.74, anim: 'AnimStatique_1' },
  temples: { scale: 0.66, anim: 'AnimStatique_1' },
  hazel: { scale: 0.82, anim: 'AnimStatique_1' },
  nepra: { scale: 0.74, anim: 'AnimStatique_1' },
  jim: { scale: 0.74, anim: 'AnimStatique_1' },
  seldawa: { scale: 0.82, anim: 'AnimStatique_1' },
  sept: { scale: 0.82, anim: 'AnimStatique_1' },
  becky: { scale: 0.82, anim: 'AnimStatique_1' },
  cloportier: { scale: 0.82, anim: 'AnimStatique_1' },
  // PNJ du Havre-Sac (maquette Hub 3A) : Kerubim Crépin (PNJ 3043, {2841|||130}), Otomaï (PNJ 914, {891|||84}, animFunList officielle),
  // Goultard (PNJ 1216, {7551|||155}, repos animé en boucle), Tissebelle et Mère Bouillotte (looks des Prêtresses de Sadida et de Pandawa)
  kerubim: { scale: 0.82, anim: 'AnimStatique_1', fun: [['AnimAttaque0_1', 1], ['AnimAttaque1_1', 1]] },
  otomai: { scale: 0.82, anim: 'AnimStatique_1', fun: [['AnimAttaque0_1', 1], ['AnimAttaque1_1', 2]] },
  goultard: { scale: 0.82, anim: 'AnimStatique_1', boucle: 48 },
  tissebelle: { scale: 0.82, anim: 'AnimStatique_1' },
  bouillotte: { scale: 0.82, anim: 'AnimStatique_1' },
  // Forgemage du Bastion (maquette « Forgemagie ») : look officiel du « Vendeur de runes de Forgemagie » (PNJ 7379, {6201}), sans anim fun
  forgemage: { scale: 0.82, anim: 'AnimStatique_1' },
};
