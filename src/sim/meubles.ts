/** Havre-Sac complet (0.6, ligne « 0.6 : » 10A-E, 11B+11C ; « Métiers : » 9A) : les meubles officiels du Havre-Sac.
 *  10A : mode déco sur la grille (poser, tourner, ranger) avec les 4 083 meubles officiels (table havenbagfurnitures,
 *        src/data/meubles.json, tools/extraction/meubles.py) ;
 *  10B : socles de vitrine (trophées des boss, Dofus, familiers exposés) ; 10C : potager (une récolte par jour) ;
 *  10D : mannequins (un par préréglage d'équipement, un clic pour changer de tenue) ; 10E : les amis en coop voient le Havre-Sac de l'hôte ;
 *  11C : chaque thème possédé donne ses meubles de base, les rares tombent des coffres de donjon et des succès ;
 *  11B : lots de meubles rares en Boutique d'Ogrines ; 9A : quelques meubles par thème se fabriquent (Bricoleur, Sculpteur).
 *  Tout est au compte (gardé avec le coffre, comme les thèmes). */
import DATA from '../data/meubles.json';
import type { Coffre } from './coffre';

/** Un meuble officiel. couche 0 = au sol (tapis, jamais bloquant), 1 = meuble, 2 = bibelot (posable sur un meuble empilable). */
export interface MeubleDef {
  id: number; theme: number; gfx: number; couche: 0 | 1 | 2; l: number; h: number; ox: number; oy: number;
  bloque: boolean; empilable: boolean; /** hauteur (px Dofus) où l'on pose un bibelot sur ce meuble */ pose: number;
  /** 11C : 'base' (offert avec le thème), 'rare' (butin, succès, lot de la Boutique d'Ogrines), 'fabrique' (9A, recette d'artisan) */
  tier: 'base' | 'rare' | 'fabrique';
  /** Meuble à nous (10B-D) : socle de vitrine, parcelle de potager, mannequin. */
  sorte?: SorteSpeciale;
}
export type SorteSpeciale = 'potager' | 'vitrine' | 'mannequin';
/** Recette d'un meuble fabriqué (9A), au format des recettes officielles (result = « meuble:<id> »). */
export interface RecetteMeuble { id: number; metier: string; level: number; ingredients: [string, number][] }

const D = DATA as unknown as { meubles: number[][]; rares?: number[]; recettes?: RecetteMeuble[]; speciaux?: Record<SorteSpeciale, { id: number; gfx: number; nom: string }> };
const RARES = new Set(D.rares ?? []);
const FAB = new Set((D.recettes ?? []).map(r => r.id));
export const MEUBLES: Record<number, MeubleDef> = {};
for (const [id, theme, gfx, couche, l, h, ox, oy, b, e, pose] of D.meubles)
  MEUBLES[id] = { id, theme, gfx, couche: couche as 0 | 1 | 2, l, h, ox, oy, bloque: !!b, empilable: !!e, pose, tier: FAB.has(id) ? 'fabrique' : RARES.has(id) ? 'rare' : 'base' };
/** 10B-D : nos meubles spéciaux (ids négatifs), dessinés avec un meuble officiel. Offerts à tous. */
export const SPECIAUX: Record<SorteSpeciale, { id: number; gfx: number; nom: string }> = D.speciaux ?? {
  potager: { id: -1, gfx: 0, nom: 'Parcelle de potager' }, vitrine: { id: -2, gfx: 0, nom: 'Socle de vitrine' }, mannequin: { id: -3, gfx: 0, nom: 'Mannequin' } };
for (const [sorte, s] of Object.entries(SPECIAUX) as [SorteSpeciale, typeof SPECIAUX.potager][]) {
  const base = Object.values(MEUBLES).find(m => m.gfx === s.gfx);
  MEUBLES[s.id] = { ...(base ?? { theme: 0, gfx: s.gfx, couche: 1, l: 1, h: 1, ox: 0, oy: 0, bloque: true, empilable: false, pose: 0 }), id: s.id, theme: 0, couche: 1, l: 1, h: 1,
    bloque: sorte !== 'potager', empilable: false, tier: 'base', sorte };
}
export const RECETTES_MEUBLES: RecetteMeuble[] = D.recettes ?? [];
/** Préfixe des recettes de meubles dans items.recipes (9A). */
export const PREFIXE_MEUBLE = 'meuble:';
export const meubleDeRecette = (result: string) => result.startsWith(PREFIXE_MEUBLE) ? MEUBLES[Number(result.slice(PREFIXE_MEUBLE.length))] ?? null : null;

export const DECO = {
  /** Meubles posés au plus par thème (les 4 083 dessins coûtent : on garde le Havre-Sac fluide). */
  max: 150,
  /** 10B-D : au plus tant de parcelles, de socles ; les mannequins suivent le nombre de préréglages. */
  potagers: 6, vitrines: 8,
  /** 10C : récolte du potager (ressources par parcelle : base + 1 par tranche de niveau du métier). */
  recolte: { base: 3, parNiveaux: 25 },
  /** 11C : chance qu'un coffre de donjon contienne un meuble rare (0.6). */
  chanceDonjon: 0.25,
  /** 11C : un succès sur tant donne un meuble rare à sa récompense. */
  unSuccesSur: 4,
  /** Métiers dont on peut planter les ressources au potager (des plantes, pas de poissons ni de minerais). */
  plantes: ['paysan', 'alchimiste'],
};

