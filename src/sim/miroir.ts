import type { World } from './world';
import type { PlayerInput } from './input';
import type { SimEvent } from './events';
import type { Dialogue, EtatQuetes } from './quests';
import { Entity } from './entity';
import { Player } from './player';
import { Monster } from './monster';
import { Bete, BETES } from './bete';
import { Arene } from './arene';
import { drapeauxPropres, signalPropre } from './carte';

/** Coop (maquette « Multi : » 3A) : l'hôte fait tourner la partie et envoie à chaque invité un instantané de ce qui se voit ;
 *  l'invité garde un monde « miroir » qu'il ne fait jamais avancer lui-même : il y recopie les instantanés, et l'affichage le lit
 *  comme une partie normale. Seuls les champs qui ont changé partent (delta par invité). Pur : ni réseau ni affichage ici. */

/** Valeur qui passe sur le réseau (JSON). Un perso, un monstre ou une bête cités ailleurs deviennent { $e: id }. */
export type Val = null | number | string | boolean | Val[] | { [k: string]: Val };
type Champs = Record<string, Val>;
type Sorte = 'j' | 'm' | 'b';

export interface Instantane {
  /** Numéro (croissant) ; plein = tout repart de zéro (premier envoi, ou nouvel invité). */
  n: number; plein?: boolean;
  /** Le perso de cet invité (il devient world.player chez lui). */
  moi: number;
  /** Temps de la partie et compteurs du monde. */
  t: number; w?: Champs;
  /** Entités présentes (les autres disparaissent chez l'invité) et champs changés. */
  ids: Record<Sorte, number[]>;
  e: [Sorte, number, Champs][];
  /** Listes envoyées entières quand elles changent (flèches, butin au sol, zones au sol, annonces). */
  l?: Record<string, Val>;
  /** Arène du donjon (null = aucune) quand elle change. */
  a?: Champs | null;
  /** Événements à jouer chez l'invité (sons, chiffres, effets). */
  ev?: Val[];
  /** Ses quêtes à lui (monde partagé) et le dialogue ouvert, quand ils changent. */
  q?: Val;
  /** Son sac à lui (objets, ressources, kamas, métiers…), quand il change : les autres joueurs ne le reçoivent jamais. */
  sac?: Champs;
}

export const COOP = {
  /** Un instantané tous les N pas de 1/60 s (30 par seconde). */
  tous: 2,
  /** Nombres arrondis au centième : moins d'octets et moins de faux changements. */
  arrondi: 100,
  /** Distance (px, en |dx| + |dy|) au-delà de laquelle l'invité ne reçoit rien : il ne le verrait pas (comme le sommeil des monstres). */
  vue: 2400,
};

/** Champs jamais envoyés : données du jeu (recréées de l'autre côté), sac et progression propres à chaque joueur, caches. */
/** Champs du sac et de la progression : refusés pour les autres, envoyés à leur propriétaire seul (instantané.sac). */
const SAC = ['bag', 'resources', 'kamas', 'metiers', 'apparats', 'dofus', 'trophees', 'zaaps', 'codex', 'codexOuvert', 'ames', 'cleDonjon', 'guerre', 'vivant', 'recetteSuivie',
  'commandeFM', 'lootFilter', 'autoDefaire', 'almanaxJour', 'magasin', 'sacEnPlus', 'benediction', 'repas', 'elixir', 'parchemins', 'ceinture', 'zonesVues', 'explore', 'lieuxVus', 'tombe',
  'coffreVitrine', 'coffreJournal', 'coffreRecords'] as const;
