// Outils du tchat (maquette « Tchat : », 2026-11-12) sans DOM ni réseau : liens d'objets, onglets réglables, lignes répétées,
// complétion par Tab. Testés dans tests/chat.test.ts.
import { ITEMS } from '../sim/data';
import { RARITY_COLORS, RARITY_NAMES, STATS, STAT_NAMES, lignePouvoir, type Item, type LegendaryFx, type Rarity, type Stat } from '../sim/items';

import type { Filtre, Onglet } from './chatOnglets';
export * from './chatOnglets';

/** Ce qu'il faut d'un message pour le classer et le regrouper. */
export interface LigneChat { canal: 'tout' | 'groupe' | 'bastion' | 'prive' | 'infos'; sorte?: 'butin'; de: string; texte: string; vers?: string }
export const filtreDe = (m: LigneChat): Filtre => (m.canal === 'infos' && m.sorte === 'butin' ? 'butin' : m.canal);

/** 2B : un onglet n'apparaît que si l'un de ses canaux sert (actifs = canaux utiles en ce moment). L'onglet ouvert reste. */
export function ongletsVisibles(onglets: Onglet[], actifs: Set<Filtre>, ouvert: number): number[] {
  const r: number[] = [];
  onglets.forEach((o, i) => { if (i === ouvert || o.f.some(f => actifs.has(f))) r.push(i); });
  return r;
}

/** 7B : lignes identiques à la suite regroupées (« ×3 »). */
export function regrouper<T extends LigneChat>(l: T[]): { m: T; n: number }[] {
  const r: { m: T; n: number }[] = [];
  for (const m of l) {
    const p = r[r.length - 1];
    if (p && p.m.canal === m.canal && p.m.de === m.de && p.m.texte === m.texte && p.m.vers === m.vers) { p.n++; p.m = m; }
    else r.push({ m, n: 1 });
  }
  return r;
}

// --- 6A : liens d'objets. Dans le texte envoyé : [[o:id|rareté|stat:valeur,…|pouvoir~valeur~sort,…]] ---
const RARETES: Rarity[] = ['commun', 'rare', 'epique', 'legendaire', 'mythique'];
export const LIEN = /\[\[o:([^|\]]{1,40})\|([a-z]{1,12})\|([^|\]]{0,400})\|([^\]]{0,200})\]\]/g;
export function lienObjet(it: Item): string {
  const st = STATS.filter(k => it.stats[k] !== undefined).map(k => `${k}:${it.stats[k]}`).join(',');
  const leg = [it.legendary, it.legendary2].filter((l): l is LegendaryFx => !!l).map(l => `${l.id}~${l.value}~${l.sort ?? ''}`).join(',');
  return `[[o:${it.id}|${it.rarity}|${st}|${leg}]]`;
}
export interface ObjetLie { id: string; nom: string; rarete: Rarity; niveau: number; stats: [Stat, number][]; pouvoirs: LegendaryFx[] }
export function lireLien(id: string, r: string, st: string, leg: string): ObjetLie | null {
  const d = ITEMS.equipment[id];
  if (!d) return null;
  const rarete = (RARETES as string[]).includes(r) ? r as Rarity : 'commun';
  const stats = st.split(',').map(x => x.split(':')).filter(([k, v]) => (STATS as readonly string[]).includes(k) && Number.isFinite(+v)).map(([k, v]) => [k as Stat, +v] as [Stat, number]);
  const pouvoirs = leg ? leg.split(',').map(x => x.split('~')).filter(([i, v]) => i && Number.isFinite(+v)).map(([i, v, s]) => ({ id: i, value: +v, ...(s ? { sort: s } : {}) })) : [];
  return { id, nom: d.name, rarete, niveau: d.level, stats, pouvoirs };
}
/** Le nom montré à la place du lien : [Coiffe du Bouftou Royal]. */
export const nomLien = (it: { nom: string }) => `[${it.nom}]`;
/** Texte du champ (« [Nom] ») → texte envoyé (liens complets), d'après les liens posés pendant la saisie. */
export function deplier(texte: string, poses: Map<string, string>): string {
  let r = texte;
  for (const [nom, lien] of poses) r = r.split(nom).join(lien);
  return r;
}
/** Fiche d'un objet lié (survol), en HTML. */
export function ficheObjet(o: ObjetLie): string {
  const c = RARITY_COLORS[o.rarete];
  const st = o.stats.map(([k, v]) => `<div style="color:${v < 0 ? '#e07a5f' : '#9be070'}">${v > 0 ? '+' : ''}${v} ${STAT_NAMES[k]}</div>`).join('');
  const lg = o.pouvoirs.map(l => { const p = lignePouvoir(l); return `<div style="color:#f08a2c;margin-top:3px"><b>${p.nom}</b>${p.texte ? ` : ${p.texte}` : ''}</div>`; }).join('');
  return `<div style="color:${c};font-weight:600">${o.nom}</div><div style="color:#a9a493;font-size:11px">${RARITY_NAMES[o.rarete]} · niveau ${o.niveau}</div>${st}${lg}`;
}
export const couleurRarete = (r: Rarity) => RARITY_COLORS[r];

// --- 8B : complétion par Tab ---
export const COMMANDES = ['/w', '/r', '/g', '/b', '/t', '/inviter', '/ami', '/ignorer', '/aide'];
/** Complète le dernier mot du champ (commande au début, sinon nom de joueur). k = nombre de Tab déjà faits sur ce mot. */
export function completer(texte: string, noms: string[], k = 0): string | null {
  const m = /(\S*)$/.exec(texte)!, mot = m[1], debut = texte.slice(0, texte.length - mot.length);
  if (!mot) return null;
  const premier = !debut.trim();
  const liste = premier && mot.startsWith('/') ? COMMANDES : [...new Set(noms)];
  const ok = liste.filter(x => x.toLowerCase().startsWith(mot.toLowerCase()) && x.toLowerCase() !== mot.toLowerCase());
  if (!ok.length) return null;
  return `${debut}${ok[k % ok.length]} `;
}

/** 7C : couleur du nom d'un joueur selon sa classe. */
export const COULEUR_CLASSE: Record<string, string> = {
  iop: '#ff7a5c', cra: '#8fd16a', osamodas: '#c99bff', sacrieur: '#ff5a74', forgelance: '#5fd3c5', eniripsa: '#ff9ad5', enutrof: '#e8c35c', ecaflip: '#f0a8e0', sadida: '#7fc84a',
};
