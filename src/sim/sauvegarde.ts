import { BASE_STATS, type EquipSlot, type Item, type Stat } from './items';
import { BOISSONS, CONSO, ELIXIRS, REPAS } from './consommables';
import { IDOLES_DEFS, basculerIdole, etatIdolesVide, type EtatIdoles } from './idoles';
import { placesTenues, SORTES_STYLE, STYLE, type StyleChoisi, type Tenue } from './style';
import { BENEDICTION, BENEDICTIONS, CONFORT, type Benediction } from './magasin';
import type { EtatQuetes } from './quests';
import type { RetourHavreSac } from './events';
import type { World } from './world';
import type { CleDonjon } from './arene';
import type { EtatGuerre } from './guerre';
import type { EtatVivant } from './mondeVivant';
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
  /** 0.6 : cartes chassées (6D) et boss sans Légendaire d'affilée (24A). */
  chasse?: Record<string, string[]>; bossSansLeg?: Record<string, number>;
  /** 0.6 : idoles (17-18). */
  idoles?: EtatIdoles;
  /** 0.6 : renommée par région (paliers obtenus) et sanctuaires trouvés (19-20). */
  renommee?: Record<string, number>; sanctuaires?: string[];
  drapeaux?: Drapeau[];
  tombe?: Tombe | null;
  lieuxVus?: string[];
  havreSac?: RetourHavreSac;
  /** Clé d'un donjon encore valable (14A). */
  cleDonjon?: CleDonjon | null;
  /** Guerre des Cawottes (0.4) : attaques gagnées, en or, champs parfaits, Kiafin rattrapés, records. */
  guerre?: EtatGuerre;
  /** 0.5 « monde vivant » : boss du monde vaincus, apparitions récompensées, invasions, Éclats, événements. */
  vivant?: EtatVivant;
  /** Commande chez Malek le Forgemage (Forgemagie UI 9E). */
  commandeFM?: CommandeFM | null;
  /** Codex des pouvoirs (0.3). */
  codex?: EntreeCodex[];
  codexOuvert?: boolean;
  ames?: string[];
  menagerie?: string[];
  style?: StyleChoisi; tenues?: Tenue[]; placesTenue?: number;
  familierOffert?: boolean;
  aboJour?: { jour: string; beni: number; cles: number };
  prereglages?: (Prereglage | null)[];
  /** Jour de la dernière offrande à l'Almanax (15C). */
  almanaxJour?: string | null;
  magasin?: { jour: string; etal: number[]; sac: boolean } | null;
  sacEnPlus?: number;
  benediction?: { k: string; reste: number } | null;
  /** « Métiers : » 4A-4C, 5A : repas et élixir actifs, points de parchemin, boisson sur sa touche. */
  repas?: { id: string; reste: number } | null; elixir?: { id: string; reste: number } | null;
  parchemins?: Partial<Record<Stat, number>>; ceinture?: string | null;
  /** Dofus possédés et portés (0.3). */
  dofus?: string[]; trophees?: string[]; dofusPortes?: (string | null)[];
  /** 0.6 (10C) : ressources déjà récoltées (potager du Havre-Sac). */
  recoltees?: string[];
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
    apparats: p.apparats, apparat: p.apparat, codex: p.codex, codexOuvert: p.codexOuvert, ames: p.ames, menagerie: p.menagerie, familierOffert: p.familierOffert, aboJour: p.aboJour, style: p.style, tenues: p.tenues, placesTenue: p.placesTenue, prereglages: p.prereglages, almanaxJour: p.almanaxJour, magasin: p.magasin, sacEnPlus: p.sacEnPlus, benediction: p.benediction, repas: p.repas, elixir: p.elixir, parchemins: p.parchemins, ceinture: p.ceinture, dofus: p.dofus, trophees: p.trophees, recoltees: p.recoltees, dofusPortes: p.dofusPortes,
    zaaps: p.zaaps, zonesVues: p.zonesVues, explore: p.explore, chasse: p.chasse, bossSansLeg: p.bossSansLeg, idoles: p.idoles, renommee: p.renommee, sanctuaires: p.sanctuaires, drapeaux: p.drapeaux, tombe: p.tombe, lieuxVus: p.lieuxVus, cleDonjon: p.cleDonjon, guerre: p.guerre, vivant: p.vivant, commandeFM: p.commandeFM, ...(w.retour ? { havreSac: w.retour } : {}),
    ...(p.cls.coffre ? { coffreEnu: exporterCoffre(p) } : {}),
  });
}

/** Remet le joueur d'une sauvegarde dans un monde tout neuf (même zone). Les objets reçoivent de nouveaux
 *  identifiants : ceux de la sauvegarde pourraient croiser ceux des monstres du nouveau monde. */
