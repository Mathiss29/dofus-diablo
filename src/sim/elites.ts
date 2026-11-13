import V06 from '../data/v06.json';
import type { MonsterDef } from './defs';
import type { Monster } from './monster';
import type { World } from './world';

/** Élites à affixes (maquette 0.6, 23A+23B) : chaque élite (pas les boss) tire 2 affixes au hasard, 3 si les idoles actives
 *  font au moins 30 points. Affichés sous son nom ; Glacial et Ardent laissent des zones au sol (World.zonesIdoles). */
export const ELITES = V06.elites;
type A = typeof ELITES.affixes;
export type Affixe = keyof A;
export const AFFIXES = Object.keys(ELITES.affixes) as Affixe[];
export const nomAffixe = (a: string) => (ELITES.affixes as Record<string, { nom: string }>)[a]?.nom ?? a;

/** Affixes tirés pour un élite (vide pour un boss ou un monstre normal). */
export function tirerAffixes(w: World, def: MonsterDef, scoreIdoles: number): Affixe[] {
  if (!def.elite || def.boss) return [];
  const n = scoreIdoles >= ELITES.scoreIdoles ? ELITES.nombreIdoles : ELITES.nombre, l = [...AFFIXES], out: Affixe[] = [];
  while (out.length < n && l.length) out.push(l.splice(w.rng.int(l.length), 1)[0]);
  return out;
}
/** Fiche de l'élite avec ses affixes (Rapide : plus vite). */
export function defAffixes(def: MonsterDef, a: readonly string[]): MonsterDef {
  return a.includes('rapide') ? { ...def, speed: def.speed * (1 + ELITES.affixes.rapide.vitesse) } : def;
}
/** À l'apparition : bouclier. */
export function poserAffixes(m: Monster, a: Affixe[]) {
  m.affixes = a;
  if (a.includes('bouclier')) m.bouclier = Math.max(m.bouclier, Math.round(m.maxHp * ELITES.affixes.bouclier.part));
}

const reveille = (m: Monster) => !m.dead && m.state !== 'idle' && m.state !== 'return' && m.state !== 'spawn';
const passe = (t0: number, t1: number, p: number) => Math.floor(t1 / p) > Math.floor(t0 / p);

/** Chaque pas, pour les élites réveillés : traînées, bouclier qui revient, téléportation, invocations. */
export function elitesPas(w: World, dt: number) {
  const E = ELITES.affixes;
  for (const m of w.monsters) {
    if (!m.affixes.length || !reveille(m)) continue;
    const t0 = m.affixeT; m.affixeT += dt;
    const t1 = m.affixeT, cible = w.players.filter(q => !q.dead).sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y))[0];
    for (const a of m.affixes) {
      if (a === 'rapide') m.atkCd -= dt * E.rapide.attaque;
      else if (a === 'glacial' && passe(t0, t1, E.glacial.periode)) {
        const G = E.glacial;
        w.zonesIdoles.push({ x: m.x, y: m.y, r: G.rayon, annonce: 0.3, a0: 0.3, t: G.duree, coup: 0, dps: G.pvParSeconde, el: 'eau', tick: 0, lent: G.lent });
      } else if (a === 'ardent' && passe(t0, t1, E.ardent.periode)) {
        const F = E.ardent;
        w.zonesIdoles.push({ x: m.x, y: m.y, r: F.rayon, annonce: 0.2, a0: 0.2, t: F.duree, coup: 0, dps: F.pvParSeconde, el: 'feu', tick: 0 });
      } else if (a === 'bouclier' && passe(t0, t1, E.bouclier.periode)) {
        m.bouclier = Math.min(Math.round(m.maxHp * E.bouclier.part), m.bouclier + Math.round(m.maxHp * E.bouclier.regen));
      } else if (a === 'teleporteur' && cible && passe(t0, t1, E.teleporteur.periode) && Math.hypot(cible.x - m.x, cible.y - m.y) > E.teleporteur.distance) {
        const ang = w.rng.range(0, Math.PI * 2), q = w.map.nearestFree(cible.x + Math.cos(ang) * 70, cible.y + Math.sin(ang) * 70);
        w.emit({ k: 'status', x: m.x, y: m.y - 40, text: 'Téléportation', color: E.teleporteur.couleur });
        m.x = q.x; m.y = q.y; m.kx = m.ky = 0;
      } else if (a === 'invocateur' && passe(t0, t1, E.invocateur.periode)) {
        const types = w.typesAutour(m);
        if (!types.length || w.monsters.some(o => o.summoner === m && !o.dead)) continue;
        for (let i = 0; i < E.invocateur.nombre; i++) {
          const ang = w.rng.range(0, Math.PI * 2), q = w.map.nearestFree(m.x + Math.cos(ang) * 80, m.y + Math.sin(ang) * 80);
          const s = w.spawnMonster(w.rng.pick(types), q.x, q.y);
          s.summoner = m; s.homeX = m.homeX; s.homeY = m.homeY;
        }
        w.emit({ k: 'status', x: m.x, y: m.y - 40, text: 'Invocation', color: E.invocateur.couleur });
      }
    }
  }
}
