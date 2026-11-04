import { Entity } from './entity';
import type { MonsterDef } from './defs';
import type { Player } from './player';
import type { World } from './world';

/** Monstre à états : spawn -> chase -> windup (télégraphe) -> lunge | slam -> recover. */
export class Monster extends Entity {
  readonly faction = 'monster' as const;
  state: 'spawn' | 'chase' | 'windup' | 'lunge' | 'recover' = 'spawn';
  /** Minuteur de l'état courant (et de l'animation de mort). */
  t = 0.6;
  atkCd: number;
  stun = 0;
  dirX = 1; dirY = 0;
  hitDone = false;
  mode: 'lunge' | 'slam' = 'lunge';

  constructor(id: number, readonly type: string, readonly def: MonsterDef, x: number, y: number, world: World) {
    super(id, x, y, def.radius, def.hp);
    this.atkCd = world.rng.range(0.3, 1.2);
    this.age = world.rng.next() * 10;
    this.setAnim('spawn');
  }

  update(dt: number, player: Player, world: World) {
    this.age += dt; this.flash = Math.max(0, this.flash - dt);
    const D = this.def;
    if (this.dead) { this.t -= dt; this.setAnim('die', 1 - this.t / 0.6); this.applyKnock(dt); return; }
    if (this.state === 'spawn') { this.t -= dt; this.setAnim('spawn', 1 - this.t / 0.6); if (this.t <= 0) this.state = 'chase'; return; }
    if (this.stun > 0) { this.stun -= dt; this.setAnim('stun'); this.applyKnock(dt); if (this.state === 'windup') this.state = 'chase'; return; }
    const dx = player.x - this.x, dy = player.y - this.y, dist = Math.hypot(dx, dy) || 1;
    this.atkCd -= dt;
    switch (this.state) {
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
}
