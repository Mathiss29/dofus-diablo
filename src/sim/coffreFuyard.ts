import V06 from '../data/v06.json';
import type { MonsterDef } from './defs';
import type { Monster } from './monster';
import type { World } from './world';

/** Coffre Malveillant qui détale (maquette 0.6, 22A), façon gobelin du trésor : rare, il attend près d'un groupe, se met à fuir
 *  dès qu'un joueur approche et disparaît au bout de 15 s s'il n'est pas abattu. Abattu, il lâche 5 butins. */
export const COFFRE_FUYARD = V06.coffreFuyard;

/** Fiche du coffre au niveau de la sous-zone (ses données officielles sont au niveau 50). */
export function defCoffreFuyard(def: MonsterDef, niveau: number): MonsterDef {
  const k = Math.max(0.3, niveau / (def.level ?? 50));
  return { ...def, hp: Math.round(def.hp * k), dmg: 0, xp: Math.round((def.xp ?? 0) * k), level: niveau };
}

/** Pilote le coffre (vrai : son pas est fait). Il ne frappe jamais. */
export function piloterCoffre(w: World, m: Monster, dt: number): boolean {
  if (m.state === 'spawn') return false;
  m.age += dt; m.flash = Math.max(0, m.flash - dt); m.stun = 0;
  if (m.dead) { m.t -= dt; m.setAnim('die', 1 - m.t / 0.6); return true; }
  const q = w.players.filter(p => !p.dead).sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y))[0];
  const d = q ? Math.hypot(q.x - m.x, q.y - m.y) : Infinity;
  if (m.fuiteT <= 0) {
    if (d > COFFRE_FUYARD.repere && m.state !== 'chase') { m.setAnim('idle'); return true; }
    m.fuiteT = COFFRE_FUYARD.fuite; m.state = 'chase';
    w.emit({ k: 'coffreFuyard', x: m.x, y: m.y });
  }
  m.fuiteT -= dt;
  if (m.fuiteT <= 0) {   // il s'enfuit : pas de butin
    w.emit({ k: 'status', x: m.x, y: m.y - 40, text: 'S\'est enfui !', color: '#f2d36b' });
    m.dead = true; m.t = 0; m.hp = 0;
    return true;
  }
  if (q) {   // s'éloigne du joueur le plus proche, en contournant les obstacles
    const base = Math.atan2(m.y - q.y, m.x - q.x), pas = m.def.speed * COFFRE_FUYARD.vitesse * dt;
    for (const da of [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9]) {
      const a = base + da, x = m.x + Math.cos(a) * pas, y = m.y + Math.sin(a) * pas;
      if (!w.walkable(x, y)) continue;
      m.x = x; m.y = y; m.facing = a; m.dirX = Math.cos(a); m.dirY = Math.sin(a);
      break;
    }
  }
  m.setAnim('run', (m.animT + dt * 2) % 1);
  m.applyKnock(dt);
  return true;
}
