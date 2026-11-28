import DATA from '../data/montures.json';
import recoltes from '../data/recoltes.json';
import type { Stat, Stats } from './items';
import type { Monster } from './monster';
import type { Player } from './player';
import type { World } from './world';

/** Montures de la 0.7 (17A Dragodindes des Koalaks, 17C Muldos de Sufokia) et leur élevage (ligne « Élevage : »).
 *  Données officielles (src/data/montures.json, tools/extraction/montures_export.py) ; croissance maison :
 *  trois traits (Fougue, Robustesse, Flair) qui montent en chassant (2A), selon les voisins d'enclos (2B), en mangeant
 *  des récoltes (2C) et en expédition (2D). Le temps de l'enclos est celui de l'horloge réelle, même partie fermée (3A). */

export type Famille = 'dragodinde' | 'muldo';
export interface RaceDef { nom: string; famille: Famille; gen: number; couleurs: string[]; teinte: number[]; stats: [Stat, number][] }
export const RACES = DATA.races as unknown as Record<string, RaceDef>;
/** Monstre sauvage -> race capturée. */
export const SAUVAGES = DATA.sauvages as Record<string, string>;
export const CAPACITES = DATA.capacites as Record<string, { nom: string; officiel: string }>;
export const PLANCHES = DATA.planches as Record<Famille, string>;
export const ZONES = DATA.zones as Partial<Record<Famille, string>>;

export type Trait = 'fougue' | 'robustesse' | 'flair';
export const TRAITS: Trait[] = ['fougue', 'robustesse', 'flair'];
export const NOM_TRAIT: Record<Trait, string> = { fougue: 'Fougue', robustesse: 'Robustesse', flair: 'Flair' };
/** 2B : tempérament -> trait qu'il transmet à ses voisins d'enclos (Joueuse : un peu des trois). */
export type Temperament = 'fougueuse' | 'docile' | 'curieuse' | 'joueuse';
export const TEMPERAMENTS: Record<Temperament, { nom: string; trait: Trait | null }> = {
  fougueuse: { nom: 'Fougueuse', trait: 'fougue' }, docile: { nom: 'Docile', trait: 'robustesse' },
  curieuse: { nom: 'Curieuse', trait: 'flair' }, joueuse: { nom: 'Joueuse', trait: null },
};

/** Capacités officielles (mountbehaviors), effets en temps réel (5C). */
export const CAPA = { infatigable: 1, porteuse: 2, reproductrice: 3, sage: 4, endurante: 5, amoureuse: 6, precoce: 7, predisposee: 8, cameleone: 9 } as const;

export const MONTURE = {
  /** 17A : +40 % de vitesse hors combat, la même pour toutes (17E : les apparences ne changent rien). */
  vitesse: 0.4,
  /** Fougue 100 : +10 % de plus. */
  vitesseFougue: 0.1,
  /** Secondes sans coup donné ni reçu avant de pouvoir remonter. */
  horsCombat: 3,
  niveauMax: 100,
  /** 4C : gestation d'une heure, 1 à 3 petits, stérile après 20 portées. */
  gestation: 3600, sterile: 20,
  /** Âge (s, horloge réelle) où un petit peut s'accoupler (« environ 2 h ») ; Précoce : moitié. */
  maturite: 7200,
  /** 1A : places de l'enclos du Havre-Sac ; 1C : enclos d'Amakna loué à la semaine. */
  enclos: 10, enclosLoue: 10, loyer: 20000, semaine: 7 * 86400,
  /** Montures gardées en tout (étable). */
  etable: 60,
  /** 17A : chance de capturer la bête sauvage vaincue (la première est toujours capturée). */
  capture: 0.12,
  /** Part de l'XP du monstre que gagne la monture active. */
  partXp: 0.25,
  /** 2B : gain d'un trait par heure dans l'enclos, par voisin du bon tempérament. */
  voisinage: 1.5,
  /** 7B : Arène de dressage = XP par heure dans l'enclos ; Abri = gestation ×0,75 ; Mangeoire = nourriture ×2. */
  areneXp: 400, abri: 0.75, mangeoire: 2,
} as const;

