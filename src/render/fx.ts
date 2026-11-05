import Phaser from 'phaser';
import { ISO, type Vec } from '../sim/iso';
import { TAU } from '../sim/math';
import type { Element } from '../sim/defs';
import type { SimEvent, Telegraph } from '../sim/events';
import type { Projectile } from '../sim/world';

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Points d'un cercle du sol projeté (= ellipse à l'écran). */
export function isoCircle(cx: number, cy: number, r: number, n = 28): Vec[] {
  const pts: Vec[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU; pts.push(ISO.toScreen(cx + Math.cos(a) * r, cy + Math.sin(a) * r)); }
  return pts;
}
const isoPoly = (pts: { x: number; y: number; z?: number }[]) => pts.map(p => ISO.toScreen(p.x, p.y, p.z ?? 0));

/** Couleur des effets selon l'élément du sort (terre, feu, eau, air). */
const ELEMENT_COLORS: Record<Element, number> = { neutre: 0xffe9c4, terre: 0xd9a35a, feu: 0xff6a3d, eau: 0x5fb4ff, air: 0x8fe07a, meilleur: 0xffe9c4 };

interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; color: number; size: number }
type Trail =
  | { kind: 'arc'; x: number; y: number; z: number; facing: number; radius: number; arc: number; color: number; width: number; life: number; max: number }
  | { kind: 'line'; x: number; y: number; facing: number; length: number; width: number; color: number; life: number; max: number };
interface Ring { x: number; y: number; r0: number; r1: number; color: number; life: number; max: number; width: number }

/** Effets visuels : particules, traînées, anneaux, chiffres de dégâts, télégraphes.
 *  Purement cosmétique : utilise Math.random() librement, rien ici n'influe sur la partie. */
export class FX {
  /** Touche F : effets d'impact (gel, tremblement, particules pleines). */
  juice = true;
  private ground: Phaser.GameObjects.Graphics;
  private top: Phaser.GameObjects.Graphics;
  private parts: Particle[] = [];
  private trails: Trail[] = [];
  private rings: Ring[] = [];

  constructor(private scene: Phaser.Scene, private colorOf: (monster: string) => number) {
    this.ground = scene.add.graphics().setDepth(-5000);   // télégraphes au sol
    this.top = scene.add.graphics().setDepth(1e6);        // traînées, particules
  }

  /** Traduit un événement de la simulation en effets. */
  handle(e: SimEvent) {
    switch (e.k) {
      case 'spell': {
        const col = ELEMENT_COLORS[e.element], w = e.big ? 16 : 10;
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
          this.number(e.x, e.y, e.z, e.amount, e.crit);
          this.particles(e.x, e.y, e.z / 2, e.crit ? 14 : 8, e.crit ? 0xffd23f : 0xffffff, 240, 0.35, 3, 160);
        } else {
          this.number(e.x, e.y, e.z, e.amount, false, '#ff6b5b');
          this.particles(e.x, e.y, 20, 10, 0xd2412f, 200, 0.4);
        }
        break;
      case 'kill':
        this.particles(e.x, e.y, e.radius, 22, this.colorOf(e.monster), 300, 0.6, 4, 300);
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
  number(x: number, y: number, z: number, value: number, crit: boolean, color?: string) {
    const p = ISO.toScreen(x, y, z);
    const t = this.scene.add.text(p.x + rand(-8, 8), p.y, String(value), {
      fontFamily: 'Trebuchet MS, Verdana, sans-serif', fontSize: crit ? '26px' : '17px', fontStyle: 'bold',
      color: color ?? (crit ? '#ffd23f' : '#ffffff'), stroke: '#1a0f0a', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(1e6 + 1);
    t.setScale(crit ? 1.6 : 1.25);
    this.scene.tweens.add({ targets: t, scale: crit ? 1.1 : 0.9, duration: 120, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: t, y: t.y - (crit ? 50 : 36), alpha: 0, delay: 250, duration: 450, ease: 'Cubic.In', onComplete: () => t.destroy() });
  }

  update(dt: number) {
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
  }

  draw(telegraphs: readonly Telegraph[], arrows: readonly Projectile[] = []) {
    const g = this.ground, top = this.top;
    g.clear(); top.clear();
    // Flèches en vol : un trait lumineux de la couleur de l'élément, à hauteur d'arc
    for (const a of arrows) {
      const col = ELEMENT_COLORS[a.hit.element ?? 'neutre'];
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
