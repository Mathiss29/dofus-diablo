import { ONGLETS_DEFAUT, type Onglet } from './chatOnglets';
/** Ambiance des cartes (maquette « Ambiance », choix de Mathis du 2026-11-06) :
 *  - cycle jour / soir / nuit / aube calé sur l'heure du PC (7D) ; plus tard, l'heure du serveur en multijoueur ;
 *  - nuit bleue façon Sonstour (3A) avec un soir orangé (3C) ; purement visuel (8A) ; intérieurs en lumière fixe (9A) ;
 *  - lumières officielles des cartes (halos, lueurs, rayons) dessinées en mode additif, plus fortes la nuit (1B, 4A) ;
 *  - réglages du joueur (10A + 10B), gardés dans le navigateur. Affichage seulement : la partie (src/sim) n'en sait rien. */

export type Heure = 'auto' | 'jour' | 'soir' | 'nuit';
export interface Reglages {
  /** Heure de l'ambiance : 'auto' = heure du PC. */
  heure: Heure;
  /** Force des lumières (halos, lueurs, rayons), 1 = comme Dofus. */
  lumieres: number;
  /** Saturation des couleurs (1 = images officielles telles quelles, 5A ; moins = jour adouci, 5B). */
  saturation: number;
  /** Chaleur de la lumière : 0 = neutre, + = plus chaud, - = plus froid. */
  chaleur: number;
  /** Zoom de la caméra au lancement (6B : plus large que l'ancien 1 ; 0,8 depuis la maquette PNJ 5B du 2026-11-06). */
  zoom: number;
  /** Volume général (0 à 1), puis volume de chaque famille de sons (maquette Son, 8A ; départ 8D : musique 50 %, effets 70 %). */
  volume: number;
  volMusique: number;
  volEffets: number;
  /** Cris des monstres, à part des effets (maquette Sons 6A, 70 % au départ). */
  volMonstres: number;
  volAmbiance: number;
  volInterface: number;
  /** Maquette « Musique boss » 8A : musique de combat contre les boss (sinon la musique de zone continue). */
  musiqueBoss: boolean;
  /** Tout le son coupé (Ctrl+M, 8B ; M = carte du monde). */
  muet: boolean;
  /** Cartes vivantes (maquette « Vivant », 5A) : arbres au vent, eau animée. */
  vent: boolean;
  eau: boolean;
  /** Particules officielles des cartes (spores, poussière, braises, étoiles…). */
  particules: boolean;
  /** Voir le perso derrière le décor (maquette « Transparence », 6A) : le décor devant lui s'efface, les monstres cachés ont une silhouette rouge. */
  transparence: boolean;
  /** Lancer des sorts (maquette Aperçu 1A/1B/1C) : maintenir pour voir puis relâcher, lancer tout de suite (aperçu avec Alt), ou viser comme Dofus (clic pour lancer). */
  lancer: 'relache' | 'immediat' | 'dofus';
  /** Option 5B : sur un monstre hors de portée, le perso s'approche avant de lancer. */
  approche: boolean;
  /** Flèche des quêtes au bord de l'écran et sur la mini-carte (maquette Flèche 8A). */
  flecheQuete: boolean;
  // --- Maquette « Réglages » (2026-11-08) ---
  /** 3A : touches choisies par action (render/touches.ts), seulement celles qui changent ; 3C : clavier forcé ou détecté. */
  touches: Record<string, string>;
  clavier: 'auto' | 'azerty' | 'qwerty';
  /** 4A : chiffres de dégâts, et leur taille. */
  chiffres: boolean;
  tailleChiffres: 'petite' | 'normale' | 'grande';
  /** 4B : compteur de dégâts par seconde. */
  dps: boolean;
  /** 4C : barres de vie au-dessus des monstres. */
  barresVie: 'toujours' | 'blesses' | 'survol';
  /** 5A : zoom à la molette ; 5B : bouton de déplacement (l'autre lance le sort du clic droit). */
  zoomMolette: boolean;
  deplacement: 'gauche' | 'droit';
  /** 6A : modules de l'interface déplaçables (décalage en pixels de chacun) ; 6B : coordonnées de la carte sous la mini-carte. */
  verrou: boolean;
  modules: Record<string, [number, number]>;
  coords: boolean;
  /** « Métiers : » 6E : ressources de mes métiers (récoltables à mon niveau) sur la mini-carte. */
  recoltesMini: boolean;
  /** 7A : échelle de l'interface (1 = 100 %). */
  echelle: number;
  /** 7B : qualité prédéfinie ; 7C : images par seconde (0 = sans limite) et compteur. */
  qualite: 'basse' | 'moyenne' | 'haute' | 'perso';
  fps: number;
  compteurFps: boolean;
  /** 9A : son d'alerte quand un Légendaire ou mieux tombe ; 9B : l'écran pulse en rouge sous 25 % de PV. */
  alerteButin: boolean;
  pulsePv: boolean;
  /** Fluidité 3A : 'ecran' = aux vrais pixels de l'écran (net, maquette Décors 1A) ; 'normale' = un pixel du jeu par pixel CSS
   *  (2,25 fois moins de pixels sur un Windows à 150 %). */
  resolution: 'ecran' | 'normale';
  // --- Maquette « Tchat : » (2026-11-12) ---
  /** 2A : onglets du tchat (nom et ce qu'ils montrent) ; 5B : taille du tchat [largeur, hauteur des messages] en pixels CSS. */
  chatOnglets: Onglet[];
  chatTaille: [number, number];
  /** 7A : heure devant chaque ligne ; 9A : opacité du fond, taille du texte (1 = normale), secondes avant l'effacement (0 = jamais). */
  chatHeure: boolean;
  chatFond: number;
  chatTexte: number;
  chatEffacement: string;
  /** 9B : recevoir les canaux Tout et Bastion. */
  chatTout: boolean;
  chatBastion: boolean;
}
/** 7B : ce que règle chaque qualité prédéfinie. */
export const QUALITES: Record<'basse' | 'moyenne' | 'haute', Partial<Reglages>> = {
  basse: { vent: false, eau: false, particules: false, lumieres: 0.6, fps: 30, resolution: 'normale' },
  moyenne: { vent: true, eau: true, particules: false, lumieres: 1, fps: 60, resolution: 'ecran' },
  haute: { vent: true, eau: true, particules: true, lumieres: 1, fps: 0, resolution: 'ecran' },
};
export const REGLAGES_DEFAUT: Reglages = { heure: 'auto', lumieres: 1, saturation: 1, chaleur: 0, zoom: 0.8, volume: 1, volMusique: 0.5, volEffets: 0.7, volMonstres: 0.5, volAmbiance: 0.6, volInterface: 0.7, musiqueBoss: true, muet: false, vent: true, eau: true, particules: true, transparence: true, lancer: 'relache', approche: false, flecheQuete: true,
  touches: {}, clavier: 'auto', chiffres: true, tailleChiffres: 'normale', dps: false, barresVie: 'blesses', zoomMolette: true, deplacement: 'gauche',
  verrou: true, modules: {}, coords: true, recoltesMini: true, echelle: 1, qualite: 'haute', fps: 0, compteurFps: false, alerteButin: true, pulsePv: true, resolution: 'ecran',
  chatOnglets: ONGLETS_DEFAUT, chatTaille: [360, 170], chatHeure: true, chatFond: 0.82, chatTexte: 1, chatEffacement: '20', chatTout: true, chatBastion: true };
