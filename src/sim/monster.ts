import { Entity } from './entity';
import type { MonsterDef, MonsterSpell } from './defs';
import type { Player } from './player';
import type { World } from './world';
import { tackleSlow, tacleOf } from './caracs';

/** Dofus -> temps réel : 1 case = CASE px (pas d'une case à sa voisine en diagonale), 1 tour = TOUR s. */
export const CASE = 48, TOUR = 3;
/** Façon de lancer un sort de monstre, déduite de ses données officielles. */
export type CastKind = 'melee' | 'charge' | 'missile' | 'target' | 'self' | 'invoque';
export function castKind(s: MonsterSpell): CastKind {
  if (s.effects.some(e => e.k === 'invoque')) return 'invoque';
  if (s.po[1] === 0) return 'self';
  if (s.effects.some(e => e.k === 'avance')) return 'charge';
  if (s.missile) return 'missile';
  return s.po[1] <= 1 ? 'melee' : 'target';
}
/** Rayon touché par la zone du sort : P = la case visée, X / C n = n cases autour. */
export function zoneRadius(s: MonsterSpell): number {
  const n = Number(s.zone.slice(1)) || 0;
  return s.zone[0] === 'P' ? CASE * 0.6 : (n + 0.5) * CASE;
}

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
  mode: 'lunge' | 'slam' | 'spell' = 'lunge';
  /** Sort officiel en cours (null : charge simple), son type, le point visé et la relance de chaque sort (s). */
  spell: MonsterSpell | null = null;
  kind: CastKind = 'melee';
  tx = 0; ty = 0;
  spellCd: number[];
  /** Bonus de vitesse (sort qui donne des PM, ex. Bêlement) : multiplicateur et durée restante. */
  haste = 1; hasteT = 0;
  /** Bonus de Dommages (Frénésie : %, Euphorie malsaine : fixes) et durée restante. */
  furyPct = 0; furyFlat = 0; furyT = 0;
  /** Invocateur (Kardorib invoqué par Kardorim). */
  summoner: Monster | null = null;
  /** Déjà touché par le joueur (l'Initiative ne renforce que le premier coup). */
  struck = false;

  constructor(id: number, readonly type: string, readonly def: MonsterDef, x: number, y: number, world: World) {
    super(id, x, y, def.radius, def.hp);
    this.homeX = this.wanderX = x; this.homeY = this.wanderY = y;
    this.wanderT = world.rng.range(1, 4);
    this.atkCd = world.rng.range(0.3, 1.2);
    this.age = world.rng.next() * 10;
    this.spellCd = (def.spells ?? []).map(() => 0);
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
    for (let i = 0; i < this.spellCd.length; i++) this.spellCd[i] -= dt;
    if (this.hasteT > 0 && (this.hasteT -= dt) <= 0) this.haste = 1;
    if (this.furyT > 0 && (this.furyT -= dt) <= 0) this.furyPct = this.furyFlat = 0;
    // Tacle du joueur : un monstre à son contact avance moins vite (sa Fuite officielle y résiste)
    const near = Math.hypot(player.x - this.x, player.y - this.y) <= this.radius + player.radius + 12;
    const speed = D.speed * this.haste * (near ? 1 - tackleSlow(player.tacle, tacleOf(D.caracs?.fuite ?? 0, D.caracs?.agilite ?? 0)) : 1);
    if (open && this.state !== 'idle' && this.state !== 'return'
      && (player.dead || Math.hypot(this.x - this.homeX, this.y - this.homeY) > open.leash)) { this.state = 'return'; this.wanderT = 0; }
    switch (this.state) {
      case 'idle': {
        if (!player.dead && dist < (D.aggro ?? open?.aggro ?? 250)) { world.aggroGroup(this); break; }
        // Petite errance autour du point de départ
        this.wanderT -= dt;
        if (this.wanderT <= 0) {
          this.wanderT = world.rng.range(4, 9);   // plus calme : de petits pas, de temps en temps
          const a = world.rng.range(0, Math.PI * 2), r = world.rng.range(0, 45);
          this.wanderX = this.homeX + Math.cos(a) * r; this.wanderY = this.homeY + Math.sin(a) * r;
        }
        if (this.moveTo(this.wanderX, this.wanderY, D.speed * 0.35, dt)) this.setAnim('run'); else this.setAnim('idle');
        break;
      }
      case 'return': {
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * dt * 0.5);
        this.wanderT -= dt;
        if (this.wanderT < -6) { this.x = this.homeX; this.y = this.homeY; }   // coincé derrière un obstacle
        if (!this.moveTo(this.homeX, this.homeY, D.speed * 1.4, dt)) { this.state = 'idle'; this.maxHp = this.def.hp; this.struck = false; this.hp = this.maxHp; this.setAnim('idle'); }
        else this.setAnim('run');
        break;
      }
      case 'chase': {
        this.facing = Math.atan2(dy, dx);
        if (player.dead) { this.setAnim('idle'); break; }
        if (D.spells?.length) {
          if (this.atkCd <= 0 && this.castSpell(dist, player, world)) break;
          // Sans sort au corps à corps, il garde ses distances (à 80 % de sa plus grande portée)
          const far = this.spellReach(player);
          if (far && dist < far * 0.8 && world.clearShot(this, player)) { this.setAnim('idle'); break; }
        } else {
          // Les monstres à piétinement choisissent : piétinement (près) ou charge (loin)
          if (D.slamRange && dist < D.slamRange && this.atkCd <= 0) { this.state = 'windup'; this.mode = 'slam'; this.t = D.slamWindup!; break; }
          const range = D.attackRange + player.radius;
          if (dist < range && this.atkCd <= 0 && (!D.slamRange || dist > D.slamRange)) {
            this.state = 'windup'; this.mode = 'lunge'; this.spell = null; this.t = D.windup; this.dirX = dx / dist; this.dirY = dy / dist; break;
          }
        }
        if (dist > this.radius + player.radius + 4) { this.x += (dx / dist) * speed * dt; this.y += (dy / dist) * speed * dt; this.setAnim('run'); }
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
        } else if (this.mode === 'spell') {
          const S = this.spell!, w = this.windupOf(S), k = 1 - this.t / w;
          this.setAnim(`windup${S.anim}`, k);
          if (this.kind === 'invoque') { /* pas de zone : l'invocation apparaît à son contact */ }
          else if (this.kind === 'target' || this.kind === 'self') {
            if (this.kind === 'self') { this.tx = this.x; this.ty = this.y; }
            world.telegraphs.push({ kind: 'circle', x: this.tx, y: this.ty, r: zoneRadius(S), progress: k, danger: !S.allies });
          } else {
            this.facing = Math.atan2(this.dirY, this.dirX);
            const len = this.kind === 'charge' ? this.chargeLen(S) + this.radius : this.kind === 'missile' ? this.missileRange(S) : D.lungeSpeed * D.lungeTime + this.radius;
            world.telegraphs.push({ kind: 'rect', x: this.x, y: this.y, facing: this.facing, len, w: this.kind === 'missile' ? 12 : this.radius * 0.9, progress: k, danger: true });
          }
          if (this.t <= 0) this.release(player, world);
        } else {
          const k = 1 - this.t / D.windup;
          this.setAnim('windup', k);
          this.spell = null;
          this.facing = Math.atan2(this.dirY, this.dirX);
          world.telegraphs.push({ kind: 'rect', x: this.x, y: this.y, facing: this.facing, len: D.lungeSpeed * D.lungeTime + this.radius, w: this.radius * 0.9, progress: k, danger: true });
          if (this.t <= 0) { this.state = 'lunge'; this.t = D.lungeTime; this.hitDone = false; }
        }
        break;
      }
      case 'lunge': {
        const S = this.spell, dur = D.lungeTime, sp = S && this.kind === 'charge' ? this.chargeLen(S) / dur : D.lungeSpeed;
        this.t -= dt; this.setAnim(S ? `lunge${S.anim}` : 'lunge', 1 - this.t / dur);
        this.x += this.dirX * sp * dt; this.y += this.dirY * sp * dt;
        if (!this.hitDone && Math.hypot(player.x - this.x, player.y - this.y) < this.radius + player.radius + 6) {
          this.hitDone = true;
          if (S) {
            world.monsterSpellHits(this, S, player); if (this.kind === 'charge') this.t = 0;
            world.emit({ k: 'spellFx', id: `m${S.id}`, x: player.x, y: player.y, facing: this.facing });
          }
          else player.hurt(D.dmg, this.x, this.y, world);
        }
        if (this.t <= 0) this.endCast(world);
        break;
      }
      case 'recover': {
        this.t -= dt;
        // fin de l'animation du sort à distance après son lancer
        const S = this.spell, after = D.recover - this.t;
        if (S && this.kind !== 'melee' && this.kind !== 'charge' && after < 0.35) this.setAnim(`lunge${S.anim}`, after / 0.35);
        else this.setAnim('idle');
        if (this.t <= 0) this.state = 'chase';
        break;
      }
    }
    this.applyKnock(dt);
  }

  /** Portée d'un sort en pixels (bord à bord). Les sorts au contact gardent la portée de charge du monstre. */
  private reach(S: MonsterSpell, player: Player): [number, number] {
    const k = castKind(S), pad = this.radius + player.radius;
    if (k === 'invoque') return [0, CASE * 6];
    if (k === 'self') return [0, S.allies ? Infinity : zoneRadius(S) + player.radius];
    if (k === 'melee') return [0, this.def.attackRange + player.radius];
    return [S.po[0] >= 2 ? S.po[0] * CASE : 0, S.po[1] * CASE + pad];
  }
  /** Plus grande portée d'un sort offensif à distance, si le monstre n'a aucun sort au contact (sinon 0 : il vient au contact). */
  private spellReach(player: Player): number {
    const S = (this.def.spells ?? []).filter(s => !s.allies && castKind(s) !== 'self');
    if (!S.length || S.some(s => s.po[1] <= 1)) return 0;
    return Math.max(...S.map(s => this.reach(s, player)[1]));
  }
  private windupOf(S: MonsterSpell): number {
    const k = castKind(S);
    return k === 'melee' ? this.def.windup : k === 'target' || k === 'self' ? Math.max(0.7, this.def.windup + 0.2) : Math.max(0.55, this.def.windup);
  }
  private chargeLen(S: MonsterSpell): number { return (S.effects.find(e => e.k === 'avance') as { n: number } | undefined ?? { n: 1 }).n * CASE; }
  private missileRange(S: MonsterSpell): number { return (S.po[1] + 0.5) * CASE + this.radius; }

  /** Choisit un sort utilisable (relance finie, à portée, ligne de vue) et commence à le lancer. */
  private castSpell(dist: number, player: Player, world: World): boolean {
    const S = this.def.spells!, ok: number[] = [];
    S.forEach((s, i) => {
      if (this.spellCd[i] > 0) return;
      const k = castKind(s), [a, b] = this.reach(s, player);
      if (k === 'invoque') {   // une invocation à la fois, quand le joueur est proche
        if (dist < CASE * 6 && !world.monsters.some(m => m.summoner === this && !m.dead)) ok.push(i);
        return;
      }
      if (s.allies && k === 'self') {
        if (s.effects.some(e => e.k === 'dommages')) { if (this.furyT <= 0 && dist < CASE * 4) ok.push(i); }   // Frénésie : juste avant le contact
        else if (this.hasteT <= 0 && dist > CASE * 2) ok.push(i);
        return;
      }
      if (dist < a || dist > b) return;
      if (k !== 'self' && k !== 'melee' && !world.clearShot(this, player)) return;
      ok.push(i);
    });
    if (!ok.length) return false;
    const i = world.rng.pick(ok), s = S[i], dx = player.x - this.x, dy = player.y - this.y, d = Math.hypot(dx, dy) || 1;
    this.spell = s; this.kind = castKind(s); this.mode = 'spell'; this.state = 'windup'; this.t = this.windupOf(s);
    this.dirX = dx / d; this.dirY = dy / d; this.facing = Math.atan2(dy, dx);
    this.tx = player.x; this.ty = player.y;   // le sort tombe là où était le joueur : on peut l'esquiver
    this.spellCd[i] = Math.max(1, s.relance) * TOUR * 0.5;
    world.emit({ k: 'monsterCast', id: this.id, name: s.name, x: this.x, y: this.y });
    return true;
  }
  /** Fin de l'incantation : coup au contact (lunge), projectile, ou effet sur la zone visée. */
  private release(player: Player, world: World) {
    const S = this.spell!;
    if (this.kind === 'melee' || this.kind === 'charge') { this.state = 'lunge'; this.t = this.def.lungeTime; this.hitDone = false; return; }
    if (this.kind === 'invoque') {
      for (const e of S.effects) if (e.k === 'invoque') world.summon(this, e.monster);
    } else if (this.kind === 'missile') {
      world.monsterMissile(this, S, this.missileRange(S));
    } else {
      const r = zoneRadius(S), el = (S.effects.find(e => e.k === 'dmg') as { element: string } | undefined)?.element ?? 'neutre';
      if (S.allies) {
        for (const m of world.monsters) if (!m.dead && Math.hypot(m.x - this.tx, m.y - this.ty) <= r + m.radius) world.monsterSpellBuff(m, S);
      } else if (Math.hypot(player.x - this.tx, player.y - this.ty) <= r + player.radius) world.monsterSpellHits(this, S, player);
      if (this.kind === 'self') world.emit({ k: 'slam', x: this.tx, y: this.ty, radius: r });
      world.emit({ k: 'spell', fx: 'burst', id: `m${S.id}`, x: this.tx, y: this.ty, facing: 0, size: r, arc: 0, element: el as never, big: false, boosted: false });
    }
    this.endCast(world);
  }
  private endCast(world: World) { this.state = 'recover'; this.t = this.def.recover; this.atkCd = world.rng.range(0.8, 1.6); }

  /** Avance vers (x, y) ; false si déjà arrivé. */
  private moveTo(x: number, y: number, speed: number, dt: number): boolean {
    const dx = x - this.x, dy = y - this.y, d = Math.hypot(dx, dy);
    if (d < 6) return false;
    const st = Math.min(d, speed * dt);
    this.x += (dx / d) * st; this.y += (dy / d) * st; this.facing = Math.atan2(dy, dx);
    return true;
  }
}
