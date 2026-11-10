import { Entity } from './entity';
import type { Element } from './defs';
import type { Monster } from './monster';
import type { Player } from './player';
import type { World } from './world';
import BETES_JSON from '../data/betes.json';
import { allieLePlusBlesse, lucioleMaj, soignerAllie } from './eniripsa';
import { coffreAssomme } from './enutrof';

/** Un effet officiel d'un sort de bête que le jeu sait jouer (tools/extraction/osa_betes.py). */
export type EffetBete =
  | { k: 'dmg'; element: Element; min: number; max: number; vol?: boolean }
  | { k: 'soin'; min: number; max: number }
  /** Soin en part des PV max de l'allié (Bisou Magique du Lapino, effet officiel 1109). */
  | { k: 'soinPct'; n: number }
  | { k: 'repousse' | 'attire' | 'avance' | 'bouclier'; n: number };
export interface SortBete { id: number; name: string; pa: number; po: [number, number]; anim: number; zone: string; effets: EffetBete[]; desc?: string }
/** Une invocation de l'Osamodas (monstres officiels 8070-8083) : PV en part de ceux du lanceur, lignée de l'Éveil (8C). */
export interface BeteDef {
  dofusId: number; name: string; look: number; atlas: string; rang: number; element: Element | 'neutre';
  suivant: string | null; pv: number; sorts: SortBete[];
  /** Ne frappe jamais (coffre au trésor et Sac Animé de l'Enutrof) : suit son maître, les monstres peuvent le viser. */
  passif?: boolean;
}
export interface ReglesBetes {
  /** Part des dommages officiels (× 1,5 comme les sorts du joueur, puis × degats) ; PA par seconde et réserve (6A). */
  degats: number; regenPA: number; paMax: number;
  /** En cases : laisse (7A, trop loin elles reviennent), rayon où elles cherchent une cible autour de l'Osamodas, distance de suivi. */
  laisse: number; cibleAutour: number; suivi: number;
  /** Éveil (8C, 4A 5A) : jauge, gain par coup d'une bête et par coup de l'Osamodas, baisse hors combat, durée de l'Éveil. */
  eveil: { max: number; parCoupBete: number; parCoupOsa: number; baisseApres: number; baisse: number; duree: number };
  /** 14A Meute bigarrée : +n de dommages à toute la meute par élément différent présent. */
  meuteBigarree: number;
  invocationsBase: number;
}
const { _regles, ...defs } = BETES_JSON as unknown as { _regles: ReglesBetes } & Record<string, BeteDef>;
export const BETES: Record<string, BeteDef> = defs;
export const REGLES_BETES: ReglesBetes = _regles;

const CASE = 48, TOUR = 3;
/** Rayon d'une zone officielle (P = la case, C/X n = n cases autour). */
export function rayonZone(zone: string): number {
  const n = Number(zone.slice(1)) || 0;
  return zone[0] === 'P' ? CASE * 0.6 : (n + 0.5) * CASE;
}

/** Bête invoquée par l'Osamodas : alliée du joueur, IA autonome (choix 1A) qui frappe sa cible avec ses vrais sorts.
 *  Ne fait pas partie de world.monsters : les monstres la visent quand elle les a frappés ou qu'elle est la plus proche (8A). */
