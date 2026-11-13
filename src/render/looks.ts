import MONSTRES from '../data/monsters.json';
/** Apparence de chaque entité : quelle planche, quelle échelle, et quelle animation Dofus
 *  jouer pour chaque état de gameplay. from/to = fractions de l'animation d'origine,
 *  choisies pour que la frame d'impact tombe au moment du dégât. */

/** `diag` : seulement les diagonales (comme une animation à 2 orientations), même si l'animation en a d'autres. */
export interface AnimSlice { anim: string; from?: number; to?: number; loop?: boolean; fps?: number; diag?: boolean }
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

/** Monstre immobile (invocation officielle : Cawotte Woyale, Wobot Tamponneur) : il ne court ni ne frappe. */
const FIXE_MAP: Record<string, AnimSlice> = { idle: { anim: 'AnimStatique' }, spawn: { anim: 'AnimStatique' }, run: { anim: 'AnimStatique' },
  windup: { anim: 'AnimStatique' }, slam_charge: { anim: 'AnimStatique' }, lunge: { anim: 'AnimStatique' }, stun: { anim: 'AnimHit', loop: true, fps: 20 }, die: { anim: 'AnimMort' } };

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
  // Sorts 61-90 (0.6) : Friction et Précipitation 806, Épée du Destin 800, Emprise 802
  friction: { anim: 'AnimAttaque806', from: 0, to: 0.6 },
  precipitation: { anim: 'AnimAttaque806', from: 0, to: 0.6 },
  epee_destin: { anim: 'AnimAttaque800', from: 0.4, to: 1 },
  emprise: { anim: 'AnimAttaque802', from: 0.1, to: 0.75 },
  // Sorts 25-60 (0.6) : Vitalité, Puissance et Vertu 814 ; Souffle, Épée Destructrice, Tempête de Puissance, Endurance 801 ; Épée de Iop 803
  vitalite_iop: { anim: 'AnimAttaque814', from: 0, to: 0.33 },
  puissance_iop: { anim: 'AnimAttaque814', from: 0, to: 0.33 },
  vertu: { anim: 'AnimAttaque814', from: 0, to: 0.33 },
  souffle: { anim: 'AnimAttaque801', from: 6 / 32, to: 1 },
  epee_destructrice: { anim: 'AnimAttaque801', from: 6 / 32, to: 1 },
  tempete: { anim: 'AnimAttaque801', from: 6 / 32, to: 1 },
  endurance: { anim: 'AnimAttaque801', from: 6 / 32, to: 1 },
  epee_iop: { anim: 'AnimAttaque803', from: 0, to: 0.6 },
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
  // Sorts 61-90 (0.6) : Tir de Repli 905, Punitive 913, Expiation 918, Perforante 919, Dévorante 912, Acuité Absolue 902
  tir_repli: { anim: 'AnimAttaque905', from: 0, to: 0.6 },
  punitive: { anim: 'AnimAttaque913', from: 0, to: 0.62 },
  expiation: { anim: 'AnimAttaque918', from: 0, to: 0.62 },
  perforante: { anim: 'AnimAttaque919', from: 0, to: 0.82 },
  devorante: { anim: 'AnimAttaque912', from: 0, to: 0.6 },
  acuite: { anim: 'AnimAttaque902', from: 0, to: 0.6 },
  // Sorts 25-60 (0.6) : Immobilisation et Œil de Taupe 914, Tirs Puissants et Œil pour Œil 902
  immobilisation: { anim: 'AnimAttaque914', from: 0, to: 0.6 },
  oeil_taupe: { anim: 'AnimAttaque914', from: 0, to: 0.6 },
  tirs_puissants: { anim: 'AnimAttaque902', from: 0, to: 0.6 },
  oeil_pour_oeil: { anim: 'AnimAttaque902', from: 0, to: 0.6 },
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
  // Sorts 61-90 (0.6) : invocations 204
  ventritofu: { anim: 'AnimAttaque204', from: 0, to: 0.7 },
  bouflourd: { anim: 'AnimAttaque204', from: 0, to: 0.7 },
  crapipaud: { anim: 'AnimAttaque204', from: 0, to: 0.7 },
  dragonnet: { anim: 'AnimAttaque204', from: 0, to: 0.7 },
  esprit_glouton: { anim: 'AnimAttaque204', from: 0, to: 0.7 },
  hit: { anim: 'AnimHit', from: 0, to: 1 },
  die: { anim: 'AnimMort', from: 0, to: 0.75 },
};

// Sacrieur : squelette joueur n° 1 + skin 110 (corps), animations officielles (spellscripts « animId:11xx », maquette Sacrieur 9A) :
// Absorption 1110, Hémorragie et Supplice 1102, Stase et Hostilité 1103, Attirance 1112, Mutilation et Couronne d'Épines 1100,
// Épée Vorace, Transposition, Condensation et Dissolution 1101, Ravage 1114, Assaut 1104, Transfusion 1105, Désolation 1111.
const SAC_MAP: Record<string, AnimSlice> = {
  ...WEAPON_MAP,
  idle: { anim: 'AnimStatiqueExplo0', loop: true, fps: 20 },
  run: { anim: 'AnimCourse', loop: true, fps: 32 },
  attack1: { anim: 'AnimArme0', from: 3 / 28, to: 17 / 28 },
  attack2: { anim: 'AnimArme0', from: 3 / 28, to: 17 / 28 },
  attack3: { anim: 'AnimArme0', from: 3 / 28, to: 24 / 28 },
  absorption: { anim: 'AnimAttaque1110', from: 0, to: 0.65 },
  hemorragie: { anim: 'AnimAttaque1102', from: 0, to: 0.65 },
  supplice: { anim: 'AnimAttaque1102', from: 0, to: 0.65 },
  stase: { anim: 'AnimAttaque1103', from: 0, to: 0.65 },
  attirance: { anim: 'AnimAttaque1112', from: 0, to: 0.65 },
  mutilation: { anim: 'AnimAttaque1100', from: 0, to: 0.65 },
  epee_vorace: { anim: 'AnimAttaque1101', from: 0, to: 0.65 },
  ravage: { anim: 'AnimAttaque1114', from: 0, to: 0.65 },
  assaut: { anim: 'AnimAttaque1104', from: 0, to: 0.65 },
  transposition: { anim: 'AnimAttaque1101', from: 0, to: 0.65 },
  condensation: { anim: 'AnimAttaque1101', from: 0, to: 0.65 },
  hostilite: { anim: 'AnimAttaque1103', from: 0, to: 0.65 },
  couronne: { anim: 'AnimAttaque1100', from: 0, to: 0.65 },
  transfusion: { anim: 'AnimAttaque1105', from: 0, to: 0.65 },
  dissolution: { anim: 'AnimAttaque1101', from: 0, to: 0.65 },
  desolation: { anim: 'AnimAttaque1111', from: 0, to: 0.65 },
  // Sorts 61-90 (0.6) : Sacrifice et Hécatombe 1101, Bain de Sang 1106, Libation 1100, Berserk 1116, Punition 1109
  sacrifice: { anim: 'AnimAttaque1101', from: 0, to: 0.65 },
  bain_sang: { anim: 'AnimAttaque1106', from: 0, to: 0.65 },
  hecatombe: { anim: 'AnimAttaque1101', from: 0, to: 0.65 },
  libation: { anim: 'AnimAttaque1100', from: 0, to: 0.65 },
  berserk: { anim: 'AnimAttaque1116', from: 0, to: 0.65 },
  punition: { anim: 'AnimAttaque1109', from: 0, to: 0.65 },
  hit: { anim: 'AnimHit', from: 0, to: 1 },
  die: { anim: 'AnimMort', from: 0, to: 0.75 },
};

