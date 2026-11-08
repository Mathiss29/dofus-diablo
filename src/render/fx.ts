import type { Apercu } from '../sim/apercu';
import Phaser from 'phaser';
import { ISO, type Vec } from '../sim/iso';
import { TAU } from '../sim/math';
import type { Element } from '../sim/defs';
import type { SimEvent, Telegraph } from '../sim/events';
import type { Projectile } from '../sim/world';
import { SpellFx } from './spellFx';
import { SOL } from './worldView';

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Points d'un cercle du sol projeté (= ellipse à l'écran). */
export function isoCircle(cx: number, cy: number, r: number, n = 28): Vec[] {
  const pts: Vec[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU; pts.push(ISO.toScreen(cx + Math.cos(a) * r, cy + Math.sin(a) * r)); }
  return pts;
}
const isoPoly = (pts: { x: number; y: number; z?: number }[]) => pts.map(p => ISO.toScreen(p.x, p.y, p.z ?? 0));

/** Couleur des effets selon l'élément du sort (terre, feu, eau, air). */
export const ELEMENT_COLORS: Record<Element, number> = { neutre: 0xffe9c4, terre: 0xd9a35a, feu: 0xff6a3d, eau: 0x5fb4ff, air: 0x8fe07a, meilleur: 0xffe9c4 };

interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; color: number; size: number }
type Trail =
  | { kind: 'arc'; x: number; y: number; z: number; facing: number; radius: number; arc: number; color: number; width: number; life: number; max: number }
  | { kind: 'line'; x: number; y: number; facing: number; length: number; width: number; color: number; life: number; max: number };
interface Ring { x: number; y: number; r0: number; r1: number; color: number; life: number; max: number; width: number }

/** Effets visuels : particules, traînées, anneaux, chiffres de dégâts, télégraphes.
 *  Purement cosmétique : utilise Math.random() librement, rien ici n'influe sur la partie. */
/** Couleur des chiffres de dégâts par élément (choix 2A de Mathis). */
const DMG_COLORS: Record<string, string> = { terre: '#c9925a', feu: '#ff6a45', eau: '#5cb4ff', air: '#6fdc7a', neutre: '#e2e2e2', meilleur: '#ffffff' };

export class FX {
  /** Touche F : effets d'impact (gel, tremblement, particules pleines). */
  juice = true;
  private ground: Phaser.GameObjects.Graphics;
  private top: Phaser.GameObjects.Graphics;
  private parts: Particle[] = [];
  private trails: Trail[] = [];
  private rings: Ring[] = [];
  /** Effets officiels des sorts (planches Dofus 3). */
  readonly official: SpellFx;
  /** Armes 4B : flèches de l'arc (dessin officiel de l'animation) en vol, et celles plantées au sol quand elles ratent. */
  private fleches = new Map<number, { img: Phaser.GameObjects.Image; a: Projectile }>();
  private plantees: { img: Phaser.GameObjects.Image; life: number }[] = [];

  constructor(private scene: Phaser.Scene, private colorOf: (monster: string) => number) {
    this.official = new SpellFx(scene);
    this.ground = scene.add.graphics().setDepth(SOL + 50);   // télégraphes au sol
    this.top = scene.add.graphics().setDepth(1e6);        // traînées, particules
  }

