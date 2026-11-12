import type { EquipSlot, Item, Stat } from './items';
import { BENEDICTION, BENEDICTIONS, CONFORT, type Benediction } from './magasin';
import type { EtatQuetes } from './quests';
import type { RetourHavreSac } from './events';
import type { World } from './world';
import type { CleDonjon } from './arene';
import type { EtatGuerre } from './guerre';
import type { CommandeFM } from './forgemagie';
import type { EntreeCodex } from './codex';
import { Player, type Prereglage } from './player';
import { DOFUS, EMPLACEMENTS_DOFUS, TROPHEES } from './dofus';
import { drapeauxPropres, type Drapeau, type Tombe } from './carte';
import { exporterCoffre, restaurerCoffre, type EtatCoffre } from './enutrof';

/** État du joueur gardé entre deux parties (écran « Mes personnages », 3 emplacements, choix 16B).
 *  Pur JSON : l'affichage le range où il veut (navigateur pour l'instant). */
export interface EtatJoueur {
  level: number; xp: number; points: number; kamas: number; potions: number; lootFilter: number; autoBrisage?: boolean; autoDefaire?: 'commun' | 'rare' | null;
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
  /** Carte du monde (« Carte : » 6A, 9A, 15A ; « Carte suite : » 17A) : brouillard, drapeaux, tombe, lieux trouvés. */
  explore?: Record<string, string[]>;
  drapeaux?: Drapeau[];
  tombe?: Tombe | null;
  lieuxVus?: string[];
  havreSac?: RetourHavreSac;
  /** Clé d'un donjon encore valable (14A). */
  cleDonjon?: CleDonjon | null;
  /** Guerre des Cawottes (0.4) : attaques gagnées, en or, champs parfaits, Kiafin rattrapés, records. */
  guerre?: EtatGuerre;
  /** Commande chez Malek le Forgemage (Forgemagie UI 9E). */
  commandeFM?: CommandeFM | null;
  /** Codex des pouvoirs (0.3). */
  codex?: EntreeCodex[];
  codexOuvert?: boolean;
  ames?: string[];
  prereglages?: (Prereglage | null)[];
  /** Jour de la dernière offrande à l'Almanax (15C). */
  almanaxJour?: string | null;
  magasin?: { jour: string; etal: number[]; sac: boolean } | null;
  sacEnPlus?: number;
  benediction?: { k: string; reste: number } | null;
  /** Dofus possédés et portés (0.3). */
  dofus?: string[]; trophees?: string[]; dofusPortes?: (string | null)[];
  /** Enutrof : le coffre au trésor (pièces, objets de la vitrine, journal, records ; interface du coffre 8A). */
  coffreEnu?: EtatCoffre;
}

const copie = <T>(o: T): T => JSON.parse(JSON.stringify(o)) as T;

export function exporterJoueur(w: World): EtatJoueur {
  const p = w.player;
  return copie({
    level: p.level, xp: p.xp, points: p.points, kamas: p.kamas, potions: p.potions, lootFilter: p.lootFilter, autoDefaire: p.autoDefaire,
    base: p.base, bag: p.bag, equipment: p.equipment, resources: p.resources, metiers: p.metiers, recetteSuivie: p.recetteSuivie,
    bar: p.bar, variants: p.variants, learned: [...p.learned],
    x: p.x, y: p.y, retour: w.pointDeRetour, quetes: w.quetes?.exporter(), zone: w.opts.zone,
    apparats: p.apparats, apparat: p.apparat, codex: p.codex, codexOuvert: p.codexOuvert, ames: p.ames, prereglages: p.prereglages, almanaxJour: p.almanaxJour, magasin: p.magasin, sacEnPlus: p.sacEnPlus, benediction: p.benediction, dofus: p.dofus, trophees: p.trophees, dofusPortes: p.dofusPortes,
    zaaps: p.zaaps, zonesVues: p.zonesVues, explore: p.explore, drapeaux: p.drapeaux, tombe: p.tombe, lieuxVus: p.lieuxVus, cleDonjon: p.cleDonjon, guerre: p.guerre, commandeFM: p.commandeFM, ...(w.retour ? { havreSac: w.retour } : {}),
    ...(p.cls.coffre ? { coffreEnu: exporterCoffre(p) } : {}),
  });
}

/** Remet le joueur d'une sauvegarde dans un monde tout neuf (même zone). Les objets reçoivent de nouveaux
 *  identifiants : ceux de la sauvegarde pourraient croiser ceux des monstres du nouveau monde. */