// Forgelance : squelette joueur n° 1 + skin 3221 (corps), animations officielles (spellscripts casterAnimation, maquette Forgelance 13A) :
// planter la Lance 2000 (Épilogue, Lance du Lac, Lance-pierre, Lance à Incendie, Javeline de Myr), Estoc Brûlant 2001,
// Volée d'Airain et Kyrja 2003, Prélude au Fer 2005, Trident, Charge Héroïque, Balestra et Talon d'Argile 2008,
// Effondrement, Phalange et Muspel 2012. L'estoc de base reprend le geste officiel de la Lance (AnimArme271).
const FL_MAP: Record<string, AnimSlice> = {
  ...WEAPON_MAP,
  idle: { anim: 'AnimStatiqueExplo0', loop: true, fps: 20 },
  run: { anim: 'AnimCourse', loop: true, fps: 32 },
  // Armé : Lance en main (skin 3650). La pose d'exploration et la course de face, de dos et de profil n'ont pas de nœud de Lance
  // dans le squelette officiel : garde de combat au repos, course en diagonale seulement.
  idle_arme: { anim: 'AnimStatiqueCombat0', loop: true, fps: 20 },
  run_arme: { anim: 'AnimCourse', loop: true, fps: 32, diag: true },
  attack1: { anim: 'AnimArme0', from: 3 / 28, to: 17 / 28 },
  attack2: { anim: 'AnimArme0', from: 3 / 28, to: 17 / 28 },
  attack3: { anim: 'AnimArme0', from: 3 / 28, to: 24 / 28 },
  ...Object.fromEntries(Object.entries({
    trident: 2008, effondrement: 2012, estoc_brulant: 2001, volee_airain: 2003, epilogue: 2000, charge_heroique: 2008, lance_lac: 2000,
    lance_pierre: 2000, phalange: 2012, lance_incendie: 2000, javeline_myr: 2000, balestra: 2008, talon_argile: 2008, kyrja: 2003,
    muspel: 2012, prelude_fer: 2005, saut: 2008,
    // sorts 61-90 (0.6) : Terre du Milieu 2012, Chevalerie 2010, Jormun 2002, Poinçon 2000, Noa 2005 ; Éclipse n'a pas d'animation officielle (2010)
    terre_milieu: 2012, chevalerie: 2010, jormun: 2002, poincon: 2000, noa: 2005, eclipse: 2010,
  }).map(([k, n]) => [k, { anim: `AnimAttaque${n}`, from: 0, to: 0.65 }])),
  hit: { anim: 'AnimHit', from: 0, to: 1 },
  die: { anim: 'AnimMort', from: 0, to: 0.75 },
};

// Eniripsa : squelette joueur n° 1 + skin 70/71 (corps), animations officielles (spellscripts casterAnimation, maquette Eniripsa 12A) :
// Mot d'Amitié 700 ; Mots Stimulant, de Lamentations, Vivifiant, de Jouvence, de Reconstitution 702 ; Farceur et d'Envol 703 ;
// Espiègle, Interdit, Accablant 704 ; Juron, de Frayeur, de Peinture 705 ; Vampirique 707 ; Tapageur et Turbulent 708 ; Cri de Guerre 709.
const ENI_MAP: Record<string, AnimSlice> = {
  ...WEAPON_MAP,
  idle: { anim: 'AnimStatiqueExplo0', loop: true, fps: 20 },
  run: { anim: 'AnimCourse', loop: true, fps: 32 },
  attack1: { anim: 'AnimArme0', from: 3 / 28, to: 17 / 28 },
  attack2: { anim: 'AnimArme0', from: 3 / 28, to: 17 / 28 },
  attack3: { anim: 'AnimArme0', from: 3 / 28, to: 24 / 28 },
  ...Object.fromEntries(Object.entries({
    amitie: 700, stimulant: 702, lamentations: 702, vivifiant: 702, jouvence: 702, reconstitution: 702, farceur: 703, envol: 703,
    espiegle: 704, interdit: 704, accablant: 704, juron: 705, frayeur: 705, peinture: 705, vampirique: 707, tapageur: 708, turbulent: 708,
    cri_guerre: 709,
    // sorts 61-90 (0.6) : Chapardage 707, Mot Fleuri 700, Pinceau Tribal 709, Cryothérapie 700
    chapardage: 707, fleuri: 700, pinceau: 709, cryotherapie: 700,
  }).map(([k, n]) => [k, { anim: `AnimAttaque${n}`, from: 0, to: 0.65 }])),
  hit: { anim: 'AnimHit', from: 0, to: 1 },
  die: { anim: 'AnimMort', from: 0, to: 0.75 },
};

// Enutrof : squelette joueur n° 1 + skin 30/31 (corps), animations officielles (spellscripts casterAnimation, maquette Enutrof 12A) :
// Lancer de Pièces 300 ; Force de l'Âge 301 ; invocations (Sac, Pelle, Coffre, Malle) 302 ; Roulage de Pelle, Pelle Aurifère 303 ;
// Opportunité 304 ; Remblai, Clef du Trésor, Avarice 305 ; Ruée vers l'Or, Boîte de Pandore, Pelle Fantomatique 306 ; Souterrain 307 ;
// Abattement 308 ; Maladresse 310 ; Banqueroute 312.
const ENU_MAP: Record<string, AnimSlice> = {
  ...WEAPON_MAP,
  idle: { anim: 'AnimStatiqueExplo0', loop: true, fps: 20 },
  run: { anim: 'AnimCourse', loop: true, fps: 32 },
  attack1: { anim: 'AnimArme0', from: 3 / 28, to: 17 / 28 },
  attack2: { anim: 'AnimArme0', from: 3 / 28, to: 17 / 28 },
  attack3: { anim: 'AnimArme0', from: 3 / 28, to: 24 / 28 },
  ...Object.fromEntries(Object.entries({
    lancer_pieces: 300, force_age: 301, sac_anime: 302, pelle_animee: 302, coffre_anime: 302, malle_animee: 302, roulage_pelle: 303,
    pelle_aurifere: 303, opportunite: 304, remblai: 305, clef_tresor: 305, avarice: 305, ruee_or: 306, boite_pandore: 306,
    pelle_fantomatique: 306, souterrain: 307, abattement: 308, maladresse: 310, banqueroute: 312,
    // sorts 61-90 (0.6) : Pelle des Anciens et Péremption 305, Corruption 309, Retraite Anticipée 306
    pelle_anciens: 305, peremption: 305, corruption: 309, retraite: 306,
  }).map(([k, n]) => [k, { anim: `AnimAttaque${n}`, from: 0, to: 0.65 }])),
  hit: { anim: 'AnimHit', from: 0, to: 1 },
  die: { anim: 'AnimMort', from: 0, to: 0.75 },
};

