import Phaser from 'phaser';
import { ISO } from '../sim/iso';
import { World } from '../sim/world';
import type { Monster } from '../sim/monster';

/** Calques de la partie de test (maquette « Panneau test » 4B, 4C) : hitbox et rayon de réveil des monstres, état de leur IA.
 *  Purement affichage : on lit la partie, on ne la change pas. */
export interface CalquesActifs { aggro: boolean; ia: boolean }

const ETATS: Record<Monster['state'], string> = {
  spawn: 'apparition', idle: 'au calme', return: 'retour', chase: 'poursuite', windup: 'prépare', lunge: 'attaque', recover: 'reprend',
};
/** Au-delà, on ne dessine rien (px du monde) : seuls les monstres autour du perso comptent. */
const PORTEE = 1400;

export class CalquesTest {
  private g: Phaser.GameObjects.Graphics | null = null;
  private textes: Phaser.GameObjects.Text[] = [];
  constructor(private scene: Phaser.Scene) {}

  dessiner(w: World, c: CalquesActifs) {
    const g = this.g ??= this.scene.add.graphics().setDepth(1e6 - 20);
    g.clear();
    let n = 0;
    if (c.aggro || c.ia) {
      const p = w.player, open = w.zone.open, ell = (x: number, y: number, r: number) => { const s = ISO.toScreen(x, y); return [s.x, s.y, r * 2 * Math.SQRT2, r * Math.SQRT2] as const; };
      for (const m of w.monsters) {
        if (m.dead || Math.abs(m.x - p.x) + Math.abs(m.y - p.y) > PORTEE) continue;
        const dort = !!open && m.state === 'idle' && w.players.every(q => Math.abs(m.x - q.x) + Math.abs(m.y - q.y) > World.SOMMEIL);
        if (c.aggro) {
          // rayon de réveil (seulement pour ceux qui attendent), puis la hitbox
          if (open && (m.state === 'idle' || m.state === 'return') && !m.mannequin) {
            g.lineStyle(1.5, 0xe0605a, 0.55); g.fillStyle(0xe0605a, 0.05);
            const [x, y, lw, lh] = ell(m.x, m.y, m.def.aggro ?? open.aggro ?? 250);
            g.fillEllipse(x, y, lw, lh); g.strokeEllipse(x, y, lw, lh);
          }
          g.lineStyle(1.5, 0x6fcf97, 0.9);
          const [x, y, lw, lh] = ell(m.x, m.y, m.radius); g.strokeEllipse(x, y, lw, lh);
        }
        if (c.ia) {
          const cible = m.state === 'idle' || m.state === 'spawn' ? null : w.cibleDe(m);
          const vers = !cible ? '' : cible === p ? ' → toi' : 'owner' in cible ? ' → bête' : ' → allié';
          const txt = `${m.def.name} · ${dort ? 'endormi' : ETATS[m.state]}${vers}${m.stun > 0 ? ' · étourdi' : ''}`;
          const s = ISO.toScreen(m.x, m.y, m.radius * 2 + 46);
          const t = this.textes[n] ??= this.scene.add.text(0, 0, '', { fontFamily: 'Lexend, sans-serif', fontSize: '11px', color: '#ffd9d2', backgroundColor: '#3a1a14cc', padding: { x: 4, y: 1 } }).setOrigin(0.5, 1).setDepth(1e6 - 19);
          t.setText(txt).setPosition(Math.round(s.x), Math.round(s.y)).setVisible(true);
          n++;
        }
      }
      if (c.aggro) { g.lineStyle(1.5, 0x5ab4ff, 0.9); const [x, y, lw, lh] = ell(p.x, p.y, p.radius); g.strokeEllipse(x, y, lw, lh); }
    }
    for (let i = n; i < this.textes.length; i++) this.textes[i].setVisible(false);
  }
  destroy() { this.g?.destroy(); for (const t of this.textes) t.destroy(); this.textes = []; this.g = null; }
}
