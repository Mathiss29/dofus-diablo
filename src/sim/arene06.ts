import type { Arene } from './arene';
import type { DonjonDef, Element } from './defs';
import { CASE, zoneRadius } from './monster';

/** Mécaniques des arènes de la 0.6 (maquette « Arènes : 1A 2D 3A 4A+4C 5B 6B+6C 7A 8A+8B 9A+9C 10A+10C 11A », 13 nov. 2026).
 *  L'état vit dans l'arène (champs simples, recopiés tels quels chez l'invité) ; ces fonctions le font avancer, chez l'hôte.
 *  Aucun hasard hors de world.rng. */
export const A06 = {
  /** 2D : cercles de choix devant l'arrivée (px au-dessus de l'arrivée, écart entre deux cercles), rayon pour entrer dedans. */
  choix: { haut: 230, ecart: 165, rayon: 52 },
  /** 4C : un coup sur un œuf à moins de `r` px de son pied, pendant le boss, le fait éclore. */
  oeuf: { r: 75 },
  /** 6B : rayon d'une toile, lenteur en marchant dessus, durée de la brûlure (s) ; 6C : la Reine tisse toutes les `cadence` s
   *  (1 s d'avance au sol), une toile tissée dure `vie` s, `max` toiles tissées à la fois. */
  toile: { r: 85, lenteur: 0.4, brule: 15, cadence: 9, annonce: 1, vie: 20, max: 6 },
  /** 8B : racines sous chaque joueur toutes les `cadence` s, cercle `annonce` s avant, enracine `duree` s. */
  racine: { cadence: 7, annonce: 1, duree: 1.5, r: CASE * 1.1, premier: 4 },
};

export type Choix06 = { x: number; y: number; nom: string; couleur: string };
export type Oeuf06 = { x: number; y: number; eclos: boolean };
/** Toile au sol : brule = secondes restantes de brûlure (0 : collante) ; vie = secondes restantes d'une toile tissée (absente : fixe). */
export type Toile06 = { x: number; y: number; r: number; brule: number; vie?: number };

/** État des mécaniques dans l'arène, à sa création. */
export function preparer06(a: Arene, d: DonjonDef, depart: { x: number; y: number }) {
  const C = A06.choix;
  if (d.choix?.length) {
    const n = d.choix.length;
    a.choix = d.choix.map((c, i) => ({ ...a.libreA(depart.x + (i - (n - 1) / 2) * C.ecart, depart.y - C.haut - (i % 2 ? 40 : 0)), nom: c.nom, couleur: c.couleur }));
  }
  a.oeufs = (d.oeufs?.pos ?? []).map(([dx, dy]) => ({ x: depart.x + dx, y: depart.y + dy, eclos: false }));
  a.toiles = (d.toiles ?? []).map(([dx, dy]) => ({ x: depart.x + dx, y: depart.y + dy, r: A06.toile.r, brule: 0 }));
}

/** 2D : un joueur entre dans un cercle : la variante est choisie (vagues, boss et butin de ce Royal). */
export function choisir06(a: Arene): boolean {
  const w = a.w, C = a.choix;
  if (!C) return true;
  for (const q of w.players) {
    if (q.dead) continue;
    const i = C.findIndex(c => Math.hypot(q.x - c.x, q.y - c.y) < A06.choix.rayon);
    if (i < 0) continue;
    a.variante = i; a.choix = null; a.majPool();
    const cle = q.cleDonjon;
    if (cle && cle.nom === a.d.nom) cle.choix = i;
    w.emit({ k: 'status', x: q.x, y: q.y - 70, text: a.d.choix![i].nom, color: C[i].couleur });
    w.emit({ k: 'impact', hitstop: 0, shake: 0.008, big: false });
    return true;
  }
  return false;
}

