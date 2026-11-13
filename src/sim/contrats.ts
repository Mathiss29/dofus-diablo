import type { ObjectifDef, QueteDef, RecompenseDef } from './quests';

/** Contrats du jour (maquette « Feuille de route des quêtes », ligne 1C + suite 2A 3C 4A 5A+5B) : peu de quêtes écrites, surtout des
 *  répétables. Un tableau tenu par un PNJ (Milice d'Astrub) propose 3 contrats par jour, renouvelés à minuit (heure du PC), et 1
 *  contrat de semaine plus long. Les titres sont ceux des quêtes officielles de la zone (2A), le déroulé est tiré au sort à partir
 *  de la date : tout le monde a les mêmes contrats le même jour, et la sauvegarde n'a besoin que de leur id. Pas de Math.random. */

/** Ce qu'il faut savoir du monde pour écrire un contrat (fourni par Quetes). */
export interface CtxContrats {
  /** Sous-zones à monstres de la zone : id -> nom, niveau, monstres. */
  sousZones: Record<string, { name: string; level: number; monsters: string[]; interieur?: boolean }>;
  /** Nom d'un monstre. */
  nomMonstre: (id: string) => string;
  /** Ressources officielles lâchées par ce monstre (ids), pour les contrats « butin de quête ». */
  ressourcesDe: (id: string) => string[];
  nomRessource: (id: string) => string;
  /** Cartes (tags) d'une sous-zone où un élite peut apparaître. */
  cartesDe: (sub: string) => string[];
  /** Titres officiels et une ligne de texte par sous-zone (quetes.json, contrats.titres). */
  titres: Record<string, [string, string][]>;
  /** PNJ qui tient le tableau (les contrats lui sont rendus). */
  pnj: string;
}

/** Nombre de contrats du jour (4A). */
export const CONTRATS_PAR_JOUR = 3;

