import type { MonsterDef } from './defs';
import type { Monster } from './monster';
import type { World } from './world';

/** Gobrechaun (0.7, ligne « 0.7 : » 15A), le lutin au trésor des Plaines herbeuses d'Otomaï (monstre officiel, niveau 110) :
 *  rare, il attend près d'un groupe, détale dès qu'un joueur approche et sème des kamas en courant. Abattu avant de disparaître,
 *  il lâche la Clé du Laboratoire caché (6C) à chaque joueur proche, plus un double butin. Il ne frappe jamais.
 *  Dans le Laboratoire caché, il garde son trésor et se bat comme un boss (DonjonDef.bossForce, src/sim/arene.ts). */
export const GOBRECHAUN = {
  monstre: 'gobrechaun',
  /** Sous-zone officielle (Plaines herbeuses) ; chance par groupe posé dans cette sous-zone (×10 en partie de test avec archis ×100). */
  sub: 454, chance: 0.03,
  /** Il se met à fuir à moins de `repere` px d'un joueur ; `fuite` s pour l'abattre ; vitesse × la sienne. */
  repere: 380, fuite: 18, vitesse: 2.2,
  /** Une poignée de kamas au sol toutes les `semis` s pendant la fuite (kamas × niveau de la sous-zone). */
  semis: 1.4, kamas: [3, 6] as [number, number],
  /** Rayon où un joueur compte comme présent quand il tombe (clé pour lui). */
  rayon: 1200,
  cle: 'cle_labo_cache',
};

/** Fiche du lutin dehors : il ne frappe pas et n'est jamais un boss. */
export function defGobrechaun(def: MonsterDef): MonsterDef { return { ...def, dmg: 0, spells: [], boss: false }; }

/** Pilote le lutin (vrai : son pas est fait). */
export function piloterGobrechaun(w: World, m: Monster, dt: number): boolean {
  if (m.state === 'spawn') return false;
  const G = GOBRECHAUN;
  m.age += dt; m.flash = Math.max(0, m.flash - dt); m.stun = 0;
  if (m.dead) { m.t -= dt; m.setAnim('die', 1 - m.t / 0.6); return true; }
  const q = w.players.filter(p => !p.dead).sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y))[0];
  const d = q ? Math.hypot(q.x - m.x, q.y - m.y) : Infinity;
  if (m.fuiteT <= 0) {
    if (d > G.repere && m.state !== 'chase') { m.setAnim('idle'); return true; }
    m.fuiteT = G.fuite; m.state = 'chase'; m.semisT = 0;
    w.emit({ k: 'gobrechaun', x: m.x, y: m.y });
  }
  m.fuiteT -= dt;
  if (m.fuiteT <= 0) {   // il s'enfuit avec son trésor
    w.emit({ k: 'status', x: m.x, y: m.y - 40, text: 'Le Gobrechaun s\'est enfui !', color: '#f2d36b' });
    m.dead = true; m.t = 0; m.hp = 0;
    return true;
  }
  if ((m.semisT -= dt) <= 0) {   // 15A : il sème des kamas en courant
    m.semisT = G.semis;
    w.semerKamas(Math.round(w.rng.range(...G.kamas) * w.niveauEn(m.x, m.y)), m.x, m.y);
  }
  if (q) {   // s'éloigne du joueur le plus proche, en contournant les obstacles
    const base = Math.atan2(m.y - q.y, m.x - q.x), pas = m.def.speed * G.vitesse * dt;
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

/** Le lutin est tombé : la clé du Laboratoire caché pour chaque joueur proche. */
export function gobrechaunVaincu(w: World, m: Monster) {
  for (const p of w.players) {
    if (Math.hypot(p.x - m.x, p.y - m.y) > GOBRECHAUN.rayon) continue;
    p.resources[GOBRECHAUN.cle] = (p.resources[GOBRECHAUN.cle] ?? 0) + 1;
    w.commeJoueur(p, () => {
      w.emit({ k: 'lootResource', id: GOBRECHAUN.cle, n: 1 });
      w.emit({ k: 'status', x: m.x, y: m.y - 60, text: 'Clé du Laboratoire caché !', color: '#f2d36b' });
    });
  }
}
