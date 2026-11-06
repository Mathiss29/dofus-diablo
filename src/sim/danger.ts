import danger from '../data/danger.json';
import type { MonsterDef } from './defs';

/** Réglages du danger des monstres (src/data/danger.json, maquette « Danger » de Mathis). */
export const DANGER = danger;

export type Rang = 'normal' | 'elite' | 'boss';
export const rangOf = (d: MonsterDef): Rang => d.boss ? 'boss' : d.elite ? 'elite' : 'normal';


/** Jet moyen du meilleur sort offensif officiel du monstre (tous ses coups de dommages additionnés). */
export function jetOfficiel(d: MonsterDef): number {
  let best = 0;
  for (const s of d.spells ?? []) {
    let t = 0;
    for (const e of s.effects) if (e.k === 'dmg' && !e.perPa) t += (e.min + e.max) / 2;
    best = Math.max(best, t);
  }
  return best;
}

/** 1A : dégâts du coup moyen d'un monstre. Une part des PV d'un perso du même niveau selon son rang,
 *  modulée par la force de son sort officiel (un petit sort tape moins, un gros sort plus). */
export function degatsMonstre(d: MonsterDef): number {
  const D = DANGER.degats, lvl = d.level ?? 1;
  const pv = D.pvRef.base + D.pvRef.parNiveau * (lvl - 1);
  const jet = jetOfficiel(d);
  const mod = jet > 0 ? Math.min(D.max, Math.max(D.min, Math.sqrt(jet / D.jetRef))) : 1;
  return Math.max(1, Math.round(pv * D.part[rangOf(d)] * mod));
}
