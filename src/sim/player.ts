import { Entity } from './entity';
import type { ClassDef, ComboHit, SkillId, SpellDef } from './defs';
import type { PlayerInput } from './input';
import type { World } from './world';

type ActiveSkill =
  | { id: 'attaque'; def: ComboHit; t: number; impacted: boolean; idx: number; boosted: false }
  | { id: string; def: SpellDef; t: number; impacted: boolean; sx: number; sy: number; tx: number; ty: number; boosted: boolean };

export class Player extends Entity {
  readonly faction = 'player' as const;
  state: 'free' | 'skill' = 'free';
  skill: ActiveSkill | null = null;
  /** Recharge restante de chaque sort. */
  cd: Record<string, number> = {};
  combo = 0;
  comboTimer = 0;
  invuln = 0;
  /** PA disponibles (fractionnaires : ils remontent en continu). */
  pa: number;
  /** Charges de déplacement disponibles (fractionnaires : elles se rechargent une à une). */
  pm: number;
  potions: number;
  potionCd = 0;
  level = 1;
  xp = 0;
  /** Jauge de classe (Rage du Iop). */
  rage = 0;
  /** Sorts à cumul (Fureur) : nombre de lancers cumulés et temps avant remise à zéro. */
  stacks: Record<string, { n: number; t: number }> = {};
  private buffer: SkillId | null = null;
  private bufferT = 0;

  constructor(id: number, x: number, y: number, readonly cls: ClassDef) {
    super(id, x, y, cls.radius, cls.hp);
    this.pa = cls.pa.max; this.pm = cls.pm.max; this.potions = cls.potion.charges;
    for (const k of Object.keys(cls.spells)) this.cd[k] = 0;
  }

  spell(id: SkillId): SpellDef | undefined { return this.cls.spells[id]; }
  /** Coût en PA d'un sort (0 pour l'attaque de base). */
  paCost(id: SkillId): number { return this.spell(id)?.pa ?? 0; }
  /** Le sort a-t-il ses ressources (PA, ou une charge de PM pour un déplacement) ? */
  hasResource(id: SkillId): boolean {
    const s = this.spell(id);
    if (!s) return id === 'attaque';
    return this.pa >= (s.pa ?? 0) && this.pm >= (s.pm ?? 0);
  }
  /** La ressource qui manque pour lancer ce sort. */
  missing(id: SkillId): 'pa' | 'pm' { const s = this.spell(id); return s && this.pm < (s.pm ?? 0) ? 'pm' : 'pa'; }
  get rageFull(): boolean { return this.rage >= this.cls.rage.max; }
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

  /** Remplit la jauge de classe ; prévient l'affichage quand elle devient pleine. */
  addRage(n: number, world: World) {
    const R = this.cls.rage, was = this.rageFull;
    this.rage = Math.min(R.max, this.rage + n);
    if (!was && this.rageFull) world.emit({ k: 'rageFull' });
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
    const sp = this.spell(id);
    if (!sp && id !== 'attaque') return false;
    if (sp && this.cd[id] > 0) return false;
    if (!this.hasResource(id)) return false;
    if (this.state === 'free' || !this.skill) return true;
    const s = this.skill;
    if (s.id !== 'attaque' && (s.def as SpellDef).move?.kind === 'leap') return false;
    if (sp?.move?.kind === 'leap') return true;           // le Bond annule tout (esquive)
    return s.t >= (s.def.cancelAt ?? s.def.duration);     // sinon on attend la fenêtre d'annulation
  }

