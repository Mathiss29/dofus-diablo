import Phaser from 'phaser';
import { SIEGE } from '../sim/siege07';
import { ISO } from '../sim/iso';
import type { World } from '../sim/world';
import { SOL } from './worldView';

/** Siège des Zoths (0.7, 6A) : la plaque de la place (cercle doré, texte « Clic : défendre le village » ou l'attente),
 *  la Pierre du village pendant le siège (anneau qui se vide, rouge quand elle faiblit) et un anneau rouge sous chaque Zoth.
 *  Lecture seule : l'état vient de world.siege. */
export class SiegeView {
  private g: Phaser.GameObjects.Graphics;
  private nom: Phaser.GameObjects.Text;
  private t = 0;
  constructor(scene: Phaser.Scene, private world: World) {
    this.g = scene.add.graphics().setDepth(SOL + 49);
    this.nom = scene.add.text(0, 0, '', { fontFamily: 'Rowdies, Lexend, sans-serif', fontSize: '15px', color: '#ffe3b0', stroke: '#000', strokeThickness: 4, align: 'center' }).setOrigin(0.5, 1);
  }
  destroy() { this.g.destroy(); this.nom.destroy(); }

  update(dt: number) {
    const S = this.world.siege;
    if (!S) return;
    this.t += dt;
    const c = ISO.toScreen(S.coeur.x, S.coeur.y), p = this.world.player, g = this.g.clear();
    const loin = Math.hypot(p.x - S.coeur.x, p.y - S.coeur.y) > SIEGE.place * 2.5;
    this.nom.setVisible(!loin);
    if (loin) return;
    const k = S.pierre / SIEGE.pierre, rx = 120, ry = 58;
    if (S.enCours) {
      const col = k > 0.6 ? 0xffd36b : k > 0.3 ? 0xff9a3a : 0xff3a2a;
      g.lineStyle(6, 0x000000, 0.45).strokeEllipse(c.x, c.y, rx, ry);
      // la Pierre : un arc qui se vide dans le sens des aiguilles d'une montre
      g.lineStyle(5, col, 0.9).beginPath();
      const n = Math.max(2, Math.ceil(48 * k));
      for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / 48) * Math.PI * 2, x = c.x + Math.cos(a) * rx / 2, y = c.y + Math.sin(a) * ry / 2; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
      g.strokePath();
      for (const a of S.assaillants) { if (a.m.dead) continue; const s = ISO.toScreen(a.m.x, a.m.y); g.lineStyle(2, 0xd8402f, 0.7).strokeEllipse(s.x, s.y, 54, 24); }
      this.nom.setText(`Pierre du village : ${Math.ceil(S.pierre)} / ${SIEGE.pierre}\nVague ${S.vague} · ${Math.ceil(S.reste)} s`).setColor(k > 0.3 ? '#ffe3b0' : '#ff9a7a');
    } else {
      const att = S.attente(p);
      g.lineStyle(3, att > 0 ? 0xa89fb6 : 0xffd36b, att > 0 ? 0.4 : 0.55 + 0.3 * Math.sin(this.t * 3)).strokeEllipse(c.x, c.y, rx, ry);
      this.nom.setText(`${S.d.nom}\n${att > 0 ? `Les Zoths reprennent des forces : ${Math.ceil(att / 60)} min` : 'Clic : défendre le village (3 min)'}`).setColor(att > 0 ? '#a89fb6' : '#ffe3b0');
    }
    this.nom.setPosition(c.x, c.y - 50).setDepth(c.y + 1);
  }
}
