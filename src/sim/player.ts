import { Entity } from './entity';
import type { ClassDef, ComboHit, SkillId } from './defs';
import type { PlayerInput } from './input';
import type { World } from './world';

type ActiveSkill =
  | { id: 'attaque'; def: ComboHit; t: number; impacted: boolean; idx: number }
  | { id: 'epee'; def: ClassDef['skills']['epee']; t: number; impacted: boolean }
  | { id: 'bond'; def: ClassDef['skills']['bond']; t: number; impacted: boolean; sx: number; sy: number; tx: number; ty: number }
  | { id: 'colere'; def: ClassDef['skills']['colere']; t: number; impacted: boolean };

export class Player extends Entity {
  readonly faction = 'player' as const;
  state: 'free' | 'skill' = 'free';
  skill: ActiveSkill | null = null;
  cd: Record<SkillId, number> = { attaque: 0, epee: 0, bond: 0, colere: 0 };
  combo = 0;
  comboTimer = 0;
  invuln = 0;
  /** PA disponibles (fractionnaires : ils remontent en continu). */
  pa: number;
  /** Charges de Bond disponibles (fractionnaires : elles se rechargent une à une). */
  pm: number;
  potions: number;
  potionCd = 0;
  level = 1;
  xp = 0;
  private buffer: SkillId | null = null;
  private bufferT = 0;

  constructor(id: number, x: number, y: number, readonly cls: ClassDef) {
    super(id, x, y, cls.radius, cls.hp);
    this.pa = cls.pa.max; this.pm = cls.pm.max; this.potions = cls.potion.charges;
  }

  /** Coût en PA d'un sort (0 pour l'attaque de base). */
  paCost(id: SkillId): number { return id === 'attaque' ? 0 : this.cls.skills[id].pa ?? 0; }
  /** Le sort a-t-il ses ressources (PA, ou une charge de PM pour le Bond) ? */
  hasResource(id: SkillId): boolean { return id === 'bond' ? this.pm >= 1 : this.pa >= this.paCost(id); }
  /** XP à gagner pour passer au niveau suivant. */
  get xpNeeded(): number { return this.cls.xpBase * this.level; }

  gainXp(n: number, world: World) {
    if (this.level >= this.cls.maxLevel) return;
    this.xp += n;
    while (this.level < this.cls.maxLevel && this.xp >= this.xpNeeded) {
      this.xp -= this.xpNeeded; this.level++;
      world.emit({ k: 'levelUp', level: this.level });
    }
    if (this.level >= this.cls.maxLevel) this.xp = 0;
  }

  drinkPotion(world: World): boolean {
    if (this.dead || this.potions <= 0 || this.potionCd > 0 || this.hp >= this.maxHp) return false;
    const amount = Math.min(this.maxHp - this.hp, Math.round(this.maxHp * this.cls.potion.heal));
    this.hp += amount; this.potions--; this.potionCd = this.cls.potion.cooldown;
    world.emit({ k: 'potion', x: this.x, y: this.y, amount });
    return true;
  }

  canStart(id: SkillId): boolean {
    if (this.dead) return false;
    if (id !== 'attaque' && this.cd[id] > 0) return false;
    if (!this.hasResource(id)) return false;
    if (this.state === 'free' || !this.skill) return true;
    const s = this.skill;
    if (s.id === 'bond') return false;
    if (id === 'bond') return true;                       // le Bond annule tout (esquive)
    return s.t >= (s.def.cancelAt ?? s.def.duration);     // sinon on attend la fenêtre d'annulation
  }