const REFUS: Record<Sorte | 'a', Set<string>> = {
  j: new Set(['cls', 'items', 'bag', 'resources', 'codex', 'learned', 'zonesVues', 'metiers', 'prereglages', 'ames', 'apparats', 'dofus', 'trophees',
    'commandeFM', 'quetes', 'monde', 'evenements', 'cleDonjon', 'guerre', 'vivant', 'recetteSuivie', 'zaaps', '_pouvoirs', 'almanaxJour', 'magasin', 'sacEnPlus', 'benediction', 'repas', 'elixir', 'parchemins', 'ceinture', 'boissonCd', 'codexOuvert', 'lootFilter', 'autoDefaire', 'kamas', 'v03', 'v04', 'v06', 'chasse', 'bossSansLeg', 'idoles', 'renommee', 'sanctuaires', 'fxIdoles', 'bouclierVu', 'idoleT', 'repathT', 'bufferT', 'buffer', 'explore', '_explore', 'lieuxVus', 'tombe', 'carteIci',
    'coffreVitrine', 'coffreJournal', 'coffreRecords', 'coffreEjection']),
  // minuteries de l'IA des monstres : l'hôte seul s'en sert
  m: new Set(['def', 'atkCd', 'spellCd', 'sigCd', 'cheminT', 'wanderT', 'wanderX', 'wanderY', 'repathT', 'e06']),
  b: new Set(['def']),
  a: new Set(['w', 'd', 'butin', 'butins']),
};
/** Listes du monde recopiées telles quelles. */
const LISTES = ['projectiles', 'drops', 'telegraphs', 'zonesSol'] as const;
/** Événements joués chez l'invité : ce qui se voit et s'entend. Le reste (quêtes, fenêtres, changement de zone, XP, mort…)
 *  parle du joueur de l'écran de l'hôte. */
const EVENEMENTS = new Set<SimEvent['k']>(['spell', 'shoot', 'slam', 'monsterCast', 'spellFx', 'status', 'massacre', 'massacreFin', 'hit', 'kill',
  'beteMorte', 'heal', 'filSoin', 'pieces', 'tresorOuvert', 'cartesJouees', 'mainGagnante', 'roulette', 'invocation', 'eveil', 'echange', 'souffrance', 'sacrifice', 'dompte', 'impact', 'grosCoup', 'bossIntro', 'furieux', 'wave',
  'areneDebut', 'areneVague', 'arenePalier', 'areneAlarme', 'bossFuite', 'wobot', 'bossEpilogue', 'areneFin', 'bossDown', 'cast', 'bulle', 'rageSpent', 'signal', 'guerreVague', 'guerreVol', 'guerreFuite', 'guerreReplantee',
  'bossMondeAnnonce', 'bossMondeArrive', 'bossMondeCombat', 'bossMondePalier', 'bossMondeFin', 'invasionDebut', 'evenementDebut']);
export const evenementPartage = (e: SimEvent) => EVENEMENTS.has(e.k);
/** Événements propres à l'invité (World.evenementsDe) qu'il peut jouer chez lui : bandeaux, butin, quêtes, métiers. */
const PERSONNELS_AFFICHES = new Set<SimEvent['k']>(['levelUp', 'newSpell', 'enterArea', 'enterLieu', 'loot', 'lootResource', 'lootKamas', 'bagFull',
  'queteInfo', 'objetQuete', 'succes', 'checkpoint', 'zaapDecouvert', 'lieuDecouvert', 'recolteFin', 'recolteStop', 'metierLevel', 'dofusGagne', 'portal', 'itemDrop', 'guerreDebut', 'guerreFin',
  'bossMondeVaincu', 'invasionPleine', 'invasionCoffre', 'evenementFin']);

const arrondir = (v: number) => (Number.isInteger(v) || !Number.isFinite(v) ? v : Math.round(v * COOP.arrondi) / COOP.arrondi);
const estEntite = (v: object): v is Entity => v instanceof Entity;

