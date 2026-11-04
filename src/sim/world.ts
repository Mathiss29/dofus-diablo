import { angleDiff, Rng } from './math';
import type { GameData, ZoneDef } from './defs';
import type { SimEvent, Telegraph } from './events';
import { GridMap } from './gridmap';
import type { PlayerInput } from './input';
import { Monster } from './monster';
import { Player } from './player';
import { planWave } from './waves';

interface HitDef { dmg: number; knock: number }

export interface WorldOptions {
  data: GameData;
  zone: string;
  map: GridMap;
  seed?: number;
  classId?: string;
}

/** La simulation d'une zone : joueur, monstres, vagues, collisions.
 *  Aucune dépendance à Phaser ni au navigateur : elle tourne telle quelle dans les tests
 *  (et plus tard sur un serveur pour la coop). L'affichage lit l'état et vide `events`. */
export class World {
  readonly rng: Rng;
  readonly zone: ZoneDef;
  readonly map: GridMap;
  readonly player: Player;
  monsters: Monster[] = [];
  /** Événements produits depuis le dernier drainEvents(). */
  private events: SimEvent[] = [];
  /** Télégraphes du dernier pas (recalculés à chaque pas). */
  telegraphs: Telegraph[] = [];
  wave = 0;
  kills = 0;
  waveDelay = 1.2;
  over = false;
  time = 0;
  private nextId = 1;

  constructor(readonly opts: WorldOptions) {
    this.rng = new Rng(opts.seed ?? 1);
    this.zone = opts.data.zones[opts.zone];
    if (!this.zone) throw new Error(`Zone inconnue : ${opts.zone}`);
    this.map = opts.map;
    const start = this.map.nearestFree(GridMap.OFFSET_Y, GridMap.OFFSET_Y);
    this.player = new Player(this.nextId++, start.x, start.y, opts.data.classes[opts.classId ?? 'iop']);
  }

  emit(e: SimEvent) { this.events.push(e); }
  drainEvents(): SimEvent[] { const e = this.events; this.events = []; return e; }
  walkable(x: number, y: number) { return this.map.walkable(x, y); }

  /** Avance la simulation de dt secondes. */
  step(dt: number, input: PlayerInput) {
    this.time += dt;
    this.telegraphs.length = 0;
    const p = this.player;
    const ents = [p, ...this.monsters], prev = ents.map(e => [e.x, e.y] as const);
    p.update(dt, input, this);
    for (const m of this.monsters) m.update(dt, p, this);
    this.separate();
    // Cases bloquantes : on glisse le long des obstacles (axe par axe), sauf en plein Bond
    ents.forEach((e, i) => {
      if (e === p && p.airborne) return;
      if (this.walkable(e.x, e.y)) return;
      const [ox, oy] = prev[i];
      if (this.walkable(e.x, oy)) e.y = oy;
      else if (this.walkable(ox, e.y)) e.x = ox;
      else { e.x = ox; e.y = oy; }
      // L'ancienne position peut être bloquée aussi (fin de Bond au-dessus d'un obstacle) : case libre la plus proche
      if (!this.walkable(e.x, e.y)) { const f = this.map.nearestFree(e.x, e.y); e.x = f.x; e.y = f.y; }
      e.kx = 0; e.ky = 0;
    });
    this.monsters = this.monsters.filter(m => !(m.dead && m.t <= 0));
    if (!this.over && this.monsters.length === 0) {
      this.waveDelay -= dt;
      if (this.waveDelay <= 0) { this.spawnWave(); this.waveDelay = 2; }
    }
  }

  spawnWave() {
    this.wave++;
    const plan = planWave(this.wave, this.zone.waves, this.rng);
    this.emit({ k: 'wave', n: this.wave, boss: plan.boss, archi: plan.archi });
    for (const type of plan.monsters) {
      let pos = this.map.randomFree(this.rng), tries = 0;
      while (Math.hypot(pos.x - this.player.x, pos.y - this.player.y) < 300 && ++tries < 50) pos = this.map.randomFree(this.rng);
      this.spawnMonster(type, pos.x, pos.y);
    }
  }