export interface Monture {
  uid: number; race: string; nom: string; male: boolean;
  niveau: number; xp: number;
  fougue: number; robustesse: number; flair: number;
  temp: Temperament; capa: number[];
  portees: number;
  /** Horloge (s) de naissance ou de capture. */
  nee: number;
  /** Fécondée : naissance à `fin` (horloge), avec ce qu'apporte le père. */
  gestation?: { fin: number; pere: string; pereCapa: number[]; pereTraits: [number, number, number] } | null;
  /** 2D : partie en expédition jusqu'à `fin`, dans la sous-zone `sub`. */
  expedition?: { sub: string; fin: number; duree: number } | null;
  parents?: [string, string];
  /** 2B : dernière heure (horloge) où l'enclos lui a été compté. */
  enclosA?: number;
}

/** Ce que chaque joueur possède (sauvegardé avec le perso, persos.ts). */
export interface Ecurie {
  montures: Monture[];
  /** uid de la monture équipée (0 : aucune) ; montée ou non. */
  active: number;
  /** Ordre des montures dans l'enclos du Havre-Sac (2B : les voisins comptent). */
  enclos: number[];
  /** 1C : enclos d'Amakna loué jusqu'à cette heure (horloge). */
  loueJusqua: number; enclosLoue: number[];
  /** 7B : objets du Bricoleur posés dans l'enclos. */
  objets: string[];
  /** 10A : générations déjà obtenues par famille (succès). */
  generations: Record<Famille, number>;
  /** 17E : apparence d'Ogrines posée (race d'apparat), '' sinon. */
  apparence: string;
  apparences: string[];
  prochainUid: number;
}
export const ecurieVide = (): Ecurie => ({ montures: [], active: 0, enclos: [], loueJusqua: 0, enclosLoue: [], objets: [], generations: { dragodinde: 0, muldo: 0 }, apparence: '', apparences: [], prochainUid: 1 });

/** Horloge réelle (s) : celle de l'écran ; sans horloge (tests, serveur), le temps de la partie. */
export const horloge = (w: World) => { const h = w.opts.horloge; return h ? h() : w.time; };

/** XP pour passer du niveau n au suivant. */
export const xpNiveau = (n: number) => Math.round(60 * n ** 1.55);

export const monture = (p: Player, uid = p.ecurie.active) => p.ecurie.montures.find(m => m.uid === uid);
export const race = (m: Monture) => RACES[m.race];
export const a = (m: Monture, c: number) => m.capa.includes(c);

/** 5A : bonus officiels de la race au niveau de la monture, + ce que donnent Robustesse et Flair. */
export function statsMonture(m: Monture): Stats {
  const s: Stats = {};
  for (const [k, v] of race(m)?.stats ?? []) s[k] = (s[k] ?? 0) + Math.round(v * m.niveau / MONTURE.niveauMax);
  const r = Math.floor(m.robustesse), f = Math.floor(m.flair);
  if (r) { s.vitalite = (s.vitalite ?? 0) + r; for (const k of ['resTerre', 'resFeu', 'resEau', 'resAir', 'resNeutre'] as Stat[]) s[k] = (s[k] ?? 0) + Math.floor(r / 20); }
  if (f) s.prospection = (s.prospection ?? 0) + Math.floor(f / 2);
  if (a(m, CAPA.porteuse)) s.pods = (s.pods ?? 0) + 500;
  return s;
}

/** Facteur de vitesse : monté et hors combat seulement. */
export function vitesseMonture(p: Player): number {
  if (!p.monte) return 1;
  const m = monture(p);
  return m ? 1 + MONTURE.vitesse + MONTURE.vitesseFougue * m.fougue / 100 : 1;
}