const CLE = 'diablofus.reglages';

export function chargerReglages(): Reglages {
  try {
    const r: Reglages = { ...REGLAGES_DEFAUT, ...JSON.parse(localStorage.getItem(CLE) ?? '{}') };
    if (r.zoom === 0.62) r.zoom = REGLAGES_DEFAUT.zoom;   // ancien zoom de départ gardé dans le navigateur : passe au nouveau (PNJ 5B)
    if (r.volMonstres === 0.7) r.volMonstres = REGLAGES_DEFAUT.volMonstres;   // ancien curseur Monstres par défaut : passe à 50 % (Groupes 6A)
    return r;
  } catch { return { ...REGLAGES_DEFAUT }; }
}
export function sauverReglages(r: Reglages) {
  try { localStorage.setItem(CLE, JSON.stringify(r)); } catch { /* navigateur sans stockage : réglages pour cette partie seulement */ }
}

type RGB = [number, number, number];
/** Une étape du cycle : teinte multipliée sur les cartes, force des feux et lueurs (l), force des reflets et rayons du soleil (s). */
interface Etape { t: RGB; l: number; s: number }
const JOUR: Etape = { t: [1, 1, 1], l: 1, s: 1 };
// soir adouci (Mathis, 2026-11-06 : l'ancien orange [0.95, 0.66, 0.55] faisait mal aux yeux sur les sols jaunes d'Incarnam)
const SOIR: Etape = { t: [0.94, 0.84, 0.8], l: 1.4, s: 0.6 };
const NUIT: Etape = { t: [0.47, 0.55, 0.86], l: 2.6, s: 0.1 };
const AUBE: Etape = { t: [0.86, 0.82, 0.88], l: 1.3, s: 0.5 };
/** Heures (0-24) des étapes : nuit jusqu'à 5 h, aube vers 6 h, jour de 7 h 30 à 18 h, soir vers 19 h 30, nuit dès 21 h. */
const CYCLE: [number, Etape][] = [[0, NUIT], [5, NUIT], [6.2, AUBE], [7.5, JOUR], [18, JOUR], [19.5, SOIR], [21, NUIT], [24, NUIT]];
const FIXE: Record<Exclude<Heure, 'auto'>, Etape> = { jour: JOUR, soir: SOIR, nuit: NUIT };