/** Petit hachage stable d'une chaîne (FNV-1a), pour tirer les contrats sans toucher au hasard de la partie. */
export function hache(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** Suite de nombres [0, 1) tirée d'une graine (mulberry32). */
export function suite(graine: number) {
  let a = graine;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Semaine ISO d'une date AAAA-MM-JJ : « 2026-S45 ». Les contrats de semaine et les Avis de recherche changent le lundi. */
export function semaine(jour: string): string {
  const [y, m, d] = jour.split('-').map(Number);
  if (!y) return '';
  const t = new Date(Date.UTC(y, m - 1, d)), j = (t.getUTCDay() + 6) % 7;   // lundi = 0
  t.setUTCDate(t.getUTCDate() - j + 3);   // jeudi de la semaine
  const an = t.getUTCFullYear(), s = Math.ceil(((t.getTime() - Date.UTC(an, 0, 1)) / 86400000 + 1) / 7);
  return `${an}-S${String(s).padStart(2, '0')}`;
}

/** Sous-zones proposées à ce niveau : celles dont le niveau va de niveau − 15 à niveau + 5 (au moins les deux plus basses). */
export function sousZonesPour(niveau: number, ctx: CtxContrats): string[] {
  const subs = Object.entries(ctx.sousZones).filter(([, s]) => s.monsters.length).sort((a, b) => a[1].level - b[1].level || +a[0] - +b[0]);
  const ok = subs.filter(([, s]) => s.level <= niveau + 5 && s.level >= niveau - 15).map(([k]) => k);
  return ok.length ? ok : subs.slice(0, 2).map(([k]) => k);
}

/** Les contrats proposés pour cette période (jour : 3, semaine : 1), selon le niveau du perso. */
export function tirerContrats(periode: string, hebdo: boolean, niveau: number, ctx: CtxContrats, enPlus = 0): string[] {
  const subs = sousZonesPour(niveau, ctx), r = suite(hache(`${periode}:${niveau}`)), out: string[] = [];
  const n = hebdo ? 1 : CONTRATS_PAR_JOUR + enPlus, pris = new Set<string>();
  for (let i = 0; i < n; i++) {
    const libres = subs.filter(s => !pris.has(s)), l = libres.length ? libres : subs;
    const s = l[Math.floor(r() * l.length)]; pris.add(s);
    out.push(`ctr:${periode}:${i}:${s}`);
  }
  return out;
}

/** Le contrat d'un id « ctr:<période>:<i>:<sous-zone> » (null si l'id n'en est pas un ou si la sous-zone n'existe plus). */
export function contrat(id: string, ctx: CtxContrats): QueteDef | null {
  const [k, periode, , sub] = id.split(':');
  const sz = ctx.sousZones[sub];
  if (k !== 'ctr' || !sz || !sz.monsters.length) return null;
  const hebdo = periode.includes('-S'), r = suite(hache(id)), pick = <T>(l: T[]) => l[Math.floor(r() * l.length)];
  const lvl = sz.level, titres = ctx.titres[sub] ?? [[`Contrat : ${sz.name}`, 'La Milice a besoin de bras.']];
  const [titre, ligne] = pick(titres);
  const monstre = pick(sz.monsters), nom = ctx.nomMonstre(monstre), cartes = ctx.cartesDe(sub);
  const objs: ObjectifDef[] = [];
  const genre = hebdo ? 'semaine' : pick(['vaincre', 'vaincre', 'butin', 'elite', 'defense', 'chrono'] as const);
  const res = sz.monsters.flatMap(m => ctx.ressourcesDe(m).map(id => ({ m, id })));
  if (genre === 'semaine') {
    objs.push({ t: 'vaincre', n: 40, sousZone: +sub, texte: `Vaincre 40 monstres : ${sz.name}` });
    if (cartes.length) objs.push({ t: 'elite', monstre, carte: pick(cartes), pv: 4, nom: `${nom} chef de bande`, texte: `Vaincre ${nom} chef de bande` });
  } else if (genre === 'butin' && res.length) {
    const x = pick(res), n = 4 + Math.floor(r() * 3);
    objs.push({ t: 'ramasser', objet: ctx.nomRessource(x.id), n, chance: 0.3, sousZone: +sub, texte: `Rapporter ${n} × ${ctx.nomRessource(x.id)} : ${sz.name}` });
  } else if (genre === 'defense' && cartes.length) {
    const carte = pick(cartes);
    objs.push({ t: 'defense', carte, s: 60, texte: `Tenir 60 s face aux vagues (${sz.name}, carte ${carte.replace('_', ',')})` });
  } else if (genre === 'chrono' && cartes.length) {
    const carte = pick(cartes);
    objs.push({ t: 'chrono', carte, s: 90, texte: `Vider la carte ${carte.replace('_', ',')} en moins de 90 s (${sz.name})` });
  } else if (genre === 'elite' && cartes.length) {
    objs.push({ t: 'elite', monstre, carte: pick(cartes), pv: 3, nom: `${nom} enragé`, texte: `Vaincre ${nom} enragé` });
    objs.push({ t: 'vaincre', n: 6, sousZone: +sub, texte: `Vaincre 6 monstres : ${sz.name}` });
  } else {
    const n = 12 + Math.floor(r() * 3) * 2, seul = r() < 0.5;
    objs.push(seul ? { t: 'vaincre', n: Math.round(n / 2), monstres: [monstre], sousZone: +sub, texte: `Vaincre ${Math.round(n / 2)} × ${nom}` }
      : { t: 'vaincre', n, sousZone: +sub, texte: `Vaincre ${n} monstres : ${sz.name}` });
  }
  // récompenses (5A + 5B) : XP + kamas + un sac à rareté garantie + des Pépites ; la semaine paie trois fois plus et un Épique
  const coef = hebdo ? 5 : 1.6;
  const recompense: RecompenseDef = { xp: Math.round(coef * lvl * 50), kamas: Math.round(coef * lvl * 10), sac: hebdo ? 'epique' : 'rare', pepites: Math.round((hebdo ? 4 : 1) * lvl) };
  return { nom: hebdo ? `Contrat de la semaine : ${titre}` : titre, type: 'prime', pnj: ctx.pnj, rendre: ctx.pnj, niveau: lvl,
    serie: hebdo ? 'Contrat de la semaine' : 'Contrat du jour', texte: `${ligne}\n\n${sz.name}, niveau ${lvl}.`,
    etapes: [{ nom: titre, objectifs: objs }], recompense, contrat: periode };
}

/** « Archis : » 3C : l'archimonstre signalé du jour, « ctra:<jour>:<archimonstre>:<sous-zone> ». Un par jour et par tableau, tiré à partir de la date
 *  parmi les archimonstres des sous-zones du niveau du perso (d'abord ceux dont il n'a pas l'âme). Ni signal sur la carte ni chance en
 *  plus (3A, 3B non retenus) : il faut le trouver et le capturer. */
export function archiDuJour(jour: string, niveau: number, ctx: CtxContrats, archis: Record<string, string>, ames: string[]): string | null {
  const subs = sousZonesPour(niveau, ctx), dans = (a: string) => subs.some(s => ctx.sousZones[s].monsters.includes(archis[a]));
  const l = Object.keys(archis).filter(dans).sort(), neufs = l.filter(a => !ames.includes(a)), choix = neufs.length ? neufs : l;
  if (!choix.length) return null;
  const a = choix[Math.floor(suite(hache(`${jour}:archi:${niveau}`))() * choix.length)];
  return `ctra:${jour}:${a}:${subs.find(s => ctx.sousZones[s].monsters.includes(archis[a]))}`;
}
export function contratArchi(id: string, ctx: CtxContrats, archis: Record<string, string>): QueteDef | null {
  const [k, jour, a, sub] = id.split(':'), base = archis[a];
  if (k !== 'ctra' || !base || !ctx.sousZones[sub]?.monsters.includes(base)) return null;
  const sz = ctx.sousZones[sub], lvl = sz.level, nom = ctx.nomMonstre(a);
  const objs: ObjectifDef[] = [{ t: 'capturer', monstre: a, texte: `Capturer l'âme de ${nom} (${sz.name})` }];
  return { nom: `Archimonstre signalé : ${nom}`, type: 'prime', pnj: ctx.pnj, rendre: ctx.pnj, niveau: lvl, serie: 'Contrat du jour', contrat: jour,
    texte: `On a vu ${nom} rôder parmi les ${ctx.nomMonstre(base)}s : ${sz.name}, niveau ${lvl}. Il remplace parfois l'un d'eux. Bats-le avec une Petite pierre d'âme dans le sac (Otomaï, Marché couvert du Bastion).`,
    etapes: [{ nom: 'Archimonstre signalé', objectifs: objs }],
    recompense: { xp: Math.round(2.5 * lvl * 50), kamas: Math.round(2.5 * lvl * 10), sac: 'rare', pepites: Math.round(2 * lvl) } };
}