  /** Traduit un événement de la simulation en effets. */
  handle(e: SimEvent) {
    switch (e.k) {
      case 'spellFx':
        this.official.cast(e.id, e.x, e.y, e.facing);
        break;
      case 'spell': {
        // Armes 3B : la traînée officielle est dans l'animation d'arme, on ne dessine plus la nôtre (sauf l'éclat de la Baguette)
        if (e.id === 'arme' && e.fx !== 'burst') break;
        const col = ELEMENT_COLORS[e.element], w = e.big ? 16 : 10;
        // Effet officiel du sort (8A) : sur la zone visée et sur le lanceur ; remplace la forme dessinée
        const reach = e.fx === 'arc' ? e.size * 0.55 : e.fx === 'line' ? e.size * 0.5 : 0;
        if (this.official.cast(e.id, e.x + Math.cos(e.facing) * reach, e.y + Math.sin(e.facing) * reach, e.facing, e.cx ?? e.x, e.cy ?? e.y, e.fx === 'line' ? e.size : 0)) {
          if (e.boosted) this.ring(e.x, e.y, 10, e.size * 1.3, 0xff7a2e, 0.45, 12);
          break;
        }
        if (e.boosted) this.ring(e.x, e.y, 10, e.size * 1.3, 0xff7a2e, 0.45, 12);   // sort renforcé par la Rage
        if (e.fx === 'arc') {
          this.trails.push({ kind: 'arc', x: e.x, y: e.y, z: 24, facing: e.facing, radius: e.size, arc: Math.max(e.arc, 0.6),
            color: e.big ? 0xffb347 : col, width: w, life: e.big ? 0.2 : 0.14, max: e.big ? 0.2 : 0.14 });
        } else if (e.fx === 'line') {
          this.trails.push({ kind: 'line', x: e.x, y: e.y, facing: e.facing, length: e.size, width: 18, color: col, life: 0.22, max: 0.22 });
          this.particles(e.x + Math.cos(e.facing) * e.size, e.y + Math.sin(e.facing) * e.size, 20, 10, col, 160, 0.35);
        } else if (e.fx === 'land') {
          this.ring(e.x, e.y, 10, e.size * 1.15, 0xffd27a, 0.3, 8);
          this.particles(e.x, e.y, 0, 26, 0xb59a6a, 260, 0.5, 4, 260);
        } else if (e.discret) {
          this.particles(e.x, e.y, 0, 18, col, 200, 0.45, 3, 200);
        } else {
          this.ring(e.x, e.y, 20, e.size * 1.2, 0xffffff, 0.35, e.big ? 14 : 8);
          this.ring(e.x, e.y, 10, e.size * 0.8, col, 0.5, 10);
          this.particles(e.x, e.y, 0, e.big ? 60 : 30, col, e.big ? 420 : 280, 0.6, 4, e.big ? 420 : 260);
          if (e.big) this.particles(e.x, e.y, 0, 30, 0x8a7350, 300, 0.7, 5, 200);
        }
        break;
      }
      case 'slam':
        this.ring(e.x, e.y, 20, e.radius, 0xe0402a, 0.35, 10);
        this.particles(e.x, e.y, 0, 30, 0x8a7350, 300, 0.6, 5, 220);
        break;
      case 'potion':
        this.number(e.x, e.y, 60, e.amount, false, '#7be07b');
        this.particles(e.x, e.y, 30, 14, 0x7be07b, 120, 0.6, 3, 220);
        break;
      case 'hit':
        if (e.target === 'monster') {
          // choix 2A : couleur de l'élément ; critique = plus gros, contour doré
          this.number(e.x, e.y, e.z, e.amount, e.crit, DMG_COLORS[e.element ?? 'neutre'] ?? '#ffffff', e.crit ? '#8a5a00' : '#1a0f0a');
          this.particles(e.x, e.y, e.z / 2, e.crit ? 14 : 8, e.crit ? 0xffd23f : 0xffffff, 240, 0.35, 3, 160);
          if (e.eclat) {   // Armes 3B : éclat de l'élément de l'arme sur chaque monstre touché
            const col = ELEMENT_COLORS[e.element ?? 'neutre'];
            this.ring(e.x, e.y, 6, e.crit ? 46 : 34, col, 0.22, e.crit ? 8 : 6);
            this.particles(e.x, e.y, e.z / 2, e.crit ? 12 : 7, col, 260, 0.3, 3, 180);
          }
        } else {
          this.number(e.x, e.y, e.z, e.amount, false, '#ff6b5b');
          this.particles(e.x, e.y, 20, 10, 0xd2412f, 200, 0.4);
        }
        break;
      case 'xp':
        this.number(e.x, e.y, e.z, `+ ${e.n} XP`, false, '#c99cff');
        break;
      case 'status':
        this.number(e.x, e.y, 70, e.text, false, e.color);
        break;
      case 'kill':
        this.particles(e.x, e.y, e.radius, 22, this.colorOf(e.monster), 300, 0.6, 4, 300);
        break;
      // Osamodas : bêtes (soins, apparition, Éveil, mort)
      case 'heal':
        this.number(e.x, e.y, e.z, `+${e.amount}`, false, '#7be07b');
        this.particles(e.x, e.y, 30, 8, 0x7be07b, 100, 0.5, 3, 200);
        break;
      case 'invocation':
        this.ring(e.x, e.y, 8, 46, 0x9ad15a, 0.4, 6);
        this.particles(e.x, e.y, 20, 16, 0xd8f0b0, 180, 0.5, 3, 240);
        break;
      case 'eveil':
        this.ring(e.x, e.y, 10, 70, 0xffc04d, 0.5, 10);
        this.particles(e.x, e.y, 30, 26, 0xffd87a, 260, 0.6, 4, 320);
        this.number(e.x, e.y, 90, `${e.name} !`, false, '#ffd87a');
        break;
      case 'dompte':
        this.ring(e.x, e.y, 10, 60, 0x7fd0ff, 0.5, 8);
        this.number(e.x, e.y, 90, `${e.name} dompté !`, false, '#9fd0ff');
        break;
      case 'beteMorte':
        this.particles(e.x, e.y, e.radius, 18, 0xbfbfbf, 240, 0.5, 4, 260);
        break;
    }
  }