/** Valeur → JSON du réseau. Les objets d'une classe autre qu'une entité (cartes, monde…) ne partent pas. */
export function versReseau(v: unknown, prof = 0): Val | undefined {
  if (v === null || v === undefined) return v === null ? null : undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? arrondir(v) : v > 0 ? 1e9 : v < 0 ? -1e9 : 0;
  if (typeof v === 'string' || typeof v === 'boolean') return v;
  if (typeof v !== 'object' || prof > 6) return undefined;
  if (estEntite(v)) return { $e: v.id };
  if (v instanceof Set) return [...v].map(x => versReseau(x, prof + 1) ?? null);
  if (Array.isArray(v)) return v.map(x => versReseau(x, prof + 1) ?? null);
  const pr = Object.getPrototypeOf(v);
  if (pr !== Object.prototype && pr !== null) return undefined;
  const o: Champs = {};
  for (const [k, x] of Object.entries(v)) { const r = versReseau(x, prof + 1); if (r !== undefined) o[k] = r; }
  return o;
}

/** Champs d'un objet (sauf refusés), prêts à partir. */
function champs(o: object, refus: Set<string>): Champs {
  const r: Champs = {};
  for (const [k, v] of Object.entries(o)) {
    if (refus.has(k) || typeof v === 'function') continue;
    const x = versReseau(v);
    if (x !== undefined) r[k] = x;
  }
  return r;
}

/** Côté hôte : un émetteur par invité, qui se souvient de ce qu'il lui a déjà envoyé. */
export class Emetteur {
  private n = 0;
  /** Ce que l'invité a déjà, par objet (entité, liste, arène) puis par champ. */
  private vu = new Map<string, Map<string, string>>();
  private evs: Val[] = [];
  constructor(readonly moi: number) {}
  /** Événement de la partie à transmettre au prochain instantané. */
  noter(e: SimEvent) { if (evenementPartage(e) && this.evs.length < 200) { const v = versReseau(e); if (v !== undefined) this.evs.push(v); } }
  /** Événement propre à cet invité (World.evenementsDe) : seuls ceux qu'il sait afficher partent. */
  noterPerso(e: SimEvent) { if (PERSONNELS_AFFICHES.has(e.k) && this.evs.length < 200) { const v = versReseau(e); if (v !== undefined) this.evs.push(v); } }
  /** Renvoie tout au prochain instantané (invité qui vient d'arriver ou de changer de zone). */
  toutRenvoyer() { this.vu.clear(); }

  instantane(w: World): Instantane {
    const plein = this.vu.size === 0;
    const s: Instantane = { n: ++this.n, moi: this.moi, t: arrondir(w.time), ids: { j: [], m: [], b: [] }, e: [] };
    if (plein) s.plein = true;
    const diff = (objet: string, champ: string, v: Val) => {
      const j = JSON.stringify(v);
      let m = this.vu.get(objet);
      if (!m) this.vu.set(objet, m = new Map());
      if (m.get(champ) === j) return false;
      m.set(champ, j); return true;
    };
    const presents = new Set<string>();
    const moi = w.players.find(p => p.id === this.moi) ?? w.players[0];
    const pres = (o: { x: number; y: number }) => Math.abs(o.x - moi.x) + Math.abs(o.y - moi.y) <= COOP.vue;
    const ent = (sorte: Sorte, o: Entity, extra: Champs = {}) => {
      if (sorte !== 'j' && !pres(o)) return;
      s.ids[sorte].push(o.id);
      const c = { ...champs(o, REFUS[sorte]), ...extra }, d: Champs = {};
      const cle = `${sorte}${o.id}`;
      presents.add(cle);
      for (const [k, v] of Object.entries(c)) if (diff(cle, k, v)) d[k] = v;
      if (Object.keys(d).length) s.e.push([sorte, o.id, d]);
    };
    for (const p of w.players) ent('j', p, { classe: classeDe(w, p) });
    for (const m of w.monsters) ent('m', m);
    for (const b of w.betes) ent('b', b);
    for (const k of LISTES) { const v = versReseau((w[k] as { x: number; y: number }[]).filter(pres)) ?? []; if (diff('l', k, v)) (s.l ??= {})[k] = v; }
    const a = w.arene ? { ...champs(w.arene, REFUS.a), nomDonjon: w.arene.d.nom } : null;
    if (diff('a', '', a)) s.a = a;
    const wc: Champs = { kills: w.kills, cibleMeute: w.cibleMeute, vivantVu: versReseau(w.vivant?.vue() ?? null) ?? null };   // 0.5 : boss du monde, invasion, événements
    if (diff('w', '', wc)) s.w = wc;
    // une entité sortie de la vue (ou morte et retirée) est oubliée : si elle revient, elle repart avec tous ses champs
    // (l'invité l'a effacée de son miroir, il la recrée de zéro)
    for (const cle of this.vu.keys()) if (/^[jmb]\d/.test(cle) && !presents.has(cle)) this.vu.delete(cle);
    // monde partagé : ses quêtes (suivi, PNJ, carnet) et son dialogue, quand ils changent
    const sac: Champs = {};
    for (const k of SAC) { const v = versReseau((moi as unknown as Record<string, unknown>)[k]); if (v !== undefined && diff('sac', k, v)) sac[k] = v; }
    if (Object.keys(sac).length) s.sac = sac;
    if (moi.quetes) { const q = versReseau({ ...moi.quetes.exporter(), dialogue: moi.quetes.dialogue }); if (q !== undefined && diff('q', '', q)) s.q = q; }
    if (this.evs.length) { s.ev = this.evs; this.evs = []; }
    return s;
  }
}