export class Bete extends Entity {
  readonly faction = 'allie' as const;
  state: 'spawn' | 'suit' | 'cast' = 'spawn';
  /** Sort de l'Osamodas qui l'a invoquée (touche de la barre d'invocations) et forme de base (pour finir l'Éveil). */
  readonly sort: string;
  base: string;
  type: string;
  def: BeteDef;
  pa: number;
  /** Éveil en cours : secondes restantes (0 = forme de base). */
  eveilT = 0;
  /** Sort en cours : index, cible (monstre ou joueur à soigner), temps écoulé, impact fait. */
  cast: { i: number; cible: Monster | Player; t: number; fait: boolean } | null = null;
  /** Le monstre qu'elle attaque. */
  cibleId: number | null = null;
  /** Minuteur de la mort et de l'apparition. */
  t = 0.4;
  tacle = 0;
  shield = 0;
  /** Peau de l'ours (Osamodas L) : secondes avant que le bouclier tombe (0 = sans limite). */
  shieldT = 0;
  /** 15A : monstre dompté, secondes avant qu'il s'enfuie (0 = vraie invocation). */
  dompteT = 0;
  /** Horde sauvage : secondes avant de repartir (0 = reste). Coup de fouet : vitesse d'attaque +hate % pendant hateT s. */
  finT = 0; hate = 0; hateT = 0;
  /** Épées jumelles (légendaire Sacrieur N) : part des dégâts de la bête. */
  force = 1;
  /** Seconde épée des Épées jumelles : ne prend pas de place d'Invocation (elle part avec sa jumelle). */
  horsCompte = false;
  /** Laine épaisse : prochaine provocation du Bouftou. */
  provoqueT = 0;
  /** Eniripsa (maquette 5B 6B) : Luciole (Fée ou Feu Follet) qui file vers un allié ou un ennemi, y applique son Mot puis meurt.
   *  mot = clé du sort de l'Eniripsa qui l'a lancée (Encouragement ou Moquerie à appliquer). */
  luciole: { kind: 'fee' | 'feu'; mot: string } | null = null;
  /** Lapino : élément de l'Alchi-Rhétorique (dernier Mot élémentaire lancé sur lui), pour Lapinopoing. */
  alchi: Element | null = null;
  constructor(id: number, readonly owner: Player, key: string, sort: string, x: number, y: number, def: BeteDef = BETES[key], pv?: number) {
    const d = def;
    super(id, x, y, 16, pv ?? Math.max(1, Math.round(owner.maxHp * d.pv)));
    this.sort = sort; this.base = key; this.type = key; this.def = d;
    this.pa = REGLES_BETES.paMax / 2;
    this.facing = owner.facing;
    this.setAnim('spawn');
  }
  /** Atlas de la planche (looks.ts). */
  get look(): string { return this.def.atlas; }

  /** 5A : jauge pleine, la bête monte d'un rang dans sa lignée pendant la durée de l'Éveil, PV au même pourcentage. */
  eveiller(world: World): boolean {
    const n = this.def.suivant;
    if (!n || !BETES[n] || this.dead) return false;
    const part = this.hp / this.maxHp;
    this.type = n; this.def = BETES[n];
    this.maxHp = Math.max(1, Math.round(this.owner.maxHp * this.def.pv)); this.hp = Math.max(1, Math.round(this.maxHp * part));
    this.eveilT = REGLES_BETES.eveil.duree; this.pa = REGLES_BETES.paMax;
    world.emit({ k: 'eveil', id: this.id, name: this.def.name, x: this.x, y: this.y });
    return true;
  }
  private finEveil() {
    const part = this.hp / this.maxHp;
    this.type = this.base; this.def = BETES[this.base];
    this.maxHp = Math.max(1, Math.round(this.owner.maxHp * this.def.pv)); this.hp = Math.max(1, Math.round(this.maxHp * part));
  }

  hurt(raw: number, fromX: number, fromY: number, world: World, element: Element = 'neutre'): boolean {
    if (this.dead || this.state === 'spawn') return false;
    let dmg = Math.max(1, Math.round(raw));
    if (this.shield > 0) { const a = Math.min(this.shield, dmg); this.shield -= a; dmg -= a; }
    this.hp -= dmg; this.flash = 0.1;
    const a = Math.atan2(this.y - fromY, this.x - fromX);
    this.kx += Math.cos(a) * 180; this.ky += Math.sin(a) * 180;
    world.emit({ k: 'hit', target: 'allie', id: this.id, x: this.x, y: this.y, z: 40, amount: dmg, crit: false, element });
    if (this.hp <= 0) this.mourir(world);
    return true;
  }
  mourir(world: World) {
    if (this.dead) return;
    this.hp = 0; this.dead = true; this.t = 0.6; this.cast = null; this.setAnim('die');
    const te = this.base === 'tofu' && !this.dompteT ? this.owner.pcv('pc-osamodas-D') : 0;   // Tofu explosif
    if (te) {
      world.hitCircle(this.x, this.y, CASE * 2, { dmg: te, knock: 0, element: 'air' });
      world.emit({ k: 'spell', fx: 'burst', id: 'pc-osamodas-D', x: this.x, y: this.y, facing: 0, size: CASE * 2, arc: 0, element: 'air', big: true, boosted: false });
    }
    if (this.base === 'coffre_tresor') coffreAssomme(this, world);   // Enutrof 3D
    world.emit({ k: 'beteMorte', id: this.id, x: this.x, y: this.y, radius: this.radius, name: this.def.name });
  }
  soigner(n: number, world: World) {
    if (this.dead || n <= 0) return;
    const v = Math.min(this.maxHp - this.hp, Math.round(n));
    if (v <= 0) return;
    this.hp += v;
    world.emit({ k: 'heal', x: this.x, y: this.y, z: 40, amount: v });
  }

