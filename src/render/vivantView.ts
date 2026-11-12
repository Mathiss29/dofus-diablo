import Phaser from 'phaser';
import { ISO } from '../sim/iso';
import type { World } from '../sim/world';
import type { VueVivant } from '../sim/mondeVivant';
import { dossier, v } from './assetUrl';
import { textureUneFois } from './uneFois';
import { EntityView } from './entityView';

const SP = 'assets/sprites';
const MALLE = { atlas: 'coffre_malle', echelle: 0.55 };
const STYLE = { fontFamily: 'Lexend, Verdana, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#e8dcff', stroke: '#14130f', strokeThickness: 4, align: 'center' };

interface Coffre { sp: Phaser.GameObjects.Sprite | null; lueur: Phaser.GameObjects.Graphics; nom: Phaser.GameObjects.Text }

/** 0.5 « monde vivant » : coffre d'invasion (7B), coffre gardé (8B) et habitant à défendre (8A). Lecture seule (world.vueVivant). */
export class VivantView {
  private coffres = new Map<string, Coffre>();
  private habitants = new Map<number, { sp: Phaser.GameObjects.Sprite; barre: Phaser.GameObjects.Graphics; nom: Phaser.GameObjects.Text }>();
  private t = 0;
  constructor(private scene: Phaser.Scene, private world: World) {}

  private planche(a: string) { return textureUneFois(this.scene, a, l => l.multiatlas(a, v(`${SP}/${a}.json`), dossier(`${SP}/`))); }

  update(dt: number) {
    this.t += dt;
    const vv: VueVivant | null = this.world.vueVivant, vus = new Set<string>(), habs = new Set<number>();
    const inv = vv?.invasion;
    if (inv?.coffre) { vus.add('inv'); this.coffre('inv', inv.coffre, 0xb07bff, `Coffre d'invasion\n${inv.nom}`); }
    for (const e of vv?.evenements ?? []) {
      if (e.sorte === 'coffre' && e.fin !== 'reussi') { vus.add(`e${e.id}`); this.coffre(`e${e.id}`, e, 0xffd36b, e.fin ? '' : 'Coffre gardé'); }
      if (e.sorte === 'defense' && e.habitant && !e.fin) { habs.add(e.id); this.habitant(e.id, e.habitant, e.nom, e.x, e.y, e.pv); }
    }
    for (const [k, c] of this.coffres) if (!vus.has(k)) { c.sp?.destroy(); c.lueur.destroy(); c.nom.destroy(); this.coffres.delete(k); }
    for (const [k, h] of this.habitants) if (!habs.has(k)) { h.sp.destroy(); h.barre.destroy(); h.nom.destroy(); this.habitants.delete(k); }
  }

  private coffre(cle: string, pos: { x: number; y: number }, couleur: number, nom: string) {
    let c = this.coffres.get(cle);
    if (!c) { c = { sp: null, lueur: this.scene.add.graphics(), nom: this.scene.add.text(0, 0, '', STYLE).setOrigin(0.5, 1) }; this.coffres.set(cle, c); }
    const s = ISO.toScreen(pos.x, pos.y), pulse = 0.5 + 0.5 * Math.sin(this.t * 3);
    c.lueur.clear().setDepth(s.y - 1).fillStyle(couleur, 0.22 + 0.14 * pulse).fillEllipse(s.x, s.y, 120, 50)
      .lineStyle(2, couleur, 0.5 + 0.3 * pulse).strokeEllipse(s.x, s.y, 120 + 10 * pulse, 50 + 4 * pulse)
      .fillStyle(couleur, 0.18).fillRect(s.x - 8, s.y - 170, 16, 170);   // faisceau, visible de loin
    c.nom.setText(nom).setPosition(s.x, s.y - 90).setDepth(s.y + 2).setColor(couleur === 0xb07bff ? '#e3d4ff' : '#ffe3b0');
    if (!this.planche(MALLE.atlas)) return;
    if (!c.sp) {
      const tex = this.scene.textures.get(MALLE.atlas), meta = (tex.customData as { meta?: { cell: number[]; origin: number[] } }).meta ?? { cell: [1, 1], origin: [0.5, 0.85] };
      c.sp = this.scene.add.sprite(0, 0, MALLE.atlas, 'AnimStatique_1_0').setOrigin(meta.origin[0] / meta.cell[0], meta.origin[1] / meta.cell[1]).setScale(MALLE.echelle);
    }
    c.sp.setPosition(s.x, s.y).setDepth(s.y).setTint(EntityView.ambiance);
  }

  private habitant(id: number, hab: string, nom: string, x: number, y: number, pv: number) {
    const a = `hab_${hab}`;
    let h = this.habitants.get(id);
    if (!h) {
      if (!this.planche(a)) return;
      const n = this.scene.textures.get(a).has('AnimStatiqueExplo0_1_0') ? 'AnimStatiqueExplo0_1_0' : this.scene.textures.get(a).getFrameNames()[0];
      h = { sp: this.scene.add.sprite(0, 0, a, n).setOrigin(0.5, 0.85).setScale(0.82 * 0.7 / 0.5), barre: this.scene.add.graphics(), nom: this.scene.add.text(0, 0, nom, { ...STYLE, color: '#ffe3b0' }).setOrigin(0.5, 1) };
      this.habitants.set(id, h);
    }
    const s = ISO.toScreen(x, y), f = Math.max(0, Math.min(1, pv / 100)), w = 60, top = s.y - 130;
    h.sp.setPosition(s.x, s.y).setDepth(s.y).setTint(f < 0.3 && Math.sin(this.t * 12) > 0 ? 0xff8080 : EntityView.ambiance);
    h.barre.clear().setDepth(s.y + 2).fillStyle(0x000000, 0.8).fillRect(s.x - w / 2 - 1, top - 1, w + 2, 7).fillStyle(0x58c048, 1).fillRect(s.x - w / 2, top, w * f, 5);
    h.nom.setPosition(s.x, top - 3).setDepth(s.y + 2);
  }

  destroy() {
    for (const c of this.coffres.values()) { c.sp?.destroy(); c.lueur.destroy(); c.nom.destroy(); }
    for (const h of this.habitants.values()) { h.sp.destroy(); h.barre.destroy(); h.nom.destroy(); }
    this.coffres.clear(); this.habitants.clear();
  }
}
