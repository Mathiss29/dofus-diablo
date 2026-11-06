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
  /** Zoom de la caméra au lancement (6B : plus large que l'ancien 1). */
  zoom: number;
  /** Volume des sons (0 à 1). */
  volume: number;
  /** Cartes vivantes (maquette « Vivant », 5A) : arbres au vent, eau animée. */
  vent: boolean;
  eau: boolean;
}
export const REGLAGES_DEFAUT: Reglages = { heure: 'auto', lumieres: 1, saturation: 1, chaleur: 0, zoom: 0.62, volume: 1, vent: true, eau: true };
const CLE = 'diablofus.reglages';

export function chargerReglages(): Reglages {
  try { return { ...REGLAGES_DEFAUT, ...JSON.parse(localStorage.getItem(CLE) ?? '{}') }; } catch { return { ...REGLAGES_DEFAUT }; }
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
