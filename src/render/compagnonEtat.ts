// Écran du bas (« Écran du bas : » 1A…9B, 2026-11-16) : ce que le jeu envoie à la page compagnon.
// Lit la partie sans la modifier ; les actions venues d'en bas passent par la scène (zoneScene.brancherEcranDuBas).
import type { World } from '../sim/world';
import type { Item } from '../sim/items';
import { EQUIP_SLOTS, noteObjet } from '../sim/items';
import { ISO } from '../sim/iso';
import { GAME_DATA, ITEMS } from '../sim/data';
import { effetsActifs } from '../sim/effets';
import { rangAbo } from '../sim/boutiqueOgrines';

const CASE = 48;

export interface PersoBas {
  nom: string; classe: string; classeId: string; sexe: 'm' | 'f'; niveau: number; xp: number;
  pv: number; pvMax: number; bouclier: number; pa: number; paMax: number; pm: number; pmMax: number;
  jauge: { nom: string; v: number; max: number } | null; lieu: string; kamas: number; potions: number;
}
export interface SortBas { icone: number; nom: string; t: number; frac: number; charges: number | null }
export interface EffetBas { nom: string; t: number; sorte: 'sort' | 'monstre' | 'objet' }
/** inter : ce que A maintenu prendrait (« Parler à Ganymède »), montré en bouton sur l'écran du bas (Confort Thor 1E). */
export interface EtatBas { perso: PersoBas; sorts: SortBas[]; effets: EffetBas[]; inter?: string | null }

/** Carte : en pixels du plan du monde (carte_fondu.webp) quand le monde a une carte, sinon en cases autour du perso (radar). */
export interface CarteBas {
  monde: string | null;
  /** dir : angle du regard à l'écran (radians). */
  moi: { x: number; y: number; dir: number };
  monstres: [number, number, number][];   // x, y, 0 normal / 1 élite / 2 boss
  allies: [number, number, string][];
  butin: [number, number, string][];      // x, y, couleur de la rareté
  but: { x: number; y: number; nom: string } | null;
  zaaps: { i: number; nom: string; x: number; y: number }[];
  surZaap: boolean;
  /** Pixels du plan par case (pour le rayon du radar et le zoom de départ). */
  pxCase: number;
}

export interface ObjetBas { uid: number; icone: number; rar: string; nom: string; niv: number; slot: string | null; cadenas: boolean; mieux: boolean; trop: boolean; neuf: boolean }
export interface SacBas { objets: ObjetBas[]; portes: Record<string, ObjetBas>; taille: number; defaire: boolean }
export interface QueteBas { id: string; nom: string; suivie: boolean; campagne: boolean; lignes: string[] }
export interface QuetesBas { quetes: QueteBas[]; succes: string[]; groupe: { nom: string; classe: string; niveau: number; pv: number; pvMax: number }[] }

export function etatBas(w: World, nom: string, sexe: 'm' | 'f'): EtatBas {
  const p = w.player, cls = p.cls;
  const jauge = cls.rage?.max ? { nom: cls.rage.name, v: Math.floor(p.rage), max: cls.rage.max } : null;
  const sorts: SortBas[] = [];
  for (let i = 0; i < 6; i++) {
    const id = p.bar[i], def = id ? p.spell(id) : undefined;
    if (!id || !def) continue;
    const ch = p.charges(id), vide = ch.max > 0 && ch.n === 0, cdT = p.cd[id] ?? 0, cdMax = p.cdMax[id] || p.recharge(id);
    const t = cdT > 0 ? cdT : vide ? ch.prochaine : 0, frac = cdT > 0 ? (cdMax ? Math.min(1, cdT / cdMax) : 0) : vide ? ch.prochaine / p.retourCharge : 0;
    sorts.push({ icone: def.icon, nom: def.name, t: Math.round(t * 10) / 10, frac: Math.round(frac * 100) / 100, charges: ch.max ? ch.n : null });
  }
  return {
    perso: { nom, classe: cls.name, classeId: w.opts.classId ?? 'iop', sexe, niveau: p.level, xp: p.level >= cls.maxLevel ? 1 : p.xp / p.xpNeeded,
      pv: Math.max(0, Math.ceil(p.hp)), pvMax: p.maxHp, bouclier: Math.ceil(p.shield), pa: Math.floor(p.pa), paMax: Math.round(p.paMax),
      pm: Math.floor(p.pm), pmMax: Math.round(p.pmMax), jauge, lieu: w.area?.name ?? w.zone.name, kamas: p.kamas, potions: p.potions },
    sorts,
    effets: effetsActifs(p).slice(0, 8).map(e => ({ nom: e.nom, t: isFinite(e.t) ? Math.ceil(e.t) : -1, sorte: e.sorte })),
  };
}

