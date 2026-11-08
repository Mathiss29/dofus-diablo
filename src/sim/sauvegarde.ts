import type { EquipSlot, Item, Stat } from './items';
import type { EtatQuetes } from './quests';
import type { RetourHavreSac } from './events';
import type { World } from './world';
import type { CleDonjon } from './arene';
import type { CommandeFM } from './forgemagie';
import type { EntreeCodex } from './codex';
import type { Prereglage } from './player';

/** État du joueur gardé entre deux parties (écran « Mes personnages », 3 emplacements, choix 16B).
 *  Pur JSON : l'affichage le range où il veut (navigateur pour l'instant). */
export interface EtatJoueur {
  level: number; xp: number; points: number; kamas: number; potions: number; lootFilter: number; autoBrisage?: boolean;
  base: Partial<Record<Stat, number>>;
  bag: Item[]; equipment: Partial<Record<EquipSlot, Item>>;
  resources: Record<string, number>;
  metiers: Record<string, { level: number; xp: number }>;
  recetteSuivie?: string | null;
  bar: (string | null)[]; variants: number[]; learned: string[];
  x: number; y: number;
  retour: { name: string; x: number; y: number };
  /** Quêtes du perso (à redonner au World : opts.reprise). */
  quetes?: EtatQuetes;
  /** Zone où se trouve le perso (absente : Incarnam, sauvegardes d'avant Astrub). */
  zone?: string;
  /** Apparat possédé et porté (Apparence 5A). */
  apparats?: string[];
  apparat?: Partial<Record<'chapeau' | 'cape' | 'bouclier' | 'familier', string>>;
  /** Havre-Sac (maquette Hub) : Zaaps découverts, zones visitées, et d'où l'on vient si l'on est dans le Havre-Sac. */
  zaaps?: { zone: string; name: string }[];
  zonesVues?: string[];
  havreSac?: RetourHavreSac;
  /** Clé d'un donjon encore valable (14A). */
  cleDonjon?: CleDonjon | null;
  /** Commande chez Malek le Forgemage (Forgemagie UI 9E). */
  commandeFM?: CommandeFM | null;
  /** Codex des pouvoirs (0.3). */
  codex?: EntreeCodex[];
  codexOuvert?: boolean;
  ames?: string[];
  prereglages?: (Prereglage | null)[];
}

const copie = <T>(o: T): T => JSON.parse(JSON.stringify(o)) as T;

export function exporterJoueur(w: World): EtatJoueur {
  const p = w.player;
  return copie({
    level: p.level, xp: p.xp, points: p.points, kamas: p.kamas, potions: p.potions, lootFilter: p.lootFilter, autoBrisage: p.autoBrisage,
    base: p.base, bag: p.bag, equipment: p.equipment, resources: p.resources, metiers: p.metiers, recetteSuivie: p.recetteSuivie,
    bar: p.bar, variants: p.variants, learned: [...p.learned],
    x: p.x, y: p.y, retour: w.pointDeRetour, quetes: w.quetes?.exporter(), zone: w.opts.zone,
    apparats: p.apparats, apparat: p.apparat, codex: p.codex, codexOuvert: p.codexOuvert, ames: p.ames, prereglages: p.prereglages,
    zaaps: p.zaaps, zonesVues: p.zonesVues, cleDonjon: p.cleDonjon, commandeFM: p.commandeFM, ...(w.retour ? { havreSac: w.retour } : {}),
  });
}

/** Remet le joueur d'une sauvegarde dans un monde tout neuf (même zone). Les objets reçoivent de nouveaux
 *  identifiants : ceux de la sauvegarde pourraient croiser ceux des monstres du nouveau monde. */
