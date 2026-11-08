import { NO_INPUT, type PlayerInput } from './input';
import type { Player } from './player';
import type { World } from './world';

/** Allié de test (panneau F1, maquette « Multi : » étape 0) : un 2e joueur conduit par la simulation, en attendant les
 *  vrais joueurs de la coop. Il frappe le monstre éveillé le plus proche de lui ou du joueur, sinon il suit le joueur. */
export const ALLIE = { portee: 420, suivre: 150 };

export function entreesAllie(w: World, q: Player): PlayerInput {
  const h = w.players[0];
  if (q.dead) return { ...NO_INPUT, aim: { x: q.x, y: q.y } };
  let cible = null, d = ALLIE.portee;
  for (const m of w.monsters) {
    if (m.dead || m.state === 'spawn') continue;
    const dm = Math.min(Math.hypot(m.x - q.x, m.y - q.y), Math.hypot(m.x - h.x, m.y - h.y));
    if ((m.state !== 'idle' || m.poseTest) && dm < d) { d = dm; cible = m; }
  }
  if (cible) return { ...NO_INPUT, aim: { x: cible.x, y: cible.y }, target: cible.id, holdAttack: true };
  if (Math.hypot(h.x - q.x, h.y - q.y) > ALLIE.suivre) return { ...NO_INPUT, aim: { x: h.x, y: h.y }, dest: { x: h.x, y: h.y } };
  return { ...NO_INPUT, aim: { x: h.x, y: h.y } };
}

/** Entrées de tous les alliés de test, par id de joueur. */
export function entreesAllies(w: World): Record<number, PlayerInput> {
  const out: Record<number, PlayerInput> = {};
  for (let i = 1; i < w.players.length; i++) out[w.players[i].id] = entreesAllie(w, w.players[i]);
  return out;
}
