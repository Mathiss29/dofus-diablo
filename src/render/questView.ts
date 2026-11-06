import Phaser from 'phaser';
import { v } from './assetUrl';
import { ISO } from '../sim/iso';
import type { QueteType, Quetes } from '../sim/quests';
import type { World } from '../sim/world';
import type { WorldView } from './worldView';

const SP = 'assets/sprites', QI = 'assets/ui/quetes';
/** Échelle et animation de repos des PNJ (planches tools/extraction/monster_planche.py, PNJ=1). Ganymède est rendu à
 *  l'échelle 1 (gros squelette) et n'a que l'orientation 3. */
const PNJ_LOOK: Record<string, { scale: number; anim: string; frames?: number }> = {
  ganymede: { scale: 1.1, anim: 'AnimStatique_3', frames: 60 },
};
/** Icônes officielles en couleur au-dessus des PNJ (uidarkstone_all) : quête à donner (!) ou à rendre (?). */
export const QUEST_ICON: Record<QueteType, [string, string]> = {
  tutoriel: ['questInitiation', 'questObjective'], principale: ['questPrincipale', 'questPrincipaleObjective'],
  secondaire: ['quest', 'questObjective'], prime: ['questRepeatable', 'questRepeatableObjective'], evenement: ['questEvent', 'questObjective'],
};
const STYLE = { fontFamily: 'Trebuchet MS, Verdana, sans-serif' };

interface PnjSprite { id: string; img: Phaser.GameObjects.Sprite; name: Phaser.GameObjects.Text; icon: Phaser.GameObjects.Image; x: number; y: number; tag: string; h: number }

/** PNJ des quêtes dans le monde : sprite officiel, nom, icône de quête au-dessus, bulle de dialogue (5A).
 *  Lit world.quetes ; ne modifie rien (le clic passe par l'entrée du joueur : input.talk). */
export class QuestView {
  static preload(scene: Phaser.Scene, quetes: { pnj: Record<string, { sprite?: string }> }) {
    for (const id of new Set(Object.entries(quetes.pnj).map(([k, d]) => d.sprite ?? k))) if (!scene.textures.exists(`pnj_${id}`)) scene.load.multiatlas(`pnj_${id}`, v(`${SP}/pnj_${id}.json`), `${SP}/`);
    for (const [a, b] of Object.values(QUEST_ICON)) for (const k of [a, b]) if (!scene.textures.exists(`qi_${k}`)) scene.load.image(`qi_${k}`, v(`${QI}/${k}.png`));
  }

  private pnjs: PnjSprite[] = [];
  private bulle: { bg: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text; pnj: string; texte: string } | null = null;

  constructor(private scene: Phaser.Scene, private world: World, private wv: WorldView | null) {
    const q = world.quetes!;
    for (const p of q.pnjs) {
      const sp = p.def.sprite ?? p.id, key = `pnj_${sp}`;
      if (!scene.textures.exists(key)) continue;
      const L = PNJ_LOOK[sp] ?? { scale: 0.62, anim: 'AnimStatique_1' };
      const s = ISO.toScreen(p.x, p.y);
      const img = scene.add.sprite(s.x, s.y, key, `${L.anim}_0`).setScale(L.scale);
      if (L.frames && !scene.anims.exists(`${key}_idle`)) {
        scene.anims.create({ key: `${key}_idle`, frames: Array.from({ length: L.frames }, (_, i) => ({ key, frame: `${L.anim}_${i}` })), frameRate: 24, repeat: -1 });
      }
      if (L.frames) img.play(`${key}_idle`);
      // pivot de la planche = pieds du perso (origin de trim_pack)
      const meta = (scene.textures.get(key).customData as { meta?: { cell?: number[]; origin?: number[] } } | undefined)?.meta;
      if (meta?.cell && meta.origin) img.setOrigin(meta.origin[0] / meta.cell[0], meta.origin[1] / meta.cell[1]);
      // hauteur du corps au-dessus des pieds (pour le nom et l'icône)
      const top = (img.frame as unknown as { data: { spriteSourceSize?: { y: number } } }).data.spriteSourceSize?.y ?? 0;
      const h = ((meta?.origin?.[1] ?? img.frame.realHeight) - top) * L.scale;
      const name = scene.add.text(s.x, s.y, p.def.nom, { ...STYLE, fontSize: '13px', fontStyle: 'bold', color: '#f1ecd8', stroke: '#14130f', strokeThickness: 3 }).setOrigin(0.5, 1);
      const icon = scene.add.image(s.x, s.y, 'qi_quest').setVisible(false);
      this.pnjs.push({ id: p.id, img, name, icon, x: p.x, y: p.y, tag: p.tag, h: Math.min(h, 230) });
    }
  }