  update(dt: number, world: World) {
    const R = REGLES_BETES, p = this.owner;
    this.age += dt; this.flash = Math.max(0, this.flash - dt);
    if (this.dead) { this.t -= dt; this.setAnim('die', 1 - this.t / 0.6); this.applyKnock(dt); return; }
    if (this.state === 'spawn') { this.t -= dt; this.setAnim('spawn', 1 - this.t / 0.4); if (this.t <= 0) this.state = 'suit'; return; }
    if (this.luciole) { lucioleMaj(this, dt, world); return; }
    if (this.eveilT > 0 && (this.eveilT -= dt) <= 0) this.finEveil();
    if (this.shieldT > 0 && (this.shieldT -= dt) <= 0) this.shield = 0;
    if (this.dompteT > 0 && (this.dompteT -= dt) <= 0) {   // 15A : le monstre dompté s'enfuit
      world.emit({ k: 'status', x: this.x, y: this.y - 40, text: 'S\'enfuit', color: '#a89fb6' });
      this.dead = true; this.t = 0; return;
    }
    if (this.finT > 0 && (this.finT -= dt) <= 0) {   // Horde sauvage : la bête repart
      world.emit({ k: 'status', x: this.x, y: this.y - 40, text: 'Repart', color: '#a89fb6' });
      this.dead = true; this.t = 0; return;
    }
    if (this.hateT > 0 && (this.hateT -= dt) <= 0) this.hate = 0;
    const le = this.base === 'bouftou' && !this.dompteT ? p.pcv('pc-osamodas-E') : 0;
    if (le && (this.provoqueT -= dt) <= 0) {   // Laine épaisse : attire les monstres proches à l'arrivée puis toutes les 8 s
      this.provoqueT = 8;
      let n = 0;
      for (const m of world.monsters) if (!m.dead && m.state !== 'idle' && m.state !== 'return' && Math.hypot(m.x - this.x, m.y - this.y) <= CASE * 4) {
        m.agresseur = this.id; m.provoqueJusqua = world.time + le; n++;
      }
      if (n) world.emit({ k: 'status', x: this.x, y: this.y - 40, text: 'Provocation', color: '#f2d36b' });
    }
    this.pa = Math.min(R.paMax, this.pa + R.regenPA * (1 + this.hate / 100) * dt);
    const dP = Math.hypot(p.x - this.x, p.y - this.y);
    // laisse (7A) : trop loin de l'Osamodas, elle revient ; vraiment trop loin (porte, Zaap…), elle apparaît à côté de lui
    if (dP > R.laisse * CASE * 2.5) { this.x = p.x - Math.cos(p.facing) * CASE; this.y = p.y - Math.sin(p.facing) * CASE; this.cast = null; this.state = 'suit'; }
    if (this.state === 'cast' && this.cast) { this.majCast(dt, world); this.applyKnock(dt); return; }
    if (this.base === 'sac_anime' && (this.provoqueT -= dt) <= 0) {   // Sac Animé : « intercepte les dommages des alliés » = attire les monstres proches
      this.provoqueT = 2;
      for (const m of world.monsters) if (!m.dead && !m.def.boss && m.state !== 'idle' && m.state !== 'return' && Math.hypot(m.x - this.x, m.y - this.y) <= CASE * 3) { m.agresseur = this.id; m.provoqueJusqua = world.time + 2.5; }
    }
    const cible = dP > R.laisse * CASE || this.def.passif ? null : this.choisirCible(world);
    this.cibleId = cible?.id ?? null;
    // 6A : soigne l'Osamodas blessé avec un sort de soin officiel (Bisou Béco, Saute-bouftou…)
    // Lapino de l'Eniripsa (7A) : l'allié le plus blessé du groupe, pas seulement son maître
    const blesse = this.base === 'lapino' ? allieLePlusBlesse(world, this, 0.6) : p.hp < p.maxHp * 0.6 && !p.dead ? p : null;
    const soin = blesse ? this.sortUtilisable(blesse, true) : -1;
    if (soin >= 0 && blesse) { this.lancer(soin, blesse); return; }
    if (cible) {
      const i = this.sortUtilisable(cible, false);
      if (i >= 0) { this.lancer(i, cible); return; }
      // hors de portée : s'approche à 80 % de sa plus grande portée
      const max = Math.max(...this.def.sorts.filter(s => s.effets.some(e => e.k === 'dmg' || e.k === 'repousse')).map(s => s.po[1]), 1);
      const d = Math.hypot(cible.x - this.x, cible.y - this.y) - cible.radius - this.radius;
      if (d > Math.max(CASE * 0.6, max * CASE * 0.8)) { this.marcher(cible.x, cible.y, dt, world); return; }
      this.facing = Math.atan2(cible.y - this.y, cible.x - this.x);
      this.setAnim('idle');
    } else {
      // suit l'Osamodas à sa place dans la meute : en éventail derrière lui, à `suivi` cases (pas dans ses pieds, Mathis 2026-11-08)
      const meute = world.betes.filter(q => !q.dead), i = Math.max(0, meute.indexOf(this)), n = meute.length;
      const a = p.facing + Math.PI + (n > 1 ? (i / (n - 1) - 0.5) * 1.8 : 0);
      const sx = p.x + Math.cos(a) * R.suivi * CASE, sy = p.y + Math.sin(a) * R.suivi * CASE;
      if (Math.hypot(sx - this.x, sy - this.y) > CASE * 0.5) this.marcher(sx, sy, dt, world, dP > R.laisse * CASE ? 1.6 : 1.15);
      else { this.facing = Math.atan2(p.y - this.y, p.x - this.x); this.setAnim('idle'); }
    }
    this.ecarter(world);
    this.applyKnock(dt);
  }