/** Point du jeu -> pixels du plan du monde (même calcul que la carte du monde, carteMonde.duJeu). */
function versPlan(w: World) {
  const wg = w.worldGrid, c = wg?.world.carte;
  if (!wg || !c || !w.zone.open) return null;
  return (x: number, y: number): [number, number] => { const s = ISO.toScreen(x, y), m = wg.fromScreen(s.x, s.y); return [Math.round((m.x - c.x) * c.k), Math.round((m.y - c.y) * c.k)]; };
}
/** Pixels du plan -> point du jeu (toucher la carte du bas = flèche, 3B). */
export function depuisPlan(w: World, px: number, py: number): { x: number; y: number } | null {
  const wg = w.worldGrid, c = wg?.world.carte;
  if (!wg || !c) return null;
  const s = wg.toScreen(px / c.k + c.x, py / c.k + c.y);
  return ISO.toWorld(s.x, s.y);
}

export function carteBas(w: World, voisins: (cle: string) => boolean): CarteBas {
  const p = w.player, plan = versPlan(w);
  // radar (monde sans carte) : en cases, vu comme à l'écran (isométrique), le perso au centre
  const pt = plan ?? ((x: number, y: number): [number, number] => { const s = ISO.toScreen(x - p.x, y - p.y); return [Math.round(s.x / CASE * 10) / 10, Math.round(s.y / CASE * 10) / 10]; });
  const loin = CASE * (plan ? 40 : 24);
  const proche = (x: number, y: number) => Math.abs(x - p.x) < loin && Math.abs(y - p.y) < loin;
  const [mx, my] = pt(p.x, p.y);
  const monstres: CarteBas['monstres'] = [];
  for (const m of w.monsters) if (!m.dead && proche(m.x, m.y)) { const [x, y] = pt(m.x, m.y); monstres.push([x, y, m.def.boss ? 2 : m.def.elite ? 1 : 0]); }
  const allies: CarteBas['allies'] = w.players.filter(o => o !== p).map(o => { const [x, y] = pt(o.x, o.y); return [x, y, o.nom ?? '']; });
  const butin: CarteBas['butin'] = [];
  for (const d of w.drops) if (d.t >= 0 && d.item && proche(d.x, d.y)) { const [x, y] = pt(d.x, d.y); butin.push([x, y, d.item.rarity]); }
  const Q = w.quetes, b = Q?.suivie ? Q.butDe(Q.suivie) : null;
  const but = b ? (() => { const [x, y] = pt(b.x, b.y); return { x, y, nom: b.nom }; })() : null;
  // Zaaps du monde montré (3D) : découverts (index dans p.zaaps) ou à découvrir (-1)
  const zaaps: CarteBas['zaaps'] = [];
  if (plan) for (const z of w.zaapsIci()) {
    const i = p.zaaps.findIndex(o => o.zone === w.opts.zone && o.name === z.name), [x, y] = plan(z.x, z.y);
    zaaps.push({ i, nom: GAME_DATA.zones[w.opts.zone ?? '']?.open?.checkpoints?.find(c => c.name === z.name)?.name ?? z.name, x, y });
  }
  const c = w.worldGrid?.world.carte;
  return { monde: plan ? w.zone.open!.world : null, moi: { x: mx, y: my, dir: (() => { const d = ISO.toScreen(Math.cos(p.facing), Math.sin(p.facing)); return Math.round(Math.atan2(d.y, d.x) * 100) / 100; })() }, monstres, allies, butin, but,
    zaaps, surZaap: !!w.zaapProche() || voisins('zaap'), pxCase: plan && c ? Math.max(2, Math.round(CASE / 2 * c.k * 10) / 10) : 1 };
}

