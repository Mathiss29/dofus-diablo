import pouvoirs from '../data/pouvoirs.json';
import classes from '../data/classes.json';
import type { Rng } from './math';
import type { Slot } from './items';
import type { SortGrade } from './sorts';

/** Version 0.3 (ligne « 0.3 : » du 2026-11-08) : les 40 pouvoirs officiels de chaque classe remplacent le tirage des seuls
 *  5 pouvoirs maison. Visibles dans la partie de test (#test) jusqu'à la sortie de la 0.3 : passer à true ce jour-là. */
export const V03_PUBLIC = false;
/** Équipements officiels en jeu avant la 0.3 (jusqu'au niveau 25) ; ceux du niveau 26 au 40 arrivent avec la 0.3 (choix 2A). */
export const NIVEAU_OBJETS_02 = 25;

/** Effet de sort officiel d'une panoplie de classe (src/data/pouvoirs.json, tools/extraction/pouvoirs.py). */
export interface PouvoirDef {
  id: string; slot: Slot; piece: string; sort: string; dofusId: number;
  effet: 'po' | 'pomin' | 'pa' | 'relance' | 'parTour' | 'parCible' | 'dmg' | 'crit' | 'ldv' | 'ligne' | 'pom';
  n: number; officiel: string;
}
export const POUVOIRS = pouvoirs as unknown as Record<string, PouvoirDef[]>;
export const POUVOIR_PAR_ID: Record<string, PouvoirDef> = Object.fromEntries(Object.values(POUVOIRS).flat().map(p => [p.id, p]));
/** Classe d'un pouvoir officiel (préfixe de son id : iop-07 -> iop). */
export const classeDuPouvoir = (id: string) => id.slice(0, id.lastIndexOf('-'));

/** Traduction en temps réel (maquette « Légendaires » 6A, 1 tour = 3 s, 1 case = 48 px). */
/** zone : le sort visé n'est pas lancé sur une case (zone autour du perso, ligne, cône) ; la portée et la ligne de vue
 *  y deviennent de la taille de zone. */
export function textePouvoir(p: PouvoirDef, zone = false): string {
  const c = (n: number) => `${n} case${n > 1 ? 's' : ''}`;
  switch (p.effet) {
    case 'po': return zone ? `zone plus grande (+${p.n} demi-case${p.n > 1 ? 's' : ''})` : `+${c(p.n)} de portée`;
    case 'pomin': return 'se lance aussi au contact';
    case 'pa': return `coûte ${p.n} PA de moins`;
    case 'relance': return `recharge ${p.n * 3} s plus courte`;
    case 'parTour': case 'parCible': return `+${p.n} charge`;
    case 'dmg': return `+${p.n} dégâts de base`;
    case 'crit': return `+${p.n} % de critique`;
    case 'ldv': return zone ? '+1 case de zone' : 'se lance par-dessus le décor';
    case 'ligne': return '+1 case de zone';
    case 'pom': return 'la Portée de ton équipement s\'applique';
  }
}

/** Ce qu'il faut savoir du perso pour tirer un pouvoir : sa classe, les sorts qu'il connaît, ceux du jeu qu'il apprendra plus tard. */
export interface CtxPouvoirs {
  /** Clé de la classe dans pouvoirs.json / sorts.json (iop, cra, osamodas). */
  classe: string;
  /** Ids Dofus des sorts connus (niveau atteint, variante choisie). */
  connus: number[];
  /** Sorts du jeu pas encore appris : id Dofus et niveau où il s'apprend. */
  aVenir: { dofusId: number; niveau: number }[];
  /** Sorts à vraie recharge (cibles de Relance éclair). */
  sortsRecharge: string[];
  /** 0.3 visible (partie de test, ou sortie publique). */
  v03: boolean;
  /** Pouvoir de la classe garanti (quête « Le premier pouvoir », 8C) : jamais d'une autre classe ni d'un sort à venir, ni maison. */
  garanti?: boolean;
}
/** Ids Dofus des sorts présents en jeu pour chaque classe : un pouvoir sur un sort pas encore fait n'est jamais tiré. */
export const EN_JEU: Record<string, number[]> = {};
for (const c of Object.values(classes as unknown as Record<string, { sorts?: string; spells: Record<string, { dofusId?: number }> }>))
  if (c.sorts) EN_JEU[c.sorts] = Object.values(c.spells).map(d => d.dofusId).filter((x): x is number => !!x);

