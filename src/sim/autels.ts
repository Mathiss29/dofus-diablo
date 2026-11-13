import V06 from '../data/v06.json';
import type { Player } from './player';
import type { World } from './world';

/** Autels de combat (maquette 0.6, 21A+21B+21C) : liés aux Douze, posés au hasard près d'un groupe dehors (un par carte)
 *  ou au milieu d'une arène de donjon entre deux vagues. Le premier joueur qui le touche gagne son effet 30 s (45 s en donjon). */
export const AUTELS = V06.autels;
export type EffetAutel = keyof typeof AUTELS.effets;
const EFFETS = Object.keys(AUTELS.effets) as EffetAutel[];

export interface Autel { id: number; x: number; y: number; effet: EffetAutel; carte: string; vie: number; arene: boolean }
/** Effet d'autel porté par un joueur. */
export interface AutelActif { effet: EffetAutel; t: number; t0: number; tick: number }

export const infoAutel = (e: EffetAutel) => AUTELS.effets[e];

export function poserAutel(w: World, x: number, y: number, carte: string, arene: boolean, effet?: EffetAutel): Autel {
  const a: Autel = { id: w.nextId++, x, y, effet: effet ?? w.rng.pick(EFFETS), carte, vie: arene ? AUTELS.vie * 3 : AUTELS.vie, arene };
  w.autels.push(a);
  return a;
}

/** Chaque pas : un joueur qui touche un autel le prend ; les effets en cours s'usent (Tempête frappe). */
export function autelsPas(w: World, dt: number) {
  for (const a of w.autels) {
    a.vie -= dt;
    const q = w.players.find(p => !p.dead && Math.hypot(p.x - a.x, p.y - a.y) <= AUTELS.rayon + p.radius);
    if (!q) continue;
    a.vie = -1;
    prendreAutel(w, q, a.effet, a.arene ? AUTELS.dureeArene : AUTELS.duree, a.x, a.y);
  }
  if (w.autels.length) w.autels = w.autels.filter(a => a.vie > 0);
  for (const q of w.players) {
    const A = q.autel;
    if (!A) continue;
    A.t -= dt;
    if (A.t <= 0 || q.dead) { q.autel = null; continue; }
    if (A.effet === 'tempete' && (A.tick -= dt) <= 0) {
      const T = AUTELS.effets.tempete;
      A.tick = T.periode;
      const cible = w.monsters.filter(m => !m.dead && m.state !== 'spawn' && !m.intouchable && Math.hypot(m.x - q.x, m.y - q.y) <= T.portee)
        .sort((m1, m2) => Math.hypot(m1.x - q.x, m1.y - q.y) - Math.hypot(m2.x - q.x, m2.y - q.y))[0];
      if (cible) w.commeJoueur(q, () => {
        w.hitCircle(cible.x, cible.y, T.rayon, { dmg: (q.level + 20) * T.degats, knock: 0, element: 'air' });
        w.emit({ k: 'impact', hitstop: 0, shake: 0.004, big: false });
      });
    }
  }
}

export function prendreAutel(w: World, q: Player, effet: EffetAutel, duree: number, x = q.x, y = q.y) {
  const E = AUTELS.effets[effet];
  q.autel = { effet, t: duree, t0: duree, tick: 0 };
  if (effet === 'frenesie') q.addMod('vitesse', AUTELS.effets.frenesie.vitesse, duree, 'autel');
  if (effet === 'course') q.courir(AUTELS.effets.course.course, duree);
  w.emit({ k: 'status', x, y: y - 70, text: `${E.nom} !`, color: E.couleur });
  w.emit({ k: 'autel', effet, dieu: E.dieu, nom: E.nom });
}