export function restaurerJoueur(w: World, e: EtatJoueur) {
  const p = w.player, s = copie(e);
  const uid = (it: Item) => ({ ...it, uid: w.newUid() });
  p.level = s.level; p.xp = s.xp; p.points = s.points; p.kamas = s.kamas; p.lootFilter = s.lootFilter ?? 0; p.autoBrisage = !!s.autoBrisage;
  p.potions = Math.min(s.potions ?? p.potions, p.cls.potion.charges);
  p.base = s.base ?? {}; p.resources = s.resources ?? {}; p.metiers = { ...p.metiers, ...s.metiers };
  p.recetteSuivie = typeof s.recetteSuivie === 'string' ? s.recetteSuivie : null;
  p.bag = (s.bag ?? []).map(uid);
  p.equipment = Object.fromEntries(Object.entries(s.equipment ?? {}).map(([k, it]) => [k, uid(it as Item)]));
  p.variants = s.variants ?? [];
  p.apparats = Array.isArray(s.apparats) ? s.apparats.filter(a => typeof a === 'string') : [];
  p.apparat = {};
  for (const k of ['chapeau', 'cape', 'bouclier', 'familier'] as const) { const a = s.apparat?.[k]; if (a === '0' || (a && p.apparats.includes(a))) p.apparat[k] = a; }
  if (Array.isArray(s.prereglages)) p.prereglages = Array.from({ length: p.prereglages.length }, (_, i) => {
    const r = s.prereglages![i];
    return r && typeof r === 'object' && r.equipement && Array.isArray(r.bar) ? { nom: String(r.nom ?? `Préréglage ${i + 1}`), equipement: r.equipement, bar: r.bar, variants: Array.isArray(r.variants) ? r.variants : [] } : null;
  });
  p.ames = Array.isArray(s.ames) ? s.ames.filter(a => typeof a === 'string') : [];
  p.codexOuvert = !!s.codexOuvert || (Array.isArray(s.codex) && s.codex.length > 0);
  p.codex = Array.isArray(s.codex) ? s.codex.filter(c => typeof c?.id === 'string').map(c => ({ id: c.id, ...(typeof c.sort === 'string' ? { sort: c.sort } : {}) })) : [];
  p.learned = new Set(s.learned ?? []);
  if (Array.isArray(s.zaaps)) p.zaaps = s.zaaps.filter(z => typeof z?.zone === 'string' && typeof z?.name === 'string');
  p.zonesVues = [...new Set([...(s.zonesVues ?? []), ...p.zonesVues])];
  const c = s.cleDonjon;
  if (c && typeof c.nom === 'string' && c.reste > 0) p.cleDonjon = { nom: c.nom, vague: Math.max(1, Math.floor(c.vague) || 1), reste: c.reste };
  const f = s.commandeFM;
  if (f?.item && f.rapport && typeof f.reste === 'number') p.commandeFM = { ...f, item: uid(f.item), reste: Math.max(0, f.reste) };
  if (s.havreSac && w.dansRefuge && !w.retour) w.retour = s.havreSac;
  if (s.bar?.length === p.bar.length) p.bar = s.bar.map(k => (k && p.cls.spells[k] ? k : null));
  p.recompute();
  if (p.verifierPoints()) w.emit({ k: 'status', x: p.x, y: p.y - 60, text: 'Points de caractéristiques rendus (nouveaux coûts)', color: '#b9e54b' });
  p.hp = p.maxHp;
  p.learnSpells(null);
  // position et point de retour : seulement dans la même zone, et pas à l'arrivée par un portail (le World y a posé le perso)
  if ((s.zone ?? 'incarnam') !== w.opts.zone || w.opts.arrivee || w.opts.position || w.opts.zaap) return;
  if (s.retour) w.setPointDeRetour(s.retour.name, s.retour.x, s.retour.y);
  // départ : là où l'on s'était arrêté, sinon au point de retour
  const r = w.pointDeRetour, ok = w.map.walkable(s.x, s.y);
  p.x = ok ? s.x : r.x; p.y = ok ? s.y : r.y;
  w.reprendreArene();   // rechargé dans l'arène d'un donjon : vagues reprises, ou retour devant le gardien
}
