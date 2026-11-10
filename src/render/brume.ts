import Phaser from 'phaser';
import type { World } from '../sim/world';

/** « Wabbits : 12A » : la nuit, l'îlot des Tombeaux se réveille. Brume verdâtre sur l'écran et halos verts qui flottent
 *  (feux follets), seulement dehors, la nuit, dans les sous-zones listées. Lecture seule. */
const SOUS_ZONES = new Set([163]);
export class BrumeNuit {
  private voile: Phaser.GameObjects.Graphics;
  private halos: Phaser.GameObjects.Graphics;
  private a = 0;
  private t = 0;
  private feux = Array.from({ length: 9 }, (_, i) => ({ dx: Math.cos(i * 2.4) * (200 + i * 45), dy: Math.sin(i * 2.4) * (130 + i * 30), p: i * 0.7 }));

  constructor(private scene: Phaser.Scene, private world: World) {
    this.voile = scene.add.graphics().setDepth(9e5);
    this.halos = scene.add.graphics().setDepth(9e5 + 1).setBlendMode(Phaser.BlendModes.ADD);
  }
  destroy() { this.voile.destroy(); this.halos.destroy(); }

  update(dt: number) {
    const w = this.world, p = w.player, m = w.worldGrid?.mapAt(p.x, p.y);
    const ici = !!m && !m.inside && SOUS_ZONES.has(m.sub) && w.estNuit();
    this.a += ((ici ? 1 : 0) - this.a) * Math.min(1, dt * 1.5);
    this.t += dt;
    const v = this.voile.clear(), h = this.halos.clear();
    if (this.a < 0.01) return;
    const r = this.scene.cameras.main.worldView;
    v.fillStyle(0x1f4a3a, 0.28 * this.a).fillRect(r.x - 50, r.y - 50, r.width + 100, r.height + 100);
    const cx = r.centerX, cy = r.centerY;
    for (const f of this.feux) {
      const x = cx + f.dx + Math.sin(this.t * 0.4 + f.p) * 60, y = cy + f.dy + Math.cos(this.t * 0.3 + f.p) * 40, k = 0.6 + 0.4 * Math.sin(this.t * 2 + f.p);
      h.fillStyle(0x4dff9a, 0.08 * this.a * k).fillCircle(x, y, 46);
      h.fillStyle(0x9affc8, 0.35 * this.a * k).fillCircle(x, y, 7);
    }
  }
}
