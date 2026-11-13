import { REGLES_IDOLES, type FxIdole } from './idoles';
import type { Monster } from './monster';
import type { Player } from './player';
import type { World } from './world';
import type { Element } from './defs';

/** Idoles en combat (maquette 0.6, 17B) : ce qui se joue pendant la partie, en secondes. Le reste (PV, dégâts, vitesse,
 *  résistances) est déjà dans la fiche du monstre (defSousIdoles) ; les effets sur le perso sont lus par Player (fxIdoles). */
const C = (REGLES_IDOLES as unknown as { combat: {
  rayonCombat: number; bouclierRegenPeriode: number; bouclierMax: number; regenPeriode: number; usurePeriode: number;
  eclairs: { periode: number; annonce: number; rayon: number; ecart: number; pv: number };
  flaque: { annonce: number; duree: number; rayon: number; pvParSeconde: number };
} }).combat;
export { C as COMBAT_IDOLES };

/** Zone qui blesse les joueurs : annoncée (annonce s), puis un coup (part des PV max) et/ou une brûlure par seconde pendant t s. */
export interface ZoneIdole { x: number; y: number; r: number; annonce: number; a0: number; t: number; coup: number; dps: number; el: Element; tick: number;
  /** Ralentit les joueurs dedans (Glacial). */
  lent?: number }

const actif = (m: Monster) => !m.dead && m.state !== 'idle' && m.state !== 'return' && m.state !== 'spawn';
/** Un monstre réveillé près de ce joueur : il est en combat. */
export const enCombat = (w: World, q: Player) => !q.dead && w.monsters.some(m => actif(m) && Math.abs(m.x - q.x) + Math.abs(m.y - q.y) < C.rayonCombat);
const passe = (t0: number, t1: number, p: number) => Math.floor(t1 / p) > Math.floor(t0 / p);

/** Monstre qui apparaît : bouclier de départ (Tynril). */
export function idolesApparition(m: Monster, fx: FxIdole) {
  if (fx.bouclier) m.bouclier = Math.round(m.maxHp * fx.bouclier);
}

/** Groupe posé : Payo (le plus fort a ses PV ×3), Djim (un Champion : PV ×2, butin doublé). */
export function idolesGroupe(w: World, membres: Monster[], fx: FxIdole) {
  const l = membres.filter(m => !m.dead);
  if (!l.length) return;
  const pv = (m: Monster, k: number) => { m.maxHp = Math.round(m.maxHp * k); m.hp = m.maxHp; if (fx.bouclier) m.bouclier = Math.round(m.maxHp * fx.bouclier); };
  if (fx.payo) pv(l.reduce((a, b) => (b.maxHp > a.maxHp ? b : a)), fx.payo);
  if (fx.champion) { const c = l[w.rng.int(l.length)]; c.champion = true; pv(c, 2); }
}

/** Un monstre tombe à 0 PV. Vrai s'il revient à la vie (Sakai) : la mort est annulée. Sinon Chokwa, Serpi, Nahuatl. */
export function idolesMort(w: World, m: Monster, groupe: { members: Monster[]; renfort?: boolean } | undefined, fx: FxIdole): boolean {
  if (m.summoner || m.mannequin) return false;
  if (fx.retour && !m.revenu) {
    m.revenu = true; m.hp = Math.max(1, Math.round(m.maxHp * fx.retour)); m.dead = false;
    w.emit({ k: 'status', x: m.x, y: m.y - 40, text: 'Revient !', color: '#b98aff' });
    return true;
  }
  const autres = groupe?.members.filter(o => o !== m && !o.dead) ?? [];
  if (fx.chokwa) for (const o of autres) o.hp = Math.min(o.maxHp, o.hp + Math.round(o.maxHp * fx.chokwa));
  if (fx.renfort && groupe && !groupe.renfort && !m.def.boss) {
    groupe.renfort = true;
    const a = w.rng.range(0, Math.PI * 2), q = w.map.nearestFree(m.x + Math.cos(a) * 90, m.y + Math.sin(a) * 90);
    const r = w.spawnMonster(m.type, q.x, q.y);
    r.group = m.group; r.homeX = m.homeX; r.homeY = m.homeY; groupe.members.push(r);
    r.t = 0.6; r.state = 'spawn';
    w.emit({ k: 'status', x: q.x, y: q.y - 40, text: 'Renfort !', color: '#ffb35c' });
  }
  if (fx.flaques) {
    const F = C.flaque;
    w.zonesIdoles.push({ x: m.x, y: m.y, r: F.rayon, annonce: F.annonce, a0: F.annonce, t: F.duree, coup: 0, dps: F.pvParSeconde, el: 'feu', tick: 0 });
  }
  return false;
}

