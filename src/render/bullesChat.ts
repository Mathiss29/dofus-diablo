// Bulles du chat (« Social : » 4B) : quand quelqu'un parle près de toi (Tout, Groupe, Bastion), sa phrase flotte au-dessus de
// sa tête quelques secondes : toi, les joueurs de ton groupe, et les passants du Bastion.
import Phaser from 'phaser';
import { EnLigne, type MessageChat } from './presence';
import { LIEN, lireLien } from './chatOutils';
import { ISO } from '../sim/iso';
import type { World } from '../sim/world';

interface Bulle { m: MessageChat; txt: Phaser.GameObjects.Text; fin: number }
const DUREE = 6000;

export class BullesChat {
  private bulles = new Map<number, Bulle>();
  private fin: () => void;
  constructor(private scene: Phaser.Scene) {
    this.fin = EnLigne.lire(m => this.nouveau(m));
  }
  private nouveau(m: MessageChat) {
    if (m.canal === 'prive' || m.canal === 'infos' || m.id == null) return;
    this.bulles.get(m.id)?.txt.destroy();
    const brut = m.texte.replace(LIEN, (_t, id, r, st, l) => { const o = lireLien(id, r, st, l); return o ? `[${o.nom}]` : '[objet]'; });   // « Tchat : » 6A
    const texte = brut.length > 90 ? brut.slice(0, 88) + '…' : brut;
    const txt = this.scene.add.text(0, 0, texte, {
      fontFamily: 'Lexend, sans-serif', fontSize: '12px', color: '#1d1b16', backgroundColor: '#f4efe0ee',
      padding: { x: 7, y: 4 }, wordWrap: { width: 200 }, align: 'center',
    }).setOrigin(0.5, 1).setVisible(false);
    this.bulles.set(m.id, { m, txt, fin: performance.now() + DUREE });
  }
  /** À chaque image : chaque bulle suit la tête de celui qui parle (s'il est là). */
  maj(w: World, miroir: boolean) {
    const t = performance.now();
    for (const [id, b] of this.bulles) {
      if (t > b.fin) { b.txt.destroy(); this.bulles.delete(id); continue; }
      let pos: { x: number; y: number } | null = null;
      if (id === EnLigne.moi) pos = w.player;
      else {
        const p = w.dansBastion && !miroir ? EnLigne.passants.get(id) : undefined;
        pos = p ?? w.players.find(q => q !== w.player && q.nom === b.m.de) ?? null;
      }
      if (!pos) { b.txt.setVisible(false); continue; }
      const s = ISO.toScreen(pos.x, pos.y);
      b.txt.setPosition(Math.round(s.x), Math.round(s.y - 128)).setDepth(s.y + 3).setVisible(true).setAlpha(Math.min(1, (b.fin - t) / 500));
    }
  }
  destroy() { this.fin(); for (const b of this.bulles.values()) b.txt.destroy(); this.bulles.clear(); }
}