const objetBas = (w: World, it: Item, neufs: Set<number>): ObjetBas | null => {
  const p = w.player, d = ITEMS.equipment[it.id];
  if (!d) return null;
  const slot = p.slotFor(it), cur = slot ? p.equipment[slot] : undefined;
  return { uid: it.uid, icone: d.icon, rar: it.rarity, nom: d.name, niv: d.level, slot, cadenas: !!it.cadenas,
    mieux: d.level <= p.level && (!cur || noteObjet(it) > noteObjet(cur)), trop: d.level > p.level, neuf: neufs.has(it.uid) };
};

/** Sac (4A-4C) : le butin récent en tête (objets apparus depuis que l'écran du bas est relié, 3 min), puis le reste. */
export function sacBas(w: World, neufs: Set<number>): SacBas {
  const p = w.player, objets: ObjetBas[] = [];
  for (const it of p.bag) { const o = objetBas(w, it, neufs); if (o) objets.push(o); }
  objets.sort((a, b) => Number(b.neuf) - Number(a.neuf) || Number(b.mieux) - Number(a.mieux) || b.niv - a.niv);
  const portes: Record<string, ObjetBas> = {};
  for (const s of EQUIP_SLOTS) { const it = p.equipment[s], o = it && objetBas(w, it, neufs); if (o) portes[s] = o; }
  return { objets, portes, taille: p.tailleSac, defaire: !!rangAbo(p.abo) };
}

export function quetesBas(w: World): QuetesBas {
  const Q = w.quetes, quetes: QueteBas[] = [];
  if (Q) for (const cq of Q.enCours) {
    const def = Q.def(cq.id), e = Q.etapeDe(cq);
    const lignes = cq.aRendre ? [`Retourner voir ${Q.data.pnj[def.rendre!]?.nom ?? ''}`]
      : (e?.objectifs ?? []).map((o, i) => { const tot = Q.total(o), n = Math.min(cq.compte[i] ?? 0, tot); return `${n >= tot ? '✓' : '•'} ${o.texte}${tot > 1 ? `  ${n}/${tot}` : ''}`; });
    quetes.push({ id: cq.id, nom: def.type === 'campagne' ? `${def.serie ?? ''} · ${def.nom}` : def.nom, suivie: Q.suivie === cq.id, campagne: def.type === 'campagne', lignes });
  }
  quetes.sort((a, b) => Number(b.suivie) - Number(a.suivie) || Number(b.campagne) - Number(a.campagne));
  const succes: string[] = [];
  if (Q) for (const id of Q.epingles) {
    const sd = Q.data.succes[id]; if (!sd) continue;
    const pr = sd.objectifs.length === 1 ? Q.progres(sd.objectifs[0]) : [sd.objectifs.filter(o => Q.objectifSuccesFait(o)).length, sd.objectifs.length];
    succes.push(`${sd.nom}  ${pr[0]}/${pr[1]}`);
  }
  const groupe = w.players.filter(o => o !== w.player).map(o => ({ nom: o.nom ?? '', classe: o.cls.name, niveau: o.level, pv: Math.max(0, Math.ceil(o.hp)), pvMax: o.maxHp }));
  return { quetes, succes, groupe };
}