export type TiragePouvoir = { officiel: string } | { maison: true };
/** Tire le pouvoir d'un Légendaire (et le second d'un Mythique), sans doublon :
 *  4A (Légendaires) : 1 fois sur 10, un pouvoir d'une autre classe (pour le recyclage, plus tard l'échange) ;
 *  sinon 3B : les pouvoirs officiels de cet emplacement qui visent un sort connu (4A de la 0.3) + les 5 pouvoirs maison,
 *  et 4C : 1 fois sur 10, un pouvoir d'un sort du jeu pas encore appris (« s'éveille au niveau N »). */
export function tirerPouvoirs(rng: Rng, ctx: CtxPouvoirs, slot: Slot, n: 1 | 2): TiragePouvoir[] {
  const slotP = slot === 'familier' ? null : slot;
  const off = (cl: string, f: (p: PouvoirDef) => boolean) => (POUVOIRS[cl] ?? []).filter(p => p.slot === slotP && (EN_JEU[cl] ?? []).includes(p.dofusId) && f(p));
  const out: TiragePouvoir[] = [], pris = new Set<string>();
  for (let i = 0; i < n; i++) {
    const libre = (l: PouvoirDef[]) => l.filter(p => !pris.has(p.id));
    let choix: PouvoirDef | null = null;
    const autres = Object.keys(POUVOIRS).filter(c => c !== ctx.classe);
    if (!ctx.garanti && rng.next() < 0.1 && autres.length) { const l = libre(off(rng.pick(autres), () => true)); if (l.length) choix = rng.pick(l); }
    if (!choix && !ctx.garanti && rng.next() < 0.1) {
      const l = libre(off(ctx.classe, p => ctx.aVenir.some(a => a.dofusId === p.dofusId)));
      if (l.length) choix = rng.pick(l);
    }
    if (!choix) {
      const l = libre(off(ctx.classe, p => ctx.connus.includes(p.dofusId)));
      // pool : chaque pouvoir officiel utile et chaque pouvoir maison ont la même chance (5 maison)
      const k = rng.int(l.length + (ctx.garanti && l.length ? 0 : 5));
      if (k < l.length) choix = l[k];
    }
    if (choix) { pris.add(choix.id); out.push({ officiel: choix.id }); }
    else out.push({ maison: true });
  }
  return out;
}

/** Cet emplacement a-t-il un pouvoir officiel de la classe sur un sort connu (Légendaire garanti, 8C) ? */
export const slotAPouvoirConnu = (ctx: CtxPouvoirs, slot: string) =>
  (POUVOIRS[ctx.classe] ?? []).some(p => p.slot === slot && ctx.connus.includes(p.dofusId) && (EN_JEU[ctx.classe] ?? []).includes(p.dofusId));

/** Applique les pouvoirs officiels portés à un grade de sort (copie). 5A : un même pouvoir porté deux fois ne compte qu'une fois. */
export function gradeAvecPouvoirs(g: SortGrade, liste: PouvoirDef[]): SortGrade {
  if (!liste.length) return g;
  const r: SortGrade = { ...g, po: [g.po[0], g.po[1]], dmg: g.dmg ? [g.dmg[0], g.dmg[1]] : undefined };
  for (const p of liste) {
    if (p.effet === 'po') r.po[1] += p.n;
    else if (p.effet === 'pomin') r.po[0] = Math.max(0, r.po[0] - p.n);
    else if (p.effet === 'pa') r.pa = Math.max(1, r.pa - p.n);
    else if (p.effet === 'relance') r.relance = Math.max(0, r.relance - p.n);
    else if ((p.effet === 'parTour' || p.effet === 'parCible') && r.parTour > 0) r.parTour += p.n;
    else if (p.effet === 'dmg' && r.dmg) { r.dmg[0] += p.n; r.dmg[1] += p.n; }
  }
  return r;
}