export function restaurerJoueur(w: World, e: EtatJoueur) {
  const p = w.player, s = copie(e);
  const uid = (it: Item) => ({ ...it, uid: w.newUid() });
  p.level = s.level; p.xp = s.xp; p.points = s.points; p.kamas = s.kamas; p.lootFilter = s.lootFilter ?? 0; p.autoDefaire = s.autoDefaire !== undefined ? s.autoDefaire : s.autoBrisage ? 'commun' : null;
  p.potions = Math.min(s.potions ?? p.potions, p.cls.potion.charges);
  p.base = s.base ?? {}; p.resources = s.resources ?? {}; p.metiers = { ...p.metiers, ...s.metiers };
  p.recetteSuivie = typeof s.recetteSuivie === 'string' ? s.recetteSuivie : null;
  // objets de maître du jeu tombés par erreur (Annobusé de Maître Jarbo…) : retirés, sauf en partie de test
  const garde = (it: Item) => !!w.opts.test || !w.opts.items?.equipment[it.id]?.horsJeu;
  p.bag = (s.bag ?? []).filter(garde).map(uid);
  p.equipment = Object.fromEntries(Object.entries(s.equipment ?? {}).filter(([, it]) => garde(it as Item)).map(([k, it]) => [k, uid(it as Item)]));
  p.variants = s.variants ?? [];
  p.apparats = Array.isArray(s.apparats) ? s.apparats.filter(a => typeof a === 'string') : [];
  p.apparat = {};
  for (const k of ['chapeau', 'cape', 'bouclier', 'familier'] as const) { const a = s.apparat?.[k]; if (a === '0' || (a && p.apparats.includes(a))) p.apparat[k] = a; }
  p.sacEnPlus = Math.max(0, Math.min(CONFORT.sac.pas * CONFORT.sac.prix.length, Math.floor((s.sacEnPlus ?? 0) / CONFORT.sac.pas) * CONFORT.sac.pas));
  p.benediction = s.benediction && s.benediction.k in BENEDICTIONS && s.benediction.reste > 0 ? { k: s.benediction.k as Benediction, reste: Math.min(BENEDICTION.duree, s.benediction.reste) } : null;
  // 6C : 4e et 5e préréglages achetés (la sauvegarde garde leurs cases, même vides)
  const nPrer = Math.max(Player.PREREGLAGES, Math.min(Player.PREREGLAGES + CONFORT.prereglage.prix.length, Array.isArray(s.prereglages) ? s.prereglages.length : 0));
  p.prereglages = Array(nPrer).fill(null);
  if (Array.isArray(s.prereglages)) p.prereglages = Array.from({ length: p.prereglages.length }, (_, i) => {
    const r = s.prereglages![i];
    return r && typeof r === 'object' && r.equipement && Array.isArray(r.bar) ? { nom: String(r.nom ?? `Préréglage ${i + 1}`), equipement: r.equipement, bar: r.bar, variants: Array.isArray(r.variants) ? r.variants : [] } : null;
  });
  p.dofus = Array.isArray(s.dofus) ? s.dofus.filter(id => typeof id === 'string' && DOFUS[id]) : [];
  p.trophees = Array.isArray(s.trophees) ? s.trophees.filter(id => typeof id === 'string' && TROPHEES[id]) : [];
  p.dofusPortes = Array.from({ length: EMPLACEMENTS_DOFUS }, (_, i) => { const id = s.dofusPortes?.[i]; return typeof id === 'string' && (p.dofus.includes(id) || p.trophees.includes(id)) && s.dofusPortes!.indexOf(id) === i ? id : null; });
  p.almanaxJour = typeof s.almanaxJour === 'string' ? s.almanaxJour : null;
  p.magasin = s.magasin && typeof s.magasin.jour === 'string' ? { jour: s.magasin.jour, etal: Array.isArray(s.magasin.etal) ? s.magasin.etal.filter(n => typeof n === 'number') : [], sac: !!s.magasin.sac } : null;
  p.ames = Array.isArray(s.ames) ? s.ames.filter(a => typeof a === 'string') : [];
  p.codexOuvert = !!s.codexOuvert || (Array.isArray(s.codex) && s.codex.length > 0);
  p.codex = Array.isArray(s.codex) ? s.codex.filter(c => typeof c?.id === 'string').map(c => ({ id: c.id, ...(typeof c.sort === 'string' ? { sort: c.sort } : {}), ...(typeof c.value === 'number' && isFinite(c.value) ? { value: c.value } : {}) })) : [];
  p.learned = new Set(s.learned ?? []);
  if (Array.isArray(s.zaaps)) p.zaaps = s.zaaps.filter(z => typeof z?.zone === 'string' && typeof z?.name === 'string');
  p.zonesVues = [...new Set([...(s.zonesVues ?? []), ...p.zonesVues])];
  if (s.explore && typeof s.explore === 'object') for (const [z, l] of Object.entries(s.explore))
    if (Array.isArray(l)) p.explore[z] = [...new Set([...l.filter(t => typeof t === 'string' && /^-?\d+_-?\d+$/.test(t)), ...(p.explore[z] ?? [])])];
  p.drapeaux = drapeauxPropres(s.drapeaux);
  const tb = s.tombe;
  p.tombe = tb && typeof tb.zone === 'string' && Number.isFinite(tb.x) && Number.isFinite(tb.y) ? { zone: tb.zone, x: tb.x, y: tb.y } : null;
  if (Array.isArray(s.lieuxVus)) p.lieuxVus = [...new Set([...s.lieuxVus.filter(k => typeof k === 'string'), ...p.lieuxVus])];
  const c = s.cleDonjon;
  if (c && typeof c.nom === 'string' && c.reste > 0) p.cleDonjon = { nom: c.nom, vague: Math.max(1, Math.floor(c.vague) || 1), reste: c.reste };
  const g = s.guerre;
  if (g && typeof g === 'object') {
    const n = (v: unknown) => Math.max(0, Math.floor(Number(v)) || 0);
    p.guerre = { gagnees: n(g.gagnees), or: n(g.or), kiafins: n(g.kiafins), parfaits: Array.isArray(g.parfaits) ? g.parfaits.filter(t => typeof t === 'string') : [],
      records: Object.fromEntries(Object.entries(g.records ?? {}).filter(([, r]) => r && Number.isFinite(r.sauvees) && Number.isFinite(r.temps)).map(([k, r]) => [k, { sauvees: n(r.sauvees), temps: n(r.temps) }])),
      malchance: Math.max(0, Number(g.malchance) || 0) };
  }
  const f = s.commandeFM;
  if (f?.item && f.rapport && typeof f.reste === 'number') p.commandeFM = { ...f, item: uid(f.item), reste: Math.max(0, f.reste) };
  if (s.havreSac && w.dansRefuge && !w.retour) w.retour = s.havreSac;
  restaurerCoffre(p, s.coffreEnu, uid);
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
