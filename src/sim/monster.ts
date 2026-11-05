import { Entity } from './entity';
import type { MonsterDef } from './defs';
import type { Player } from './player';
import type { World } from './world';

/** Monstre à états : spawn -> chase -> windup (télégraphe) -> lunge | slam -> recover.
 *  En monde ouvert, il attend d'abord près de son point de départ (idle, petite errance), poursuit le joueur
 *  qui s'approche, et rentre chez lui en reprenant ses PV s'il s'en éloigne trop (return). */
export class Monster extends Entity {
  readonly faction = 'monster' as const;
  state: 'spawn' | 'idle' | 'return' | 'chase' | 'windup' | 'lunge' | 'recover' = 'spawn';
  /** Point de départ (monde ouvert) et groupe auquel il appartient. */
  homeX: number; homeY: number;
  group = -1;
  private wanderT = 0;
  private wanderX: number; private wanderY: number;
  /** Minuteur de l'état courant (et de l'animation de mort). */
  t = 0.6;
  atkCd: number;
  stun = 0;
  dirX = 1; dirY = 0;
  hitDone = false;
  mode: 'lunge' | 'slam' = 'lunge';

  constructor(id: number, readonly type: string, readonly def: MonsterDef, x: number, y: number, world: World) {
    super(id, x, y, def.radius, def.hp);
    this.homeX = this.wanderX = x; this.homeY = this.wanderY = y;
    this.wanderT = world.rng.range(1, 4);
    this.atkCd = world.rng.range(0.3, 1.2);
    this.age = world.rng.next() * 10;
    this.setAnim('spawn');
  }

  update(dt: number, player: Player, world: World) {
    this.age += dt; this.flash = Math.max(0, this.flash - dt);
    const D = this.def;
    if (this.dead) { this.t -= dt; this.setAnim('die', 1 - this.t / 0.6); this.applyKnock(dt); return; }
    const open = world.zone.open;
    if (this.state === 'spawn') { this.t -= dt; this.setAnim('spawn', 1 - this.t / 0.6); if (this.t <= 0) this.state = open ? 'idle' : 'chase'; return; }
    if (this.stun > 0) { this.stun -= dt; this.setAnim('stun'); this.applyKnock(dt); if (this.state === 'windup') this.state = 'chase'; if (this.state === 'idle') this.state = 'chase'; return; }
    const dx = player.x - this.x, dy = player.y - this.y, dist = Math.hypot(dx, dy) || 1;
    this.atkCd -= dt;
    if (open && this.state !== 'idle' && this.state !== 'return'
      && (player.dead || Math.hypot(this.x - this.homeX, this.y - this.homeY) > open.leash)) { this.state = 'return'; this.wanderT = 0; }
    switch (this.state) {
      case 'idle': {
        if (!player.dead && dist < (D.aggro ?? open?.aggro ?? 250)) { world.aggroGroup(this); break; }
        // Petite errance autour du point de départ
        this.wanderT -= dt;
        if (this.wanderT <= 0) {
          this.wanderT = world.rng.range(2, 5);
          const a = world.rng.range(0, Math.PI * 2), r = world.rng.range(0, 70);
          this.wanderX = this.homeX + Math.cos(a) * r; this.wanderY = this.homeY + Math.sin(a) * r;
        }
        if (this.moveTo(this.wanderX, this.wanderY, D.speed * 0.35, dt)) this.setAnim('run'); else this.setAnim('idle');
        break;
      }
      case 'return': {
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * dt * 0.5);
        this.wanderT -= dt;
        if (this.wanderT < -6) { this.x = this.homeX; this.y = this.homeY; }   // coincé derrière un obstacle
        if (!this.moveTo(this.homeX, this.homeY, D.speed * 1.4, dt)) { this.state = 'idle'; this.hp = this.maxHp; this.setAnim('idle'); }
        else this.setAnim('run');
        break;
      }
      case 'chase': {
        this.facing = Math.atan2(dy, dx);
        if (player.dead) { this.setAnim('idle'); break; }
        // Les monstres à piétinement choisissent : piétinement (près) ou charge (loin)
        if (D.slamRange && dist < D.slamRange && this.atkCd <= 0) { this.state = 'windup'; this.mode = 'slam'; this.t = D.slamWindup!; break; }
        const range = D.attackRange + player.radius;
        if (dist < range && this.atkCd <= 0 && (!D.slamRange || dist > D.slamRange)) {
          this.state = 'windup'; this.mode = 'lunge'; this.t = D.windup; this.dirX = dx / dist; this.dirY = dy / dist; break;
        }
        if (dist > this.radius + player.radius + 4) { this.x += (dx / dist) * D.speed * dt; this.y += (dy / dist) * D.speed * dt; this.setAnim('run'); }
        else this.setAnim('idle');
        break;
      }
      case 'windup': {
        this.t -= dt;
        if (this.mode === 'slam') {
          const k = 1 - this.t / D.slamWindup!;
          this.setAnim('slam_charge', k);
          world.telegraphs.push({ kind: 'circle', x: this.x, y: this.y, r: D.slamRadius!, progress: k, danger: true });
          if (this.t <= 0) {
            if (Math.hypot(player.x - this.x, player.y - this.y) < D.slamRadius! + player.radius) player.hurt(Math.round(D.dmg * 1.3), this.x, this.y, world);
            world.emit({ k: 'slam', x: this.x, y: this.y, radius: D.slamRadius! });
            world.emit({ k: 'impact', hitstop: 0, shake: 0.012, big: false });
            this.state = 'recover'; this.t = D.recover; this.atkCd = world.rng.range(1.2, 2);
          }
        } else {
          const k = 1 - this.t / D.windup;
          this.setAnim('windup', k);
          this.facing = Math.atan2(this.dirY, this.dirX);
          world.telegraphs.push({ kind: 'rect', x: this.x, y: this.y, facing: this.facing, len: D.lungeSpeed * D.lungeTime + this.radius, w: this.radius * 0.9, progress: k, danger: true });
          if (this.t <= 0) { this.state = 'lunge'; this.t = D.lungeTime; this.hitDone = false; }
        }
        break;
      }
      case 'lunge': {
        this.t -= dt; this.setAnim('lunge', 1 - this.t / D.lungeTime);
        this.x += this.dirX * D.lungeSpeed * dt; this.y += this.dirY * D.lungeSpeed * dt;
        if (!this.hitDone && Math.hypot(player.x - this.x, player.y - this.y) < this.radius + player.radius + 6) {
          this.hitDone = true; player.hurt(D.dmg, this.x, this.y, world);
        }
        if (this.t <= 0) { this.state = 'recover'; this.t = D.recover; this.atkCd = world.rng.range(0.8, 1.8); }
        break;
      }
      case 'recover': this.t -= dt; this.setAnim('idle'); if (this.t <= 0) this.state = 'chase'; break;
    }
    this.applyKnock(dt);
  }

  /** Avance vers (x, y) ; false si déjà arrivé. */
  private moveTo(x: number, y: number, speed: number, dt: number): boolean {
    const dx = x - this.x, dy = y - this.y, d = Math.hypot(dx, dy);
    if (d < 6) return false;
    const st = Math.min(d, speed * dt);
    this.x += (dx / d) * st; this.y += (dy / d) * st; this.facing = Math.atan2(dy, dx);
    return true;
  }
}
