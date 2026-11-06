import Phaser from 'phaser';
import { ISO } from '../sim/iso';
import { RECOLTE } from '../sim/recolte';
import type { World } from '../sim/world';
import { ICON_SHEET, iconFrame } from './icons';

/** Ressources à récolter (métiers, 0.2b) : l'icône officielle de la ressource posée à son emplacement officiel, un reflet doré
 *  pour les dorées, presque effacée tant qu'elle repousse ; barre du geste de récolte au-dessus du perso.
 *  Les animations des ressources ne sont pas dans le client de Dofus 3 (voir tools/contenu/recoltes.py). Lecture seule. */
interface Vue { icon: Phaser.GameObjects.Image; sol: Phaser.GameObjects.Ellipse }
/** Curseur officiel de l'outil du métier (icons_assets de Dofus 3), comme dans le jeu : faux, hache, pioche, filet. */
const OUTIL: Record<string, string> = { paysan: 'faux', alchimiste: 'faux', bucheron: 'hache', mineur: 'pioche', pecheur: 'filet' };
const CSS = `.rcbulle{position:fixed;z-index:8;pointer-events:none;transform:translate(-50%,-100%);background:#141210ee;border:1px solid #4a4436;
 border-radius:4px;padding:5px 10px;font:600 13px/1.35 Lexend,Verdana,sans-serif;color:#f4efe0;text-align:center;white-space:nowrap;box-shadow:0 2px 6px #000a}
.rcbulle b{display:block;font-size:14px}.rcbulle .ko{color:#ff6b5a}.rcbulle .dore{color:#ffd34a}.rcbulle i{font-style:normal;color:#a8a290;font-size:12px}`;
export class RecolteView {
  private vues = new Map<number, Vue>();
  private barre: Phaser.GameObjects.Graphics;
  private bulle: HTMLDivElement;
  survolee: number | null = null;
  static readonly VUE = 1500;

  constructor(private scene: Phaser.Scene, private world: World) {
    this.barre = scene.add.graphics().setDepth(1e6 - 1);
    if (!document.getElementById('rcbulle-css')) { const st = document.createElement('style'); st.id = 'rcbulle-css'; st.textContent = CSS; document.head.appendChild(st); }
    this.bulle = document.createElement('div'); this.bulle.className = 'rcbulle'; this.bulle.style.display = 'none'; document.body.appendChild(this.bulle);
  }
  destroy() { for (const v of this.vues.values()) { v.icon.destroy(); v.sol.destroy(); } this.vues.clear(); this.barre.destroy(); this.bulle.remove(); }

  /** Curseur CSS sur la ressource survolée (outil de son métier), sinon null. */
  curseur(): string | null {
    const r = this.survolee != null ? this.world.recoltes.find(x => x.id === this.survolee) : null;
    const m = r && this.world.opts.recoltes?.ressources[r.item]?.metier;
    return m ? `url(assets/ui/curseurs/${OUTIL[m] ?? 'faux'}.png) 4 4, pointer` : null;
  }

  /** Bulle au survol, comme dans Dofus : nom de la ressource, métier et niveau requis (en rouge s'il manque des niveaux). */
  private majBulle(cam: Phaser.Cameras.Scene2D.Camera) {
    const R = this.world.opts.recoltes, id = this.survolee, v = id != null ? this.vues.get(id) : null;
    const r = id != null ? this.world.recoltes.find(x => x.id === id) : null, def = r && R?.ressources[r.item];
    if (!R || !v || !r || !def) { this.bulle.style.display = 'none'; return; }
    const lv = Math.max(1, this.world.player.metierLevel(def.metier)), metier = R.metiers[def.metier]?.nom ?? def.metier;
    const cle = `${id}:${lv}:${r.dore}`;
    if (this.bulle.dataset.cle !== cle) {
      this.bulle.dataset.cle = cle;
      this.bulle.innerHTML = `<b${r.dore ? ' class="dore"' : ''}>${def.nom}${r.dore ? ' dorée' : ''}</b><span${lv < def.niveau ? ' class="ko"' : ''}>${metier} - Niv ${def.niveau}</span>`
        + (lv < def.niveau ? `<br><i>Votre niveau : ${lv}</i>` : '');
    }
    const rect = this.scene.game.canvas.getBoundingClientRect(), k = rect.width / this.scene.scale.width;
    const x = (v.icon.x - cam.worldView.x) * cam.zoom, y = (v.icon.y - 26 - cam.worldView.y) * cam.zoom;
    this.bulle.style.left = `${rect.left + x * k}px`; this.bulle.style.top = `${rect.top + y * k}px`; this.bulle.style.display = '';
  }

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
    this.majBulle(cam);
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