/** Monter / descendre (touche de la monture). */
export function basculerMonture(p: Player, w: World): boolean {
  if (p.monte) { descendre(p, w); return true; }
  const m = monture(p);
  if (!m || m.expedition || p.dead) return false;
  if (p.age - p.coupA < MONTURE.horsCombat) {
    w.emit({ k: 'status', x: p.x, y: p.y - 70, text: 'Pas en plein combat', color: '#e0a060' });
    return false;
  }
  p.monte = true; p.montee = p.ecurie.apparence || m.race;
  w.emit({ k: 'monture', joueur: p.id, monte: true, race: m.race });
  return true;
}

export function descendre(p: Player, w: World) {
  if (!p.monte) return;
  p.monte = false; p.montee = '';
  w.emit({ k: 'monture', joueur: p.id, monte: false, race: monture(p)?.race ?? '' });
}

/** « On descend tout seul au premier coup donné ou reçu » (17A). */
export function coupEchange(p: Player, w: World) {
  p.coupA = p.age;
  if (p.monte) descendre(p, w);
}

function nouvelle(p: Player, w: World, raceId: string, opts: Partial<Monture> = {}): Monture | null {
  const e = p.ecurie;
  if (e.montures.length >= MONTURE.etable) return null;
  const r = w.rng, temps = Object.keys(TEMPERAMENTS) as Temperament[];
  const m: Monture = {
    uid: e.prochainUid++, race: raceId, nom: RACES[raceId].nom, male: r.next() < 0.5, niveau: 1, xp: 0,
    fougue: 0, robustesse: 0, flair: 0, temp: temps[Math.floor(r.next() * temps.length)], capa: [], portees: 0, nee: horloge(w), ...opts,
  };
  e.montures.push(m);
  const fam = RACES[raceId].famille, g = RACES[raceId].gen;
  if (g > (e.generations[fam] ?? 0)) e.generations[fam] = g;
  if (!e.active) e.active = m.uid;
  return m;
}

/** 17A / 17C : une Dragodinde ou un Muldo sauvage vaincu peut être capturé (le tout premier toujours). */
export function chasseMonture(w: World, m: Monster, joueurs: Player[]) {
  const raceId = SAUVAGES[m.type];
  for (const p of joueurs) {
    if (!p.v07) continue;
    if (raceId) {
      const fam = RACES[raceId].famille, premiere = !p.ecurie.montures.some(x => race(x)?.famille === fam);
      if (premiere || w.rng.next() < MONTURE.capture) {
        const c = nouvelle(p, w, raceId);
        if (c) {
          if (w.rng.next() < 0.1) c.capa.push(1 + Math.floor(w.rng.next() * 9));
          w.emit({ k: 'status', x: m.x, y: m.y - 60, text: `${c.nom} capturée !`, color: '#f2c45a' });
          w.emit({ k: 'montureCapturee', joueur: p.id, race: raceId, nom: c.nom });
        }
      }
    }
    const mo = monture(p);
    if (mo && !mo.expedition) gagnerXpMonture(mo, Math.round((m.def.xp ?? m.def.hp / 5) * MONTURE.partXp), p.monte ? 'fougue' : 'robustesse', w, p);
  }
}

/** 2A : XP de chasse ; le trait le plus sollicité monte un peu (monté = Fougue, à pied = Robustesse, butin ramassé = Flair). */
export function gagnerXpMonture(m: Monture, xp: number, trait: Trait | null, w: World, p?: Player) {
  if (m.niveau < MONTURE.niveauMax) {
    m.xp += xp * (a(m, CAPA.sage) ? 2 : 1);
    while (m.niveau < MONTURE.niveauMax && m.xp >= xpNiveau(m.niveau)) {
      m.xp -= xpNiveau(m.niveau); m.niveau++;
      if (p) { p.recompute(); w.emit({ k: 'status', x: p.x, y: p.y - 90, text: `${m.nom} : niveau ${m.niveau}`, color: '#9ad15a' }); }
    }
    if (m.niveau >= MONTURE.niveauMax) m.xp = 0;
  }
  if (trait) monterTrait(m, trait, 0.08 * (trait === 'robustesse' && a(m, CAPA.endurante) ? 2 : 1));
}

