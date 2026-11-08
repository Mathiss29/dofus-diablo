import Phaser from 'phaser';
import { ISO } from '../sim/iso';
import { FABRICATION } from '../sim/metiers';
import type { World } from '../sim/world';
import { v as url } from './assetUrl';

/** Ateliers (maquette Métiers UI 3A) : chaque machine officielle (four, scie, enclume, plan de travail…) est cliquable et ouvre
 *  la fenêtre Artisanat. Le dessin de la machine est déjà dans le décor ; on pose au-dessus l'icône officielle de l'atelier
 *  (repère de la carte du monde), qui flotte, une bulle au survol et un halo. Barre de fabrication au-dessus du perso (5B).
 *  Lecture seule : le clic passe par l'entrée du joueur (input.atelier). */
const S = 1.1;   // pixels Dofus -> écran du jeu (GridMap.S)
const CLE = (g: number) => `repere_${g}`;
const CSS = `.atbulle{position:fixed;z-index:8;pointer-events:none;transform:translate(-50%,-100%);background:#141210ee;border:1px solid #4a4436;
 border-radius:4px;padding:5px 10px;font:600 13px/1.35 Lexend,Verdana,sans-serif;color:#f4efe0;text-align:center;white-space:nowrap;box-shadow:0 2px 6px #000a}
.atbulle b{display:block;font-size:14px}.atbulle i{font-style:normal;color:#b9e54b;font-size:12px}`;

interface Vue { img: Phaser.GameObjects.Image | null; g: number }

export class AtelierView {
  private vues = new Map<number, Vue>();
  private barre: Phaser.GameObjects.Graphics;
  private bulle: HTMLDivElement;
  survole: number | null = null;
  /** Icône officielle (repère « Atelier des … ») de chaque atelier, par nom. */
  private pictos = new Map<string, number>();
  private demandes = new Set<number>();

  constructor(private scene: Phaser.Scene, private world: World, private dossier: string) {
    this.barre = scene.add.graphics().setDepth(1e6 - 1);
    if (!document.getElementById('atbulle-css')) { const st = document.createElement('style'); st.id = 'atbulle-css'; st.textContent = CSS; document.head.appendChild(st); }
    this.bulle = document.createElement('div'); this.bulle.className = 'atbulle'; this.bulle.style.display = 'none'; document.body.appendChild(this.bulle);
    const reperes = world.worldGrid?.world.reperes ?? [];
    for (const po of world.postes) {
      if (this.pictos.has(po.atelier)) continue;
      const r = reperes.find(x => x.n.startsWith('Atelier') && po.atelier.startsWith(x.n));
      if (r) this.pictos.set(po.atelier, r.g);
    }
  }
  destroy() { for (const v of this.vues.values()) v.img?.destroy(); this.vues.clear(); this.barre.destroy(); this.bulle.remove(); }

  private texture(g: number) {
    const T = this.scene.textures, k = CLE(g);
    if (T.exists(k)) return true;
    if (!this.demandes.has(g)) {
      this.demandes.add(g);
      this.scene.load.image(k, url(`${this.dossier}/${g}.webp`));
      if (!this.scene.load.isLoading()) this.scene.load.start();
    }
    return false;
  }

  /** Point d'accroche à l'écran d'un poste : le haut de la machine (son dessin), sinon un peu au-dessus de la case. */
  private ancre(id: number) {
    const po = this.world.postes.find(x => x.id === id)!, s = ISO.toScreen(po.x, po.y);
    return { x: s.x + (po.dessin?.x ?? 0) * S, y: s.y + (po.dessin?.y ?? 0) * S, machine: po.gfx != null };
  }

