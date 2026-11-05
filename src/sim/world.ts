import { angleDiff, Rng } from './math';
import type { Element, GameData, HitZone, SubAreaDef, ZoneDef } from './defs';
import type { SimEvent, Telegraph } from './events';
import { GridMap, WorldGrid } from './gridmap';
import type { PlayerInput } from './input';
import { Monster } from './monster';
import { Player } from './player';
import { planWave } from './waves';

interface HitDef { dmg: number; knock: number; element?: Element; lifesteal?: number }
/** Flèche en vol (Crâ). */
export interface Projectile { id: number; spell: string; x: number; y: number; dx: number; dy: number; left: number; speed: number; width: number;
  explode: number; pierce: boolean; hit: HitDef; stun: number; touched: Set<number> }

/** Monde ouvert : un groupe de monstres posé sur une carte Dofus, qui réapparaît quand il a été vaincu. */
interface MonsterGroup { id: number; map: string; sub: SubAreaDef; members: Monster[]; timer: number; cleared: boolean; x: number; y: number }

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
  projectiles: Projectile[] = [];
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
  private groups: MonsterGroup[] = [];
  /** Point de retour après une mort (le dernier Zaap atteint). */
  private checkpoint = { x: 0, y: 0 };
  checkpointName = '';
  /** Sous-zone où se trouve le joueur (monde ouvert). */
  area: SubAreaDef | null = null;

  constructor(readonly opts: WorldOptions) {
    this.rng = new Rng(opts.seed ?? 1);
    this.zone = opts.data.zones[opts.zone];
    if (!this.zone) throw new Error(`Zone inconnue : ${opts.zone}`);
    this.map = opts.map;
    let start = this.map.nearestFree(GridMap.OFFSET_Y, GridMap.OFFSET_Y);
    const open = this.zone.open;
    if (open) {
      if (!(this.map instanceof WorldGrid)) throw new Error('Une zone en monde ouvert demande un WorldGrid');
      const m = this.map.mapByCoords(...open.start);
      if (!m) throw new Error(`Carte de départ absente du monde : ${open.start}`);
      // départ : la case la plus dégagée de la carte (le plus de cases marchables autour)
      start = this.openestCell(m.tag);
      this.checkpointName = open.checkpoints[0]?.name ?? '';
    }
    this.checkpoint = start;
    this.player = new Player(this.nextId++, start.x, start.y, opts.data.classes[opts.classId ?? 'iop']);
    if (open) this.spawnGroups();
  }

  /** Case la plus dégagée d'une carte (le plus de cases marchables autour). */
  private openestCell(tag: string) {
    const wg = this.worldGrid!, free = wg.freeByMap.get(tag)!, ok = new Set(free), C = wg.cols;
    let best = free[0], bestN = -1;
    for (const c of free) {
      let n = 0;
      for (let dr = -6; dr <= 6; dr++) for (let dk = -3; dk <= 3; dk++) if (ok.has(c + dr * C + dk)) n++;
      if (n > bestN) { bestN = n; best = c; }
    }
    return wg.cellToWorld(best);
  }

  get worldGrid(): WorldGrid | null { return this.map instanceof WorldGrid ? this.map : null; }

  // --- Monde ouvert ---------------------------------------------------------
  private spawnGroups() {
    const wg = this.worldGrid!, open = this.zone.open!;
    for (const m of wg.world.maps) {
      const sub = open.subareas[String(m.sub)];
      if (!sub || !wg.freeByMap.get(m.tag)!.length) continue;
      for (let i = 0; i < sub.groupsPerMap; i++) {
        const g: MonsterGroup = { id: this.groups.length, map: m.tag, sub, members: [], timer: 0, cleared: false, x: 0, y: 0 };
        this.groups.push(g);
        this.spawnGroup(g);
      }
    }
  }
  private spawnGroup(g: MonsterGroup) {
    const wg = this.worldGrid!, free = wg.freeByMap.get(g.map)!, p = this.player;
    let pos = wg.randomFree(this.rng, free), tries = 0;
    while (Math.hypot(pos.x - p.x, pos.y - p.y) < 450 && ++tries < 30) pos = wg.randomFree(this.rng, free);
    g.x = pos.x; g.y = pos.y; g.members = []; g.cleared = false;
    const [a, b] = g.sub.groupSize, n = a + this.rng.int(b - a + 1);
    for (let i = 0; i < n; i++) {
      const ang = this.rng.range(0, Math.PI * 2), r = i === 0 ? 0 : this.rng.range(30, 80);
      const q = wg.nearestFree(pos.x + Math.cos(ang) * r, pos.y + Math.sin(ang) * r, free);
      const mo = this.spawnMonster(this.rng.pick(g.sub.monsters), q.x, q.y);
      mo.group = g.id; g.members.push(mo);
    }
  }
  /** Un monstre repère le joueur : tout son groupe passe à l'attaque. */
  aggroGroup(m: Monster) {
    const g = this.groups[m.group];
    for (const o of g ? g.members : [m]) if (!o.dead && (o.state === 'idle' || o === m)) o.state = 'chase';
  }
  private updateOpen(dt: number) {
    const p = this.player, open = this.zone.open!;
    for (const g of this.groups) {
      if (g.members.some(m => !m.dead)) continue;
      if (!g.cleared) {
        g.cleared = true; g.timer = open.respawn;
        p.potions = Math.min(p.cls.potion.charges, p.potions + 1);   // un groupe vaincu rend une potion
        this.emit({ k: 'groupCleared' });
      }
      g.timer -= dt;
      // Réapparition hors de la vue du joueur
      if (g.timer <= 0 && Math.hypot(g.x - p.x, g.y - p.y) > 900) this.spawnGroup(g);
    }
    const m = this.worldGrid!.mapAt(p.x, p.y), sub = m ? open.subareas[String(m.sub)] ?? null : null;
    if (sub && sub !== this.area) { this.area = sub; this.emit({ k: 'enterArea', name: sub.name, level: sub.level }); }
    // Zaap atteint : il devient le point de retour
    const cp = m && open.checkpoints.find(c => c.map[0] === m.x && c.map[1] === m.y);
    if (cp && cp.name !== this.checkpointName) {
      this.checkpointName = cp.name; this.checkpoint = this.openestCell(m.tag);
      this.emit({ k: 'checkpoint', name: cp.name });
    }
  }
  /** Monde ouvert, après une mort : retour au dernier Zaap atteint, sans pénalité (choix 10D). */
  respawnPlayer() {
    const p = this.player;
    if (!this.zone.open || !p.dead) return;
    p.dead = false; p.hp = p.maxHp; p.x = this.checkpoint.x; p.y = this.checkpoint.y; p.kx = p.ky = 0; p.z = 0;
    p.state = 'free'; p.skill = null; p.invuln = 2; p.rage = 0; p.setAnim('idle');
    this.over = false;
    this.emit({ k: 'respawn' });
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
    this.updateProjectiles(dt);
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
    if (this.zone.open) { this.updateOpen(dt); return; }
    if (!this.over && this.monsters.length === 0) {
      this.waveDelay -= dt;
      if (this.waveDelay <= 0) { this.spawnWave(); this.waveDelay = 2; }
    }
  }

  spawnWave() {
    this.wave++;
    const plan = planWave(this.wave, this.zone.waves!, this.rng);
    this.emit({ k: 'wave', n: this.wave, boss: plan.boss, archi: plan.archi });
    // chaque nouvelle vague rend une potion
    const p = this.player;
    if (this.wave > 1) p.potions = Math.min(p.cls.potion.charges, p.potions + 1);
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

  // --- Flèches ---------------------------------------------------------------
  shoot(x: number, y: number, facing: number, hz: Extract<HitZone, { shape: 'projectile' }>, hit: HitDef, stun: number, area: number, spell: string) {
    this.projectiles.push({ id: this.nextId++, spell, x, y, dx: Math.cos(facing), dy: Math.sin(facing), left: hz.range, speed: hz.speed,
      width: hz.width * area, explode: (hz.explode ?? 0) * area, pierce: !!hz.pierce, hit, stun, touched: new Set() });
  }
  private updateProjectiles(dt: number) {
    for (const pr of this.projectiles) {
      const st = Math.min(pr.left, pr.speed * dt);
      pr.x += pr.dx * st; pr.y += pr.dy * st; pr.left -= st;
      const target = this.monsters.find(m => !m.dead && m.state !== 'spawn' && !pr.touched.has(m.id) && Math.hypot(m.x - pr.x, m.y - pr.y) <= m.radius + pr.width);
      let end = pr.left <= 0;
      if (target) {
        if (pr.explode) { this.hitCircle(pr.x, pr.y, pr.explode, pr.hit, pr.stun); end = true; }
        else {
          pr.touched.add(target.id);
          this.applyHits(m => m === target, pr.hit, pr.x - pr.dx * 10, pr.y - pr.dy * 10, pr.stun, Math.atan2(pr.dy, pr.dx));
          if (!pr.pierce) end = true;
        }
        this.emit({ k: 'impact', hitstop: 0.03, shake: pr.explode ? 0.008 : 0.003, big: false });
      } else if (end && pr.explode) this.hitCircle(pr.x, pr.y, pr.explode, pr.hit, pr.stun);
      if (end) {
        pr.left = 0;
        this.emit({ k: 'spell', fx: 'burst', id: pr.spell, x: pr.x, y: pr.y, facing: Math.atan2(pr.dy, pr.dx), size: pr.explode || 26, arc: 0,
          element: pr.hit.element ?? 'neutre', big: pr.explode > 0, boosted: false });
      }
    }
    this.projectiles = this.projectiles.filter(p => p.left > 0);
  }

  // --- Zones de frappe (coordonnées monde) --------------------------------
  hitCone(x: number, y: number, facing: number, range: number, arc: number, def: HitDef, stun = 0) {
    return this.applyHits(m => {
      const dx = m.x - x, dy = m.y - y, d = Math.hypot(dx, dy);
      return d <= range + m.radius && (d < m.radius + 8 || Math.abs(angleDiff(Math.atan2(dy, dx), facing)) <= arc / 2);
    }, def, x, y, stun);
  }
  hitLine(x: number, y: number, facing: number, length: number, width: number, def: HitDef, stun = 0) {
    const c = Math.cos(facing), s = Math.sin(facing);
    return this.applyHits(m => {
      const dx = m.x - x, dy = m.y - y, t = dx * c + dy * s, perp = Math.abs(-dx * s + dy * c);
      return t >= -m.radius && t <= length + m.radius && perp <= width + m.radius;
    }, def, x, y, stun, facing);
  }
  hitCircle(x: number, y: number, r: number, def: HitDef, stun = 0) {
    return this.applyHits(m => Math.hypot(m.x - x, m.y - y) <= r + m.radius, def, x, y, stun);
  }
  private applyHits(test: (m: Monster) => boolean, def: HitDef, ox: number, oy: number, stun: number, pushDir?: number): number {
    const p = this.player, cls = p.cls;
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
      this.emit({ k: 'hit', target: 'monster', id: m.id, x: m.x, y: m.y, z: m.radius * 2 + 10, amount: dmg, crit, element: def.element ?? 'neutre' });
      if (n <= 3) p.addRage(cls.rage.perHit, this);
      if (def.lifesteal) p.hp = Math.min(p.maxHp, p.hp + Math.round(dmg * def.lifesteal));   // la Rage monte avec les coups portés (3 cibles max par coup)
      if (m.hp <= 0) this.killMonster(m);
    }
    return n;
  }
  private killMonster(m: Monster) {
    m.dead = true; m.t = 0.6; this.kills++;
    this.emit({ k: 'kill', x: m.x, y: m.y, radius: m.radius, monster: m.type });
    const p = this.player;
    p.hp = Math.min(p.maxHp, p.hp + p.cls.healOnKill);
    p.gainXp(m.def.xp ?? Math.round(m.def.hp / 5), this);
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