export function monterTrait(m: Monture, t: Trait, n: number) { m[t] = Math.min(100, Math.round((m[t] + n) * 100) / 100); }

/** 2C : trait nourri par une ressource de récolte (céréales = Fougue, poissons = Robustesse, plantes = Flair). */
const METIER_TRAIT: Record<string, Trait> = { paysan: 'fougue', pecheur: 'robustesse', alchimiste: 'flair' };
const RES = (recoltes as { ressources: Record<string, { metier: string; niveauObjet: number }> }).ressources;
export function traitNourriture(res: string): Trait | null { const r = RES[res]; return r ? METIER_TRAIT[r.metier] ?? null : null; }

/** 2C : donne `n` ressources à manger ; renvoie le nombre mangé (jusqu'à 100 dans le trait). */
export function nourrir(p: Player, uid: number, res: string, n: number): number {
  const m = monture(p, uid), t = traitNourriture(res);
  if (!m || !t || m.expedition) return 0;
  const k = (0.25 + (RES[res]?.niveauObjet ?? 1) / 100) * (p.ecurie.objets.includes('mangeoire') ? MONTURE.mangeoire : 1);
  let mange = 0;
  while (mange < n && (p.resources[res] ?? 0) > 0 && m[t] < 100) { p.resources[res]--; mange++; monterTrait(m, t, k); }
  if (!p.resources[res]) delete p.resources[res];
  return mange;
}

export const mure = (m: Monture, now: number) => now - m.nee >= MONTURE.maturite * (a(m, CAPA.precoce) ? 0.5 : 1);
export const feconde = (m: Monture, now: number) => mure(m, now) && m.portees < MONTURE.sterile && !m.gestation && !m.expedition;

/** 4A : accouplement de deux montures de l'enclos (une femelle, un mâle, même famille). */
export function accoupler(p: Player, w: World, a1: number, a2: number): string | null {
  const x = monture(p, a1), y = monture(p, a2), now = horloge(w);
  if (!x || !y || x === y) return 'Choisis deux montures.';
  if (race(x).famille !== race(y).famille) return 'Une Dragodinde et un Muldo ne se croisent pas.';
  if (x.male === y.male) return 'Il faut un mâle et une femelle.';
  const f = x.male ? y : x, m = x.male ? x : y;
  const enclos = [...p.ecurie.enclos, ...(p.ecurie.loueJusqua > now ? p.ecurie.enclosLoue : [])];
  if (!enclos.includes(f.uid) || !enclos.includes(m.uid)) return 'Les deux doivent être dans un enclos.';
  if (!feconde(f, now) || !feconde(m, now)) return 'Elles doivent être adultes, fertiles et disponibles.';
  const duree = MONTURE.gestation * (p.ecurie.objets.includes('abri') ? MONTURE.abri : 1) * (a(f, CAPA.amoureuse) || a(m, CAPA.amoureuse) ? 0.7 : 1);
  f.gestation = { fin: now + duree, pere: m.race, pereCapa: [...m.capa], pereTraits: [m.fougue, m.robustesse, m.flair] };
  m.portees++;
  w.emit({ k: 'status', x: p.x, y: p.y - 70, text: `${f.nom} attend des petits`, color: '#f2a0c0' });
  return null;
}

/** Races qu'un croisement peut donner (4A, arbre officiel) : celles des parents, la bicolore de leurs couleurs, et
 *  quand les deux parents sont de la génération qui précède une couleur nouvelle, ces couleurs-là. */
