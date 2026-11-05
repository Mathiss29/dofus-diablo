import { Entity } from './entity';
import type { ClassDef, ComboHit, Element, SkillId, SpellDef } from './defs';
import { WEAPONS } from './data';
import { BASE_STATS, EQUIP_SLOTS, METIER_MAX, metierXpNeeded, type EquipSlot, type Item, type ItemsData, type Stat, type Stats } from './items';
import type { PlayerInput } from './input';
import type { World } from './world';
import { fuiteFactor, tackleSlow, tacleOf } from './caracs';

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
  /** Points de caractéristiques placés (5 par niveau, choix 6C) et non placés. */
  base: Partial<Record<Stat, number>> = {};
  points = 0;
  /** Sac (objets tirés) et ressources par identifiant Dofus. */
  bag: Item[] = [];
  resources: Record<string, number> = {};
  /** Métiers (choix 6A : Chasseur) : niveau et XP. */
  metiers: Record<string, { level: number; xp: number }> = { chasseur: { level: 1, xp: 0 } };
  kamas = 0;
  /** Butin au sol affiché et aspiré (choix 4C, réglé dans l'inventaire) : 0 tout, 1 Rare et plus, 2 Épique et plus. */
  lootFilter = 0;
  /** Objet au sol que l'on va ramasser (clic). */
  pickupId: number | null = null;
  equipment: Partial<Record<EquipSlot, Item>> = {};
  /** Caractéristiques totales (points + équipement + panoplies), recalculées à chaque changement. */
  stats: Stats = {};
  /** Panoplies portées : nombre d'objets par panoplie. */
  setCount: Record<string, number> = {};
  items: ItemsData | null = null;
  static readonly BAG_SIZE = 120;
  /** Déplacement à la souris : points de passage restants, monstre poursuivi, dernière destination. */
  path: { x: number; y: number }[] = [];
  chaseId: number | null = null;
  private dest: { x: number; y: number } | null = null;
  private repathT = 0;
  private buffer: SkillId | null = null;
  private bufferT = 0;

  constructor(id: number, x: number, y: number, readonly cls: ClassDef) {
    super(id, x, y, cls.radius, cls.hp);
    this.pa = cls.pa.max; this.pm = cls.pm.max; this.potions = cls.potion.charges;
    this.recompute();
    for (const k of Object.keys(cls.spells)) this.cd[k] = 0;
  }

  // --- Caractéristiques -------------------------------------------------------
  stat(k: Stat): number { let v = this.stats[k] ?? 0; for (const m of this.mods) if (m.k === k) v += m.n; return v; }
  /** Bonus / malus temporaires (sorts de monstres : -40 Puissance pendant un tour…). */
  mods: { k: Stat; n: number; t: number }[] = [];
  addMod(k: Stat, n: number, t: number) { this.mods.push({ k, n, t }); }
  /** Ralentissement (retrait de PM) : fraction de vitesse perdue et durée restante. */
  slowK = 0; slowT = 0;
  slow(t: number, k: number) { k *= fuiteFactor(this.fuite); this.slowK = this.slowT > 0 ? Math.max(this.slowK, k) : k; this.slowT = Math.max(this.slowT, t); }
  get speed(): number { return this.cls.speed * (this.slowT > 0 ? 1 - this.slowK : 1); }
  /** Tacle et Fuite (base Agilité / 10), Retrait et Esquive PA / PM (base Sagesse / 10), comme dans Dofus. */
  get tacle(): number { return tacleOf(this.stat('tacle'), this.stat('agilite')); }
  get fuite(): number { return tacleOf(this.stat('fuite'), this.stat('agilite')); }
  retrait(k: 'PA' | 'PM'): number { return this.stat(`retrait${k}`) + this.stat('sagesse') / 10; }
  esquive(k: 'PA' | 'PM'): number { return this.stat(`esquive${k}`) + this.stat('sagesse') / 10; }
  get initiative(): number { return this.stat('initiative') + this.stat('force') + this.stat('intelligence') + this.stat('chance') + this.stat('agilite'); }
  /** Tacle des monstres au contact : on avance moins vite en s'éloignant d'eux (la Fuite y résiste). */
  private tackled(dx: number, dy: number, world: World): number {
    let k = 0;
    for (const m of world.monsters) {
      if (m.dead || m.state === 'spawn') continue;
      const ox = this.x - m.x, oy = this.y - m.y, d = Math.hypot(ox, oy);
      if (d > m.radius + this.radius + 12 || ox * dx + oy * dy <= 0) continue;
      k = Math.max(k, tackleSlow(tacleOf(m.def.caracs?.tacle ?? 0, m.def.caracs?.agilite ?? 0), this.fuite));
    }
    return 1 - k;
  }
  get paMax(): number { return this.cls.pa.max + this.stat('pa'); }
  get pmMax(): number { return this.cls.pm.max + this.stat('pm'); }
  get critChance(): number { return this.cls.critChance + this.stat('critique') / 100; }
  /** Effet légendaire porté (somme si plusieurs). */
  legendary(id: string): number {
    let v = 0;
    for (const it of Object.values(this.equipment)) for (const l of [it?.legendary, it?.legendary2]) if (l?.id === id) v += l.value;
    return v;
  }
  /** Recalcule les caractéristiques et les PV max (5 PV par niveau + 1 par point de Vitalité, comme Dofus). */
  recompute() {
    const st: Stats = {}, add = (k: Stat, v: number) => { st[k] = (st[k] ?? 0) + v; };
    for (const [k, v] of Object.entries(this.base) as [Stat, number][]) add(k, v);
    const sets: Record<string, number> = {};
    for (const it of Object.values(this.equipment)) {
      if (!it) continue;
      for (const [k, v] of Object.entries(it.stats) as [Stat, number][]) add(k, v);
      const set = this.items?.equipment[it.id]?.set;
      if (set) sets[set] = (sets[set] ?? 0) + 1;
    }
    for (const [id, n] of Object.entries(sets)) {
      const b = this.items?.sets[id]?.bonus[String(n - 1)];
      if (b) for (const [k, v] of Object.entries(b) as [Stat, number][]) add(k, v);
    }
    this.stats = st; this.setCount = sets;
    const was = this.maxHp;
    this.maxHp = Math.max(1, this.cls.hp + (this.level - 1) * 5 + this.stat('vitalite'));
    if (this.maxHp > was) this.hp += this.maxHp - was;
    this.hp = Math.min(this.hp, this.maxHp);
    this.buildWeapon();
  }
  /** « Meilleur élément » du lanceur = celui de sa plus forte caractéristique. */
  resolveElement(element: Element): Element {
    if (element !== 'meilleur') return element;
    const E: Record<string, Stat> = { terre: 'force', feu: 'intelligence', eau: 'chance', air: 'agilite' };
    return (['terre', 'feu', 'eau', 'air'] as Element[]).reduce((a, b) => this.stat(E[b]) > this.stat(E[a]) ? b : a, 'terre');
  }
  /** Dommages d'un coup : base × (1 + (caractéristique de l'élément + Puissance) / 100) + Dommages fixes, comme Dofus. */
  damage(base: number, element: Element): number {
    const E: Record<string, Stat> = { terre: 'force', feu: 'intelligence', eau: 'chance', air: 'agilite' };
    const el = this.resolveElement(element);
    const c = E[el] ? this.stat(E[el]) : this.stat('force');
    const flat = this.stat('dommages') + this.stat((`dommages${el[0].toUpperCase()}${el.slice(1)}`) as Stat);
    return Math.max(1, base * (1 + Math.max(-50, c + this.stat('puissance')) / 100) + flat);
  }
  /** Place n points dans une caractéristique de base. */
  spendPoint(k: Stat, n = 1): boolean {
    if (!BASE_STATS.includes(k) || n < 1 || this.points < n) return false;
    this.points -= n; this.base[k] = (this.base[k] ?? 0) + n; this.recompute();
    return true;
  }

  // --- Sac et équipement --------------------------------------------------------
  /** Emplacement où irait cet objet (le 2e anneau si le 1er est pris). */
  slotFor(it: Item): EquipSlot | null {
    const d = this.items?.equipment[it.id];
    if (!d) return null;
    if (d.slot === 'anneau') return !this.equipment.anneau1 || this.equipment.anneau2 ? 'anneau1' : 'anneau2';
    return d.slot as EquipSlot;
  }
  /** Équipe un objet du sac (l'ancien retourne dans le sac). Le niveau requis est celui de l'objet. */
  equip(uid: number, slot?: EquipSlot): boolean {
    const i = this.bag.findIndex(b => b.uid === uid), it = this.bag[i], d = it && this.items?.equipment[it.id];
    if (!it || !d || d.level > this.level) return false;
    const to = slot ?? this.slotFor(it);
    if (!to || !EQUIP_SLOTS.includes(to) || (d.slot === 'anneau' ? !to.startsWith('anneau') : to !== d.slot)) return false;
    this.bag.splice(i, 1);
    const old = this.equipment[to];
    if (old) this.bag.push(old);
    this.equipment[to] = it; this.recompute();
    return true;
  }
  unequip(slot: EquipSlot): boolean {
    const it = this.equipment[slot];
    if (!it || this.bag.length >= Player.BAG_SIZE) return false;
    delete this.equipment[slot]; this.bag.push(it); this.recompute();
    return true;
  }

  spell(id: SkillId): SpellDef | undefined { return id === 'arme' ? this.weaponDef ?? undefined : this.cls.spells[id]; }
  /** Auto-attaque (clic gauche) : celle de l'arme portée, sinon le coup de la classe (Coup de poing, Flèche Cinglante). */
  get autoAttack(): SkillId { return this.weaponDef ? 'arme' : this.cls.basic ?? 'attaque'; }
  /** Auto-attaque de l'arme portée (src/data/armes.json), recalculée à chaque changement d'équipement. */
  weaponDef: SpellDef | null = null;
  private buildWeapon() {
    const it = this.equipment.arme, d = it && this.items?.equipment[it.id], w = d?.weapon, prof = w && WEAPONS[w.type];
    if (!d || !w || !prof) { this.weaponDef = null; return; }
    const best = [...w.dmg].sort((a, b) => (b.min + b.max) - (a.min + a.max))[0];
    const { base, mult, anim, ...rest } = prof;
    this.weaponDef = { ...rest, name: d.name, icon: anim, itemIcon: d.icon, element: (best?.element ?? 'neutre') as Element, cooldown: 0,
      dmg: Math.round(base + this.weaponDamage() * mult), anim: `arme${anim}` };
  }
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

  /** Ajoute l'XP (bonus de Sagesse compris) et renvoie ce qui a été gagné. */
  gainXp(n: number, world: World): number {
    if (this.level >= this.cls.maxLevel) return 0;
    const gain = Math.round(n * (1 + this.stat('sagesse') / 100));
    this.xp += gain;
    while (this.level < this.cls.maxLevel && this.xp >= this.xpNeeded) {
      this.xp -= this.xpNeeded; this.level++; this.points += 5;
      this.recompute(); this.hp = this.maxHp;
      world.emit({ k: 'levelUp', level: this.level });
    }
    if (this.level >= this.cls.maxLevel) this.xp = 0;
    return gain;
  }

  /** L'arme en main a-t-elle l'effet officiel « Arme de chasse » ? */
  get huntingWeapon(): boolean { const it = this.equipment.arme; return !!(it && this.items?.equipment[it.id]?.chasse); }
  metierLevel(key: string): number { return this.metiers[key]?.level ?? 0; }
  /** XP de métier ; prévient l'affichage à chaque niveau. */
  gainMetierXp(key: string, n: number, world: World) {
    const m = this.metiers[key] ??= { level: 1, xp: 0 };
    if (m.level >= METIER_MAX) return;
    m.xp += n;
    while (m.level < METIER_MAX && m.xp >= metierXpNeeded(m.level)) {
      m.xp -= metierXpNeeded(m.level); m.level++;
      world.emit({ k: 'metierLevel', metier: key, level: m.level });
    }
  }

  /** Remplit la jauge de classe ; prévient l'affichage quand elle devient pleine. */
  addRage(n: number, world: World) {
    const R = this.cls.rage, was = this.rageFull;
    this.rage = Math.min(R.max, this.rage + n * (1 + this.legendary('rage') / 100));
    if (!was && this.rageFull) world.emit({ k: 'rageFull' });
  }

  drinkPotion(world: World): boolean {
    if (this.dead || this.potions <= 0 || this.potionCd > 0 || this.hp >= this.maxHp) return false;
    const amount = Math.min(this.maxHp - this.hp, Math.round(this.maxHp * this.cls.potion.heal * (1 + this.legendary('potion') / 100)));
    this.hp += amount; this.potions--; this.potionCd = this.cls.potion.cooldown;
    world.emit({ k: 'potion', x: this.x, y: this.y, amount });
    return true;
  }

  canStart(id: SkillId): boolean {
    if (this.dead) return false;
    const sp = this.spell(id);
    if (!sp && id !== 'attaque') return false;
    if (sp && this.cd[id] > 0) return false;
    if (id === this.autoAttack && this.autoCd > 0) return false;
    if (!this.hasResource(id)) return false;
    if (this.state === 'free' || !this.skill) return true;
    const s = this.skill;
    if (s.id !== 'attaque' && (s.def as SpellDef).move?.kind === 'leap') return false;
    if (sp?.move?.kind === 'leap') return true;           // le Bond annule tout (esquive)
    return s.t >= (s.def.cancelAt ?? s.def.duration);     // sinon on attend la fenêtre d'annulation
  }

  /** Temps mini entre deux auto-attaques : 1 / (attaques par seconde de l'arme x (1 + Vitesse d'attaque %)). */
  attackInterval(): number {
    const aps = this.spell(this.autoAttack)?.aps ?? Player.BASE_APS;
    return 1 / (aps * (1 + this.stat('vitesse') / 100));
  }
  static readonly BASE_APS = 1.2;
  /** Recharge de l'auto-attaque en cours. */
  autoCd = 0;

  start(id: SkillId, aim: { x: number; y: number }, world: World) {
    if (id === this.autoAttack) this.autoCd = this.attackInterval();
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
      const sig = this.rageFull && def.rage === 'dash' ? this.cls.rage.signature : 1;   // Déferlement renforcé : avance plus loin
      let L = Math.min(def.move.maxRange * sig, d);
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
    this.setAnim(def.charge ? `${id}_charge` : def.anim ?? id);
    this.facing = def.move && (tx !== this.x || ty !== this.y) ? Math.atan2(ty - this.y, tx - this.x) : Math.atan2(aim.y - this.y, aim.x - this.x);
    this.state = 'skill';
  }

  update(dt: number, input: PlayerInput, world: World) {
    this.age += dt;
    for (const k of Object.keys(this.cd)) this.cd[k] = Math.max(0, this.cd[k] - dt);
    this.autoCd = Math.max(0, this.autoCd - dt);
    for (const [k, s] of Object.entries(this.stacks)) { s.t -= dt; if (s.t <= 0) delete this.stacks[k]; }
    this.invuln = Math.max(0, this.invuln - dt);
    this.potionCd = Math.max(0, this.potionCd - dt);
    this.pa = Math.min(this.paMax, this.pa + this.cls.pa.regen * dt);
    this.pm = Math.min(this.pmMax, this.pm + dt * (1 + this.legendary('mobilite') / 100) / this.cls.pm.recharge);
    this.flash = Math.max(0, this.flash - dt);
    if (this.slowT > 0) this.slowT -= dt;
    if (this.mods.length) { for (const m of this.mods) m.t -= dt; this.mods = this.mods.filter(m => m.t > 0); }
    if (this.dead) { this.setAnim('die', Math.min(1, this.animT + dt * 1.5)); return; }
    if (this.comboTimer > 0) this.comboTimer -= dt;
    if (input.potion) this.drinkPotion(world);
    // Déplacement à la souris (clic gauche) : sur le sol on y va, sur un monstre on s'approche pour l'attaquer
    let aim = input.aim;
    this.repathT -= dt;
    if (input.pickup != null) {
      const d = world.drops.find(q => q.uid === input.pickup);
      if (d) { this.pickupId = d.uid; this.chaseId = null; this.dest = null; this.path = world.findPath(this, d); }
    }
    if (input.target != null) { this.chaseId = input.target; this.pickupId = null; }
    else if (input.dest) {
      this.chaseId = null; this.pickupId = null;
      if (!this.dest || Math.hypot(input.dest.x - this.dest.x, input.dest.y - this.dest.y) > 20 || this.repathT <= 0) {
        this.dest = { ...input.dest }; this.path = world.findPath(this, input.dest); this.repathT = 0.25;
      }
    }
    if (this.chaseId != null) {
      const m = world.monsters.find(q => q.id === this.chaseId && !q.dead);
      if (!m) { this.chaseId = null; this.path = []; }
      else {
        aim = { x: m.x, y: m.y };
        if (Math.hypot(m.x - this.x, m.y - this.y) <= this.attackReach() + m.radius) {
          this.path = [];
          if (!this.buffer) { this.buffer = this.autoAttack; this.bufferT = 0.05; }   // la poursuite s'arrête au premier coup porté
        } else if (this.repathT <= 0 || !this.path.length) { this.path = world.findPath(this, m); this.repathT = 0.2; }
      }
    }
    // Tampon d'entrée : une touche pressée 150 ms trop tôt n'est pas perdue
    const pr = input.pressed === 'attaque' ? this.autoAttack : input.pressed;
    if (pr && (pr === 'attaque' || this.spell(pr))) {
      // sort sans ressource : on le signale (le HUD fait clignoter le compteur), sans le garder en tampon
      if (!this.hasResource(pr) && (pr === 'attaque' || this.cd[pr] <= 0)) world.emit({ k: 'noResource', res: this.missing(pr) });
      this.buffer = pr; this.bufferT = 0.15;
    }
    else if (input.holdAttack && !this.buffer) { this.buffer = this.autoAttack; this.bufferT = 0.05; }
    if (this.buffer) {
      this.bufferT -= dt;
      if (this.canStart(this.buffer)) {
        // un sort lancé arrête le déplacement à la souris (sauf l'auto-attaque d'une poursuite, déjà à portée)
        if (this.buffer !== this.autoAttack) { this.path = []; this.chaseId = null; this.dest = null; }
        else this.chaseId = null;
        this.endSkill(); this.start(this.buffer, aim, world); this.buffer = null;
      }
      else if (this.bufferT <= 0) this.buffer = null;
    }
    if (this.state === 'free') {
      const m = input.move;
      if (m.x || m.y) {
        this.path = []; this.chaseId = null;
        const v = this.speed * this.tackled(m.x, m.y, world);
        this.x += m.x * v * dt; this.y += m.y * v * dt;
        this.facing = Math.atan2(m.y, m.x); this.setAnim('run');
      } else if (this.path.length) {
        const t = this.path[0], dx = t.x - this.x, dy = t.y - this.y, d = Math.hypot(dx, dy), step = this.speed * this.tackled(dx, dy, world) * dt;
        if (d <= step) { this.x = t.x; this.y = t.y; this.path.shift(); }
        else { this.x += dx / d * step; this.y += dy / d * step; }
        if (d > 0.5) this.facing = Math.atan2(dy, dx);
        this.setAnim('run');
      } else this.setAnim('idle');
    } else this.updateSkill(dt, world);
    this.applyKnock(dt);
  }

  /** Portée de l'auto-attaque : distance à laquelle on s'arrête pour frapper un monstre poursuivi. */
  attackReach(): number {
    const d = this.spell(this.autoAttack);
    if (!d) return this.cls.attaque.combo[0].range * 0.8;
    const h = d.hit;
    return h.shape === 'cone' ? h.range * 0.8 : h.shape === 'line' ? h.length * 0.75 : h.shape === 'circle' ? h.radius * 0.8 : h.range * 0.85;
  }

  /** Moyenne des dommages de l'arme portée, ajoutée à l'attaque de base. */
  weaponDamage(): number {
    const w = this.equipment.arme && this.items?.equipment[this.equipment.arme.id]?.weapon;
    return w ? w.dmg.reduce((a, d) => a + (d.min + d.max) / 2, 0) : 0;
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
        const hits = world.hitCone(this.x, this.y, this.facing, d.range, arc, { dmg: d.dmg + this.weaponDamage(), knock: d.knock, element: this.cls.attaque.element });
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
    // Rage pleine (choix 2B) : dommages en plus, et l'effet qui caractérise le sort poussé de +50 %
    const R = this.cls.rage, boost = s.boosted ? 1 + R.bonus : 1, sig = (k: SpellDef['rage']) => (s.boosted && d.rage === k ? R.signature : 1);
    const area = Math.max(sig('length'), sig('radius'));
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
        mult *= 1 + d.stack.per * sig('stack') * st.n;
        this.stacks[s.id] = { n: Math.min(d.stack.max, st.n + 1), t: d.stack.time };
      }
      const hit = { dmg: (d.dmg + (s.id === this.cls.basic ? this.weaponDamage() : 0)) * mult, knock: d.knock * sig('knock'), element: d.element,
        lifesteal: d.lifesteal && d.lifesteal * sig('lifesteal'), erosion: d.erosion && d.erosion * sig('erosion'),
        pmLoss: d.pmLoss && Math.round(d.pmLoss * sig('pm')), paLoss: d.paLoss && Math.round(d.paLoss * sig('pa')) };
      let hits = 0, size = 0;
      if (hz.shape === 'cone') { size = hz.range * area; hits = world.hitCone(this.x, this.y, this.facing, size, (hz.arc * Math.PI) / 180, hit, d.stun); }
      else if (hz.shape === 'line') { size = hz.length * area; hits = world.hitLine(this.x, this.y, this.facing, size, hz.width * area, hit, d.stun); }
      else if (hz.shape === 'circle') { size = hz.radius * area; hits = world.hitCircle(this.x, this.y, size, hit, d.stun); }
      else {
        // Flèche : la zone (et les dommages) partent avec le projectile ; l'effet d'impact se joue à l'arrivée
        world.shoot(this.x, this.y, this.facing, hz, hit, d.stun ?? 0, sig('explode'), s.id);
        size = hz.range;
      }
      if (hz.shape !== 'projectile') world.emit({ k: 'spell', fx: d.fx, id: s.id, x: this.x, y: this.y, facing: this.facing, size,
        arc: hz.shape === 'cone' ? (hz.arc * Math.PI) / 180 : 0, element: d.element, big: d.shake >= 0.012 || s.boosted, boosted: s.boosted });
      else world.emit({ k: 'shoot', id: s.id, x: this.x, y: this.y, facing: this.facing, element: d.element, boosted: s.boosted });
      if (hz.shape !== 'projectile') world.emit({ k: 'impact', hitstop: hits || d.charge ? d.hitstop * (s.boosted ? 1.4 : 1) : 0, shake: d.shake * (s.boosted ? 1.5 : 1), big: d.shake >= 0.012 || s.boosted });
    }
    if (s.t >= d.duration) this.endSkill();
  }

  /** Coup reçu : Résistance fixe puis % Résistance de l'élément (plafonnée à 50 %), comme Dofus. */
  hurt(raw: number, fromX: number, fromY: number, world: World, element: Element = 'neutre'): boolean {
    if (this.invuln > 0 || this.dead) return false;
    const E = element === 'meilleur' ? 'Neutre' : `${element[0].toUpperCase()}${element.slice(1)}`;
    const dmg = Math.max(1, Math.round((raw - this.stat(`red${E}` as Stat)) * (1 - Math.min(50, this.stat(`res${E}` as Stat)) / 100)));
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