/** Un meuble posé : id, case de la carte (0-559), tourné (miroir), et pour un mannequin le préréglage qu'il porte. */
export interface Pose { m: number; c: number; r?: 1; p?: number }
/** Ce qui fait un Havre-Sac à voir : le thème et ce qui est posé (le sien, ou celui de l'hôte en coop, 10E). */
export interface SacVu { theme: number; poses: Pose[]; potager: Record<string, { r: string; j: string }>; vitrine: Record<string, string> }

/** Thèmes connus de la table officielle (les meubles des thèmes absents du jeu ne sont pas proposés). */
export const themesDesMeubles = () => [...new Set(Object.values(MEUBLES).filter(m => m.id > 0).map(m => m.theme))];

/** Meubles que le compte peut poser : les meubles de base de chaque thème possédé (11C), plus ceux gagnés un par un
 *  (rares, fabriqués) et nos meubles spéciaux. */
export function meublesPossedes(themes: number[], c: Coffre): Set<number> {
  const s = new Set<number>(c.meubles ?? []), t = new Set(themes);
  for (const m of Object.values(MEUBLES)) if (m.id < 0 || (m.tier === 'base' && t.has(m.theme))) s.add(m.id);
  return s;
}
/** 11B : les meubles rares d'un thème (lot de la Boutique d'Ogrines). */
export const raresDuTheme = (theme: number) => Object.values(MEUBLES).filter(m => m.tier === 'rare' && m.theme === theme).map(m => m.id);

// --- Grille ---------------------------------------------------------------------------------------------------------
const COLS = 14, ROWS = 40;
/** Case voisine vers le haut de l'écran : à droite (axe de la largeur) ou à gauche (axe de la profondeur). -1 hors carte. */
function haut(c: number, droite: boolean): number {
  const r = Math.floor(c / COLS), k = c % COLS, o = r % 2, kk = k + o - (droite ? 0 : 1);
  return r - 1 < 0 || kk < 0 || kk >= COLS ? -1 : (r - 1) * COLS + kk;
}
/** Cases couvertes par un meuble posé sur la case c : c est la case de devant, il s'étend de l cases vers le haut à droite
 *  et de h cases vers le haut à gauche (l et h échangés s'il est tourné). Vide s'il dépasse de la carte. */
export function casesDe(m: MeubleDef, c: number, tourne = false): number[] {
  const [L, H] = tourne ? [m.h, m.l] : [m.l, m.h], out: number[] = [];
  let ligne = c;
  for (let i = 0; i < L; i++) {
    if (ligne < 0) return [];
    let k = ligne;
    for (let j = 0; j < H; j++) { if (k < 0) return []; out.push(k); k = haut(k, false); }
    ligne = haut(ligne, true);
  }
  return out;
}
export const CASES_CARTE = COLS * ROWS;

/** Clé d'une parcelle ou d'un socle : thème et case. */
export const cleSac = (theme: number, c: number) => `${theme}:${c}`;

/** Relit la déco du coffre (abîmée : on garde ce qui est sain). */
export function relireDeco(o: Partial<Coffre>, r: Coffre) {
  if (Array.isArray(o.meubles)) { const l = [...new Set(o.meubles.filter(x => Number.isInteger(x) && MEUBLES[x as number]))] as number[]; if (l.length) r.meubles = l; }
  if (o.deco && typeof o.deco === 'object') {
    const d: Record<string, Pose[]> = {};
    for (const [t, l] of Object.entries(o.deco)) {
      if (!/^\d{1,3}$/.test(t) || !Array.isArray(l)) continue;
      const ok = l.filter(p => p && MEUBLES[p.m] && Number.isInteger(p.c) && p.c >= 0 && p.c < CASES_CARTE).slice(0, DECO.max)
        .map(p => ({ m: p.m, c: p.c, ...(p.r ? { r: 1 as const } : {}), ...(Number.isInteger(p.p) && p.p! >= 0 && p.p! < 10 ? { p: p.p } : {}) }));
      if (ok.length) d[t] = ok;
    }
    if (Object.keys(d).length) r.deco = d;
  }
  const cle = (k: string) => /^\d{1,3}:\d{1,3}$/.test(k);
  if (o.potager && typeof o.potager === 'object') {
    const p = Object.fromEntries(Object.entries(o.potager).filter(([k, v]) => cle(k) && v && typeof v.r === 'string' && /^\d{1,7}$/.test(v.r) && typeof v.j === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.j)));
    if (Object.keys(p).length) r.potager = p;
  }
  if (o.vitrine && typeof o.vitrine === 'object') {
    const v = Object.fromEntries(Object.entries(o.vitrine).filter(([k, x]) => cle(k) && typeof x === 'string' && /^[dtf]:\d{1,7}$/.test(x)));
    if (Object.keys(v).length) r.vitrine = v;
  }
}

/** 10E : le Havre-Sac de l'hôte reçu par le réseau, relu comme un coffre (null s'il est abîmé). */
export function sacVuValide(x: unknown): SacVu | null {
  const o = x as Partial<SacVu> | null;
  if (!o || !Number.isInteger(o.theme) || !Array.isArray(o.poses)) return null;
  const r = { onglets: [] } as unknown as Coffre;
  relireDeco({ deco: { [String(o.theme)]: o.poses }, potager: o.potager, vitrine: o.vitrine }, r);
  return { theme: o.theme!, poses: r.deco?.[String(o.theme)] ?? [], potager: r.potager ?? {}, vitrine: r.vitrine ?? {} };
}