export function enfantsPossibles(ra: string, rb: string): { race: string; poids: number }[] {
  const A = RACES[ra], B = RACES[rb], fam = A.famille, out = new Map<string, number>();
  const ajoute = (id: string | undefined, n: number) => { if (id && RACES[id]) out.set(id, (out.get(id) ?? 0) + n); };
  ajoute(ra, 3); ajoute(rb, 3);
  const parCouleurs = (cs: string[]) => Object.entries(RACES).find(([, r]) => r.famille === fam && r.couleurs.length === cs.length && cs.every(c => r.couleurs.includes(c)))?.[0];
  for (const ca of A.couleurs) for (const cb of B.couleurs) if (ca !== cb) ajoute(parCouleurs([ca, cb]), 2);
  const gm = Math.max(A.gen, B.gen);
  if (gm % 2 === 0 && Math.min(A.gen, B.gen) >= gm - 1) {   // deux parents de la génération bicolore : la couleur suivante peut naître
    const g = gm + 1;
    for (const [id, r] of Object.entries(RACES)) if (r.famille === fam && r.couleurs.length === 1 && r.gen === g) ajoute(id, 1);
  }
  return [...out].map(([race, poids]) => ({ race, poids }));
}

function tirerEnfant(w: World, ra: string, rb: string, predispose: boolean): string {
  const l = enfantsPossibles(ra, rb).map(e => ({ ...e, poids: e.poids * (predispose && (e.race === ra || e.race === rb) ? 1.5 : 1) }));
  let t = w.rng.next() * l.reduce((s, e) => s + e.poids, 0);
  for (const e of l) { t -= e.poids; if (t <= 0) return e.race; }
  return ra;
}

/** Fait avancer l'élevage d'un joueur à l'horloge réelle : naissances, expéditions, voisinage et dressage de l'enclos. */
export function majElevage(p: Player, w: World) {
  const e = p.ecurie, now = horloge(w);
  if (!e.montures.length) return;
  if (e.loueJusqua && e.loueJusqua <= now && e.enclosLoue.length) {   // 1C : bail fini, les bêtes rentrent au Havre-Sac
    for (const u of e.enclosLoue) if (e.enclos.length < MONTURE.enclos) e.enclos.push(u);
    e.enclosLoue = [];
  }
  for (const f of [...e.montures]) {
    const g = f.gestation;
    if (g && g.fin <= now) {
      f.gestation = null; f.portees++;
      const n = 1 + Math.floor(w.rng.next() * 3) + (a(f, CAPA.reproductrice) ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const pre = a(f, CAPA.predisposee) || g.pereCapa.includes(CAPA.predisposee);
        const r = tirerEnfant(w, f.race, g.pere, pre);
        const capa = [...new Set([...f.capa, ...g.pereCapa])].filter(() => w.rng.next() < (pre ? 0.75 : 0.5));
        if (w.rng.next() < 0.05) capa.push(1 + Math.floor(w.rng.next() * 9));
        // les petits naissent avec un quart des traits moyens des parents
        const tr = TRAITS.map((t, k) => Math.round((f[t] + g.pereTraits[k]) / 8));
        const b = nouvelle(p, w, r, { capa: [...new Set(capa)], parents: [f.race, g.pere], nee: g.fin, fougue: tr[0], robustesse: tr[1], flair: tr[2] });
        if (!b) break;
        const place = enclosLibre(p, now);
        if (place) place.push(b.uid);
        w.emit({ k: 'montureNee', joueur: p.id, race: r, nom: b.nom, gen: RACES[r].gen });
      }
    }
    const x = f.expedition;
    if (x && x.fin <= now) { f.expedition = null; retourExpedition(p, w, f, x); }
  }
  // 2B et 7B : chaque heure passée dans l'enclos compte (même partie fermée)
  const enclos = [e.enclos, e.loueJusqua > now ? e.enclosLoue : []];
  for (const rang of enclos) rang.forEach((u, i) => {
    const m = monture(p, u);
    if (!m) return;
    m.enclosA ??= now;
    const h = Math.floor((now - m.enclosA) / 3600);
    if (h <= 0) return;
    m.enclosA += h * 3600;
    for (const v of [rang[i - 1], rang[i + 1]]) {
      const o = v != null ? monture(p, v) : undefined;
      if (!o) continue;
      const t = TEMPERAMENTS[o.temp].trait;
      if (t) monterTrait(m, t, MONTURE.voisinage * h);
      else for (const k of TRAITS) monterTrait(m, k, MONTURE.voisinage * h / 3);
    }
    if (e.objets.includes('arene')) gagnerXpMonture(m, MONTURE.areneXp * h, null, w);
  });
}

