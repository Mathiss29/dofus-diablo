import IDOLES from '../data/idoles.json';
import type { Element, MonsterDef } from './defs';
import type { RecoltesData } from './recolte';

/** Idoles (maquette 0.6, questions 17-18, 2026-11-13) : le joueur choisit sa difficulté. Chaque idole ajoute une contrainte
 *  et des points de score ; chaque point donne +0,5 % d'XP et de butin (plafonné à 60 points en donjon). Au plus 6 actives,
 *  une par famille. Modèle d'Idlus (js/idols.js), effets « au tour » traduits en secondes. Par perso, pas liées au compte.
 *  Fabriquées une fois chez le Bricoleur. Réglages et textes dans src/data/idoles.json. */
export const REGLES_IDOLES = IDOLES as unknown as {
  max: number; pctParPoint: number; plafondDonjon: number;
  familles: Record<string, { nom: string; couleur: string; icone: string }>;
  idoles: Record<string, IdoleDef>;
};
export interface FxIdole {
  pv?: number; payo?: number; degats?: number; rage?: number; eclairs?: number;
  bouclier?: number; inarretables?: number; bouclierRegen?: number; champion?: number;
  enPlus?: number; renfort?: number; retour?: number;
  vitesse?: number; chargesMoins?: number; eveil?: number; recharges?: number; projectiles?: number;
  usure?: number; vol?: number; boucliersJoueur?: number; flaques?: number;
  soins?: number; regen?: number; chokwa?: number;
  res?: number; zone?: number; resDernier?: number;
  critMonstres?: number; echec?: number; sansCrit?: number; critForce?: number;
}
export interface IdoleDef { nom: string; famille: string; score: number; niveau: number; desc: string; fx: FxIdole }
export const IDOLES_DEFS = REGLES_IDOLES.idoles;
export const ORDRE_IDOLES = Object.keys(IDOLES_DEFS);

/** Ce que le perso garde : idoles fabriquées, idoles actives, 3 jeux enregistrés. */
export interface EtatIdoles { possedees: string[]; actives: string[]; jeux: ({ nom: string; ids: string[] } | null)[] }
export const etatIdolesVide = (): EtatIdoles => ({ possedees: [], actives: [], jeux: [null, null, null] });

/** Active ou retire une idole. Remplace celle de la même famille ; refuse au-delà de 6. Renvoie un message d'erreur, ou null. */
export function basculerIdole(e: EtatIdoles, id: string): string | null {
  const I = IDOLES_DEFS[id];
  if (!I) return 'Idole inconnue.';
  const i = e.actives.indexOf(id);
  if (i >= 0) { e.actives.splice(i, 1); return null; }
  if (!e.possedees.includes(id)) return 'Idole à fabriquer chez le Bricoleur.';
  const meme = e.actives.findIndex(x => IDOLES_DEFS[x]?.famille === I.famille);
  if (meme >= 0) e.actives.splice(meme, 1);
  if (e.actives.length >= REGLES_IDOLES.max) return `${REGLES_IDOLES.max} idoles au plus.`;
  e.actives.push(id);
  return null;
}
export function enregistrerJeu(e: EtatIdoles, i: number, nom?: string) {
  if (i < 0 || i >= e.jeux.length) return;
  e.jeux[i] = { nom: nom || e.jeux[i]?.nom || `Jeu ${i + 1}`, ids: e.actives.slice() };
}
export function chargerJeu(e: EtatIdoles, i: number): string | null {
  const j = e.jeux[i];
  if (!j) return 'Jeu vide.';
  e.actives = [];
  for (const id of j.ids) if (e.possedees.includes(id)) basculerIdole(e, id);
  return null;
}

export const scoreIdoles = (ids: readonly string[]) => ids.reduce((a, id) => a + (IDOLES_DEFS[id]?.score ?? 0), 0);
/** Bonus d'XP et de butin (part de 1) : +0,5 % par point, score plafonné à 60 en donjon. */
export const bonusIdoles = (ids: readonly string[], donjon: boolean) =>
  Math.min(scoreIdoles(ids), donjon ? REGLES_IDOLES.plafondDonjon : Infinity) * REGLES_IDOLES.pctParPoint / 100;

/** Effets cumulés : les multiplicateurs se multiplient, le reste garde la plus forte valeur ; soins = la plus basse. */
export function fxIdoles(ids: readonly string[]): FxIdole | null {
  if (!ids.length) return null;
  const X: FxIdole = {};
  for (const id of ids) for (const [k, v] of Object.entries(IDOLES_DEFS[id]?.fx ?? {}) as [keyof FxIdole, number][]) {
    if (k === 'pv' || k === 'degats' || k === 'zone') X[k] = (X[k] ?? 1) * v;
    else if (k === 'soins') X[k] = Math.min(X[k] ?? 1, v);
    else X[k] = Math.max(X[k] ?? 0, v);
  }
  return X;
}

const ELEMENTS: Element[] = ['neutre', 'terre', 'feu', 'eau', 'air'];
/** Fiche d'un monstre sous les idoles : PV, dégâts, vitesse, résistances (le reste se joue pendant le combat). */
export function defSousIdoles(d: MonsterDef, fx: FxIdole): MonsterDef {
  const res = { ...(d.res ?? {}) };
  if (fx.res) for (const e of ELEMENTS) res[e] = (res[e] ?? 0) + fx.res;
  return { ...d, hp: Math.round(d.hp * (fx.pv ?? 1)), dmg: Math.round(d.dmg * (fx.degats ?? 1)), speed: d.speed * (1 + (fx.vitesse ?? 0)), res };
}

/** Recette d'une idole (comme Idlus) : 3 ressources de récolte au niveau de l'idole, de métiers qui tournent selon son rang
 *  dans la famille ; plus il est haut, plus il en faut. */
export function recetteIdole(id: string, recoltes: Pick<RecoltesData, 'ressources'>): [string, number][] {
  const I = IDOLES_DEFS[id];
  if (!I) return [];
  const rang = ORDRE_IDOLES.filter(x => IDOLES_DEFS[x].famille === I.famille).indexOf(id);
  const metiers = [['bucheron', 'mineur', 'alchimiste'], ['mineur', 'paysan', 'pecheur'], ['bucheron', 'alchimiste', 'paysan']][rang % 3];
  const q = [12, 8, 6].map(x => x + rang * 4);
  const out: [string, number][] = [];
  metiers.forEach((m, i) => {
    const l = Object.entries(recoltes.ressources).filter(([, r]) => r.metier === m && r.niveau <= Math.max(1, I.niveau - 5 * i)).sort((a, b) => b[1].niveau - a[1].niveau);
    if (l.length) out.push([l[0][0], q[i]]);
  });
  return out;
}
