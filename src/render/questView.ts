import Phaser from 'phaser';
import { v } from './assetUrl';
import { ISO } from '../sim/iso';
import type { QueteType, Quetes } from '../sim/quests';
import type { World } from '../sim/world';
import type { WorldView } from './worldView';
import { PNJ_LOOKS, type PnjLook } from './looks';
import { EntityView } from './entityView';

const SP = 'assets/sprites', QI = 'assets/ui/quetes';
/** Animations « fun » des PNJ : une toutes les FUN_PAUSE secondes environ (tirage au poids officiel). */
const FUN_PAUSE: [number, number] = [5, 12], FPS = 25;
/** Icônes officielles en couleur au-dessus des PNJ (uidarkstone_all) : quête à donner (!) ou à rendre (?). */
export const QUEST_ICON: Record<QueteType, [string, string]> = {
  tutoriel: ['questInitiation', 'questObjective'], principale: ['questPrincipale', 'questPrincipaleObjective'],
  secondaire: ['quest', 'questObjective'], prime: ['questRepeatable', 'questRepeatableObjective'], evenement: ['questEvent', 'questObjective'],
};
const STYLE = { fontFamily: 'Lexend, Verdana, sans-serif' };

interface PnjSprite {
  id: string; img: Phaser.GameObjects.Sprite; name: Phaser.GameObjects.Text; icon: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Graphics;
  x: number; y: number; tag: string; h: number; L: PnjLook; key: string; prochainFun: number;
}

/** PNJ des quêtes dans le monde : sprite officiel, nom, icône de quête au-dessus, bulle de dialogue (5A).
 *  Lit world.quetes ; ne modifie rien (le clic passe par l'entrée du joueur : input.talk). */
export class QuestView {
  static preload(scene: Phaser.Scene, quetes: { pnj: Record<string, { sprite?: string }> }) {
    for (const id of new Set(Object.entries(quetes.pnj).map(([k, d]) => d.sprite ?? k))) if (!scene.textures.exists(`pnj_${id}`)) scene.load.multiatlas(`pnj_${id}`, v(`${SP}/pnj_${id}.json`), `${SP}/`);
    for (const [a, b] of Object.values(QUEST_ICON)) for (const k of [a, b]) if (!scene.textures.exists(`qi_${k}`)) scene.load.image(`qi_${k}`, v(`${QI}/${k}.png`));
  }

  private pnjs: PnjSprite[] = [];
  /** PNJ survolé (contour doré, 8A). */
  survole: string | null = null;
  private glow: { id: string; fx: Phaser.FX.Glow } | null = null;
  private bulle: { bg: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text; nom: Phaser.GameObjects.Text; pnj: string; texte: string } | null = null;