/** Chaque pas : soins et boucliers des monstres réveillés (Abdinde, Kori), usure du perso (Dokoko, Jiva), éclairs (Zaihort), zones. */
export function idolesPas(w: World, dt: number, fx: FxIdole | null) {
  if (fx) effetsIdoles(w, dt, fx);
  zonesPas(w, dt);
  for (const q of w.players) q.bouclierVu = q.shield;
}
function effetsIdoles(w: World, dt: number, fx: FxIdole) {
  if (fx.regen || fx.bouclierRegen) for (const m of w.monsters) {
    if (!actif(m) || m.mannequin) continue;
    const t0 = m.idoleT; m.idoleT += dt;
    if (fx.regen && passe(t0, m.idoleT, C.regenPeriode) && m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + Math.round(m.maxHp * fx.regen));
    if (fx.bouclierRegen && passe(t0, m.idoleT, C.bouclierRegenPeriode)) m.bouclier = Math.min(Math.round(m.maxHp * C.bouclierMax), m.bouclier + Math.round(m.maxHp * fx.bouclierRegen));
  }
  for (const q of w.players) {
    if (!enCombat(w, q)) { q.idoleT = 0; continue; }
    const t0 = q.idoleT; q.idoleT += dt;
    if (fx.usure && passe(t0, q.idoleT, C.usurePeriode)) {
      const n = Math.min(q.hp - 1, Math.round(q.maxHp * fx.usure));   // l'usure ne tue pas
      if (n > 0) { q.hp -= n; w.emit({ k: 'hit', target: 'player', x: q.x, y: q.y, z: 50, amount: n, crit: false, element: 'neutre' }); }
    }
    if (fx.eclairs && passe(t0, q.idoleT, C.eclairs.periode)) {
      const E = C.eclairs, a = w.rng.range(0, Math.PI * 2), d = w.rng.range(0, E.ecart);
      w.zonesIdoles.push({ x: q.x + Math.cos(a) * d, y: q.y + Math.sin(a) * d, r: E.rayon, annonce: E.annonce, a0: E.annonce, t: 0, coup: E.pv, dps: 0, el: 'air', tick: 0 });
    }
  }
}
/** Zones au sol qui blessent les joueurs : idoles (éclairs, flaques) et élites (Glacial, Ardent). */
function zonesPas(w: World, dt: number) {
  if (!w.zonesIdoles.length) return;
  for (const z of w.zonesIdoles) {
    if (z.annonce > 0) {
      z.annonce -= dt;
      w.telegraphs.push({ kind: 'circle', x: z.x, y: z.y, r: z.r, progress: 1 - Math.max(0, z.annonce) / z.a0, danger: true });
      if (z.annonce > 0) continue;
      if (z.coup) {
        w.emit({ k: 'impact', hitstop: 0, shake: 0.006, big: false });
        for (const q of w.players) if (!q.dead && Math.hypot(q.x - z.x, q.y - z.y) <= z.r + q.radius) q.hurt(q.maxHp * z.coup, z.x, z.y, w, z.el, true);
      }
      continue;
    }
    z.t -= dt;
    if (z.dps <= 0) continue;
    w.telegraphs.push({ kind: 'circle', x: z.x, y: z.y, r: z.r, progress: 1, danger: true });
    if ((z.tick -= dt) <= 0) {
      z.tick = 0.5;
      for (const q of w.players) if (!q.dead && Math.hypot(q.x - z.x, q.y - z.y) <= z.r + q.radius) {
        q.hurt(q.maxHp * z.dps * 0.5, z.x, z.y, w, z.el, true);
        if (z.lent) q.slow(0.6, z.lent);
      }
    }
  }
  w.zonesIdoles = w.zonesIdoles.filter(z => z.annonce > 0 || z.t > 0);
}