  start(id: SkillId, aim: { x: number; y: number }, world: World) {
    const S = this.cls.skills;
    if (id === 'attaque') {
      const idx = this.comboTimer > 0 ? (this.combo + 1) % 3 : 0;
      this.combo = idx; this.comboTimer = 0;
      this.skill = { id, def: S.attaque.combo[idx], t: 0, impacted: false, idx };
      this.setAnim('attack' + (idx + 1));
    } else if (id === 'epee') {
      this.skill = { id, def: S.epee, t: 0, impacted: false };
      this.cd.epee = S.epee.cooldown; this.pa -= this.paCost('epee'); this.setAnim('epee');
    } else if (id === 'bond') {
      const def = S.bond;
      const dx = aim.x - this.x, dy = aim.y - this.y, d = Math.hypot(dx, dy) || 1;
      const L = Math.min(def.maxRange, d);
      let tx = this.x + (dx / d) * L, ty = this.y + (dy / d) * L;
      // on recule vers le départ jusqu'à une case où l'on peut atterrir
      for (let i = 0; i < 20 && !world.walkable(tx, ty); i++) { tx -= (dx / d) * L / 20; ty -= (dy / d) * L / 20; }
      this.skill = { id, def, t: 0, impacted: false, sx: this.x, sy: this.y, tx, ty };
      this.cd.bond = def.cooldown; this.pm -= 1;
      this.invuln = Math.max(this.invuln, def.duration + 0.05);
      this.setAnim('leap');
    } else {
      this.skill = { id, def: S.colere, t: 0, impacted: false };
      this.cd.colere = S.colere.cooldown; this.pa -= this.paCost('colere'); this.setAnim('colere_charge');
    }
    const s = this.skill;
    this.facing = s.id === 'bond' ? Math.atan2(s.ty - this.y, s.tx - this.x) : Math.atan2(aim.y - this.y, aim.x - this.x);
    this.state = 'skill';
  }

