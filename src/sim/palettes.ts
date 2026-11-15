import donnees from '../data/palettes.json';
import type { Coffre } from './coffre';

/** Palettes de couleurs des persos (maquette « Palettes : 1A 2A+2B+2C 3B+3C 4A+4B+4C+4D 5A 6A », 2026-11-15) :
 *  24 palettes en 4 familles (Classiques, Dofus, Nations, Enfers). Classiques et Nations sont à tous ; une palette Dofus
 *  s'ouvre quand un perso du compte trouve ce Dofus, une palette des Enfers en finissant un palier d'Enfer (3B) ;
 *  les palettes fermées s'achètent aussi en Pépites chez Tissebelle, pour tout le compte (3C). Le compte garde aussi
 *  ses propres mélanges (« Mes palettes », 4B). Contenu : src/data/palettes.json. */
export interface Palette {
  id: string; nom: string;
  /** cheveux puis 4 zones de tenue (0xRRGGBB) ; la peau reste celle du perso */
  c: number[];
  /** palette Dofus : id officiel du Dofus qui l'ouvre */
  dofus?: string;
  /** palette des Enfers : s'ouvre en finissant un palier d'Enfer */
  enfers?: boolean;
}
export interface FamillePalettes { id: string; nom: string; palettes: Palette[] }
export interface Teint { nom: string; c: number }
export interface DonneesPalettes { prix: number; familles: FamillePalettes[]; teints: Teint[] }

export const PALETTES_PERSO = donnees as unknown as DonneesPalettes;
export const PALETTE_PAR_ID: Record<string, Palette> = Object.fromEntries(PALETTES_PERSO.familles.flatMap(f => f.palettes.map(p => [p.id, p])));
/** « Mes palettes » (4B) : 8 mélanges au plus par compte. */
export const MES_PALETTES_MAX = 8;

/** La palette demande-t-elle quelque chose (Dofus, palier d'Enfer) ? */
export const paletteFermee = (p: Palette) => !!(p.dofus || p.enfers);

/** La palette est-elle ouverte pour ce compte ? `dofus` = les Dofus trouvés par les persos du compte. */
export function paletteOuverte(p: Palette, c: Pick<Coffre, 'palettes'>, dofus: Iterable<string>): boolean {
  if (!paletteFermee(p) || c.palettes?.includes(p.id)) return true;
  if (p.dofus) for (const d of dofus) if (d === p.dofus) return true;
  return false;
}

/** Comment ouvrir une palette fermée (bulle d'aide). */
export function commentOuvrir(p: Palette, nomDofus?: string): string {
  const achat = `ou achète-la chez Tissebelle (${PALETTES_PERSO.prix} Pépites)`;
  if (p.dofus) return `Trouve le ${nomDofus ?? 'Dofus'}, ${achat}`;
  if (p.enfers) return `Finis un palier des Enfers (bientôt), ${achat}`;
  return '';
}

const couleur = (x: unknown) => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 0xffffff;
/** Relit les palettes d'un coffre sauvegardé (ids connus, mélanges de 6 couleurs). */
export function relirePalettes(o: Partial<Coffre>, r: Coffre) {
  if (Array.isArray(o.palettes)) { const l = [...new Set(o.palettes.filter(x => typeof x === 'string' && PALETTE_PAR_ID[x]))]; if (l.length) r.palettes = l; }
  if (Array.isArray(o.mesPalettes)) {
    const l = o.mesPalettes.filter(m => Array.isArray(m) && m.length === 6 && m.every(couleur)).slice(0, MES_PALETTES_MAX).map(m => [...m]);
    if (l.length) r.mesPalettes = l;
  }
}

/** Code couleur à partager (4C) : les 6 couleurs (peau, cheveux, tenue 1 à 4) en hexadécimal, séparées par des tirets. */
export const codeCouleurs = (c: number[]) => c.map(x => x.toString(16).padStart(6, '0')).join('-');
/** Lit un code couleur collé : 6 couleurs (peau comprise) ou 5 (la peau ne change pas). null si le code est illisible. */
export function lireCodeCouleurs(code: string, peau: number): number[] | null {
  const l = code.trim().toLowerCase().match(/[0-9a-f]{6}/g);
  if (!l || (l.length !== 5 && l.length !== 6) || code.replace(/[\s#,;:.\-]|[0-9a-f]{6}/gi, '').length) return null;
  const c = l.map(x => parseInt(x, 16));
  return c.length === 5 ? [peau, ...c] : c;
}

/** Bouton dé (4A) : des couleurs au hasard mais assorties. `alea` rend un nombre dans [0, 1[ (l'affichage passe Math.random,
 *  la sim n'en a pas besoin). Teinte de base au hasard, puis un accord (voisines, complémentaire ou triade) ; la peau ne change pas. */
export function paletteAuHasard(peau: number, alea: () => number): number[] {
  const h = alea() * 360, accord = [[0, 30, -30], [0, 180, 20], [0, 120, 240]][Math.floor(alea() * 3)];
  const t = (k: number) => (h + accord[k % accord.length] + (alea() - 0.5) * 16 + 360) % 360;
  const hsl = (hh: number, s: number, l: number) => {
    const a = s * Math.min(l, 1 - l), f = (n: number) => { const k = (n + hh / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
    return (f(0) << 16) | (f(8) << 8) | f(4);
  };
  const cheveux = alea() < 0.3 ? hsl(t(0), 0.15 + alea() * 0.2, 0.15 + alea() * 0.7) : hsl(t(1), 0.45 + alea() * 0.45, 0.25 + alea() * 0.5);
  return [peau, cheveux,
    hsl(t(0), 0.45 + alea() * 0.4, 0.35 + alea() * 0.3),
    hsl(t(1), 0.4 + alea() * 0.4, 0.2 + alea() * 0.25),
    hsl(t(2), 0.3 + alea() * 0.4, 0.15 + alea() * 0.2),
    hsl(t(0), 0.5 + alea() * 0.4, 0.6 + alea() * 0.25)];
}