  /** Ne marche ni sur l'Osamodas ni sur les autres bêtes : on se pousse doucement hors de leur cercle. */
  private ecarter(world: World) {
    const voisins: { x: number; y: number; r: number }[] = [{ x: this.owner.x, y: this.owner.y, r: this.owner.radius + 14 },
      ...world.betes.filter(q => q !== this && !q.dead).map(q => ({ x: q.x, y: q.y, r: q.radius + 6 }))];
    for (const v of voisins) {
      const dx = this.x - v.x, dy = this.y - v.y, d = Math.hypot(dx, dy), min = v.r + this.radius;
      if (d >= min) continue;
      const ux = d > 0.01 ? dx / d : Math.cos(this.id), uy = d > 0.01 ? dy / d : Math.sin(this.id), k = Math.min(min - d, 6);
      if (world.walkable(this.x + ux * k, this.y + uy * k)) { this.x += ux * k; this.y += uy * k; }
    }
  }

  private marcher(x: number, y: number, dt: number, world: World, vit = 1.15) {
    const dx = x - this.x, dy = y - this.y, d = Math.hypot(dx, dy);
    if (d < 4) { this.setAnim('idle'); return; }
    const st = Math.min(d, this.owner.speed * vit * dt);
    let ux = dx / d, uy = dy / d;
    if (!world.walkable(this.x + ux * 20, this.y + uy * 20)) {   // obstacle juste devant : on tente de le longer
      const g = world.walkable(this.x - uy * 20, this.y + ux * 20) ? 1 : -1;
      [ux, uy] = [-uy * g, ux * g];
    }
    this.x += ux * st; this.y += uy * st; this.facing = Math.atan2(uy, ux);
    this.setAnim('run');
  }