function enclosLibre(p: Player, now: number): number[] | null {
  const e = p.ecurie;
  if (e.enclos.length < MONTURE.enclos) return e.enclos;
  if (e.loueJusqua > now && e.enclosLoue.length < MONTURE.enclosLoue) return e.enclosLoue;
  return null;
}

/** Ranger une monture dans un enclos (ou l'en sortir : `ou` = null). */
export function placer(p: Player, w: World, uid: number, ou: 'havre' | 'amakna' | null): string | null {
  const e = p.ecurie, now = horloge(w), m = monture(p, uid);
  if (!m) return 'Monture introuvable.';
  e.enclos = e.enclos.filter(u => u !== uid); e.enclosLoue = e.enclosLoue.filter(u => u !== uid);
  if (!ou) return null;
  if (ou === 'amakna' && e.loueJusqua <= now) return "Loue d'abord l'enclos d'Amakna.";
  const l = ou === 'havre' ? e.enclos : e.enclosLoue;
  if (l.length >= (ou === 'havre' ? MONTURE.enclos : MONTURE.enclosLoue)) return 'Enclos plein.';
  l.push(uid); m.enclosA = now;
  if (e.active === uid) { descendre(p, w); e.active = 0; p.recompute(); }
  return null;
}

/** Équiper une monture (la monter ensuite avec sa touche). */
export function equiperMonture(p: Player, w: World, uid: number): boolean {
  const m = monture(p, uid);
  if (!m || m.expedition) return false;
  descendre(p, w);
  placer(p, w, uid, null);
  p.ecurie.active = uid; p.recompute();
  return true;
}

/** 1C : louer l'enclos d'Amakna une semaine (prolonge le bail en cours). */
export function louerEnclos(p: Player, w: World): string | null {
  if (p.kamas < MONTURE.loyer) return 'Pas assez de kamas.';
  p.kamas -= MONTURE.loyer;
  const now = horloge(w);
  p.ecurie.loueJusqua = Math.max(now, p.ecurie.loueJusqua) + MONTURE.semaine;
  return null;
}

/** 2D : expéditions dans une sous-zone déjà visitée (30 min à 8 h). Infatigable : 30 % plus court. */
export const DUREES_EXPEDITION = [1800, 7200, 28800];
export function envoyerExpedition(p: Player, w: World, uid: number, sub: string, duree: number): string | null {
  const m = monture(p, uid);
  if (!m) return 'Monture introuvable.';
  if (m.expedition || m.gestation) return 'Elle est occupée.';
  if (!DUREES_EXPEDITION.includes(duree)) return 'Durée inconnue.';
  if (p.ecurie.active === uid) { descendre(p, w); p.ecurie.active = 0; p.recompute(); }
  placer(p, w, uid, null);
  const d = duree * (a(m, CAPA.infatigable) ? 0.7 : 1);
  m.expedition = { sub, fin: horloge(w) + d, duree };
  return null;
}