  start(id: SkillId, aim: { x: number; y: number }, world: World) {
    if (id === 'attaque') {
      const A = this.cls.attaque;
      const idx = this.comboTimer > 0 ? (this.combo + 1) % A.combo.length : 0;
      this.combo = idx; this.comboTimer = 0;
      this.skill = { id, def: A.combo[idx], t: 0, impacted: false, idx, boosted: false };
      this.setAnim('attack' + (idx + 1));
      this.facing = Math.atan2(aim.y - this.y, aim.x - this.x);
      this.state = 'skill';
      return;
    }
    const def = this.spell(id)!;
    let tx = this.x, ty = this.y;
    if (def.move) {
      const dx = aim.x - this.x, dy = aim.y - this.y, d = Math.hypot(dx, dy) || 1;
      let L = Math.min(def.move.maxRange, d);
      if (def.move.kind === 'dash') {
        // la ruée s'arrête devant le premier ennemi sur sa route
        for (const m of world.monsters) {
          if (m.dead) continue;
          const t = (m.x - this.x) * dx / d + (m.y - this.y) * dy / d, perp = Math.abs(-(m.x - this.x) * dy / d + (m.y - this.y) * dx / d);
          if (t > 0 && t < L + m.radius && perp < m.radius + this.radius) L = Math.max(0, Math.min(L, t - m.radius - this.radius));
        }
      }
      tx = this.x + (dx / d) * L; ty = this.y + (dy / d) * L;
      // on recule vers le départ jusqu'à une case où l'on peut arriver
      for (let i = 0; i < 20 && !world.walkable(tx, ty); i++) { tx -= (dx / d) * L / 20; ty -= (dy / d) * L / 20; }
    }
    // Rage pleine : ce sort est renforcé (pas les déplacements)
    const boosted = this.rageFull && def.move?.kind !== 'leap';
    if (boosted) { this.rage = 0; world.emit({ k: 'rageSpent', spell: id }); }
    this.skill = { id, def, t: 0, impacted: false, sx: this.x, sy: this.y, tx, ty, boosted };
    this.cd[id] = def.cooldown; this.pa -= def.pa ?? 0; this.pm -= def.pm ?? 0;
    if (def.move?.kind === 'leap') this.invuln = Math.max(this.invuln, def.duration + 0.05);
    this.setAnim(def.charge ? `${id}_charge` : id);
    this.facing = def.move && (tx !== this.x || ty !== this.y) ? Math.atan2(ty - this.y, tx - this.x) : Math.atan2(aim.y - this.y, aim.x - this.x);
    this.state = 'skill';
  }

  update(dt: number, input: PlayerInput, world: World) {
    this.age += dt;
    for (const k of Object.keys(this.cd)) this.cd[k] = Math.max(0, this.cd[k] - dt);
    for (const [k, s] of Object.entries(this.stacks)) { s.t -= dt; if (s.t <= 0) delete this.stacks[k]; }
    this.invuln = Math.max(0, this.invuln - dt);
    this.potionCd = Math.max(0, this.potionCd - dt);
    this.pa = Math.min(this.cls.pa.max, this.pa + this.cls.pa.regen * dt);
    this.pm = Math.min(this.cls.pm.max, this.pm + dt / this.cls.pm.recharge);
    this.flash = Math.max(0, this.flash - dt);
    if (this.dead) { this.setAnim('die', Math.min(1, this.animT + dt * 1.5)); return; }
    if (this.comboTimer > 0) this.comboTimer -= dt;
    if (input.potion) this.drinkPotion(world);
    // Tampon d'entrée : une touche pressée 150 ms trop tôt n'est pas perdue
    const pr = input.pressed === 'attaque' && this.cls.basic ? this.cls.basic : input.pressed;
    if (pr && (pr === 'attaque' || this.spell(pr))) {
      // sort sans ressource : on le signale (le HUD fait clignoter le compteur), sans le garder en tampon
      if (!this.hasResource(pr) && (pr === 'attaque' || this.cd[pr] <= 0)) world.emit({ k: 'noResource', res: this.missing(pr) });
      this.buffer = pr; this.bufferT = 0.15;
    }
    else if (input.holdAttack && !this.buffer) { this.buffer = this.cls.basic ?? 'attaque'; this.bufferT = 0.05; }
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
    if (this.skill?.id === 'attaque') this.comboTimer = this.cls.attaque.comboWindow;
    this.state = 'free'; this.skill = null; this.z = 0;
  }

  /** Vrai pendant un saut : on survole les obstacles et les monstres. */
  get airborne(): boolean { return !!this.skill && this.skill.id !== 'attaque' && (this.skill.def as SpellDef).move?.kind === 'leap'; }