  /** Étincelles de charge pendant la Colère de Iop. */
  chargeSparks(x: number, y: number) {
    if (Math.random() < 0.6) this.particles(x + rand(-30, 30), y + rand(-30, 30), 0, 1, 0xffd36b, 30, 0.4, 3, 300);
  }

  particles(x: number, y: number, z: number, n: number, color: number, speed = 220, life = 0.45, size = 3, up = 200) {
    if (!this.juice) n = Math.ceil(n / 4);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = rand(0.3, 1) * speed;
      this.parts.push({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(0.2, 1) * up, life: rand(0.6, 1) * life, max: life, color, size });
    }
  }
  ring(x: number, y: number, r0: number, r1: number, color: number, life = 0.3, width = 6) {
    this.rings.push({ x, y, r0, r1, color, life, max: life, width });
  }
  number(x: number, y: number, z: number, value: number | string, crit: boolean, color?: string, stroke = '#1a0f0a') {
    const p = ISO.toScreen(x, y, z);
    const t = this.scene.add.text(p.x + rand(-8, 8), p.y, String(value), {
      fontFamily: 'Lexend, Verdana, sans-serif', fontSize: crit ? '26px' : '17px', fontStyle: 'bold',
      color: color ?? (crit ? '#ffd23f' : '#ffffff'), stroke, strokeThickness: crit ? 5 : 4,
    }).setOrigin(0.5).setDepth(1e6 + 1);
    t.setScale(crit ? 1.6 : 1.25);
    this.scene.tweens.add({ targets: t, scale: crit ? 1.1 : 0.9, duration: 120, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: t, y: t.y - (crit ? 50 : 36), alpha: 0, delay: 250, duration: 450, ease: 'Cubic.In', onComplete: () => t.destroy() });
  }

  update(dt: number) {
    this.official.update(dt);
    for (const p of this.parts) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= 900 * dt;
      if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.6; p.vy *= 0.6; }
      p.vx *= 0.96; p.vy *= 0.96;
    }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const t of this.trails) t.life -= dt;
    this.trails = this.trails.filter(t => t.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter(r => r.life > 0);
    for (const f of this.plantees) { f.life -= dt; f.img.setAlpha(Math.min(1, f.life / 0.3)); if (f.life <= 0) f.img.destroy(); }
    this.plantees = this.plantees.filter(f => f.life > 0);
  }

  /** Flèches de l'arc : image officielle tournée dans le sens du vol ; une flèche qui n'a rien touché se plante un instant. */
  private dessinerFleches(arrows: readonly Projectile[]) {
    const vues = new Set<number>();
    for (const a of arrows) {
      if (!a.fleche) continue;
      vues.add(a.id);
      let f = this.fleches.get(a.id);
      if (!f) {
        if (!this.scene.textures.exists('fleche_arme')) continue;
        f = { img: this.scene.add.image(0, 0, 'fleche_arme').setOrigin(0.85, 0.5).setScale(0.28), a };
        this.fleches.set(a.id, f);
      }
      f.a = a;
      const h = ISO.toScreen(a.x, a.y, 34), t = ISO.toScreen(a.x + a.dx * 10, a.y + a.dy * 10, 34);
      f.img.setPosition(h.x, h.y).setRotation(Math.atan2(t.y - h.y, t.x - h.x)).setDepth(ISO.toScreen(a.x, a.y).y + 2);
    }
    for (const [id, f] of this.fleches) {
      if (vues.has(id)) continue;
      this.fleches.delete(id);
      if (f.a.touched.size) { f.img.destroy(); continue; }
      // ratée : pointe dans le sol, un peu inclinée, puis s'efface
      const a = f.a, h = ISO.toScreen(a.x, a.y, 6), r = f.img.rotation;
      f.img.setPosition(h.x, h.y).setRotation(r + (Math.cos(r) >= 0 ? 0.5 : -0.5)).setDepth(ISO.toScreen(a.x, a.y).y);
      this.plantees.push({ img: f.img, life: 0.8 });
    }
  }

  /** Aperçu d'un sort avant de le lancer (maquette Aperçu : formes lisses façon Diablo, 4B) : cercle de portée bleu,
   *  zone touchée orange, ennemis touchés cerclés de rouge. À appeler après draw(). */
  apercu(a: Apercu | null, from: Vec, monsters: readonly { id: number; x: number; y: number; radius: number }[], reach = 0) {
    const g = this.ground;
    if (reach > 0) { g.lineStyle(1.5, 0xe8e2d4, 0.45); g.strokePoints(isoCircle(from.x, from.y, reach, 40), true, true); }   // portée de l'arme (Maj, 9B)
    if (!a) return;
    const BLEU = 0x8cc4ff, ORANGE = 0xff8a45, ROUGE = 0xff4a3a;
    if (a.portee > 0) {
      g.fillStyle(BLEU, 0.07); g.fillPoints(isoCircle(from.x, from.y, a.portee, 48), true);
      g.lineStyle(1.5, BLEU, 0.75); g.strokePoints(isoCircle(from.x, from.y, a.portee, 48), true, true);
    }
    const z = a.zone;
    const fill = (pts: Vec[]) => { g.fillStyle(ORANGE, 0.26); g.fillPoints(pts, true); g.lineStyle(2, ORANGE, 0.9); g.strokePoints(pts, true, true); };
    if (z?.kind === 'circle') fill(isoCircle(z.x, z.y, z.r, 36));
    else if (z?.kind === 'cone') {
      const pts: { x: number; y: number }[] = [{ x: z.x, y: z.y }], n = 18;
      for (let i = 0; i <= n; i++) { const t = z.facing - z.arc / 2 + (z.arc * i) / n; pts.push({ x: z.x + Math.cos(t) * z.range, y: z.y + Math.sin(t) * z.range }); }
      fill(z.arc >= TAU - 0.01 ? isoCircle(z.x, z.y, z.range, 36) : isoPoly(pts));
    } else if (z?.kind === 'line') {
      const c = Math.cos(z.facing), s = Math.sin(z.facing), px = -s * z.width, py = c * z.width;
      fill(isoPoly([{ x: z.x + px, y: z.y + py }, { x: z.x + c * z.length + px, y: z.y + s * z.length + py }, { x: z.x + c * z.length - px, y: z.y + s * z.length - py }, { x: z.x - px, y: z.y - py }]));
    } else if (z?.kind === 'shot') {
      const a1 = ISO.toScreen(z.x, z.y), b1 = ISO.toScreen(z.tx, z.ty);
      g.lineStyle(z.width * 1.2, ORANGE, 0.22); g.lineBetween(a1.x, a1.y, b1.x, b1.y);
      g.lineStyle(2, ORANGE, 0.9); g.lineBetween(a1.x, a1.y, b1.x, b1.y);
      if (z.r > 0) fill(isoCircle(z.tx, z.ty, z.r, 36));
      else { g.fillStyle(ORANGE, 0.9); g.fillPoints(isoCircle(z.tx, z.ty, 5, 12), true); }
    }
    for (const m of monsters) if (a.cibles.includes(m.id)) { g.lineStyle(3, ROUGE, 0.95); g.strokePoints(isoCircle(m.x, m.y, m.radius + 7, 24), true, true); }
  }

  draw(telegraphs: readonly Telegraph[], arrows: readonly Projectile[] = []) {
    const g = this.ground, top = this.top;
    g.clear(); top.clear();
    // Flèches en vol : le projectile officiel s'il existe, sinon un trait lumineux de la couleur de l'élément
    const official = this.official.projectiles(arrows);
    this.dessinerFleches(arrows);
    for (const a of arrows) {
      if (a.fleche && this.fleches.has(a.id)) continue;
      if (official.has(a.id)) { if (Math.random() < 0.25) this.particles(a.x, a.y, 34, 1, ELEMENT_COLORS[a.hit.element ?? 'neutre'], 30, 0.2, 2, 30); continue; }
      const col = ELEMENT_COLORS[a.hit.element ?? 'neutre'];
      if (a.hostile) {   // boule d'un monstre : cerclée de rouge pour qu'on la repère et qu'on l'esquive
        const h = ISO.toScreen(a.x, a.y, 30), t = ISO.toScreen(a.x - a.dx * 30, a.y - a.dy * 30, 30);
        top.lineStyle(8, col, 0.35); top.lineBetween(t.x, t.y, h.x, h.y);
        top.fillStyle(col, 1); top.fillCircle(h.x, h.y, a.width * 0.75);
        top.lineStyle(2, 0xe0402a, 1); top.strokeCircle(h.x, h.y, a.width * 0.75 + 1);
        top.fillStyle(0xffffff, 0.9); top.fillCircle(h.x - 2, h.y - 2, a.width * 0.25);
        if (Math.random() < 0.4) this.particles(a.x, a.y, 30, 1, col, 30, 0.25, 2, 30);
        continue;
      }
      const h = ISO.toScreen(a.x, a.y, 34), t = ISO.toScreen(a.x - a.dx * 46, a.y - a.dy * 46, 34);
      top.lineStyle(a.explode ? 7 : 5, col, 0.55); top.lineBetween(t.x, t.y, h.x, h.y);
      top.lineStyle(2, 0xffffff, 1); top.lineBetween((t.x + h.x) / 2, (t.y + h.y) / 2, h.x, h.y);
      if (Math.random() < 0.4) this.particles(a.x, a.y, 34, 1, col, 40, 0.25, 2, 40);
    }
    for (const tg of telegraphs) {
      const col = tg.danger ? 0xe0402a : 0xf0b030, k = tg.progress;
      if (tg.kind === 'circle') {
        g.fillStyle(col, 0.12); g.fillPoints(isoCircle(tg.x, tg.y, tg.r), true);
        g.fillStyle(col, 0.28); g.fillPoints(isoCircle(tg.x, tg.y, tg.r * k), true);
        g.lineStyle(2, col, 0.8); g.strokePoints(isoCircle(tg.x, tg.y, tg.r), true, true);
      } else {
        const c = Math.cos(tg.facing), s = Math.sin(tg.facing), px = -s * tg.w, py = c * tg.w;
        const quad = (L: number) => isoPoly([{ x: tg.x + px, y: tg.y + py }, { x: tg.x + c * L + px, y: tg.y + s * L + py }, { x: tg.x + c * L - px, y: tg.y + s * L - py }, { x: tg.x - px, y: tg.y - py }]);
        g.fillStyle(col, 0.12); g.fillPoints(quad(tg.len), true);
        g.fillStyle(col, 0.3); g.fillPoints(quad(tg.len * k), true);
      }
    }
    for (const r of this.rings) {
      const k = 1 - r.life / r.max, rad = r.r0 + (r.r1 - r.r0) * Phaser.Math.Easing.Cubic.Out(k);
      top.lineStyle(r.width * (1 - k) + 1, r.color, 1 - k); top.strokePoints(isoCircle(r.x, r.y, rad, 36), true, true);
    }
    for (const t of this.trails) {
      const k = t.life / t.max;
      if (t.kind === 'arc') {
        const pts: Vec[] = [], n = 14;
        for (let i = 0; i <= n; i++) { const a = t.facing - t.arc / 2 + (t.arc * i) / n; pts.push(ISO.toScreen(t.x + Math.cos(a) * t.radius, t.y + Math.sin(a) * t.radius, t.z)); }
        top.lineStyle(t.width * k + 1, t.color, 0.35 + 0.65 * k); top.strokePoints(pts, false);
        top.lineStyle((t.width * k) / 3 + 1, 0xffffff, k); top.strokePoints(pts, false);
      } else {
        const a = ISO.toScreen(t.x, t.y, 20), b = ISO.toScreen(t.x + Math.cos(t.facing) * t.length, t.y + Math.sin(t.facing) * t.length, 20);
        top.lineStyle(t.width * k + 2, t.color, k); top.lineBetween(a.x, a.y, b.x, b.y);
        top.lineStyle((t.width * k) / 3 + 1, 0xffffff, k); top.lineBetween(a.x, a.y, b.x, b.y);
      }
    }
    for (const p of this.parts) {
      const s = ISO.toScreen(p.x, p.y, p.z), k = p.life / p.max;
      top.fillStyle(p.color, Math.min(1, k * 1.5)); top.fillRect(s.x - p.size / 2, s.y - p.size / 2, p.size, p.size);
    }
  }
}