  update(dt: number, input: PlayerInput, world: World) {
    this.age += dt;
    for (const k of Object.keys(this.cd) as SkillId[]) this.cd[k] = Math.max(0, this.cd[k] - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.potionCd = Math.max(0, this.potionCd - dt);
    this.pa = Math.min(this.cls.pa.max, this.pa + this.cls.pa.regen * dt);
    this.pm = Math.min(this.cls.pm.max, this.pm + dt / this.cls.pm.recharge);
    this.flash = Math.max(0, this.flash - dt);
    if (this.dead) { this.setAnim('die', Math.min(1, this.animT + dt * 1.5)); return; }
    if (this.comboTimer > 0) this.comboTimer -= dt;
    // Tampon d'entrée : une touche pressée 150 ms trop tôt n'est pas perdue
    if (input.potion) this.drinkPotion(world);
    if (input.pressed) {
      // sort sans ressource : on le signale (le HUD fait clignoter le compteur), sans le garder en tampon
      if (!this.hasResource(input.pressed) && (input.pressed === 'attaque' || this.cd[input.pressed] <= 0))
        world.emit({ k: 'noResource', res: input.pressed === 'bond' ? 'pm' : 'pa' });
      this.buffer = input.pressed; this.bufferT = 0.15;
    }
    else if (input.holdAttack && !this.buffer) { this.buffer = 'attaque'; this.bufferT = 0.05; }
    if (this.buffer) {
      this.bufferT -= dt;
      if (this.canStart(this.buffer)) { this.endSkill(); this.start(this.buffer, input.aim, world); this.buffer = null; }
      else if (this.bufferT <= 0) this.buffer = null;
    }
    if (this.state === 'free') {
      const m = input.move;
      if (m.x || m.y) {
        this.x += m.x * this.cls.speed * dt; this.y += m.y * this.cls.speed * dt;
        this.facing = Math.atan2(m.y, m.x); this.setAnim('run');
      } else this.setAnim('idle');
    } else this.updateSkill(dt, world);
    this.applyKnock(dt);
  }

  endSkill() {
    if (this.skill?.id === 'attaque') this.comboTimer = this.cls.skills.attaque.comboWindow;
    this.state = 'free'; this.skill = null; this.z = 0;
  }

  /** Vrai pendant un Bond : on survole les obstacles et les monstres. */
  get airborne(): boolean { return this.skill?.id === 'bond'; }

  private updateSkill(dt: number, world: World) {
    const s = this.skill!;
    s.t += dt;
    const k = Math.min(1, s.t / s.def.duration);
    const fx = Math.cos(this.facing), fy = Math.sin(this.facing);
    if (s.id === 'attaque') {
      const d = s.def;
      this.animT = k;
      if (s.t < d.impactAt + 0.03) { this.x += fx * d.step * dt; this.y += fy * d.step * dt; }   // petit pas en avant
      if (!s.impacted && s.t >= d.impactAt) {
        s.impacted = true;
        const arc = (d.arc * Math.PI) / 180;
        const hits = world.hitCone(this.x, this.y, this.facing, d.range, arc, d);
        world.emit({ k: 'swing', x: this.x, y: this.y, facing: this.facing, radius: d.range * 0.85, arc, finisher: s.idx === 2 });
        world.emit({ k: 'impact', hitstop: hits ? d.hitstop : 0, shake: hits ? d.shake : d.shake * 0.25, big: false });
      }
    } else if (s.id === 'epee') {
      const d = s.def;
      this.animT = k;
      if (!s.impacted && s.t >= d.impactAt) {
        s.impacted = true;
        const hits = world.hitLine(this.x, this.y, this.facing, d.length, d.width, d);
        world.emit({ k: 'epee', x: this.x, y: this.y, facing: this.facing, length: d.length });
        world.emit({ k: 'impact', hitstop: hits ? d.hitstop : 0, shake: d.shake, big: false });
      }
    } else if (s.id === 'bond') {
      const d = s.def;
      this.animT = k;
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.x = s.sx + (s.tx - s.sx) * e; this.y = s.sy + (s.ty - s.sy) * e;
      this.z = Math.sin(k * Math.PI) * d.height;
      world.telegraphs.push({ kind: 'circle', x: s.tx, y: s.ty, r: d.radius, progress: k, danger: false });
      if (k >= 1 && !s.impacted) {
        s.impacted = true; this.z = 0;
        const hits = world.hitCircle(s.tx, s.ty, d.radius, d, d.stun);
        world.emit({ k: 'bondLand', x: s.tx, y: s.ty, radius: d.radius });
        world.emit({ k: 'impact', hitstop: hits ? d.hitstop : 0, shake: d.shake, big: false });
      }
    } else {
      const d = s.def;
      if (s.t < d.impactAt) {
        this.setAnim('colere_charge', s.t / d.impactAt);
        world.telegraphs.push({ kind: 'circle', x: this.x, y: this.y, r: d.radius, progress: s.t / d.impactAt, danger: false });
      } else this.setAnim('colere_hit', (s.t - d.impactAt) / (d.duration - d.impactAt));
      if (!s.impacted && s.t >= d.impactAt) {
        s.impacted = true;
        world.hitCircle(this.x, this.y, d.radius, d, 0.4);
        world.emit({ k: 'colere', x: this.x, y: this.y, radius: d.radius });
        world.emit({ k: 'impact', hitstop: d.hitstop, shake: d.shake, big: true });
      }
    }
    if (s.t >= s.def.duration) this.endSkill();
  }

  hurt(dmg: number, fromX: number, fromY: number, world: World): boolean {
    if (this.invuln > 0 || this.dead) return false;
    this.hp -= dmg; this.flash = 0.1; this.invuln = this.cls.iframesOnHit;
    const a = Math.atan2(this.y - fromY, this.x - fromX);
    this.kx += Math.cos(a) * 260; this.ky += Math.sin(a) * 260;
    world.emit({ k: 'hit', target: 'player', x: this.x, y: this.y, z: 50, amount: dmg, crit: false });
    world.emit({ k: 'playerHurt' });
    world.emit({ k: 'impact', hitstop: 0.04, shake: 0.006, big: false });
    if (this.hp <= 0) { this.hp = 0; this.dead = true; this.setAnim('die'); world.onPlayerDeath(); }
    return true;
  }
}
