import Phaser from 'phaser';
import { ISO } from '../sim/iso';
import type { FamilierDef } from '../sim/items';
import type { World } from '../sim/world';
import { FAMILIERS, ITEMS } from '../sim/data';
import { EntityView } from './entityView';

/** Hauteur affichée d'un familier (px à l'écran au zoom 1) : petit à côté du perso, quelle que soit la taille de sa planche. */
const HAUTEUR = 52;

/** Le familier porté (maquette Familiers 4A) : sa planche officielle (repos + course, fam_<squelette>), chargée à la demande.
 *  Un familier d'apparat (5A) remplace seulement le dessin. Les familiers sans animation de course glissent en sautillant. */
export class FamilierView {
  private sprite?: Phaser.GameObjects.Sprite;
  private ombre: Phaser.GameObjects.Graphics;
  private planche = '';
  private counts: Record<string, number> = {};
  private echelle = 1;
  private t = 0;
  private dir = { back: false, flip: false };

  constructor(private scene: Phaser.Scene, private charger: (atlas: string) => boolean) {
    this.ombre = scene.add.graphics();
  }

  /** La fiche du familier à dessiner : celle de l'apparat posé, sinon celle du familier porté. */
  private fiche(w: World): FamilierDef | undefined {
    const p = w.player, a = p.apparat.familier;
    if (a && a !== '0') return FAMILIERS.familiers[a];
    const it = p.equipment.familier;
    return it && ITEMS.equipment[it.id]?.familier;
  }

  maj(w: World, dt: number) {
    const f = w.familier, d = f && w.player.apparat.familier !== '0' ? this.fiche(w) : undefined;
    if (!f || !d || !this.charger(d.planche)) { this.sprite?.setVisible(false); this.ombre.clear(); return; }
    if (this.planche !== d.planche) this.nouvelle(d);
    const s = this.sprite!;
    this.t += dt;
    const bouge = Math.hypot(f.vx, f.vy) > 15;
    const vers = bouge ? ISO.toScreen(f.vx, f.vy) : ISO.toScreen(w.player.x - f.x, w.player.y - f.y);
    if (Math.hypot(vers.x, vers.y) > 2) this.dir = { back: vers.y < -0.05, flip: vers.y < -0.05 ? vers.x > 0 : vers.x < 0 };
    const o = this.dir.back ? 5 : 1;
    const course = d.anims.find(a => a.endsWith(`_${o}`) && !a.startsWith('AnimStatique'));
    let nom = bouge && course ? course : `AnimStatique_${o}`;
    if (!this.counts[nom]) nom = this.counts[`AnimStatique_1`] ? 'AnimStatique_1' : Object.keys(this.counts)[0];
    const n = this.counts[nom] || 1, img = Math.floor(this.t * 25) % n;
    s.setFrame(`${nom}_${img}`);
    const hop = bouge && !course ? Math.abs(Math.sin(this.t * 12)) * 6 : 0;   // pas de course officielle : petits sauts
    const p = ISO.toScreen(f.x, f.y);
    s.setVisible(true).setPosition(p.x, p.y - hop).setDepth(p.y).setScale(this.dir.flip ? -this.echelle : this.echelle, this.echelle);
    if (EntityView.ambiance !== 0xffffff) s.setTint(EntityView.ambiance); else s.clearTint();
    this.ombre.clear().setDepth(p.y - 1).fillStyle(0x000000, 0.25).fillEllipse(p.x, p.y, 30, 13);
  }

  private nouvelle(d: FamilierDef) {
    this.sprite?.destroy();
    const tex = this.scene.textures.get(d.planche), names = tex.getFrameNames();
    this.counts = {};
    for (const name of names) { const k = name.replace(/_\d+$/, ''); this.counts[k] = (this.counts[k] || 0) + 1; }
    const meta = (tex.customData as { meta?: { cell: number[]; origin: number[] } }).meta ?? { cell: [1, 1], origin: [0.5, 0.9] };
    // échelle : la hauteur du repos (au-dessus du pied) ramenée à HAUTEUR
    const f0 = tex.get(names.find(n => n.startsWith('AnimStatique')) ?? names[0]);
    const haut = Math.max(20, meta.origin[1] - ((f0 as unknown as { data: { spriteSourceSize: { y: number } } }).data.spriteSourceSize?.y ?? 0));
    this.echelle = Math.min(0.6, HAUTEUR / haut);
    this.sprite = this.scene.add.sprite(0, 0, d.planche, names[0]).setOrigin(meta.origin[0] / meta.cell[0], meta.origin[1] / meta.cell[1]);
    this.planche = d.planche;
  }

  destroy() { this.sprite?.destroy(); this.ombre.destroy(); }
}