export const classeDe = (w: World, p: Player) => Object.keys(w.opts.data.classes).find(k => w.opts.data.classes[k] === p.cls) ?? 'iop';

/** Valeur du réseau → valeur du miroir ({ $e } redevient l'entité ; un Set reste un Set). */
function depuisReseau(v: Val, w: World, avant?: unknown): unknown {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) { const a = v.map(x => depuisReseau(x, w)); return avant instanceof Set ? new Set(a) : a; }
  if (typeof v.$e === 'number' && Object.keys(v).length === 1) return entiteMiroir(w, v.$e) ?? null;
  const o: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) o[k] = depuisReseau(x, w);
  return o;
}
/** Champs de base d'une entité créée sans constructeur (au cas où l'instantané ne les donne pas tous : l'affichage en a besoin). */
const NEUF = { x: 0, y: 0, z: 0, facing: 0, anim: 'idle', animT: 0, age: 0, flash: 0, kx: 0, ky: 0, dead: false, hp: 1, maxHp: 1, radius: 16 };
const entiteMiroir = (w: World, id: number): Entity | undefined =>
  w.players.find(p => p.id === id) ?? w.monsters.find(m => m.id === id) ?? w.betes.find(b => b.id === id);
const poser = (o: object, k: string, v: unknown) => { (o as Record<string, unknown>)[k] = v; };

/** Côté invité : recopie un instantané dans le monde miroir. Renvoie les événements à jouer (sons, chiffres, effets),
 *  plus ceux que l'invité déduit pour son propre perso (coup reçu, niveau gagné). */
/** Lissage (« Vrai multi » 6B) : position reçue que l'entité rejoint en douceur entre deux instantanés. */
const CIBLES = new WeakMap<object, { x: number; y: number }>();
/** Au-delà de cet écart (px), l'entité saute à sa place (porte, Bond, téléport) ; vitesse du lissage (par seconde). */
export const LISSAGE = { saut: 220, vitesse: 22 };
/** Côté invité, à chaque image : chaque entité glisse vers sa dernière position reçue. */
export function lisserMiroir(w: World, dt: number) {
  const k = 1 - Math.exp(-LISSAGE.vitesse * dt);
  for (const l of [w.players, w.monsters, w.betes] as Entity[][]) for (const e of l) {
    const c = CIBLES.get(e);
    if (!c) continue;
    const dx = c.x - e.x, dy = c.y - e.y;
    if (Math.abs(dx) + Math.abs(dy) < 0.5) { e.x = c.x; e.y = c.y; CIBLES.delete(e); continue; }
    e.x += dx * k; e.y += dy * k;
  }
}

