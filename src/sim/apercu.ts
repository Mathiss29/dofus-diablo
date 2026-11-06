import type { SkillId } from './defs';
import { CASE } from './monster';
import type { World } from './world';

/** Aperçu d'un sort avant de le lancer (maquette Aperçu, 2026-11-06 : 3A portée, 3B zone, 3C ennemis touchés).
 *  Calculé sans rien changer à la partie, avec la même géométrie que le sort lancé. Coordonnées monde. */
export interface Apercu {
  /** Portée maximale autour du perso (cercle de portée). */
  portee: number;
  /** Zone touchée : cône, ligne ou cercle (autour du perso, au point d'arrivée ou à l'explosion de la flèche). */
  zone: { kind: 'cone'; x: number; y: number; facing: number; range: number; arc: number }
    | { kind: 'line'; x: number; y: number; facing: number; length: number; width: number }
    | { kind: 'circle'; x: number; y: number; r: number }
    | { kind: 'shot'; x: number; y: number; tx: number; ty: number; width: number; r: number }
    | null;
  /** Monstres qui seraient touchés. */
  cibles: number[];
}

/** Ce que ferait le sort lancé maintenant vers ce point. */
export function apercuSort(world: World, id: SkillId, aim: { x: number; y: number }): Apercu | null {
  const p = world.player, d = id === 'attaque' ? null : p.spell(id);
  if (!d) return null;
  const facing = Math.atan2(aim.y - p.y, aim.x - p.x);
  const R = p.cls.rage, sig = (k: string) => (p.rageFull && d.move?.kind !== 'leap' && d.rage === k ? R.signature : 1);
  const area = Math.max(sig('length'), sig('radius'));
  const vivants = world.monsters.filter(m => !m.dead && m.state !== 'spawn');
  const dans = (test: (m: (typeof vivants)[number]) => boolean) => vivants.filter(test).map(m => m.id);
  const hz = d.hit;
  if (d.self) return { portee: 0, zone: null, cibles: [] };
  if (d.move) {
    const at = p.landing(id, aim, world), r = hz.shape === 'circle' ? hz.radius * area : 0;
    return { portee: d.move.maxRange * sig('dash'), zone: r ? { kind: 'circle', x: at.x, y: at.y, r } : null,
      cibles: r ? dans(m => Math.hypot(m.x - at.x, m.y - at.y) <= r + m.radius) : [] };
  }
  if (hz.shape === 'cone') {
    const range = hz.range * area, arc = (hz.arc * Math.PI) / 180;
    return { portee: range, zone: { kind: 'cone', x: p.x, y: p.y, facing, range, arc }, cibles: dans(m => {
      const dx = m.x - p.x, dy = m.y - p.y, l = Math.hypot(dx, dy);
      const da = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - facing), Math.cos(Math.atan2(dy, dx) - facing)));
      return l <= range + m.radius && (l < m.radius + 8 || da <= arc / 2);
    }) };
  }
  if (hz.shape === 'line') {
    const length = hz.length * area, width = hz.width * area, c = Math.cos(facing), s = Math.sin(facing);
    return { portee: length, zone: { kind: 'line', x: p.x, y: p.y, facing, length, width }, cibles: dans(m => {
      const dx = m.x - p.x, dy = m.y - p.y, t = dx * c + dy * s;
      return t >= -m.radius && t <= length + m.radius && Math.abs(-dx * s + dy * c) <= width + m.radius;
    }) };
  }
  if (hz.shape === 'point') {
    const at = p.landing(id, aim, world), r = hz.radius * area;
    return { portee: (p.shot(id).range ?? hz.range) + p.stat('portee') * CASE, zone: { kind: 'circle', x: at.x, y: at.y, r },
      cibles: dans(m => Math.hypot(m.x - at.x, m.y - at.y) <= r + m.radius) };
  }
  if (hz.shape === 'circle') {
    const r = hz.radius * area;
    return { portee: r, zone: { kind: 'circle', x: p.x, y: p.y, r }, cibles: dans(m => Math.hypot(m.x - p.x, m.y - p.y) <= r + m.radius) };
  }
  // Flèche : elle file jusqu'au premier ennemi sur sa route (tous avec « traverse »), puis explose s'il y a lieu
  const shot = p.shot(id), range = (shot.range ?? hz.range) + p.stat('portee') * CASE, explode = (shot.explode ?? hz.explode ?? 0) * sig('explode');
  const c = Math.cos(facing), s = Math.sin(facing);
  const route = vivants.map(m => ({ m, t: (m.x - p.x) * c + (m.y - p.y) * s, perp: Math.abs(-(m.x - p.x) * s + (m.y - p.y) * c) }))
    .filter(q => q.t > 0 && q.t <= range + q.m.radius && q.perp <= q.m.radius + hz.width).sort((a, b) => a.t - b.t);
  const first = route[0], end = hz.pierce || !first ? range : Math.max(0, first.t - first.m.radius);
  const tx = p.x + c * end, ty = p.y + s * end;
  let cibles = hz.pierce ? route.map(q => q.m.id) : first ? [first.m.id] : [];
  if (explode && (first || !hz.pierce)) cibles = [...new Set([...cibles, ...dans(m => Math.hypot(m.x - tx, m.y - ty) <= explode + m.radius)])];
  return { portee: range, zone: { kind: 'shot', x: p.x, y: p.y, tx, ty, width: hz.width, r: explode }, cibles };
}

/** Distance à laquelle le sort atteint une cible (pour s'approcher d'un monstre hors de portée, choix 5B). */
export function porteeSort(world: World, id: SkillId): number {
  const a = apercuSort(world, id, { x: world.player.x + 1, y: world.player.y });
  return a?.portee ?? 0;
}