  /** PNJ sous le curseur (corps dessiné ou pieds). */
  pnjUnder(ptr: Phaser.Input.Pointer, cam: Phaser.Cameras.Scene2D.Camera): string | null {
    const wp = ptr.positionToCamera(cam) as Phaser.Math.Vector2;
    for (const p of this.pnjs) {
      if (!p.img.visible) continue;
      const s = ISO.toScreen(p.x, p.y);
      if (Math.abs(wp.x - s.x) < 34 && wp.y < s.y + 14 && wp.y > s.y - p.h - 10) return p.id;
    }
    return null;
  }

  update() {
    const q = this.world.quetes as Quetes, t = this.world.time;
    for (const p of this.pnjs) {
      const on = !this.wv || this.wv.isReady(p.tag);
      const s = ISO.toScreen(p.x, p.y);
      p.img.setVisible(on).setPosition(s.x, s.y).setDepth(s.y);
      p.name.setVisible(on).setPosition(s.x, s.y - p.h - 4).setDepth(1e6 - 2);
      const ic = q.icone(p.id) ?? (q.attendParler(p.id) ? { quete: q.attendParler(p.id)!, rendre: true } : null);
      if (ic && on) {
        const [give, back] = QUEST_ICON[q.def(ic.quete).type];
        p.icon.setTexture(`qi_${ic.rendre ? back : give}`).setVisible(true);
        const k = 34 / Math.max(p.icon.width, p.icon.height);
        p.icon.setScale(k).setPosition(s.x, s.y - p.h - 34 + Math.sin(t * 3) * 3).setDepth(1e6 - 2);
      } else p.icon.setVisible(false);
    }
    // bulle du PNJ qui parle (le jeu continue, 5A)
    const b = q.bulle, n = b && this.pnjs.find(x => x.id === b.pnj);
    if (!b || !n || !n.img.visible) { this.bulle?.bg.destroy(); this.bulle?.text.destroy(); this.bulle = null; return; }
    if (!this.bulle || this.bulle.pnj !== b.pnj || this.bulle.texte !== b.texte) {
      this.bulle?.bg.destroy(); this.bulle?.text.destroy();
      const text = this.scene.add.text(0, 0, b.texte, { ...STYLE, fontSize: '13px', color: '#2a2418', wordWrap: { width: 230 }, align: 'center' }).setOrigin(0.5, 1);
      this.bulle = { bg: this.scene.add.graphics(), text, pnj: b.pnj, texte: b.texte };
    }
    const s = ISO.toScreen(n.x, n.y), by = s.y - n.h - 50, T = this.bulle.text, w = T.width + 20, h = T.height + 14;
    T.setPosition(s.x, by).setDepth(1e6).setAlpha(Math.min(1, b.t * 2));
    const g = this.bulle.bg.clear().setDepth(1e6 - 1).setAlpha(Math.min(1, b.t * 2));
    g.fillStyle(0xf4ecd2, 0.96); g.lineStyle(2, 0x6a5a3a, 1);
    g.fillRoundedRect(s.x - w / 2, by - h + 7, w, h, 8); g.strokeRoundedRect(s.x - w / 2, by - h + 7, w, h, 8);
    g.fillTriangle(s.x - 8, by + 6, s.x + 8, by + 6, s.x, by + 16); g.lineBetween(s.x - 8, by + 7, s.x, by + 16); g.lineBetween(s.x + 8, by + 7, s.x, by + 16);
  }
}