/** Chaque pas de l'arène (après le départ) : toiles, tissage de la Reine, racines de l'Ancestral. */
export function update06(a: Arene, dt: number) {
  const w = a.w, T = A06.toile, b = a.boss, bossLa = !!b && !b.dead && b.state !== 'spawn' && !a.fini;
  // 6B : les toiles collent (40 % de lenteur), une toile brûlée repousse au bout de 15 s ; une toile tissée finit par tomber
  for (const t of a.toiles) {
    if (t.brule > 0) t.brule = Math.max(0, t.brule - dt);
    if (t.vie != null) t.vie -= dt;
  }
  a.toiles = a.toiles.filter(t => t.vie == null || t.vie > 0);
  for (const q of w.players) if (!q.dead && a.toiles.some(t => !t.brule && Math.hypot(q.x - t.x, q.y - t.y) < t.r)) q.slow(0.25, T.lenteur);
  // annonces au sol (1 s), puis l'effet
  const S = (id: number) => b?.def.spells?.find(s => s.id === id);
  for (const n of a.tisse) {
    n.t -= dt;
    w.telegraphs.push({ kind: 'circle', x: n.x, y: n.y, r: n.r, progress: 1 - Math.max(0, n.t) / T.annonce, danger: true });
    if (n.t <= 0) a.toiles.push({ x: n.x, y: n.y, r: n.r, brule: 0, vie: T.vie });
  }
  a.tisse = a.tisse.filter(n => n.t > 0);
  const R = A06.racine;
  for (const n of a.racines) {
    n.t -= dt;
    w.telegraphs.push({ kind: 'circle', x: n.x, y: n.y, r: n.r, progress: 1 - Math.max(0, n.t) / R.annonce, danger: true });
    if (n.t > 0) continue;
    for (const q of w.players) if (!q.dead && Math.hypot(q.x - n.x, q.y - n.y) < n.r + q.radius) {
      q.slow(R.duree, 1);
      w.emit({ k: 'status', x: q.x, y: q.y - 60, text: 'Enraciné', color: '#9fd27a' });
    }
    w.emit({ k: 'slam', x: n.x, y: n.y, radius: n.r });
  }
  a.racines = a.racines.filter(n => n.t > 0);
  if (!bossLa || b!.intouchable) return;
  const vivants = w.players.filter(q => !q.dead);
  // 6C : la Reine tisse sous les joueurs (zone officielle de Mitraille de soie)
  const ts = a.d.tisse != null ? S(a.d.tisse) : undefined;
  if (ts && (a.tTisse -= dt) <= 0) {
    a.tTisse = T.cadence;
    const tissees = a.toiles.filter(t => t.vie != null).length;
    for (const q of vivants.slice(0, Math.max(0, T.max - tissees))) a.tisse.push({ x: q.x, y: q.y, t: T.annonce, r: zoneRadius(ts) });
    w.emit({ k: 'monsterCast', id: b!.id, name: ts.name, x: b!.x, y: b!.y });
  }
  // 8B : racines sous chaque joueur (Branche Paralysante)
  const rs = a.d.racines != null ? S(a.d.racines) : undefined;
  if (rs && (a.tRacines -= dt) <= 0) {
    a.tRacines = R.cadence;
    for (const q of vivants) a.racines.push({ x: q.x, y: q.y, t: R.annonce, r: R.r });
    w.emit({ k: 'monsterCast', id: b!.id, name: rs.name, x: b!.x, y: b!.y });
  }
}

/** Un coup d'un joueur (zone de applyHits) : les sorts de feu brûlent les toiles (6B) ; pendant le boss, un œuf touché éclot (4C). */
export function coup06(a: Arene, touche: (o: { x: number; y: number; radius: number }) => boolean, element: Element) {
  const w = a.w;
  if (element === 'feu') for (const t of a.toiles) if (!t.brule && touche({ x: t.x, y: t.y, radius: t.r * 0.8 })) {
    t.brule = A06.toile.brule;
    w.emit({ k: 'status', x: t.x, y: t.y - 30, text: 'Toile brûlée', color: '#ff9a5a' });
  }
  const b = a.boss, E = a.d.oeufs;
  if (!E || !b || b.dead || a.fini) return;
  for (const o of a.oeufs) if (!o.eclos && touche({ x: o.x, y: o.y, radius: A06.oeuf.r })) {
    o.eclos = true;
    a.renfort(w.rng.pick(E.eclot), o.x + 30, o.y + 30);
    w.emit({ k: 'status', x: o.x, y: o.y - 80, text: 'L\'œuf éclot !', color: '#f2d36b' });
    w.emit({ k: 'slam', x: o.x, y: o.y, radius: 70 });
  }
}