export interface Ambiance {
  /** Teinte des cartes (multiplie leurs couleurs), en 0xRRGGBB. */
  tint: number;
  /** Teinte plus légère pour les personnages et les monstres : ils ressortent dans le noir (4B). */
  tintPerso: number;
  /** Force des feux et lueurs des cartes. */
  lumieres: number;
  /** Force des reflets et rayons du soleil. */
  soleil: number;
  /** Nom de l'étape la plus proche, pour l'interface. */
  nom: string;
}

const hex = (c: RGB) => (Math.round(Math.min(1, c[0]) * 255) << 16) | (Math.round(Math.min(1, c[1]) * 255) << 8) | Math.round(Math.min(1, c[2]) * 255);
const mix = (a: RGB, b: RGB, f: number): RGB => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];

/** Étape du cycle pour une heure de 0 à 24 (fondu entre les étapes). */
export function etape(h: number): Etape {
  h = ((h % 24) + 24) % 24;
  for (let i = 1; i < CYCLE.length; i++) {
    const [h1, e1] = CYCLE[i];
    if (h <= h1) {
      const [h0, e0] = CYCLE[i - 1], f = h1 > h0 ? (h - h0) / (h1 - h0) : 0;
      return { t: mix(e0.t, e1.t, f), l: e0.l + (e1.l - e0.l) * f, s: e0.s + (e1.s - e0.s) * f };
    }
  }
  return NUIT;
}

/** Ambiance du moment : l'heure du PC (ou celle forcée dans les réglages) ; lumière de jour fixe dans les intérieurs (9A). */
export function ambiance(r: Reglages, date: Date, interieur: boolean): Ambiance {
  const h = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const e = interieur ? JOUR : r.heure === 'auto' ? etape(h) : FIXE[r.heure];
  // chaleur : un peu plus de rouge, un peu moins de bleu (ou l'inverse)
  const w = r.chaleur * 0.12, t: RGB = [e.t[0] * (1 + Math.min(0, w)) , e.t[1] * (1 - Math.abs(w) * 0.25), e.t[2] * (1 - Math.max(0, w))];
  const nom = interieur ? 'intérieur' : r.heure !== 'auto' ? r.heure : h >= 21 || h < 5.5 ? 'nuit' : h < 7.5 ? 'aube' : h < 18.5 ? 'jour' : 'soir';
  return { tint: hex(t), tintPerso: hex(mix(t, [1, 1, 1], 0.55)), lumieres: e.l * r.lumieres, soleil: e.s * r.lumieres, nom };
}

/** Matrice de couleur (5 x 4, format Phaser ColorMatrix) : saturation autour de la luminance. 1 = inchangé. */
export function matriceSaturation(s: number): number[] {
  const lr = 0.2126, lg = 0.7152, lb = 0.0722, i = 1 - s;
  return [
    lr * i + s, lg * i, lb * i, 0, 0,
    lr * i, lg * i + s, lb * i, 0, 0,
    lr * i, lg * i, lb * i + s, 0, 0,
    0, 0, 0, 1, 0,
  ];
}