function retourExpedition(p: Player, w: World, m: Monture, x: NonNullable<Monture['expedition']>) {
  const sz = w.zone.open?.subareas[x.sub], I = w.opts.items;
  const heures = x.duree / 3600, niv = sz?.level ?? 1;
  const trop = niv > m.niveau + 20;   // région trop dure : elle revient blessée, avec moins
  gagnerXpMonture(m, Math.round(niv * 40 * heures * (trop ? 0.3 : 1)), 'flair', w, p.ecurie.active === m.uid ? p : undefined);
  const butin: Record<string, number> = {};
  const res = (sz?.monsters ?? []).flatMap(id => (I?.drops[id] ?? []).filter(d => !d.cond).map(d => d.item)).filter(id => I?.resources[id]);
  const n = Math.max(1, Math.round(heures * (3 + m.flair / 25) * (trop ? 0.3 : 1)));
  for (let i = 0; i < n && res.length; i++) { const id = res[Math.floor(w.rng.next() * res.length)]; butin[id] = (butin[id] ?? 0) + 1; }
  for (const [id, q] of Object.entries(butin)) p.resources[id] = (p.resources[id] ?? 0) + q;
  w.emit({ k: 'montureExpedition', joueur: p.id, nom: m.nom, butin, blessee: trop });
}

/** Relecture d'une sauvegarde : écurie vide si absente ou abîmée, montures de races inconnues écartées. */
export function lireEcurie(s: unknown): Ecurie {
  const e = ecurieVide();
  if (!s || typeof s !== 'object') return e;
  const o = s as Partial<Ecurie>;
  e.montures = Array.isArray(o.montures) ? o.montures.filter(m => m && typeof m.uid === 'number' && RACES[m.race]) : [];
  const uids = new Set(e.montures.map(m => m.uid)), ok = (l: unknown) => Array.isArray(l) ? l.filter(u => uids.has(u)) : [];
  e.active = uids.has(o.active as number) ? o.active as number : 0;
  e.enclos = ok(o.enclos).slice(0, MONTURE.enclos); e.enclosLoue = ok(o.enclosLoue).slice(0, MONTURE.enclosLoue);
  e.loueJusqua = typeof o.loueJusqua === 'number' ? o.loueJusqua : 0;
  e.objets = Array.isArray(o.objets) ? o.objets.filter(x => typeof x === 'string') : [];
  e.apparences = Array.isArray(o.apparences) ? o.apparences.filter(x => typeof x === 'string') : [];
  e.apparence = typeof o.apparence === 'string' && e.apparences.includes(o.apparence) ? o.apparence : '';
  e.generations = { dragodinde: o.generations?.dragodinde ?? 0, muldo: o.generations?.muldo ?? 0 };
  e.prochainUid = Math.max(o.prochainUid ?? 1, ...e.montures.map(m => m.uid + 1), 1);
  return e;
}

/** 7B : objets du Bricoleur posés dans l'enclos (noms officiels, effets à nous), fabriqués à son atelier. */
export const OBJETS_ENCLOS: Record<string, { nom: string; niveau: number; recette: [string, number][]; effet: string }> = {
  mangeoire: { nom: 'Mangeoire', niveau: 10, recette: [['303', 30], ['289', 40]], effet: 'La nourriture compte double.' },
  abri: { nom: 'Abri', niveau: 30, recette: [['473', 30], ['400', 30]], effet: 'Gestation un quart plus courte.' },
  arene: { nom: 'Arène de dressage', niveau: 50, recette: [['476', 40], ['533', 40]], effet: `+${MONTURE.areneXp} XP par heure à chaque monture de l'enclos.` },
};

/** Sous-zones où envoyer une monture en expédition (2D) : celles du monde ouvert jusqu'au niveau du perso. */
export function lieuxExpedition(w: World, p: Player): { sub: string; nom: string; niveau: number }[] {
  return Object.entries(w.zone.open?.subareas ?? {}).filter(([, s]) => s.level <= p.level && s.monsters.length && (!s.v07 || w.v07Ouvert) && (!s.v06 || p.v06) && (!s.essai || p.v04))
    .map(([sub, s]) => ({ sub, nom: s.name, niveau: s.level })).sort((a, b) => a.niveau - b.niveau);
}

