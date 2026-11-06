import Phaser from 'phaser';
import { ISO } from '../sim/iso';
import { RECOLTE } from '../sim/recolte';
import type { World } from '../sim/world';
import { ICON_SHEET, iconFrame } from './icons';

/** Ressources à récolter (métiers, 0.2b) : l'icône officielle de la ressource posée à son emplacement officiel, un reflet doré
 *  pour les dorées, presque effacée tant qu'elle repousse ; barre du geste de récolte au-dessus du perso.
 *  Les animations des ressources ne sont pas dans le client de Dofus 3 (voir tools/contenu/recoltes.py). Lecture seule. */
interface Vue { icon: Phaser.GameObjects.Image; sol: Phaser.GameObjects.Ellipse }
export class RecolteView {
  private vues = new Map<number, Vue>();
  private barre: Phaser.GameObjects.Graphics;
  survolee: number | null = null;
  static readonly VUE = 1500;

  constructor(private scene: Phaser.Scene, private world: World) {
    this.barre = scene.add.graphics().setDepth(1e6 - 1);
  }
  destroy() { for (const v of this.vues.values()) { v.icon.destroy(); v.sol.destroy(); } this.vues.clear(); this.barre.destroy(); }

  /** Ressource prête sous le curseur (coordonnées de la caméra). */
  sous(ptr: Phaser.Input.Pointer, cam: Phaser.Cameras.Scene2D.Camera): number | null {
    const wp = ptr.positionToCamera(cam) as Phaser.Math.Vector2;
    let best: number | null = null, bd = 30;
    for (const [id, v] of this.vues) {
      if (!v.icon.visible || v.icon.alpha < 0.5) continue;
      const d = Math.hypot(v.icon.x - wp.x, v.icon.y - wp.y);
      if (d < bd) { bd = d; best = id; }
    }
    return best;
  }

  update(cam: Phaser.Cameras.Scene2D.Camera, ptr: Phaser.Input.Pointer) {
    const w = this.world, R = w.opts.recoltes, cx = cam.midPoint.x, cy = cam.midPoint.y;
    if (!R) return;
    this.survolee = this.sous(ptr, cam);
    const vus = new Set<number>();
    for (const r of w.recoltes) {
      const s = ISO.toScreen(r.x, r.y);
      if (Math.abs(s.x - cx) > RecolteView.VUE || Math.abs(s.y - cy) > RecolteView.VUE * 0.7) continue;
      vus.add(r.id);
      let v = this.vues.get(r.id);
      if (!v) {
        const def = R.ressources[r.item];
        v = { sol: this.scene.add.ellipse(s.x, s.y, 40, 16, 0x000000, 0.28),
          icon: this.scene.add.image(s.x, s.y - 20, ICON_SHEET.key, Math.max(0, iconFrame(def?.icone ?? 0))).setDisplaySize(40, 40) };
        this.vues.set(r.id, v);
      }
      const prete = r.repousse <= 0, bob = prete ? Math.sin(w.time * 2 + r.id) * 2 : 0, survol = this.survolee === r.id;
      v.sol.setPosition(s.x, s.y).setDepth(s.y - 2).setFillStyle(r.dore && prete ? 0xffd34a : 0x000000, r.dore && prete ? 0.45 + Math.sin(w.time * 4 + r.id) * 0.15 : 0.28);
      v.icon.setPosition(s.x, s.y - 20 - bob).setDepth(s.y).setAlpha(prete ? 1 : 0.22).setDisplaySize(survol ? 46 : 40, survol ? 46 : 40);
      if (r.dore && prete) v.icon.setTint(0xffe7a0); else if (survol) v.icon.setTint(0xe8ffb0); else v.icon.clearTint();
    }
    // hors de vue : on libère (des milliers de ressources dans Astrub)
    for (const [id, v] of this.vues) if (!vus.has(id)) { v.icon.destroy(); v.sol.destroy(); this.vues.delete(id); }
    // barre du geste au-dessus du perso
    this.barre.clear();
    const g = w.enRecolte;
    if (g) {
      const p = ISO.toScreen(w.player.x, w.player.y), k = Math.min(1, g.t / RECOLTE.duree);
      this.barre.fillStyle(0x000000, 0.7).fillRoundedRect(p.x - 31, p.y - 128, 62, 9, 3)
        .fillStyle(0x9ad15a, 1).fillRoundedRect(p.x - 30, p.y - 127, 60 * k, 7, 3);
    }
  }
}