  spawnMonster(type: string, x: number, y: number): Monster {
    const def = this.opts.data.monsters[type];
    if (!def) throw new Error(`Monstre inconnu : ${type}`);
    const m = new Monster(this.nextId++, type, def, x, y, this);
    this.monsters.push(m);
    return m;
  }

  // --- Zones de frappe (coordonnées monde) --------------------------------
  hitCone(x: number, y: number, facing: number, range: number, arc: number, def: HitDef) {
    return this.applyHits(m => {
      const dx = m.x - x, dy = m.y - y, d = Math.hypot(dx, dy);
      return d <= range + m.radius && (d < m.radius + 8 || Math.abs(angleDiff(Math.atan2(dy, dx), facing)) <= arc / 2);
    }, def, x, y, 0);
  }
  hitLine(x: number, y: number, facing: number, length: number, width: number, def: HitDef) {
    const c = Math.cos(facing), s = Math.sin(facing);
    return this.applyHits(m => {
      const dx = m.x - x, dy = m.y - y, t = dx * c + dy * s, perp = Math.abs(-dx * s + dy * c);
      return t >= -m.radius && t <= length + m.radius && perp <= width + m.radius;
    }, def, x, y, 0, facing);
  }
  hitCircle(x: number, y: number, r: number, def: HitDef, stun = 0) {
    return this.applyHits(m => Math.hypot(m.x - x, m.y - y) <= r + m.radius, def, x, y, stun);
  }
  private applyHits(test: (m: Monster) => boolean, def: HitDef, ox: number, oy: number, stun: number, pushDir?: number): number {
    const cls = this.player.cls;
    let n = 0;
    for (const m of this.monsters) {
      if (m.dead || m.state === 'spawn' || !test(m)) continue;
      n++;
      const crit = this.rng.next() < cls.critChance;
      const dmg = Math.round(def.dmg * this.rng.range(0.9, 1.1) * (crit ? cls.critMult : 1));
      m.hp -= dmg; m.flash = 0.09;
      const a = pushDir ?? Math.atan2(m.y - oy, m.x - ox);
      const kb = def.knock / m.def.mass;
      m.kx += Math.cos(a) * kb; m.ky += Math.sin(a) * kb;
      if (!m.def.boss) m.stun = Math.max(m.stun, stun || 0.12);   // petit vacillement : interrompt les télégraphes
      else if (stun) m.stun = Math.max(m.stun, stun * 0.3);
      this.emit({ k: 'hit', target: 'monster', x: m.x, y: m.y, z: m.radius * 2 + 10, amount: dmg, crit });
      if (m.hp <= 0) this.killMonster(m);
    }
    return n;
  }
  private killMonster(m: Monster) {
    m.dead = true; m.t = 0.6; this.kills++;
    this.emit({ k: 'kill', x: m.x, y: m.y, radius: m.radius, monster: m.type });
    const p = this.player;
    p.hp = Math.min(p.maxHp, p.hp + p.cls.healOnKill);
    if (m.def.boss) { this.emit({ k: 'impact', hitstop: 0.15, shake: 0.02, big: true }); this.emit({ k: 'bossDown', monster: m.type }); }
  }
  onPlayerDeath() { this.over = true; this.emit({ k: 'playerDeath', wave: this.wave }); }

  /** Évite que les monstres se superposent (O(n²), suffisant sous 100 monstres). */
  private separate() {
    const all = this.monsters.filter(m => !m.dead);
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01, min = a.radius + b.radius;
      if (d < min) {
        const push = (min - d) / 2, nx = dx / d, ny = dy / d, wa = b.def.mass / (a.def.mass + b.def.mass), wb = 1 - wa;
        a.x -= nx * push * 2 * wa; a.y -= ny * push * 2 * wa; b.x += nx * push * 2 * wb; b.y += ny * push * 2 * wb;
      }
    }
    const p = this.player;
    if (p.z > 5) return;
    for (const m of all) {
      const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy) || 0.01, min = p.radius + m.radius;
      if (d < min) {
        const push = min - d;
        p.x += (dx / d) * push * 0.5; p.y += (dy / d) * push * 0.5;
        m.x -= (dx / d) * push * 0.5; m.y -= (dy / d) * push * 0.5;
      }
    }
  }
}