/** 1C : le perso est-il dans Amakna (pour louer l'enclos) ? */
export function dansAmakna(w: World, p: Player): boolean {
  const s = w.worldGrid?.mapAt(p.x, p.y)?.sub, sz = s != null ? w.zone.open?.subareas[String(s)] : undefined;
  return !!sz && (sz.region ?? w.zone.name) === 'Amakna';
}

/** Commandes de la fenêtre d'élevage (passent par World.elevage : le joueur qui agit). */
export type CmdElevage =
  | { k: 'equiper'; uid: number } | { k: 'ranger'; uid: number; ou: 'havre' | 'amakna' | null }
  | { k: 'deplacer'; uid: number; de: -1 | 1 } | { k: 'nourrir'; uid: number; res: string; n: number }
  | { k: 'accoupler'; a: number; b: number } | { k: 'expedition'; uid: number; sub: string; duree: number }
  | { k: 'louer' } | { k: 'fabriquer'; id: string } | { k: 'renommer'; uid: number; nom: string } | { k: 'liberer'; uid: number }
  | { k: 'apparence'; id: string };

export function commandeElevage(p: Player, w: World, c: CmdElevage): string | null {
  const e = p.ecurie;
  switch (c.k) {
    case 'equiper': return equiperMonture(p, w, c.uid) ? null : 'Elle est occupée.';
    case 'ranger': return placer(p, w, c.uid, c.ou);
    case 'deplacer': {   // 2B : changer de voisins
      for (const l of [e.enclos, e.enclosLoue]) {
        const i = l.indexOf(c.uid), j = i + c.de;
        if (i >= 0 && j >= 0 && j < l.length) { [l[i], l[j]] = [l[j], l[i]]; return null; }
      }
      return null;
    }
    case 'nourrir': { const n = nourrir(p, c.uid, c.res, c.n); if (n && e.active === c.uid) p.recompute(); return n ? null : 'Elle n\'en veut pas.'; }
    case 'accoupler': return accoupler(p, w, c.a, c.b);
    case 'expedition': {
      if (!lieuxExpedition(w, p).some(l => l.sub === c.sub)) return 'Région inconnue.';
      return envoyerExpedition(p, w, c.uid, c.sub, c.duree);
    }
    case 'louer': return dansAmakna(w, p) ? louerEnclos(p, w) : "L'enclos se loue dans Amakna.";
    case 'fabriquer': {
      const o = OBJETS_ENCLOS[c.id];
      if (!o || e.objets.includes(c.id)) return 'Déjà dans ton enclos.';
      if (w.atelierIci('bricoleur') === null) return 'Il faut être à un atelier de Bricoleur.';
      if (p.metierLevel('bricoleur') < o.niveau) return `Bricoleur niveau ${o.niveau} requis.`;
      if (o.recette.some(([x, q]) => (p.resources[x] ?? 0) < q)) return 'Ingrédients manquants.';
      for (const [x, q] of o.recette) { p.resources[x] -= q; if (p.resources[x] <= 0) delete p.resources[x]; }
      e.objets.push(c.id);
      p.gainMetierXp('bricoleur', 10 * o.recette.reduce((s, [, q]) => s + q, 0), w);
      return null;
    }
    case 'renommer': { const m = monture(p, c.uid); if (m) m.nom = c.nom.trim().slice(0, 24) || race(m).nom; return null; }
    case 'liberer': {
      const m = monture(p, c.uid);
      if (!m || m.gestation || m.expedition) return 'Pas maintenant.';
      if (e.active === m.uid) { descendre(p, w); e.active = 0; }
      e.montures = e.montures.filter(x => x !== m); placer(p, w, m.uid, null); e.enclos = e.enclos.filter(u => u !== m.uid);
      p.recompute();
      return null;
    }
    case 'apparence': {
      if (c.id && !e.apparences.includes(c.id)) return 'Apparence pas encore achetée.';
      e.apparence = c.id;
      if (p.monte) p.montee = c.id || monture(p)?.race || '';
      return null;
    }
  }
}
