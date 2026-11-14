import type { Arene } from './arene';
import { COFFRE_FUYARD } from './coffreFuyard';
import type { DonjonDef, MonsterDef } from './defs';
import type { Monster } from './monster';
import type { World } from './world';

/** 0.6 (22B) : une fois sur 20, le Coffre Malveillant abattu laisse un portail vers la Salle au trésor (arène `tresor` de donjonsV06) :
 *  des coffres, des monstres dorés de la sous-zone d'où l'on vient, puis le Coffre des Forgerons ; tout au niveau de cette sous-zone. */
export const PORTAIL_TRESOR = COFFRE_FUYARD.portail;

/** Portail posé dans le monde (vie : secondes restantes). */
export interface PortailTresor { x: number; y: number; tag: string; vie: number; sub: number; niveau: number }
/** Visite en cours : d'où l'on vient (la sortie y ramène), sous-zone et niveau de la salle. */
export interface VisiteTresor { retour: { tag: string; x: number; y: number }; sub: number; niveau: number }

/** Le coffre qui fuit est tombé : peut-être un portail. */
export function tenterPortail(w: World, m: Monster) {
  const d = salleTresor(w), wg = w.worldGrid, carte = wg?.mapAt(m.x, m.y);
  if (!d || !carte || w.portailTresor || w.rng.next() >= PORTAIL_TRESOR.chance * (w.test?.archis ? 10 : 1)) return;
  w.portailTresor = { x: m.x, y: m.y, tag: carte.tag, vie: PORTAIL_TRESOR.duree, sub: carte.sub, niveau: w.niveauEn(m.x, m.y) };
  w.emit({ k: 'status', x: m.x, y: m.y - 70, text: 'Un portail doré s\'ouvre !', color: '#f2d36b' });
  w.emit({ k: 'tresorPortail', x: m.x, y: m.y });
}

/** La salle, si elle existe dans cette partie (0.6 visible). */
export function salleTresor(w: World): DonjonDef | undefined { return w.zone.open?.donjons?.find(d => d.tresor && d.arene); }

/** Chaque pas : le portail s'éteint, ou le joueur de cet écran y entre (pas pendant une autre arène). */
export function portailPas(w: World, dt: number) {
  const P = w.portailTresor, p = w.player;
  if (!P) return;
  if ((P.vie -= dt) <= 0) { w.portailTresor = null; return; }
  if (p.dead || w.passage || w.arene || Math.hypot(p.x - P.x, p.y - P.y) > PORTAIL_TRESOR.rayon) return;
  const d = salleTresor(w);
  if (!d) return;
  w.portailTresor = null;
  w.visiteTresor = { retour: { tag: P.tag, x: P.x, y: P.y }, sub: P.sub, niveau: P.niveau };
  w.entrerTresor(d);
}

/** Monstres dorés : ceux de la sous-zone d'où l'on vient (sinon ceux de la carte où était le portail). */
export function poolTresor(w: World): string[] {
  const V = w.visiteTresor, M = w.opts.data.monsters;
  const sz = V ? w.zone.open?.subareas[String(V.sub)] : undefined;
  return (sz?.monsters ?? []).filter(m => M[m] && !M[m].boss && !M[m].archiDe);
}

/** Fiche d'un monstre de la salle au niveau de la visite ; les monstres de la sous-zone sont dorés (PV ×1,5, butin en plus). */
export function defTresor(w: World, def: MonsterDef, dore: boolean): MonsterDef {
  const n = w.visiteTresor?.niveau ?? def.level ?? 50, k = Math.max(0.3, n / (def.level ?? n)) * (dore ? PORTAIL_TRESOR.pvDore : 1);
  return { ...def, hp: Math.round(def.hp * k), xp: Math.round((def.xp ?? def.hp / 5) * k), level: n };
}

/** Un monstre de la salle vient d'arriver. */
export function apparuTresor(a: Arene, m: Monster) { if (poolTresor(a.w).includes(m.type)) m.dore = true; }