/** lisser : les positions reçues sont rejointes en douceur par lisserMiroir (affichage de l'invité) au lieu d'être posées d'un coup. */
export function appliquerInstantane(w: World, s: Instantane, lisser = false): SimEvent[] {
  const D = w.opts.data, moi = w.players[0], hpAvant = moi.hp, niveauAvant = moi.level;
  if (s.plein) { w.monsters.length = 0; w.betes.length = 0; w.players.splice(1); }
  // 1. entités : création (sans constructeur : rien ne doit se passer dans le miroir), puis disparition
  poser(moi, 'id', s.moi);
  const nouveaux = new Set<object>();
  if (s.plein) nouveaux.add(moi);
  const champsDe = new Map(s.e.map(([so, id, c]) => [`${so}${id}`, c]));
  for (const id of s.ids.j) {
    if (id === s.moi || w.players.some(p => p.id === id)) continue;
    const c = champsDe.get(`j${id}`), cls = D.classes[String(c?.classe ?? 'iop')] ?? D.classes.iop;
    const q = new Player(id, 0, 0, cls);
    q.items = moi.items; nouveaux.add(q);
    w.players.push(q);
  }
  // un monstre ou une bête qui change de type (Éveil des bêtes de l'Osamodas…) reste le même objet : seul def suit
  for (const id of s.ids.m) {
    const c = champsDe.get(`m${id}`), ancien = w.monsters.find(m => m.id === id), def = D.monsters[String(c?.type)];
    if (ancien) { if (def) poser(ancien, 'def', def); continue; }
    if (!def) continue;
    const m = Object.assign(Object.create(Monster.prototype) as Monster, NEUF);
    poser(m, 'def', def); poser(m, 'id', id);
    w.monsters.push(m); nouveaux.add(m);
  }
  for (const id of s.ids.b) {
    const c = champsDe.get(`b${id}`), ancien = w.betes.find(b => b.id === id), def = BETES[String(c?.type)];
    if (ancien) { if (def) poser(ancien, 'def', def); continue; }
    if (!def) continue;
    const b = Object.assign(Object.create(Bete.prototype) as Bete, NEUF);
    poser(b, 'def', def); poser(b, 'id', id);
    w.betes.push(b); nouveaux.add(b);
  }
  const garder = <T extends Entity>(l: T[], ids: number[]) => { const k = new Set(ids); return l.filter(o => k.has(o.id)); };
  w.monsters = garder(w.monsters, s.ids.m);
  w.betes = garder(w.betes, s.ids.b);
  for (let i = w.players.length - 1; i >= 1; i--) if (!s.ids.j.includes(w.players[i].id)) w.players.splice(i, 1);
  // 2. champs (après les créations : un champ peut citer une entité arrivée dans le même instantané)
  for (const [so, id, c] of s.e) {
    const o = so === 'j' ? w.players.find(p => p.id === id) : so === 'm' ? w.monsters.find(m => m.id === id) : w.betes.find(b => b.id === id);
    if (!o) continue;
    const neuf = nouveaux.has(o);
    for (const [k, v] of Object.entries(c)) {
      if (k === 'classe' || (so === 'j' && REFUS.j.has(k))) continue;
      if (lisser && !neuf && (k === 'x' || k === 'y') && typeof v === 'number') {
        const e = o as Entity, cible = CIBLES.get(e) ?? { x: e.x, y: e.y };
        cible[k] = v; CIBLES.set(e, cible);
        if (Math.abs(cible.x - e.x) + Math.abs(cible.y - e.y) > LISSAGE.saut) { e.x = cible.x; e.y = cible.y; }
        continue;
      }
      poser(o, k, depuisReseau(v, w, (o as unknown as Record<string, unknown>)[k]));
    }
    if (so === 'j' && 'equipment' in c) poser(o, '_pouvoirs', null);
  }
  // 3. listes, arène, monde
  for (const [k, v] of Object.entries(s.l ?? {})) poser(w, k, depuisReseau(v, w));
  if (s.a === null) w.arene = null;
  else if (s.a) {
    const d = w.zone.open?.donjons?.find(x => x.nom === s.a!.nomDonjon);
    if (d) {
      if (!w.arene || w.arene.d !== d) { const a = Object.create(Arene.prototype) as Arene; poser(a, 'w', w); poser(a, 'd', d); w.arene = a; }
      for (const [k, v] of Object.entries(s.a)) if (k !== 'nomDonjon') poser(w.arene, k, depuisReseau(v, w));
    }
  }
  for (const [k, v] of Object.entries(s.w ?? {})) poser(w, k, depuisReseau(v, w));
  poser(w, 'time', s.t);
  for (const [k, v] of Object.entries(s.sac ?? {})) if ((SAC as readonly string[]).includes(k)) poser(moi, k, depuisReseau(v, w));
  if (s.q && typeof s.q === 'object' && w.quetes) w.quetes.recopier(s.q as unknown as EtatQuetes & { dialogue?: Dialogue | null });
  const evs = (s.ev ?? []).map(e => depuisReseau(e, w) as SimEvent);
  if (moi.hp < hpAvant && !moi.dead) evs.push({ k: 'playerHurt' });
  if (moi.level > niveauAvant) evs.push({ k: 'status', x: moi.x, y: moi.y - 80, text: `Niveau ${moi.level} !`, color: '#ffd76a' });
  return evs;
}