  constructor(private scene: Phaser.Scene, private world: World, private wv: WorldView | null) {
    const q = world.quetes!;
    for (const p of q.pnjs) {
      const sp = p.def.sprite ?? p.id, key = `pnj_${sp}`;
      if (!scene.textures.exists(key)) continue;
      const L = PNJ_LOOKS[sp] ?? { scale: 0.82, anim: 'AnimStatique_1' };
      const s = ISO.toScreen(p.x, p.y);
      const img = scene.add.sprite(s.x, s.y, key, `${L.anim}_0`).setScale(L.scale);
      const tex = scene.textures.get(key), nb = (a: string) => tex.getFrameNames().filter(f => f.startsWith(a + '_')).length;
      if (L.boucle && !scene.anims.exists(`${key}_idle`)) {
        scene.anims.create({ key: `${key}_idle`, frames: Array.from({ length: L.boucle }, (_, i) => ({ key, frame: `${L.anim}_${i}` })), frameRate: 24, repeat: -1 });
      }
      if (L.boucle) img.play(`${key}_idle`);
      for (const [a] of L.fun ?? []) if (!scene.anims.exists(`${key}_${a}`) && nb(a)) {
        scene.anims.create({ key: `${key}_${a}`, frames: Array.from({ length: nb(a) }, (_, i) => ({ key, frame: `${a}_${i}` })), frameRate: FPS });
      }
      // la fin d'une animation fun ramène la pose de repos
      img.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => img.setFrame(`${L.anim}_0`));
      // pivot de la planche = pieds du perso (origin de trim_pack)
      const meta = (scene.textures.get(key).customData as { meta?: { cell?: number[]; origin?: number[] } } | undefined)?.meta;
      if (meta?.cell && meta.origin) img.setOrigin(meta.origin[0] / meta.cell[0], meta.origin[1] / meta.cell[1]);
      // hauteur du corps au-dessus des pieds (pour le nom et l'icône)
      const top = (img.frame as unknown as { data: { spriteSourceSize?: { y: number } } }).data.spriteSourceSize?.y ?? 0;
      const h = ((meta?.origin?.[1] ?? img.frame.realHeight) - top) * L.scale;
      const name = scene.add.text(s.x, s.y, p.def.nom, { ...STYLE, fontSize: '13px', fontStyle: 'bold', color: '#f1ecd8', stroke: '#14130f', strokeThickness: 3 }).setOrigin(0.5, 1);
      const icon = scene.add.image(s.x, s.y, 'qi_quest').setVisible(false);
      const shadow = scene.add.graphics();   // même ombre au sol que le perso et les monstres (EntityView)
      this.pnjs.push({ id: p.id, img, name, icon, shadow, x: p.x, y: p.y, tag: p.tag, h: Math.min(h, 230), L, key,
        prochainFun: world.time + Phaser.Math.FloatBetween(1, FUN_PAUSE[1]) });
    }
  }

  /** Pieds et hauteur du corps d'un PNJ visible (coordonnées dessinées) : la bulle de dialogue s'y accroche. */
  ancre(id: string): { x: number; y: number; h: number } | null {
    const p = this.pnjs.find(x => x.id === id);
    if (!p || !p.img.visible) return null;
    const s = ISO.toScreen(p.x, p.y);
    return { x: s.x, y: s.y, h: p.h };
  }
  /** Image du PNJ pour la fiche de cible (2C) : texture et cadre de sa planche. */
  portrait(id: string): { key: string; frame: string } | null {
    const p = this.pnjs.find(x => x.id === id);
    return p ? { key: p.img.texture.key, frame: p.img.frame.name } : null;
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
    // contour doré du PNJ survolé (WebGL seulement)
    if (this.glow?.id !== this.survole) {
      if (this.glow) this.pnjs.find(x => x.id === this.glow!.id)?.img.preFX?.remove(this.glow.fx);
      const n = this.survole ? this.pnjs.find(x => x.id === this.survole) : null;
      const fx = n?.img.preFX?.addGlow(0xf2d36b, 3, 0, false, 0.1, 10);
      this.glow = n && fx ? { id: n.id, fx } : null;
    }
    for (const p of this.pnjs) {
      const on = !this.wv || this.wv.isReady(p.tag);
      const s = ISO.toScreen(p.x, p.y);
      p.img.setVisible(on).setPosition(s.x, s.y).setDepth(s.y);
      if (EntityView.ambiance !== 0xffffff) p.img.setTint(EntityView.ambiance); else p.img.clearTint();   // lumière du jour/soir/nuit
      const w = Math.min(70, Math.max(34, p.img.frame.realWidth * p.L.scale * 0.7));
      p.shadow.clear().setVisible(on).setDepth(s.y - 1).fillStyle(0x000000, 0.28).fillEllipse(s.x, s.y, w, w * 0.45);
      // de temps en temps, une animation « fun » officielle tirée au poids (comme dans Dofus)
      if (on && p.L.fun?.length && t >= p.prochainFun) {
        p.prochainFun = t + Phaser.Math.FloatBetween(...FUN_PAUSE);
        const tot = p.L.fun.reduce((n, [, w]) => n + w, 0); let r = Math.random() * tot;
        const pick = p.L.fun.find(([, w]) => (r -= w) < 0) ?? p.L.fun[0];
        if (this.scene.anims.exists(`${p.key}_${pick[0]}`) && !p.img.anims.isPlaying) p.img.play(`${p.key}_${pick[0]}`);
      }
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
    if (!b || !n || !n.img.visible) { this.bulle?.bg.destroy(); this.bulle?.text.destroy(); this.bulle?.nom.destroy(); this.bulle = null; return; }
    if (!this.bulle || this.bulle.pnj !== b.pnj || this.bulle.texte !== b.texte) {
      this.bulle?.bg.destroy(); this.bulle?.text.destroy(); this.bulle?.nom.destroy();
      const text = this.scene.add.text(0, 0, b.texte, { ...STYLE, fontSize: '13px', fontStyle: 'bold', color: '#f4efe0', wordWrap: { width: 230 }, align: 'center' }).setOrigin(0.5, 1);
      const nom = this.scene.add.text(0, 0, q.data.pnj[b.pnj]?.nom ?? '', { ...STYLE, fontSize: '12px', fontStyle: 'bold', color: '#f2d36b' }).setOrigin(0.5, 1);
      this.bulle = { bg: this.scene.add.graphics(), text, nom, pnj: b.pnj, texte: b.texte };
    }
    const s = ISO.toScreen(n.x, n.y), by = s.y - n.h - 50, T = this.bulle.text, N = this.bulle.nom, w = Math.max(T.width, N.width) + 20, h = T.height + N.height + 16;
    T.setPosition(s.x, by).setDepth(1e6).setAlpha(Math.min(1, b.t * 2));
    N.setPosition(s.x, by - T.height - 2).setDepth(1e6).setAlpha(Math.min(1, b.t * 2));
    const g = this.bulle.bg.clear().setDepth(1e6 - 1).setAlpha(Math.min(1, b.t * 2));
    g.fillStyle(0x1b1711, 0.95); g.lineStyle(2, 0xf1ecd8, 1);   // style sombre officiel (Dialogues 7B)
    g.fillRoundedRect(s.x - w / 2, by - h + 7, w, h, 8); g.strokeRoundedRect(s.x - w / 2, by - h + 7, w, h, 8);
    g.fillTriangle(s.x - 8, by + 6, s.x + 8, by + 6, s.x, by + 16); g.lineBetween(s.x - 8, by + 7, s.x, by + 16); g.lineBetween(s.x + 8, by + 7, s.x, by + 16);
    // la grande bulle à réponses remplace la petite pendant un dialogue avec ce PNJ
    const cache = q.dialogue?.pnj === b.pnj; T.setVisible(!cache); N.setVisible(!cache); g.setVisible(!cache);
  }
}