  private updateSkill(dt: number, world: World) {
    const s = this.skill!;
    s.t += dt;
    const k = Math.min(1, s.t / s.def.duration);
    const fx = Math.cos(this.facing), fy = Math.sin(this.facing);
    if (s.id === 'attaque' && 'idx' in s) {
      const d = s.def;
      this.animT = k;
      if (s.t < d.impactAt + 0.03) { this.x += fx * d.step * dt; this.y += fy * d.step * dt; }   // petit pas en avant
      if (!s.impacted && s.t >= d.impactAt) {
        s.impacted = true;
        const arc = (d.arc * Math.PI) / 180;
        const hits = world.hitCone(this.x, this.y, this.facing, d.range, arc, { dmg: d.dmg, knock: d.knock, element: this.cls.attaque.element });
        world.emit({ k: 'spell', fx: 'arc', id: 'attaque', x: this.x, y: this.y, facing: this.facing, size: d.range * 0.85, arc, element: this.cls.attaque.element, big: s.idx === 2, boosted: false });
        world.emit({ k: 'impact', hitstop: hits ? d.hitstop : 0, shake: hits ? d.shake : d.shake * 0.25, big: false });
      }
      if (s.t >= d.duration) this.endSkill();
      return;
    }
    if (!('tx' in s)) return;
    const d = s.def, mv = d.move;
    // Animation : en deux temps pour les sorts chargés
    if (d.charge) {
      if (s.t < d.impactAt) this.setAnim(`${s.id}_charge`, s.t / d.impactAt);
      else this.setAnim(`${s.id}_hit`, (s.t - d.impactAt) / (d.duration - d.impactAt));
    } else this.animT = k;
    const R = this.cls.rage, boost = s.boosted ? 1 + R.bonus : 1, area = s.boosted ? R.area : 1;
    const hz = d.hit;
    if (mv) {
      const kk = Math.min(1, s.t / d.impactAt);
      const e = mv.kind === 'leap' ? (kk < 0.5 ? 2 * kk * kk : 1 - Math.pow(-2 * kk + 2, 2) / 2) : 1 - Math.pow(1 - kk, 3);
      if (!s.impacted) {
        this.x = s.sx + (s.tx - s.sx) * e; this.y = s.sy + (s.ty - s.sy) * e;
        this.z = mv.kind === 'leap' ? Math.sin(kk * Math.PI) * (mv.height ?? 0) : 0;
      }
      if (hz.shape === 'circle' && !s.impacted) world.telegraphs.push({ kind: 'circle', x: s.tx, y: s.ty, r: hz.radius * area, progress: kk, danger: false });
    } else if (d.charge && s.t < d.impactAt && hz.shape === 'circle') {
      world.telegraphs.push({ kind: 'circle', x: this.x, y: this.y, r: hz.radius * area, progress: s.t / d.impactAt, danger: false });
    }
    if (!s.impacted && s.t >= d.impactAt) {
      s.impacted = true; this.z = 0;
      if (mv) { this.x = s.tx; this.y = s.ty; }
      // Cumul (Fureur) : chaque lancer augmente les dommages du suivant
      let mult = boost;
      if (d.stack) {
        const st = this.stacks[s.id] ?? { n: 0, t: 0 };
        mult *= 1 + d.stack.per * st.n;
        this.stacks[s.id] = { n: Math.min(d.stack.max, st.n + 1), t: d.stack.time };
      }
      const hit = { dmg: d.dmg * mult, knock: d.knock, element: d.element, lifesteal: d.lifesteal };
      let hits = 0, size = 0;
      if (hz.shape === 'cone') { size = hz.range * area; hits = world.hitCone(this.x, this.y, this.facing, size, (hz.arc * Math.PI) / 180, hit, d.stun); }
      else if (hz.shape === 'line') { size = hz.length * area; hits = world.hitLine(this.x, this.y, this.facing, size, hz.width * area, hit, d.stun); }
      else if (hz.shape === 'circle') { size = hz.radius * area; hits = world.hitCircle(this.x, this.y, size, hit, d.stun); }
      else {
        // Flèche : la zone (et les dommages) partent avec le projectile ; l'effet d'impact se joue à l'arrivée
        world.shoot(this.x, this.y, this.facing, hz, hit, d.stun ?? 0, area, s.id);
        size = hz.range;
      }
      if (hz.shape !== 'projectile') world.emit({ k: 'spell', fx: d.fx, id: s.id, x: this.x, y: this.y, facing: this.facing, size,
        arc: hz.shape === 'cone' ? (hz.arc * Math.PI) / 180 : 0, element: d.element, big: d.shake >= 0.012 || s.boosted, boosted: s.boosted });
      else world.emit({ k: 'shoot', id: s.id, x: this.x, y: this.y, facing: this.facing, element: d.element, boosted: s.boosted });
      if (hz.shape !== 'projectile') world.emit({ k: 'impact', hitstop: hits || d.charge ? d.hitstop * (s.boosted ? 1.4 : 1) : 0, shake: d.shake * (s.boosted ? 1.5 : 1), big: d.shake >= 0.012 || s.boosted });
    }
    if (s.t >= d.duration) this.endSkill();
  }

  hurt(dmg: number, fromX: number, fromY: number, world: World): boolean {
    if (this.invuln > 0 || this.dead) return false;
    this.hp -= dmg; this.flash = 0.1; this.invuln = this.cls.iframesOnHit;
    const a = Math.atan2(this.y - fromY, this.x - fromX);
    this.kx += Math.cos(a) * 260; this.ky += Math.sin(a) * 260;
    world.emit({ k: 'hit', target: 'player', x: this.x, y: this.y, z: 50, amount: dmg, crit: false });
    world.emit({ k: 'playerHurt' });
    world.emit({ k: 'impact', hitstop: 0.04, shake: 0.006, big: false });
    this.addRage(this.cls.rage.perHurt, world);
    if (this.hp <= 0) { this.hp = 0; this.dead = true; this.setAnim('die'); world.onPlayerDeath(); }
    return true;
  }
}