/** Entrées d'un invité gardées par l'hôte : seulement ce qui sert au combat (pas de quêtes, fenêtres, Zaaps ni outils de test). */
/** Gestes d'un seul pas (monde partagé) : gardés entre deux envois ou deux pas, puis joués une seule fois. */
export type UneFois = Pick<PlayerInput, 'talk' | 'reponse' | 'versPortail' | 'carte'>;
export function garderUneFois(u: UneFois, i: Partial<PlayerInput>) {
  if (i.talk) u.talk = i.talk;
  if (i.reponse != null) u.reponse = i.reponse;
  if (i.versPortail) u.versPortail = i.versPortail;
  if (i.carte) u.carte = { ...u.carte, ...i.carte };
}
export function entreeInvite(i: Partial<PlayerInput> | null | undefined): PlayerInput {
  const v = (p: unknown) => (p && typeof p === 'object' && Number.isFinite((p as { x: number }).x) && Number.isFinite((p as { y: number }).y)
    ? { x: (p as { x: number }).x, y: (p as { y: number }).y } : null);
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  const mv = v(i?.move) ?? { x: 0, y: 0 }, l = Math.hypot(mv.x, mv.y);
  return {
    move: l > 1 ? { x: mv.x / l, y: mv.y / l } : mv, aim: v(i?.aim) ?? { x: 0, y: 0 },
    pressed: typeof i?.pressed === 'string' ? i.pressed : null, holdAttack: !!i?.holdAttack, potion: !!i?.potion,
    dest: v(i?.dest), pickup: n(i?.pickup), target: n(i?.target), castOn: n(i?.castOn), approach: !!i?.approach, meute: n(i?.meute),
    versPortail: typeof i?.versPortail === 'string' ? i.versPortail.slice(0, 80) : null,
    // monde partagé : parler à un PNJ, lui répondre
    talk: typeof i?.talk === 'string' ? i.talk.slice(0, 60) : null, reponse: Number.isInteger(i?.reponse) && i!.reponse! >= -1 && i!.reponse! < 20 ? i!.reponse : null,
    // carte du monde : drapeaux du groupe (14A), signal Alt + clic (14B)
    carte: i?.carte && typeof i.carte === 'object' ? { ...(Array.isArray(i.carte.drapeaux) ? { drapeaux: drapeauxPropres(i.carte.drapeaux) } : {}), signal: signalPropre(i.carte.signal) } : null,
  };
}
