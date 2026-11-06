import Phaser from 'phaser';
import { ISO } from '../sim/iso';
import type { SimEvent } from '../sim/events';
import { World } from '../sim/world';

/** Havre-Sac (maquette Hub) : barre d'incantation au-dessus du perso (2A, touche H) et compteur de dégâts par seconde
 *  au-dessus du Poutch Ingball (7A). Lecture seule : la partie se lit, les coups arrivent par les événements. */
export class HavreSacView {
  private barre: Phaser.GameObjects.Graphics;
  private dps: Phaser.GameObjects.Text | null = null;
  /** Coups reçus par le Poutch : temps (s) et dégâts, sur les 10 dernières secondes. */
  private coups: { t: number; n: number }[] = [];
  private dernier = 0;
  private majT = 0;

  constructor(scene: Phaser.Scene, private world: World) {
    this.barre = scene.add.graphics().setDepth(1e6 - 1);
    if (world.poutch != null) this.dps = scene.add.text(0, 0, '', { fontFamily: 'Rowdies, Lexend, sans-serif', fontSize: '15px', color: '#ffd34a', align: 'center', stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5, 1).setDepth(1e6 - 2);
  }
  destroy() { this.barre.destroy(); this.dps?.destroy(); }

  handle(e: SimEvent) {
    if (e.k === 'hit' && e.target === 'monster' && e.id === this.world.poutch) { this.coups.push({ t: this.world.time, n: e.amount }); this.dernier = e.amount; }
  }

  update(dt: number) {
    const w = this.world;
    this.barre.clear();
    const inc = w.incantation;
    if (inc) {
      const p = ISO.toScreen(w.player.x, w.player.y), k = Math.min(1, inc.t / World.INCANTATION);
      this.barre.fillStyle(0x000000, 0.7).fillRoundedRect(p.x - 31, p.y - 128, 62, 9, 3)
        .fillStyle(0x6fb2e8, 1).fillRoundedRect(p.x - 30, p.y - 127, 60 * k, 7, 3);
    }
    const m = this.dps && w.monsters.find(o => o.id === w.poutch);
    if (!this.dps || !m) return;
    const s = ISO.toScreen(m.x, m.y);
    this.dps.setPosition(s.x, s.y - 150);
    if ((this.majT -= dt) > 0) return;
    this.majT = 0.25;
    this.coups = this.coups.filter(c => w.time - c.t <= 10);
    if (!this.coups.length) { this.dps.setText('Poutch Ingball\nfrappe-le !'); return; }
    const total = this.coups.reduce((a, c) => a + c.n, 0), d = Math.max(1, Math.min(10, w.time - this.coups[0].t));
    this.dps.setText(`${Math.round(total / d)} DPS\ndernier coup ${this.dernier}`);
  }
}