  /** Poste sous le curseur : la machine (autour de son dessin) ou l'icône qui flotte au-dessus. */
  sous(ptr: Phaser.Input.Pointer, cam: Phaser.Cameras.Scene2D.Camera): number | null {
    const wp = ptr.positionToCamera(cam) as Phaser.Math.Vector2;
    let best: number | null = null, bd = Infinity;
    for (const po of this.world.postes) {
      const a = this.ancre(po.id);
      if (Math.abs(a.x - wp.x) > 400 || Math.abs(a.y - wp.y) > 400) continue;
      const dansMachine = a.machine && Math.abs(wp.x - a.x) < 55 && wp.y < a.y + 18 && wp.y > a.y - 95;
      const v = this.vues.get(po.id), dansPicto = !!v?.img?.visible && v.img.getBounds().contains(wp.x, wp.y);
      if (!dansMachine && !dansPicto) continue;
      const d = Math.hypot(a.x - wp.x, a.y - 40 - wp.y);
      if (d < bd) { bd = d; best = po.id; }
    }
    return best;
  }
  curseur(): string | null { return this.survole != null ? 'pointer' : null; }

  update(cam: Phaser.Cameras.Scene2D.Camera, ptr: Phaser.Input.Pointer, masque = false) {
    const w = this.world, cx = cam.midPoint.x, cy = cam.midPoint.y;
    this.survole = masque ? null : this.sous(ptr, cam);
    const vus = new Set<number>();
    for (const po of w.postes) {
      const a = this.ancre(po.id);
      if (Math.abs(a.x - cx) > 1500 || Math.abs(a.y - cy) > 1100) continue;
      vus.add(po.id);
      let v = this.vues.get(po.id);
      const g = po.coffre ? 401 : this.pictos.get(po.atelier) ?? 305;   // coffre : repère officiel de la Banque
      if (!v) { v = { img: null, g }; this.vues.set(po.id, v); }
      if (!v.img && this.texture(g)) v.img = this.scene.add.image(0, 0, CLE(g)).setOrigin(0.5, 1);
      if (!v.img) continue;
      const survol = this.survole === po.id, bob = Math.sin(w.time * 2.4 + po.id) * 4;
      v.img.setPosition(a.x, a.y - (a.machine ? 100 : 46) + bob).setDepth(1e6 - 3).setDisplaySize(survol ? 40 : 34, survol ? 40 : 34)
        .setAlpha(survol ? 1 : 0.9);
      if (survol) v.img.setTint(0xe8ffb0); else v.img.clearTint();
    }
    for (const [id, v] of this.vues) if (!vus.has(id)) { v.img?.destroy(); this.vues.delete(id); }
    this.majBulle(cam);
    // barre de fabrication au-dessus du perso (une seconde pour toute la série)
    this.barre.clear();
    const f = w.enFabrication;
    if (f) {
      const p = ISO.toScreen(w.player.x, w.player.y), k = Math.min(1, f.t / FABRICATION.duree);
      this.barre.fillStyle(0x000000, 0.7).fillRoundedRect(p.x - 31, p.y - 128, 62, 9, 3)
        .fillStyle(0xb9e54b, 1).fillRoundedRect(p.x - 30, p.y - 127, 60 * k, 7, 3);
    }
  }

  private majBulle(cam: Phaser.Cameras.Scene2D.Camera) {
    const po = this.survole != null ? this.world.postes.find(x => x.id === this.survole) : null;
    if (!po) { this.bulle.style.display = 'none'; return; }
    const M = this.world.opts.items?.metiers ?? {};
    if (this.bulle.dataset.cle !== String(po.id)) {
      this.bulle.dataset.cle = String(po.id);
      this.bulle.innerHTML = po.coffre ? `<b>${po.atelier}</b><i>Clic : ouvrir (partagé par tes persos)</i>`
        : `<b>${po.atelier}</b><i>Clic : fabriquer (${po.metiers.map(m => M[m]?.name ?? m).join(', ')})</i>`;
    }
    const a = this.ancre(po.id), rect = this.scene.game.canvas.getBoundingClientRect(), k = rect.width / this.scene.scale.width;
    const x = (a.x - cam.worldView.x) * cam.zoom, y = (a.y - (a.machine ? 130 : 76) - cam.worldView.y) * cam.zoom;
    this.bulle.style.left = `${rect.left + x * k}px`; this.bulle.style.top = `${rect.top + y * k}px`; this.bulle.style.display = '';
  }
}
