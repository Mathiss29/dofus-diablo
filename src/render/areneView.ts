import Phaser from 'phaser';
import { ISO } from '../sim/iso';
import type { World } from '../sim/world';

/** Arène d'un donjon (maquette « Donjons en vagues » 13A) : à la mort du boss, le portail de sortie (il ramène devant
 *  le gardien) et le coffre du donjon à côté. Lecture seule : l'état vient de world.arene. */
export class AreneView {
  private portail: Phaser.GameObjects.Graphics;
  private coffre: Phaser.GameObjects.Graphics;
  private nom: Phaser.GameObjects.Text;
  private t = 0;

  constructor(scene: Phaser.Scene, private world: World) {
    this.portail = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.coffre = scene.add.graphics().setVisible(false);
    this.nom = scene.add.text(0, 0, 'Sortie', { fontFamily: 'Rowdies, Lexend, sans-serif', fontSize: '15px', color: '#cfe8ff', stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5, 1).setVisible(false);
  }
  destroy() { this.portail.destroy(); this.coffre.destroy(); this.nom.destroy(); }

  update(dt: number) {
    const a = this.world.arene, vu = !!a?.fini;
    this.portail.setVisible(vu); this.coffre.setVisible(vu); this.nom.setVisible(vu);
    if (!a || !vu) { this.t = 0; return; }
    this.t += dt;
    const k = Math.min(1, this.t / 0.6);   // le portail s'ouvre en 0,6 s
    // portail : anneaux de lumière bleue qui tournent au-dessus d'un cercle au sol
    const s = ISO.toScreen(a.pts.sortie.x, a.pts.sortie.y), g = this.portail.clear().setDepth(s.y + 1);
    const R = 46 * k, H = 110 * k;
    g.fillStyle(0x3a8fe0, 0.25).fillEllipse(s.x, s.y, R * 2.4, R * 1.2);
    for (let i = 0; i < 4; i++) {
      const ph = this.t * 2.2 + i * Math.PI / 2, w = R * (1.1 + 0.18 * Math.sin(ph)), h = H * (1 + 0.05 * Math.cos(ph));
      g.lineStyle(4 - i * 0.6, i % 2 ? 0x8fd3ff : 0x4aa8ff, 0.55 - i * 0.08).strokeEllipse(s.x, s.y - h / 2, w, h);
    }
    g.fillStyle(0x9fe0ff, 0.18 + 0.08 * Math.sin(this.t * 5)).fillEllipse(s.x, s.y - H / 2, R * 0.9, H * 0.85);
    this.nom.setPosition(s.x, s.y - H - 6).setDepth(s.y + 2).setAlpha(k);
    // coffre : caisse en bois cerclée d'or ; couvercle levé et lueur dorée une fois ouvert
    const c = ISO.toScreen(a.pts.coffre.x, a.pts.coffre.y), q = this.coffre.clear().setDepth(c.y);
    const W = 52, Hc = 30, x = c.x - W / 2, y = c.y - Hc - 6;
    q.fillStyle(0x000000, 0.3).fillEllipse(c.x, c.y, W * 1.3, 16);
    q.fillStyle(0x6b3f1d, 1).fillRoundedRect(x, y, W, Hc, 4);
    q.fillStyle(0x8a5428, 1).fillRect(x + 3, y + 3, W - 6, Hc - 10);
    q.fillStyle(0xe2b13c, 1).fillRect(x, y + 8, W, 4).fillRect(x + W / 2 - 4, y + 4, 8, 12);
    if (a.coffreOuvert) {
      q.fillStyle(0xffe08a, 0.35 + 0.15 * Math.sin(this.t * 4)).fillEllipse(c.x, y - 4, W * 1.1, 26);
      q.fillStyle(0x5a3418, 1).fillRoundedRect(x - 2, y - 24, W + 4, 12, 4);
    } else {
      q.fillStyle(0x7a4a22, 1).fillRoundedRect(x - 2, y - 12, W + 4, 14, { tl: 10, tr: 10, bl: 2, br: 2 });
      q.fillStyle(0xe2b13c, 1).fillRect(x - 2, y - 2, W + 4, 3);
    }
  }
}