export function restaurerJoueur(w: World, e: EtatJoueur) {
  const p = w.player, s = copie(e);
  const uid = (it: Item) => ({ ...it, uid: w.newUid() });
  p.level = s.level; p.xp = s.xp; p.points = s.points; p.kamas = s.kamas; p.lootFilter = s.lootFilter ?? 0; p.autoDefaire = s.autoDefaire !== undefined ? s.autoDefaire : s.autoBrisage ? 'commun' : null;
  p.potions = Math.min(s.potions ?? p.potions, p.potionsMax);
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
  const conso = (c: { id: string; reste: number } | null | undefined, l: Record<string, unknown>) =>
    c && typeof c.id === 'string' && l[c.id] && c.reste > 0 ? { id: c.id, reste: Math.min(CONSO.duree, c.reste) } : null;
  p.repas = conso(s.repas, REPAS); p.elixir = conso(s.elixir, ELIXIRS);
  p.parchemins = Object.fromEntries(Object.entries(s.parchemins ?? {}).filter(([k, n]) => BASE_STATS.includes(k as Stat) && Number.isFinite(n) && (n as number) > 0)
    .map(([k, n]) => [k, Math.min(CONSO.parcheminMax, Math.floor(n as number))]));
  p.ceinture = typeof s.ceinture === 'string' && BOISSONS[s.ceinture] ? s.ceinture : null;
  // 6C : 4e et 5e préréglages achetés (la sauvegarde garde leurs cases, même vides)
  const nPrer = Math.max(Player.PREREGLAGES, Math.min(Player.PREREGLAGES + CONFORT.prereglage.prix.length, Array.isArray(s.prereglages) ? s.prereglages.length : 0));
  p.prereglages = Array(nPrer).fill(null);
  if (Array.isArray(s.prereglages)) p.prereglages = Array.from({ length: p.prereglages.length }, (_, i) => {
    const r = s.prereglages![i];
    return r && typeof r === 'object' && r.equipement && Array.isArray(r.bar) ? { nom: String(r.nom ?? `Préréglage ${i + 1}`), equipement: r.equipement, bar: r.bar, variants: Array.isArray(r.variants) ? r.variants : [] } : null;
  });
  p.dofus = Array.isArray(s.dofus) ? s.dofus.filter(id => typeof id === 'string' && DOFUS[id]) : [];
  p.recoltees = Array.isArray(s.recoltees) ? [...new Set(s.recoltees.filter(id => typeof id === 'string' && /^\d{1,7}$/.test(id)))] : [];
  p.trophees = Array.isArray(s.trophees) ? s.trophees.filter(id => typeof id === 'string' && TROPHEES[id]) : [];
  p.dofusPortes = Array.from({ length: EMPLACEMENTS_DOFUS }, (_, i) => { const id = s.dofusPortes?.[i]; return typeof id === 'string' && (p.dofus.includes(id) || p.trophees.includes(id)) && s.dofusPortes!.indexOf(id) === i ? id : null; });
  p.almanaxJour = typeof s.almanaxJour === 'string' ? s.almanaxJour : null;
  p.magasin = s.magasin && typeof s.magasin.jour === 'string' ? { jour: s.magasin.jour, etal: Array.isArray(s.magasin.etal) ? s.magasin.etal.filter(n => typeof n === 'number') : [], sac: !!s.magasin.sac } : null;
  p.ames = Array.isArray(s.ames) ? s.ames.filter(a => typeof a === 'string') : [];
  p.menagerie = Array.isArray(s.menagerie) ? [...new Set(s.menagerie.filter(a => typeof a === 'string'))] : [];
  p.familierOffert = !!s.familierOffert;
  if (s.aboJour && typeof s.aboJour.jour === 'string') p.aboJour = { jour: s.aboJour.jour, beni: Math.max(0, Number(s.aboJour.beni) || 0), cles: Math.max(0, Number(s.aboJour.cles) || 0) };
  p.style = Object.fromEntries(SORTES_STYLE.filter(k => typeof s.style?.[k] === 'string').map(k => [k, s.style![k]!]));
  p.placesTenue = Math.max(0, Math.min(STYLE.tenues.prix.length, Math.floor(Number(s.placesTenue) || 0)));
  p.tenues = Array.isArray(s.tenues) ? s.tenues.filter(t => t && typeof t.nom === 'string' && t.apparat && typeof t.apparat === 'object').slice(0, placesTenues(p.placesTenue))
    .map(t => ({ nom: t.nom.slice(0, 24), apparat: Object.fromEntries(Object.entries(t.apparat).filter(([k, v]) => ['chapeau', 'cape', 'bouclier', 'familier'].includes(k) && typeof v === 'string')),
      ...(Array.isArray(t.couleurs) && t.couleurs.every(c => Number.isInteger(c)) ? { couleurs: t.couleurs.slice(0, 8) } : {}) })) : [];
  p.codexOuvert = !!s.codexOuvert || (Array.isArray(s.codex) && s.codex.length > 0);
  p.codex = Array.isArray(s.codex) ? s.codex.filter(c => typeof c?.id === 'string').map(c => ({ id: c.id, ...(typeof c.sort === 'string' ? { sort: c.sort } : {}), ...(typeof c.value === 'number' && isFinite(c.value) ? { value: c.value } : {}) })) : [];
  p.learned = new Set(s.learned ?? []);
  if (Array.isArray(s.zaaps)) p.zaaps = s.zaaps.filter(z => typeof z?.zone === 'string' && typeof z?.name === 'string');
  p.zonesVues = [...new Set([...(s.zonesVues ?? []), ...p.zonesVues])];
  if (s.chasse && typeof s.chasse === 'object') for (const [z, l] of Object.entries(s.chasse))
    if (Array.isArray(l)) p.chasse[z] = [...new Set(l.filter(t => typeof t === 'string' && /^-?\d+_-?\d+$/.test(t)))];
  if (s.idoles && typeof s.idoles === 'object') {
    const ok = (l: unknown) => Array.isArray(l) ? [...new Set(l.filter((id): id is string => typeof id === 'string' && !!IDOLES_DEFS[id]))] : [];
    const possedees = ok(s.idoles.possedees), e = etatIdolesVide();
    e.possedees = possedees;
    for (const id of ok(s.idoles.actives)) if (possedees.includes(id)) basculerIdole(e, id);
    if (Array.isArray(s.idoles.jeux)) e.jeux = e.jeux.map((_, i) => { const j = s.idoles!.jeux[i]; return j && typeof j === 'object' ? { nom: String(j.nom ?? `Jeu ${i + 1}`).slice(0, 24), ids: ok(j.ids) } : null; });
    p.idoles = e;
  }
  if (s.renommee && typeof s.renommee === 'object') for (const [r, n] of Object.entries(s.renommee))
    if (typeof n === 'number' && n > 0) p.renommee[r.slice(0, 40)] = Math.min(4, Math.floor(n));
  if (Array.isArray(s.sanctuaires)) p.sanctuaires = [...new Set(s.sanctuaires.filter((x): x is string => typeof x === 'string' && /^[^|]{1,40}\|\d+\|(vitalite|sagesse|force|intelligence|chance|agilite)$/.test(x)))];
  if (s.bossSansLeg && typeof s.bossSansLeg === 'object') for (const [b, n] of Object.entries(s.bossSansLeg))
    if (typeof n === 'number' && n > 0 && Number.isFinite(n)) p.bossSansLeg[b] = Math.min(1000, Math.floor(n));
  if (s.explore && typeof s.explore === 'object') for (const [z, l] of Object.entries(s.explore))
    if (Array.isArray(l)) p.explore[z] = [...new Set([...l.filter(t => typeof t === 'string' && /^-?\d+_-?\d+$/.test(t)), ...(p.explore[z] ?? [])])];
  p.drapeaux = drapeauxPropres(s.drapeaux);
  const tb = s.tombe;
  p.tombe = tb && typeof tb.zone === 'string' && Number.isFinite(tb.x) && Number.isFinite(tb.y) ? { zone: tb.zone, x: tb.x, y: tb.y } : null;
  if (Array.isArray(s.lieuxVus)) p.lieuxVus = [...new Set([...s.lieuxVus.filter(k => typeof k === 'string'), ...p.lieuxVus])];
  const c = s.cleDonjon;
  if (c && typeof c.nom === 'string' && c.reste > 0) p.cleDonjon = { nom: c.nom, vague: Math.max(1, Math.floor(c.vague) || 1), reste: c.reste, ...(c.renforcee === true ? { renforcee: true } : {}) };
  const g = s.guerre;
  if (g && typeof g === 'object') {
    const n = (v: unknown) => Math.max(0, Math.floor(Number(v)) || 0);
    p.guerre = { gagnees: n(g.gagnees), or: n(g.or), kiafins: n(g.kiafins), parfaits: Array.isArray(g.parfaits) ? g.parfaits.filter(t => typeof t === 'string') : [],
      records: Object.fromEntries(Object.entries(g.records ?? {}).filter(([, r]) => r && Number.isFinite(r.sauvees) && Number.isFinite(r.temps)).map(([k, r]) => [k, { sauvees: n(r.sauvees), temps: n(r.temps) }])),
      malchance: Math.max(0, Number(g.malchance) || 0) };
  }
  const vv = s.vivant;
  if (vv && typeof vv === 'object') {
    const n = (v: unknown) => Math.max(0, Math.floor(Number(v)) || 0), txt = (l: unknown) => Array.isArray(l) ? l.filter(t => typeof t === 'string') : [];
    p.vivant = { boss: txt(vv.boss), apparitions: Array.isArray(vv.apparitions) ? vv.apparitions.filter(Number.isFinite).slice(-12) : [], invasions: n(vv.invasions),
      eclatsHeure: Number.isFinite(vv.eclatsHeure) ? Math.floor(vv.eclatsHeure) : -1, evenements: n(vv.evenements) };
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