  /** 7A : la cible de l'Osamodas d'abord (le dernier monstre qu'il a frappé, ou 7C : l'ordre Alt + clic),
   *  sinon le monstre en chasse le plus proche à moins de cibleAutour cases de lui. */
  private choisirCible(world: World): Monster | null {
    const R = REGLES_BETES, p = this.owner, prise = world.cibleMeute;
    if (prise != null) {
      const m = world.monsters.find(q => q.id === prise && !q.dead);
      if (m && Math.hypot(m.x - p.x, m.y - p.y) <= R.laisse * CASE) return m;
    }
    let best: Monster | null = null, bd = R.cibleAutour * CASE;
    for (const m of world.monsters) {
      if (m.dead || m.state === 'spawn' || m.mannequin && !m.poseTest) continue;
      const enChasse = m.state !== 'idle' && m.state !== 'return';
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (!enChasse && Math.hypot(m.x - this.x, m.y - this.y) > CASE * 2) continue;   // ne réveille pas les groupes au calme, sauf à son contact
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }
  /** Un sort officiel qu'elle peut lancer sur cette cible tout de suite (PA, portée) : -1 sinon. */
  private sortUtilisable(c: Monster | Player, soin: boolean): number {
    const d = Math.hypot(c.x - this.x, c.y - this.y) - c.radius - this.radius;
    let best = -1, score = -1;
    this.def.sorts.forEach((s, i) => {
      const fx = s.effets;
      if (soin ? !fx.some(e => e.k === 'soin' || e.k === 'soinPct') : !fx.some(e => e.k === 'dmg' || e.k === 'repousse')) return;   // Pelle Animée : pousse sans frapper
      if (this.pa < s.pa) return;
      const max = s.po[1] === 0 ? rayonZone(s.zone) : Math.max(1, s.po[1]) * CASE;
      if (d > max) return;
      const v = fx.reduce((a, e) => a + (e.k === 'dmg' || e.k === 'soin' ? e.min + e.max : e.k === 'soinPct' ? e.n * 4 : 0), 0) + (soin ? 0 : (i * 7 + this.age * 13) % 5);
      if (v > score) { score = v; best = i; }
    });
    return best;
  }
  private lancer(i: number, cible: Monster | Player) {
    this.pa -= this.def.sorts[i].pa;
    this.cast = { i, cible, t: 0, fait: false };
    this.state = 'cast';
    this.facing = Math.atan2(cible.y - this.y, cible.x - this.x);
  }
  /** Incantation courte (0,3 s) puis impact, et 0,35 s pour finir le geste. */
  private majCast(dt: number, world: World) {
    const c = this.cast!, S = this.def.sorts[c.i], anim = S.anim;
    c.t += dt;
    const W = 0.3;
    if (!c.fait) {
      this.setAnim(`windup${anim}`, Math.min(1, c.t / W));
      if (c.t >= W) { c.fait = true; this.impact(S, c.cible, world); }
    } else {
      this.setAnim(`lunge${anim}`, Math.min(1, (c.t - W) / 0.35));
      if (c.t >= W + 0.35) { this.cast = null; this.state = 'suit'; }
    }
  }
  /** Effets officiels du sort, dans l'ordre des données : sur un monstre (dommages, vol, poussée) ou sur l'Osamodas (soin). */
  private impact(S: SortBete, cible: Monster | Player, world: World) {
    const p = this.owner, R = REGLES_BETES, allie = cible.faction === 'player';
    const r = rayonZone(S.zone);
    const cx = S.po[1] === 0 ? this.x : cible.x, cy = S.po[1] === 0 ? this.y : cible.y;
    let el: Element = 'neutre';
    for (const e of S.effets) {
      if (e.k === 'avance' && !allie) {
        const d = Math.hypot(cible.x - this.x, cible.y - this.y), pas = Math.min(e.n * CASE, Math.max(0, d - cible.radius - this.radius - 4));
        if (d > 0) { this.x += (cible.x - this.x) / d * pas; this.y += (cible.y - this.y) / d * pas; }
      } else if (e.k === 'dmg' && !allie) {
        el = this.alchi ?? e.element;   // Lapinopoing : l'élément de l'Alchi-Rhétorique
        for (const m of world.monsters) {
          if (m.dead || m.state === 'spawn' || Math.hypot(m.x - cx, m.y - cy) > r + m.radius) continue;
          const fl = ['dragoune', 'dragonnet', 'sulfenix'].includes(this.type) && !this.dompteT && m.hp < m.maxHp / 2 ? p.pcv('pc-osamodas-N') : 0;   // Flamme de lignée
          const jet = world.rng.range(e.min, e.max + 1) * 1.5 * R.degats * world.bonusMeute(p) * this.force * (1 + fl / 100);
          const vc = this.base === 'crapipou' && !this.dompteT ? p.pcv('pc-osamodas-M') : 0;
          if (vc) for (const o of world.monsters) {   // Venin qui court : le poison gagne les monstres à 1 case de la cible
            const d = Math.hypot(o.x - cx, o.y - cy);
            if (o === m || o.dead || o.state === 'spawn' || d <= r + o.radius || d > r + CASE + o.radius) continue;
            if (o.saigneT <= 0) world.emit({ k: 'status', x: o.x, y: o.y - 34, text: 'Empoisonné', color: '#7fd35a' });
            o.saigne = jet * vc / 100 / 2; o.saigneT = 2;
          }
          const n = world.coupDeBete(this, m, jet, el);
          if (e.vol && n > 0) this.soigner(n / 2, world);
        }
      } else if (e.k === 'soinPct' && allie) {   // Bisou Magique du Lapino : % des PV max de l'allié ciblé
        soignerAllie(p, cible as Player, (cible as Player).maxHp * e.n / 100, world, { brut: true, de: this });
        if (p.pcv('pc-eniripsa-G')) for (const q of world.players)   // Lapino gardien : les alliés à 2 cases de la cible aussi
          if (q !== cible && !q.dead && Math.hypot(q.x - cible.x, q.y - cible.y) <= CASE * 2) soignerAllie(p, q, q.maxHp * e.n / 100, world, { brut: true, de: this });
      } else if (e.k === 'soin' && allie) {
        const n = world.rng.range(e.min, e.max + 1) * 1.5 * R.degats;
        p.soigner(n);
        world.emit({ k: 'heal', x: p.x, y: p.y, z: 50, amount: Math.round(n) });
        for (const b of world.betes) if (b !== this && Math.hypot(b.x - p.x, b.y - p.y) <= r + CASE) b.soigner(n, world);
      } else if ((e.k === 'repousse' || e.k === 'attire') && !allie) {
        const m = cible as Monster, dx = m.x - this.x, dy = m.y - this.y, d = Math.hypot(dx, dy) || 1, s = e.k === 'repousse' ? 1 : -1;
        const len = s > 0 ? e.n * CASE : Math.min(e.n * CASE, Math.max(0, d - m.radius - this.radius - 4));
        if (!m.def.boss) { m.kx += s * dx / d * len * 7.13; m.ky += s * dy / d * len * 7.13; }
      } else if (e.k === 'bouclier') {
        const q = allie ? cible as Player : p;   // Prévention du Lapino : sur l'allié ciblé
        q.shield = Math.max(q.shield, Math.round(q.maxHp * e.n / 1000)); q.shieldT = TOUR * 2;
      }
    }
    world.emit({ k: 'spell', fx: 'burst', id: `b${S.id}`, x: cx, y: cy, facing: this.facing, size: Math.max(r, 24), arc: 0, element: allie ? 'eau' : el, big: false, boosted: this.eveilT > 0, discret: true, cx: this.x, cy: this.y });
  }
}
