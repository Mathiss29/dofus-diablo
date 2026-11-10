import Phaser from 'phaser';
import { GUERRE } from '../sim/guerre';
import { ISO } from '../sim/iso';
import type { World } from '../sim/world';
import { v } from './assetUrl';
import { ICON_SHEET, iconFrame } from './icons';
import { textureUneFois } from './uneFois';
import { SOL } from './worldView';

const SP = 'assets/sprites';
/** Icône officielle de la Cawotte (objet 361). */
const ICONE = 68031;

/** Guerre des Cawottes (maquette « Guerre : » 6A, 10B, 10C) : l'épouvantail de chaque champ (l'Épouvanteur officiel, figé),
 *  les cawottes plantées, celle qu'emporte un Kiafin, un anneau rouge sous les voleurs et une flèche vers le Kiafin en fuite.
 *  Lecture seule : l'état vient de world.guerre. */
export class GuerreView {
  private epouv: { s: Phaser.GameObjects.Sprite | null; nom: Phaser.GameObjects.Text }[] = [];
  private cawottes: Phaser.GameObjects.Image[] = [];
  private g: Phaser.GameObjects.Graphics;
  private fleche: Phaser.GameObjects.Graphics;
  private t = 0;

  constructor(private scene: Phaser.Scene, private world: World) {
    this.g = scene.add.graphics();
    this.fleche = scene.add.graphics().setDepth(1e6);
    for (const c of world.guerre!.champs) {
      this.epouv.push({ s: null, nom: scene.add.text(0, 0, c.nom, { fontFamily: 'Rowdies, Lexend, sans-serif', fontSize: '15px', color: '#ffe3b0', stroke: '#000', strokeThickness: 4, align: 'center' }).setOrigin(0.5, 1) });
    }
    this.planche();
  }
  private planche() { return textureUneFois(this.scene, 'epouvanteur', l => l.atlas('epouvanteur', v(`${SP}/epouvanteur.avif`), v(`${SP}/epouvanteur.json`))); }
  destroy() { for (const e of this.epouv) { e.s?.destroy(); e.nom.destroy(); } for (const c of this.cawottes) c.destroy(); this.g.destroy(); this.fleche.destroy(); }

  update(dt: number) {
    const G = this.world.guerre;
    if (!G) return;
    this.t += dt;
    const pret = this.planche();
    G.champs.forEach((c, i) => {
      const e = G.epouvantail(i), s = ISO.toScreen(e.x, e.y), E = this.epouv[i];
      if (pret && !E.s && this.scene.textures.get('epouvanteur').has('AnimStatique_1_0')) {
        const tex = this.scene.textures.get('epouvanteur'), meta = (tex.customData as { meta?: { cell: number[]; origin: number[] } }).meta ?? { cell: [1, 1], origin: [0.5, 0.85] };
        E.s = this.scene.add.sprite(0, 0, 'epouvanteur', 'AnimStatique_1_0').setOrigin(meta.origin[0] / meta.cell[0], meta.origin[1] / meta.cell[1]).setScale(0.8);
      }
      E.s?.setPosition(s.x, s.y).setDepth(s.y);
      const r = G.recharges[i], enCours = G.attaque?.i === i;
      E.nom.setPosition(s.x, s.y - 125).setDepth(s.y + 1)
        .setText(`${c.nom}\n${enCours ? 'Attaque en cours !' : r > 0 ? `Repos : ${Math.ceil(r / 60)} min` : 'Clic : lancer l\'attaque'}`)
        .setColor(enCours ? '#ff9a7a' : r > 0 ? '#a89fb6' : '#ffe3b0');
    });
    // cawottes de l'attaque en cours : plantées au sol, ou au-dessus du Kiafin qui l'emporte
    const a = G.attaque, caw = a && !a.fini ? a.cawottes : [];
    while (this.cawottes.length < caw.length) this.cawottes.push(this.scene.add.image(0, 0, ICON_SHEET.key, Math.max(0, iconFrame(ICONE))).setDisplaySize(56, 56).setOrigin(0.5, 0.8));
    this.cawottes.forEach((im, k) => {
      const c = caw[k];
      if (!c || c.etat === 'perdue') { im.setVisible(false); return; }
      const m = c.etat === 'portee' ? this.world.monsters.find(x => x.id === c.porteur) : null;
      const s = m ? ISO.toScreen(m.x, m.y, 70) : ISO.toScreen(c.x, c.y);
      im.setVisible(true).setPosition(s.x, s.y + (m ? Math.sin(this.t * 8) * 3 : 0)).setDepth(s.y + (m ? 200 : 0));
    });
    // 10B : anneau rouge sous chaque voleur ; 10C : flèche du joueur vers le Kiafin en fuite
    const g = this.g.clear(), f = this.fleche.clear();
    if (!a || a.fini) return;
    // une motte claire sous chaque cawotte plantée, pour la voir parmi les décors du champ
    for (const c of a.cawottes) if (c.etat === 'plantee') { const s = ISO.toScreen(c.x, c.y); g.fillStyle(0x5a3415, 0.55).fillEllipse(s.x, s.y, 46, 22).lineStyle(2, 0xffd36b, 0.55 + 0.3 * Math.sin(this.t * 3)).strokeEllipse(s.x, s.y, 50, 24); }
    g.setDepth(SOL + 49);
    const p = this.world.player, ps = ISO.toScreen(p.x, p.y);
    for (const vo of a.voleurs) {
      const m = vo.m;
      if (m.dead) continue;
      const s = ISO.toScreen(m.x, m.y), fuit = !!vo.fuite;
      g.lineStyle(fuit ? 4 : 2, fuit ? 0xff3a2a : 0xd8402f, fuit ? 0.6 + 0.4 * Math.sin(this.t * 10) : 0.7).strokeEllipse(s.x, s.y, 54, 24);
      if (!fuit || Math.hypot(m.x - p.x, m.y - p.y) > GUERRE.champ * 2) continue;
      const dx = s.x - ps.x, dy = s.y - ps.y, d = Math.hypot(dx, dy);
      if (d < 120) continue;
      const ux = dx / d, uy = dy / d, cx = ps.x + ux * 80, cy = ps.y - 40 + uy * 80;
      f.fillStyle(0xff3a2a, 0.85).fillTriangle(cx + ux * 18, cy + uy * 18, cx - uy * 10 - ux * 6, cy + ux * 10 - uy * 6, cx + uy * 10 - ux * 6, cy - ux * 10 - uy * 6);
    }
  }
}