// Écaflip : squelette joueur n° 1 + skin 60/61 (corps), animations officielles (spellscripts casterAnimation, maquette Écaflip 12A) :
// Griffe Invocatrice 601 ; Yams, Pelotage 602 ; Perception 603 ; Pile ou Face 604 ; Jass, Baraka, Blakjak, Belote, Tromperie 606 ;
// Réflexes 607 ; Topkaj 608 ; Bonne Pioche 611 ; Roulette 612 ; Château de Cartes 6 ; Bond du Félin 4.
const ECA_MAP: Record<string, AnimSlice> = {
  ...WEAPON_MAP,
  idle: { anim: 'AnimStatiqueExplo0', loop: true, fps: 20 },
  run: { anim: 'AnimCourse', loop: true, fps: 32 },
  attack1: { anim: 'AnimArme0', from: 3 / 28, to: 17 / 28 },
  attack2: { anim: 'AnimArme0', from: 3 / 28, to: 17 / 28 },
  attack3: { anim: 'AnimArme0', from: 3 / 28, to: 24 / 28 },
  ...Object.fromEntries(Object.entries({
    griffe_invocatrice: 601, yams: 602, pelotage: 602, perception: 603, pile_face: 604, jass: 606, baraka: 606, blakjak: 606, belote: 606,
    tromperie: 606, reflexes: 607, topkaj: 608, bonne_pioche: 611, roulette: 612, chateau_cartes: 6, bond_felin: 4,
    // sorts 61-90 (0.6) : Esprit Félin 605, Odorat 601, Coussinets et Félintion 602, Seconde Chance 603, Bluff 613
    esprit_felin: 605, odorat: 601, coussinets: 602, felintion: 602, seconde_chance: 603, bluff: 613,
  }).map(([k, n]) => [k, { anim: `AnimAttaque${n}`, from: 0, to: 0.65 }])),
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
  // Sacrieur : dessiné en direct depuis son squelette, comme l'Osamodas
  sacrieur: { atlas: 'sacrieur', scale: 0.82, map: SAC_MAP, height: 120, ignoreZ: true, portraitZoom: 1.7, multi: true },
  // Forgelance : dessiné en direct depuis son squelette, comme l'Osamodas et le Sacrieur
  forgelance: { atlas: 'forgelance', scale: 0.82, map: FL_MAP, height: 120, ignoreZ: true, portraitZoom: 1.7, multi: true },
  // Eniripsa : dessiné en direct depuis son squelette, comme les autres classes
  eniripsa: { atlas: 'eniripsa', scale: 0.82, map: ENI_MAP, height: 120, ignoreZ: true, portraitZoom: 1.7, multi: true },
  // Enutrof : dessiné en direct depuis son squelette, comme les autres classes
  enutrof: { atlas: 'enutrof', scale: 0.82, map: ENU_MAP, height: 120, ignoreZ: true, portraitZoom: 1.7, multi: true },
  // Écaflip : dessiné en direct depuis son squelette, comme les autres classes
  ecaflip: { atlas: 'ecaflip', scale: 0.82, map: ECA_MAP, height: 120, ignoreZ: true, portraitZoom: 1.7, multi: true },
  // Chaton Enragé de l'Écaflip (monster_planche.py, os 289, SCALE 2,5) : Griffe Invocatrice
  eca_chaton: { atlas: 'eca_chaton', scale: 0.5, map: MONSTER_MAP(11 / 30, 'AnimAttaque0', { 0: 11 / 30, 1: 21 / 44 }), height: 60, multi: true },
  // Invocations de l'Enutrof (monster_planche.py, os 4147, 4156, 4166, SCALE 2,5) : Sac Animé, Pelle Animée, coffre au trésor (Coffre Animé)
  enu_sac: { atlas: 'enu_sac', scale: 0.5, map: MONSTER_MAP(23 / 42, 'AnimAttaque0', { 0: 23 / 42, 1: 18 / 36 }), height: 70, multi: true },
  enu_pelle: { atlas: 'enu_pelle', scale: 0.5, map: MONSTER_MAP(25 / 37, 'AnimAttaque0', { 0: 25 / 37 }), height: 80, multi: true },
  enu_coffre: { atlas: 'enu_coffre', scale: 0.45, map: { ...MONSTER_MAP(21 / 33, 'AnimAttaque0', { 0: 21 / 33, 1: 9 / 32 }), ouvre: { anim: 'AnimAttaque0' } }, height: 70, multi: true },   // ouvre : interface du coffre 7D
  // Bêtes de l'Eniripsa (monster_planche.py, os 7599 SCALE 2,5, os 7600 et 7601) : Lapino, Fées, Feux Follets
  eni_lapino: { atlas: 'eni_lapino', scale: 0.55, map: MONSTER_MAP(13 / 37, 'AnimAttaque0', { 0: 13 / 37, 1: 10 / 29, 2: 28 / 31 }), height: 80, multi: true },
  eni_fee: { atlas: 'eni_fee', scale: 0.45, map: MONSTER_MAP(23 / 37), height: 60, multi: true },
  eni_feu_follet: { atlas: 'eni_feu_follet', scale: 0.45, map: MONSTER_MAP(23 / 37), height: 60, multi: true },
  // Lance Immortelle plantée (monster_planche.py, os 7139, animations rangées dans le squelette) : décor du Forgelance Désarmé
  forgelance_lance: { atlas: 'forgelance_lance', scale: 0.4, map: MONSTER_MAP(13 / 60), height: 90, multi: true },
  // Épées du Sacrieur (monster_planche.py, os 8378 et 8376, SCALE 2,5) : invocations alliées (maquette Sacrieur 7A)
  sacri_epee_vorace: { atlas: 'sacri_epee_vorace', scale: 0.55, map: MONSTER_MAP(7 / 55, 'AnimAttaque0', { 0: 7 / 55, 1: 12 / 47 }), height: 110, multi: true },
  sacri_epee_dansante: { atlas: 'sacri_epee_dansante', scale: 0.55, map: MONSTER_MAP(9 / 36, 'AnimAttaque0', { 0: 9 / 36, 1: 12 / 47 }), height: 110, multi: true },
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
  // Monstres des 11 donjons de la 0.4 (arènes, ligne « Arènes finales : 1A 2A ») : monster_planche.py, liste dans tools/extraction/arenes04/lot_monstres.json
  scarafeuille_rouge: { atlas: 'scarafeuille_rouge', scale: 0.64, map: MONSTER_MAP(16/28, 'AnimAttaque0', { 0: 16/28, 1: 17/31 }), height: 225, multi: true },
  scarafeuille_bleu: { atlas: 'scarafeuille_bleu', scale: 0.64, map: MONSTER_MAP(16/28, 'AnimAttaque0', { 0: 16/28, 1: 17/31 }), height: 225, multi: true },
  scarafeuille_blanc: { atlas: 'scarafeuille_blanc', scale: 0.64, map: MONSTER_MAP(16/28, 'AnimAttaque0', { 0: 16/28, 1: 17/31 }), height: 226, multi: true },
  scarafeuille_noir: { atlas: 'scarafeuille_noir', scale: 0.64, map: MONSTER_MAP(16/28, 'AnimAttaque0', { 0: 16/28, 1: 17/31 }), height: 225, multi: true },
  scarafeuille_vert: { atlas: 'scarafeuille_vert', scale: 0.64, map: MONSTER_MAP(16/28, 'AnimAttaque0', { 0: 16/28, 1: 17/31 }), height: 225, multi: true },
  scarabosse_dore: { atlas: 'scarabosse_dore', scale: 0.88, map: MONSTER_MAP(15/30, 'AnimAttaque0', { 0: 15/30, 1: 14/30 }), height: 279, multi: true },
  scarafeuille_immature: { atlas: 'scarafeuille_immature', scale: 0.51, map: MONSTER_MAP(17/29, 'AnimAttaque0', { 0: 17/29, 1: 14/30 }), height: 133, multi: true },
  chafer_ronin: { atlas: 'chafer_ronin', scale: 0.88, map: MONSTER_MAP(12/25, 'AnimAttaque0', { 0: 12/25, 1: 11/23, 2: 23/34 }), height: 322, multi: true },
  chafer_primitif: { atlas: 'chafer_primitif', scale: 0.64, map: MONSTER_MAP(9/25, 'AnimAttaque0', { 0: 9/25, 1: 12/28, 2: 11/23 }), height: 233, multi: true },
  tofu_amakna: { atlas: 'tofu_amakna', scale: 0.7, map: MONSTER_MAP(9/30, 'AnimAttaque0', { 0: 9/30 }), height: 78, multi: true },
  tofu_noir: { atlas: 'tofu_noir', scale: 0.77, map: MONSTER_MAP(8/30, 'AnimAttaque0', { 0: 8/30 }), height: 83, multi: true },
  batofu: { atlas: 'batofu', scale: 1.06, map: MONSTER_MAP(27/39, 'AnimAttaque0', { 0: 27/39, 1: 24/37 }), height: 86, multi: true },
  tofoune: { atlas: 'tofoune', scale: 0.64, map: MONSTER_MAP(10/29, 'AnimAttaque0', { 0: 10/29, 1: 19/34 }), height: 219, multi: true },
  tofukaz: { atlas: 'tofukaz', scale: 0.64, map: MONSTER_MAP(8/30, 'AnimAttaque1', { 1: 8/30 }), height: 78, multi: true },
  tofu_ventripotent: { atlas: 'tofu_ventripotent', scale: 0.77, map: MONSTER_MAP(21/44, 'AnimAttaque1', { 1: 21/44 }), height: 119, multi: true },
  tofu_mutant: { atlas: 'tofu_mutant', scale: 0.51, map: MONSTER_MAP(8/32, 'AnimAttaque1', { 1: 8/32, 2: 6/74 }), height: 145, multi: true },
  gob_trotteur: { atlas: 'gob_trotteur', scale: 0.64, map: MONSTER_MAP(19/39, 'AnimAttaque0', { 0: 19/39, 1: 14/42 }), height: 290, multi: true },
  gobet: { atlas: 'gobet', scale: 0.64, map: MONSTER_MAP(18/44, 'AnimAttaque0', { 0: 18/44, 1: 15/50 }), height: 206, multi: true },
  gobichon: { atlas: 'gobichon', scale: 0.64, map: MONSTER_MAP(14/32, 'AnimAttaque0', { 0: 14/32, 1: 9/33 }), height: 175, multi: true },
  gobaliste: { atlas: 'gobaliste', scale: 0.64, map: MONSTER_MAP(26/50, 'AnimAttaque0', { 0: 26/50, 1: 26/50 }), height: 115, multi: true },
  gobaladee: { atlas: 'gobaladee', scale: 0.64, map: MONSTER_MAP(34/47, 'AnimAttaque0', { 0: 34/47, 1: 6/47 }), height: 121, multi: true },
  directeur_grunob: { atlas: 'directeur_grunob', scale: 0.88, map: MONSTER_MAP(6/45, 'AnimAttaque0', { 0: 6/45, 1: 3/35, 2: 13/45 }), height: 175, multi: true },
  bwork_mage: { atlas: 'bwork_mage', scale: 0.74, map: MONSTER_MAP(20/25, 'AnimAttaque1', { 1: 20/25, 2: 20/28 }), height: 185, multi: true },
  bwork_archer: { atlas: 'bwork_archer', scale: 0.9, map: MONSTER_MAP(24/40, 'AnimAttaque2', { 2: 24/40, 901: 22/36, 902: 22/36 }), height: 170, multi: true },
  trooll_apprivoise: { atlas: 'trooll_apprivoise', scale: 0.64, map: MONSTER_MAP(25/38, 'AnimAttaque1', { 1: 25/38, 2: 6/49 }), height: 367, multi: true },
  bworkette: { atlas: 'bworkette', scale: 1.38, map: MONSTER_MAP(24/38, 'AnimAttaque0', { 0: 24/38, 1: 13/28, 2: 36/47 }), height: 190, multi: true },
  bwork: { atlas: 'bwork', scale: 0.74, map: MONSTER_MAP(9/27, 'AnimAttaque0', { 0: 9/27, 2: 9/27 }), height: 198, multi: true },
  kreuvete_la_bwork_ingenue: { atlas: 'kreuvete_la_bwork_ingenue', scale: 0.7, map: MONSTER_MAP(11/24, 'AnimAttaque0', { 0: 11/24, 2: 11/24 }), height: 260, multi: true },
  mineur_sombre: { atlas: 'mineur_sombre', scale: 0.64, map: MONSTER_MAP(12/23, 'AnimAttaque0', { 0: 12/23, 2: 4/20, 9: 10/22 }), height: 241, multi: true },
  forgeron_sombre: { atlas: 'forgeron_sombre', scale: 1.2, map: MONSTER_MAP(14/34, 'AnimAttaque0', { 0: 14/34, 1: 4/27 }), height: 181, multi: true },
  boulanger_sombre: { atlas: 'boulanger_sombre', scale: 0.64, map: MONSTER_MAP(11/27, 'AnimAttaque0', { 0: 11/27, 1: 9/25 }), height: 309, multi: true },
  bandit_du_clan_des_roublards: { atlas: 'bandit_du_clan_des_roublards', scale: 0.64, map: MONSTER_MAP(15/28, 'AnimAttaque0', { 0: 15/28, 1: 9/27 }), height: 259, multi: true },
  coffre_des_forgerons: { atlas: 'coffre_des_forgerons', scale: 1.06, map: MONSTER_MAP(11/47, 'AnimAttaque1', { 1: 11/47, 2: 12/35 }), height: 107, multi: true },
  kwak_de_vent: { atlas: 'kwak_de_vent', scale: 0.64, map: MONSTER_MAP(11/20, 'AnimAttaque0', { 0: 11/20, 1: 5/15 }), height: 191, multi: true },
  kwak_de_flamme: { atlas: 'kwak_de_flamme', scale: 0.64, map: MONSTER_MAP(11/20, 'AnimAttaque0', { 0: 11/20, 1: 5/15 }), height: 192, multi: true },
  kwak_de_glace: { atlas: 'kwak_de_glace', scale: 0.64, map: MONSTER_MAP(11/20, 'AnimAttaque0', { 0: 11/20, 1: 5/15 }), height: 193, multi: true },
  kwak_de_terre: { atlas: 'kwak_de_terre', scale: 0.64, map: MONSTER_MAP(11/20, 'AnimAttaque0', { 0: 11/20, 1: 5/15 }), height: 193, multi: true },
  kwakere_de_flamme: { atlas: 'kwakere_de_flamme', scale: 1.09, map: MONSTER_MAP(13/32, 'AnimAttaque0', { 0: 13/32, 1: 6/40, 2: 6/40 }), height: 148, multi: true },
  kwakere_de_terre: { atlas: 'kwakere_de_terre', scale: 1.09, map: MONSTER_MAP(13/32, 'AnimAttaque0', { 0: 13/32, 1: 6/40, 2: 6/40 }), height: 149, multi: true },
  kwakere_de_glace: { atlas: 'kwakere_de_glace', scale: 1.09, map: MONSTER_MAP(13/32, 'AnimAttaque0', { 0: 13/32, 1: 6/40, 2: 6/40 }), height: 150, multi: true },
  kwakere_de_vent: { atlas: 'kwakere_de_vent', scale: 1.09, map: MONSTER_MAP(13/32, 'AnimAttaque0', { 0: 13/32, 1: 6/40, 2: 6/40 }), height: 148, multi: true },
  kwakwa: { atlas: 'kwakwa', scale: 1.32, map: MONSTER_MAP(6/18, 'AnimAttaque0', { 0: 6/18, 1: 6/20, 2: 5/20 }), height: 301, multi: true },
  bwak_de_vent: { atlas: 'bwak_de_vent', scale: 0.64, map: MONSTER_MAP(4/23, 'AnimAttaque0', { 0: 4/23 }), height: 103, multi: true },
  bwak_de_glace: { atlas: 'bwak_de_glace', scale: 0.64, map: MONSTER_MAP(4/23, 'AnimAttaque0', { 0: 4/23 }), height: 103, multi: true },
  bwak_de_flamme: { atlas: 'bwak_de_flamme', scale: 0.64, map: MONSTER_MAP(4/23, 'AnimAttaque0', { 0: 4/23 }), height: 102, multi: true },
  bwak_de_terre: { atlas: 'bwak_de_terre', scale: 0.64, map: MONSTER_MAP(4/23, 'AnimAttaque0', { 0: 4/23 }), height: 104, multi: true },
  larve_saphir: { atlas: 'larve_saphir', scale: 1.02, map: MONSTER_MAP(12/24, 'AnimAttaque0', { 0: 12/24, 1: 9/18 }), height: 57, multi: true },
  larve_rubis: { atlas: 'larve_rubis', scale: 1.02, map: MONSTER_MAP(12/24, 'AnimAttaque0', { 0: 12/24, 1: 9/18 }), height: 57, multi: true },
  larve_emeraude: { atlas: 'larve_emeraude', scale: 1.02, map: MONSTER_MAP(12/24, 'AnimAttaque0', { 0: 12/24, 1: 9/18 }), height: 58, multi: true },
  larve_doree: { atlas: 'larve_doree', scale: 0.9, map: MONSTER_MAP(12/24, 'AnimAttaque0', { 0: 12/24, 1: 9/18 }), height: 56, multi: true },
  shin_larve: { atlas: 'shin_larve', scale: 0.97, map: MONSTER_MAP(12/19, 'AnimAttaque1', { 1: 12/19 }), height: 207, multi: true },
  larve_verte_solitaire: { atlas: 'larve_verte_solitaire', scale: 0.9, map: MONSTER_MAP(12/24, 'AnimAttaque0', { 0: 12/24, 1: 9/18 }), height: 55, multi: true },
  larve_bleue_solitaire: { atlas: 'larve_bleue_solitaire', scale: 0.9, map: MONSTER_MAP(12/24, 'AnimAttaque0', { 0: 12/24, 1: 9/18 }), height: 55, multi: true },
  // Amakna (0.4, monde sans coupure) : monstres des sous-zones officielles (am/ajout.py, tools/extraction/LISEZMOI.md)
  mulou: { atlas: 'mulou', scale: 1.2, map: MONSTER_MAP(10/29, 'AnimAttaque0', { 0: 10/29, 1: 28/47, 2: 12/35 }), height: 182, multi: true },
  cochon_de_lait: { atlas: 'cochon_de_lait', scale: 0.7, map: MONSTER_MAP(14/23, 'AnimAttaque0', { 0: 14/23, 1: 4/46, 2: 14/23 }), height: 197, multi: true },
  araknelle: { atlas: 'araknelle', scale: 0.9, map: MONSTER_MAP(10/18, 'AnimAttaque0', { 0: 10/18, 1: 10/18 }), height: 46, multi: true },
  ambi_guman: { atlas: 'ambi_guman', scale: 1.0, map: MONSTER_MAP(20/40, 'AnimAttaque0', { 0: 20/40, 1: 18/49, 2: 24/44 }), height: 352, multi: true },
  wabbit_squelette: { atlas: 'wabbit_squelette', scale: 0.64, map: MONSTER_MAP(19/35, 'AnimAttaque1', { 1: 19/35 }), height: 129, multi: true },
  black_wabbit_squelette: { atlas: 'black_wabbit_squelette', scale: 0.77, map: MONSTER_MAP(19/35, 'AnimAttaque1', { 1: 19/35 }), height: 152, multi: true },
  sanglier_des_plaines: { atlas: 'sanglier_des_plaines', scale: 0.64, map: MONSTER_MAP(9/19, 'AnimAttaque0', { 0: 9/19, 1: 9/19 }), height: 203, multi: true },
  cavalier_porkass: { atlas: 'cavalier_porkass', scale: 0.64, map: MONSTER_MAP(16/32, 'AnimAttaque0', { 0: 16/32, 1: 9/30 }), height: 225, multi: true },
  berger_porkass: { atlas: 'berger_porkass', scale: 0.64, map: MONSTER_MAP(15/33, 'AnimAttaque0', { 0: 15/33, 1: 13/40 }), height: 253, multi: true },
  bouss_baybe: { atlas: 'bouss_baybe', scale: 0.8, map: MONSTER_MAP(15/28, 'AnimAttaque0', { 0: 15/28, 1: 10/29 }), height: 197, multi: true },
  amlub: { atlas: 'amlub', scale: 0.7, map: MONSTER_MAP(18/30, 'AnimAttaque0', { 0: 18/30, 1: 31/48 }), height: 124, multi: true },
  codem: { atlas: 'codem', scale: 0.7, map: MONSTER_MAP(18/30, 'AnimAttaque0', { 0: 18/30, 1: 31/48 }), height: 122, multi: true },
  kirevam: { atlas: 'kirevam', scale: 0.7, map: MONSTER_MAP(18/30, 'AnimAttaque0', { 0: 18/30, 1: 31/48 }), height: 112, multi: true },
  let_emoliug: { atlas: 'let_emoliug', scale: 0.7, map: MONSTER_MAP(18/30, 'AnimAttaque0', { 0: 18/30, 1: 31/48 }), height: 110, multi: true },
  susej: { atlas: 'susej', scale: 0.7, map: MONSTER_MAP(18/30, 'AnimAttaque0', { 0: 18/30, 1: 31/48 }), height: 124, multi: true },
  idemas: { atlas: 'idemas', scale: 0.7, map: MONSTER_MAP(18/30, 'AnimAttaque0', { 0: 18/30, 1: 31/48 }), height: 99, multi: true },
  aboub: { atlas: 'aboub', scale: 0.7, map: MONSTER_MAP(18/30, 'AnimAttaque0', { 0: 18/30, 1: 31/48 }), height: 123, multi: true },
  gink: { atlas: 'gink', scale: 0.7, map: MONSTER_MAP(18/30, 'AnimAttaque0', { 0: 18/30, 1: 31/48 }), height: 105, multi: true },
  nebgib: { atlas: 'nebgib', scale: 0.7, map: MONSTER_MAP(18/30, 'AnimAttaque0', { 0: 18/30, 1: 31/48 }), height: 125, multi: true },
  nipul: { atlas: 'nipul', scale: 0.7, map: MONSTER_MAP(18/30, 'AnimAttaque0', { 0: 18/30, 1: 31/48 }), height: 108, multi: true },
  osurc: { atlas: 'osurc', scale: 0.7, map: MONSTER_MAP(18/30, 'AnimAttaque0', { 0: 18/30, 1: 31/48 }), height: 117, multi: true },
  tikoko: { atlas: 'tikoko', scale: 1.0, map: MONSTER_MAP(12/37, 'AnimAttaque0', { 0: 12/37, 1: 12/37 }), height: 184, multi: true },
  kokoko: { atlas: 'kokoko', scale: 1.1, map: MONSTER_MAP(20/45, 'AnimAttaque0', { 0: 20/45, 1: 32/41 }), height: 370, multi: true },
  nodkoko: { atlas: 'nodkoko', scale: 1.1, map: MONSTER_MAP(12/25, 'AnimAttaque0', { 0: 12/25, 1: 16/30 }), height: 48, multi: true },
  tortue_rouge: { atlas: 'tortue_rouge', scale: 0.9, map: MONSTER_MAP(18/45, 'AnimAttaque0', { 0: 18/45, 1: 20/50 }), height: 163, multi: true },
  tortue_bleue: { atlas: 'tortue_bleue', scale: 1.2, map: MONSTER_MAP(17/37, 'AnimAttaque0', { 0: 17/37, 1: 19/27 }), height: 127, multi: true },
  tortue_verte: { atlas: 'tortue_verte', scale: 0.9, map: MONSTER_MAP(24/43, 'AnimAttaque0', { 0: 24/43, 1: 19/43 }), height: 149, multi: true },
  tortue_jaune: { atlas: 'tortue_jaune', scale: 0.9, map: MONSTER_MAP(16/43, 'AnimAttaque0', { 0: 16/43, 1: 14/31 }), height: 170, multi: true },
  grokoko: { atlas: 'grokoko', scale: 1.47, map: MONSTER_MAP(17/38, 'AnimAttaque0', { 0: 17/38, 1: 12/39 }), height: 177, multi: true },
  kanniboul_ark: { atlas: 'kanniboul_ark', scale: 1.2, map: MONSTER_MAP(23/48, 'AnimAttaque0', { 0: 23/48, 1: 16/38 }), height: 127, multi: true },
  kanniboul_eth: { atlas: 'kanniboul_eth', scale: 0.9, map: MONSTER_MAP(14/34, 'AnimAttaque0', { 0: 14/34, 1: 14/35 }), height: 182, multi: true },
  kanniboul_jav: { atlas: 'kanniboul_jav', scale: 0.9, map: MONSTER_MAP(15/40, 'AnimAttaque0', { 0: 15/40, 1: 14/38 }), height: 169, multi: true },
  kanniboul_sarbak: { atlas: 'kanniboul_sarbak', scale: 0.9, map: MONSTER_MAP(20/38, 'AnimAttaque0', { 0: 20/38, 1: 10/29 }), height: 174, multi: true },
  kanniboul_ebil: { atlas: 'kanniboul_ebil', scale: 1.0, map: MONSTER_MAP(12/25, 'AnimAttaque0', { 0: 12/25, 1: 10/25 }), height: 252, multi: true },
  kanniboul_tam: { atlas: 'kanniboul_tam', scale: 1.0, map: MONSTER_MAP(33/51, 'AnimAttaque0', { 0: 33/51, 1: 24/46 }), height: 209, multi: true },
  champ_champ: { atlas: 'champ_champ', scale: 0.64, map: MONSTER_MAP(14/28, 'AnimAttaque0', { 0: 14/28, 1: 16/33 }), height: 119, multi: true },
  abraknyde_chetif: { atlas: 'abraknyde_chetif', scale: 0.64, map: MONSTER_MAP(18/33, 'AnimAttaque0', { 0: 18/33, 1: 20/34, 2: 9/34 }), height: 261, multi: true },
  tofu_malefique: { atlas: 'tofu_malefique', scale: 0.7, map: MONSTER_MAP(10/30, 'AnimAttaque0', { 0: 10/30, 1: 10/30 }), height: 83, multi: true },
  kwoan: { atlas: 'kwoan', scale: 0.77, map: MONSTER_MAP(15/24, 'AnimAttaque0', { 0: 15/24, 1: 20/40 }), height: 126, multi: true },
  roub_ignolles: { atlas: 'roub_ignolles', scale: 0.64, map: MONSTER_MAP(27/41, 'AnimAttaque0', { 0: 27/41, 1: 24/37 }), height: 312, multi: true },
  gelee_bleuet: { atlas: 'gelee_bleuet', scale: 0.64, map: MONSTER_MAP(12/41, 'AnimAttaque0', { 0: 12/41, 1: 8/37 }), height: 178, multi: true },
  gelee_menthe: { atlas: 'gelee_menthe', scale: 0.64, map: MONSTER_MAP(12/41, 'AnimAttaque0', { 0: 12/41, 1: 8/37 }), height: 179, multi: true },
  gelee_fraise: { atlas: 'gelee_fraise', scale: 0.64, map: MONSTER_MAP(12/41, 'AnimAttaque0', { 0: 12/41, 1: 8/37 }), height: 178, multi: true },
  champa_vert: { atlas: 'champa_vert', scale: 0.64, map: MONSTER_MAP(8/28, 'AnimAttaque0', { 0: 8/28, 1: 8/28 }), height: 105, multi: true },
  champa_rouge: { atlas: 'champa_rouge', scale: 0.64, map: MONSTER_MAP(8/28, 'AnimAttaque0', { 0: 8/28, 1: 8/28 }), height: 104, multi: true },
  champa_bleu: { atlas: 'champa_bleu', scale: 0.64, map: MONSTER_MAP(8/28, 'AnimAttaque0', { 0: 8/28, 1: 8/28 }), height: 104, multi: true },
  champa_marron: { atlas: 'champa_marron', scale: 0.64, map: MONSTER_MAP(8/28, 'AnimAttaque0', { 0: 8/28, 1: 8/28 }), height: 104, multi: true },
  maitre_boulet: { atlas: 'maitre_boulet', scale: 0.7, map: MONSTER_MAP(19/50, 'AnimAttaque0', { 0: 19/50, 1: 19/47, 2: 13/50 }), height: 199, multi: true },
  dragoeuf_calcaire: { atlas: 'dragoeuf_calcaire', scale: 0.64, map: MONSTER_MAP(3/23, 'AnimAttaque1', { 1: 3/23, 2: 13/26 }), height: 154, multi: true },
  dragoeuf_argile: { atlas: 'dragoeuf_argile', scale: 0.64, map: MONSTER_MAP(13/27, 'AnimAttaque0', { 0: 13/27, 1: 13/26 }), height: 153, multi: true },
  dragoeuf_ardoise: { atlas: 'dragoeuf_ardoise', scale: 0.64, map: MONSTER_MAP(13/27, 'AnimAttaque0', { 0: 13/27, 1: 13/26 }), height: 154, multi: true },
  dragoeuf_charbon: { atlas: 'dragoeuf_charbon', scale: 0.64, map: MONSTER_MAP(13/27, 'AnimAttaque0', { 0: 13/27, 1: 13/26 }), height: 153, multi: true },
  coffre_malveillant: { atlas: 'coffre_malveillant', scale: 0.77, map: MONSTER_MAP(12/37, 'AnimAttaque0', { 0: 12/37, 1: 11/47 }), height: 107, multi: true },
  boo: { atlas: 'boo', scale: 0.7, map: MONSTER_MAP(10/37, 'AnimAttaque0', { 0: 10/37, 1: 13/27 }), height: 83, multi: true },
  crocodaille: { atlas: 'crocodaille', scale: 0.8, map: MONSTER_MAP(10/28, 'AnimAttaque0', { 0: 10/28, 1: 19/50, 2: 10/28 }), height: 147, multi: true },
  chef_crocodaille: { atlas: 'chef_crocodaille', scale: 0.83, map: MONSTER_MAP(9/23, 'AnimAttaque0', { 0: 9/23, 1: 21/34 }), height: 162, multi: true },
  arakne_olithique: { atlas: 'arakne_olithique', scale: 0.83, map: MONSTER_MAP(10/18, 'AnimAttaque1', { 1: 10/18, 2: 32/42 }), height: 86, multi: true },
  boulanger_souille: { atlas: 'boulanger_souille', scale: 0.64, map: MONSTER_MAP(11/27, 'AnimAttaque0', { 0: 11/27, 1: 9/25 }), height: 309, multi: true },
  mineur_souille: { atlas: 'mineur_souille', scale: 0.64, map: MONSTER_MAP(12/23, 'AnimAttaque0', { 0: 12/23, 2: 4/20, 9: 10/22 }), height: 241, multi: true },
  dragodinde_amande_sauvage: { atlas: 'dragodinde_amande_sauvage', scale: 0.74, map: MONSTER_MAP(11/31, 'AnimAttaque0', { 0: 11/31, 1: 10/32 }), height: 234, multi: true },
  dragodinde_rousse_sauvage: { atlas: 'dragodinde_rousse_sauvage', scale: 0.74, map: MONSTER_MAP(11/31, 'AnimAttaque0', { 0: 11/31, 1: 10/32 }), height: 234, multi: true },
  arakne: { atlas: 'arakne', scale: 0.61, map: MONSTER_MAP(13/26, 'AnimAttaque0', { 0: 13/26, 1: 51/103 }), height: 73, multi: true },
  moskito: { atlas: 'moskito', scale: 0.83, map: MONSTER_MAP(11/25, 'AnimAttaque0', { 0: 11/25, 1: 11/25 }), height: 70, multi: true },
  campagnoll: { atlas: 'campagnoll', scale: 0.64, map: MONSTER_MAP(11/27, 'AnimAttaque0', { 0: 11/27, 1: 9/36 }), height: 155, multi: true },
  meulou: { atlas: 'meulou', scale: 0.83, map: MONSTER_MAP(12/35, 'AnimAttaque0', { 0: 12/35, 1: 10/29, 3: 14/42 }), height: 283, multi: true },
  craquelourd: { atlas: 'craquelourd', scale: 0.64, map: MONSTER_MAP(11/27, 'AnimAttaque0', { 0: 11/27, 1: 34/51 }), height: 348, multi: true },
  poutch_vil_smisse: { atlas: 'poutch_vil_smisse', scale: 0.64, map: MONSTER_MAP(9/31, 'AnimAttaque1', { 1: 9/31 }), height: 207, multi: true },
  poutch_ombre: { atlas: 'poutch_ombre', scale: 0.64, map: MONSTER_MAP(9/31, 'AnimAttaque1', { 1: 9/31 }), height: 205, multi: true },
  poutch_hyperscampe: { atlas: 'poutch_hyperscampe', scale: 0.64, map: MONSTER_MAP(9/31, 'AnimAttaque1', { 1: 9/31 }), height: 215, multi: true },
  poutch_sylargh: { atlas: 'poutch_sylargh', scale: 0.64, map: MONSTER_MAP(9/31, 'AnimAttaque1', { 1: 9/31 }), height: 205, multi: true },
  poutch_crane_rose: { atlas: 'poutch_crane_rose', scale: 0.64, map: MONSTER_MAP(9/31, 'AnimAttaque1', { 1: 9/31 }), height: 201, multi: true },
  bandit_manchot: { atlas: 'bandit_manchot', scale: 0.64, map: MONSTER_MAP(15/28, 'AnimAttaque0', { 0: 15/28, 1: 9/27 }), height: 259, multi: true },
  craqueleur: { atlas: 'craqueleur', scale: 0.74, map: MONSTER_MAP(11/27, 'AnimAttaque0', { 0: 11/27, 1: 34/51 }), height: 298, multi: true },
  craqueleur_des_plaines: { atlas: 'craqueleur_des_plaines', scale: 1.1, map: MONSTER_MAP(15/38, 'AnimAttaque0', { 0: 15/38, 1: 27/52 }), height: 220, multi: true },
  craqueboule: { atlas: 'craqueboule', scale: 0.64, map: MONSTER_MAP(10/25, 'AnimAttaque0', { 0: 10/25, 1: 5/25 }), height: 188, multi: true },
  craqueleur_legendaire: { atlas: 'craqueleur_legendaire', scale: 0.88, map: MONSTER_MAP(7/30, 'AnimAttaque0', { 0: 7/30, 1: 8/27, 2: 15/31 }), height: 401, multi: true },
  elementerre: { atlas: 'elementerre', scale: 0.96, map: MONSTER_MAP(16/26, 'AnimAttaque0', { 0: 16/26, 1: 19/35 }), height: 95, multi: true },
  craquelope: { atlas: 'craquelope', scale: 1.92, map: MONSTER_MAP(14/30, 'AnimAttaque0', { 0: 14/30, 1: 8/16, 2: 30/51 }), height: 83, multi: true },
  wa_wobot: { atlas: 'wa_wobot', scale: 1.38, map: MONSTER_MAP(10/32, 'AnimAttaque0', { 0: 10/32, 1: 16/31, 2: 5/30 }), height: 248, multi: true },
  black_wo_wabbit: { atlas: 'black_wo_wabbit', scale: 0.54, map: MONSTER_MAP(11/25, 'AnimAttaque0', { 0: 11/25, 2: 18/31 }), height: 287, multi: true },
  wobot_kiafin: { atlas: 'wobot_kiafin', scale: 0.58, map: MONSTER_MAP(12/30, 'AnimAttaque0', { 0: 12/30, 1: 19/33 }), height: 396, multi: true },
  blanc_pa_wabbit: { atlas: 'blanc_pa_wabbit', scale: 0.64, map: MONSTER_MAP(15/40, 'AnimAttaque0', { 0: 15/40, 2: 7/28 }), height: 269, multi: true },
  // invocations immobiles du Wa Wabbit et du Wa Wobot (« Wabbits : 8A, 10A ») : repos, coup reçu, mort
  cawotte_woyale: { atlas: 'cawotte_woyale', scale: 0.4, map: FIXE_MAP, height: 120, multi: true },
  nono_le_wobot: { atlas: 'nono_le_wobot', scale: 1.0, map: MONSTER_MAP(21/32, 'AnimAttaque0', { 0: 21/32, 1: 27/38 }), height: 236, multi: true },
  wabbit_gm: { atlas: 'wabbit_gm', scale: 1.0, map: MONSTER_MAP(15/35, 'AnimAttaque0', { 0: 15/35, 1: 49/58 }), height: 237, multi: true },
  wobot_tamponneur: { atlas: 'wobot_tamponneur', scale: 0.8, map: FIXE_MAP, height: 100, multi: true },
  tiwobot: { atlas: 'tiwobot', scale: 0.52, map: MONSTER_MAP(22/54, 'AnimAttaque1', { 1: 22/54, 2: 45/60, 3: 19/50 }), height: 230, multi: true },
  wabbit: { atlas: 'wabbit', scale: 0.64, map: MONSTER_MAP(11/27, 'AnimAttaque0', { 0: 11/27, 1: 22/35 }), height: 151, multi: true },
  black_wabbit: { atlas: 'black_wabbit', scale: 0.64, map: MONSTER_MAP(13/27, 'AnimAttaque0', { 0: 13/27, 1: 18/39 }), height: 146, multi: true },
  black_tiwabbit: { atlas: 'black_tiwabbit', scale: 0.64, map: MONSTER_MAP(14/25, 'AnimAttaque0', { 0: 14/25, 1: 30/45 }), height: 90, multi: true },
  tiwabbit_kiafin: { atlas: 'tiwabbit_kiafin', scale: 0.64, map: MONSTER_MAP(17/32, 'AnimAttaque0', { 0: 17/32, 1: 17/32 }), height: 158, multi: true },
  tiwabbit: { atlas: 'tiwabbit', scale: 0.64, map: MONSTER_MAP(15/28, 'AnimAttaque0', { 0: 15/28, 1: 22/35 }), height: 87, multi: true },
  wo_wabbit: { atlas: 'wo_wabbit', scale: 0.54, map: MONSTER_MAP(11/25, 'AnimAttaque0', { 0: 11/25, 1: 21/34, 2: 27/38 }), height: 287, multi: true },
  grand_pa_wabbit: { atlas: 'grand_pa_wabbit', scale: 0.64, map: MONSTER_MAP(15/32, 'AnimAttaque0', { 0: 15/32, 1: 15/32 }), height: 288, multi: true },
  wa_wabbit: { atlas: 'wa_wabbit', scale: 0.88, map: MONSTER_MAP(24/45, 'AnimAttaque0', { 0: 24/45, 1: 16/31, 2: 16/32 }), height: 219, multi: true },
  // 0.5 « monde vivant » : boss du monde (os 326, 328, 330, 434, 840 ; SCALE=1.6 ; Maître Vampire à 135 %)
  gelee_royale_bleuet: { atlas: 'gelee_royale_bleuet', scale: 1, map: MONSTER_MAP(12/41, 'AnimAttaque0', { 0: 12/41, 1: 24/45, 2: 16/37 }), height: 178, multi: true },
  gelee_royale_menthe: { atlas: 'gelee_royale_menthe', scale: 1, map: MONSTER_MAP(12/41, 'AnimAttaque0', { 0: 12/41, 1: 24/45, 2: 16/37 }), height: 178, multi: true },
  gelee_royale_fraise: { atlas: 'gelee_royale_fraise', scale: 1, map: MONSTER_MAP(12/41, 'AnimAttaque0', { 0: 12/41, 1: 24/45, 2: 16/37 }), height: 178, multi: true },
  gelee_royale_citron: { atlas: 'gelee_royale_citron', scale: 1, map: MONSTER_MAP(12/41, 'AnimAttaque0', { 0: 12/41, 1: 24/45, 2: 16/37 }), height: 178, multi: true },
  maitre_vampire: { atlas: 'maitre_vampire', scale: 1.39, map: MONSTER_MAP(13/26, 'AnimAttaque0', { 0: 13/26, 1: 4/36 }), height: 124, multi: true },
};

