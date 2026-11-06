import type { EquipSlot, Item, Stat } from './items';
import type { EtatQuetes } from './quests';
import type { World } from './world';

/** État du joueur gardé entre deux parties (écran « Mes personnages », 3 emplacements, choix 16B).
 *  Pur JSON : l'affichage le range où il veut (navigateur pour l'instant). */
export interface EtatJoueur {
  level: number; xp: number; points: number; kamas: number; potions: number; lootFilter: number;
  base: Partial<Record<Stat, number>>;
  bag: Item[]; equipment: Partial<Record<EquipSlot, Item>>;
  resources: Record<string, number>;
  metiers: Record<string, { level: number; xp: number }>;
  bar: (string | null)[]; variants: number[]; learned: string[];
  x: number; y: number;
  retour: { name: string; x: number; y: number };
  /** Quêtes du perso (à redonner au World : opts.reprise). */
  quetes?: EtatQuetes;
  /** Zone où se trouve le perso (absente : Incarnam, sauvegardes d'avant Astrub). */
  zone?: string;
}

const copie = <T>(o: T): T => JSON.parse(JSON.stringify(o)) as T;

export function exporterJoueur(w: World): EtatJoueur {
  const p = w.player;
  return copie({
    level: p.level, xp: p.xp, points: p.points, kamas: p.kamas, potions: p.potions, lootFilter: p.lootFilter,
    base: p.base, bag: p.bag, equipment: p.equipment, resources: p.resources, metiers: p.metiers,
    bar: p.bar, variants: p.variants, learned: [...p.learned],
    x: p.x, y: p.y, retour: w.pointDeRetour, quetes: w.quetes?.exporter(), zone: w.opts.zone,
  });
}

/** Remet le joueur d'une sauvegarde dans un monde tout neuf (même zone). Les objets reçoivent de nouveaux
 *  identifiants : ceux de la sauvegarde pourraient croiser ceux des monstres du nouveau monde. */
export function restaurerJoueur(w: World, e: EtatJoueur) {
  const p = w.player, s = copie(e);
  const uid = (it: Item) => ({ ...it, uid: w.newUid() });
  p.level = s.level; p.xp = s.xp; p.points = s.points; p.kamas = s.kamas; p.lootFilter = s.lootFilter ?? 0;
  p.potions = Math.min(s.potions ?? p.potions, p.cls.potion.charges);
  p.base = s.base ?? {}; p.resources = s.resources ?? {}; p.metiers = { ...p.metiers, ...s.metiers };
  p.bag = (s.bag ?? []).map(uid);
  p.equipment = Object.fromEntries(Object.entries(s.equipment ?? {}).map(([k, it]) => [k, uid(it as Item)]));
  p.variants = s.variants ?? [];
  p.learned = new Set(s.learned ?? []);
  if (s.bar?.length === p.bar.length) p.bar = s.bar.map(k => (k && p.cls.spells[k] ? k : null));
  p.recompute(); p.hp = p.maxHp;
  p.learnSpells(null);
  // position et point de retour : seulement dans la même zone, et pas à l'arrivée par un portail (le World y a posé le perso)
  if ((s.zone ?? 'incarnam') !== w.opts.zone || w.opts.arrivee) return;
  if (s.retour) w.setPointDeRetour(s.retour.name, s.retour.x, s.retour.y);
  // départ : là où l'on s'était arrêté, sinon au point de retour
  const r = w.pointDeRetour, ok = w.map.walkable(s.x, s.y);
  p.x = ok ? s.x : r.x; p.y = ok ? s.y : r.y;
}