/** Archimonstres d'Astrub (0.3, 15B ; tools/contenu/archimonstres.py) : dans Dofus, un archimonstre a le dessin de son monstre
 *  (même gfxId) à sa propre échelle officielle. Même planche, à cette échelle, un peu plus grand et doré comme ceux des Champs. */
const MONS = MONSTRES as Record<string, { look?: string; archiDe?: string; archiEchelle?: number }>;
for (const [k, d] of Object.entries(MONS)) {
  const base = d.archiDe && (LOOKS[d.archiDe] ?? LOOKS[MONS[d.archiDe]?.look ?? '']);   // monstre au dessin d'un autre (Chafer -> chafer_debutant)
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
  // PNJ des Dofus (0.3) : Gawdien du Dofus (PNJ 148, {321}), Rathrosk (PNJ 4357, {4930}, animFunList officielle),
  // Énergie du Dofus Cacao (PNJ 4842, {3401|||120})
  gawdien: { scale: 0.82, anim: 'AnimStatique_1' },
  responsable: { scale: 0.82, anim: 'AnimStatique_1' },   // Responsable de la boutique (PNJ 5136, Marché du Bastion, Magasin 13E)
  // Île des Wabbits (« Wabbits : 2A + 12B ») : Capitaine Lily (PNJ 134, {10|||85}), Wabbit du Matin Pewlant (PNJ 141, {959|||130})
  lily: { scale: 0.82, anim: 'AnimStatique_1' },
  wabbit_matin: { scale: 0.82, anim: 'AnimStatique_1' },
  rathrosk: { scale: 0.82, anim: 'AnimStatique_1', fun: [['AnimAttaque3_1', 9], ['AnimAttaque2_1', 7], ['AnimAttaque1_1', 4]] },
  energie_cacao: { scale: 0.82, anim: 'AnimStatique_1' },
  // Gardes et crieur du Bastion (maquette Ville 5F) : looks officiels, animFunList officielles des miliciens (MILICIEN BONTA PIQUE 6554,
  // MILICIEN BRÂKMAR PIQUE 6560) et du Héraut d'Ecaflip (3098) ; Garde Pandalien ({5795|…}), Gardes d'Amakna et Marin frigostien sans anim fun
  garde_bonta: { scale: 0.82, anim: 'AnimStatique_1', fun: [['AnimAttaque0_1', 10]] },
  garde_brakmar: { scale: 0.82, anim: 'AnimStatique_1', fun: [['AnimAttaque0_1', 10], ['AnimAttaque2_1', 5]] },
  garde_pandala: { scale: 0.82, anim: 'AnimStatique_1' },
  garde_frigost: { scale: 0.82, anim: 'AnimStatique_1' },
  garde_amakna: { scale: 0.82, anim: 'AnimStatique_1' },
  // Bailli du Roi Allister (PNJ 2330, look de personnage) : planche de habitant_planche.py à SCALE=0,7, repos explo en boucle
  bailli: { scale: 0.82, anim: 'AnimStatiqueExplo0_1', boucle: 32 },
  heraut_ecaflip: { scale: 0.82, anim: 'AnimStatique_1', fun: [['AnimAttaque0_1', 9], ['AnimAttaque1_1', 7], ['AnimAttaque2_1', 6]] },
};
