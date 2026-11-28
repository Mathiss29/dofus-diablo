import Phaser from 'phaser';
import { ISO } from '../sim/iso';
import type { Player } from '../sim/player';
import type { World } from '../sim/world';
import { PLANCHES, RACES, ZONES, type Famille } from '../sim/montures';
import { EntityView } from './entityView';
import { v } from './assetUrl';
import { teindre } from './teinteFamilier';

/** Montures de la 0.7 (17A, 17C) : la planche grise officielle de la famille (mont_639 Dragodinde, mont_3588 Muldo,
 *  tools/extraction/montures_export.py), teinte aux couleurs officielles de la race grâce à sa carte des zones,
 *  dessinée sous chaque joueur monté. Le cavalier (EntityView) est levé jusqu'à la selle et ses jambes cachées. */

/** Échelle d'une monture à l'écran (planches à l'échelle 2,5 des monstres : un peu plus haute que le perso). */
export const ECHELLE_MONTURE = 0.55;
/** Hauteur de la selle au-dessus du pied, en pixels de planche. */
const SELLE: Record<Famille, number> = { dragodinde: 128, muldo: 120 };
/** Hauteur de la selle (pixels à l'écran) et part de la hauteur du cavalier (jambes) rognée : ses hanches se posent sur la selle. */
export function selle(race: string): { haut: number; jambes: number } | null {
  const r = RACES[race];
  return r ? { haut: SELLE[r.famille] * ECHELLE_MONTURE, jambes: 0.4 } : null;
}

interface Vue { sprite: Phaser.GameObjects.Sprite; ombre: Phaser.GameObjects.Image; cle: string; counts: Record<string, number>; t: number }

export class MontureView {
  private vues = new Map<number, Vue>();
  private demandees = new Set<string>();

  constructor(private scene: Phaser.Scene, private charger: (atlas: string) => boolean) {}

  maj(w: World, dt: number, visible: (p: Player) => boolean) {
    const vus = new Set<number>();
    for (const p of w.players) {
      const race = p.montee, r = race && RACES[race];
      if (!r || p.dead || !visible(p)) continue;
      const planche = PLANCHES[r.famille];
      if (!this.charger(planche)) continue;
      const cle = this.texture(planche, r.famille, race);
      let vu = this.vues.get(p.id);
      if (!vu || vu.cle !== cle) { vu?.sprite.destroy(); vu?.ombre.destroy(); vu = this.nouvelle(cle); this.vues.set(p.id, vu); }
      vus.add(p.id);
      vu.t += dt;
      const fd = ISO.toScreen(Math.cos(p.facing), Math.sin(p.facing)), back = fd.y < -0.05, flip = back ? fd.x > 0 : fd.x < 0;
      const o = back ? 5 : 1, nom = p.anim === 'run' && vu.counts[`AnimCourse_${o}`] ? `AnimCourse_${o}` : `AnimStatique_${o}`;
      const n = vu.counts[nom] || 1;
      vu.sprite.setFrame(`${nom}_${Math.floor(vu.t * 30) % n}`);
      const s = ISO.toScreen(p.x, p.y);
      // juste derrière le cavalier, assis dessus (ses jambes sont rognées)
      vu.sprite.setVisible(true).setPosition(s.x, s.y).setDepth(s.y - 0.5).setScale(flip ? -ECHELLE_MONTURE : ECHELLE_MONTURE, ECHELLE_MONTURE);
      if (EntityView.ambiance !== 0xffffff) vu.sprite.setTint(EntityView.ambiance); else vu.sprite.clearTint();
      vu.ombre.setVisible(true).setPosition(s.x, s.y).setDisplaySize(90, 40).setDepth(s.y - 2);
    }
    for (const [id, vu] of this.vues) if (!vus.has(id)) { vu.sprite.setVisible(false); vu.ombre.setVisible(false); }
  }

  private nouvelle(cle: string): Vue {
    const tex = this.scene.textures.get(cle), names = tex.getFrameNames(), counts: Record<string, number> = {};
    for (const name of names) { const k = name.replace(/_\d+$/, ''); counts[k] = (counts[k] || 0) + 1; }
    const meta = (tex.customData as { meta?: { cell: number[]; origin: number[] } }).meta ?? { cell: [1, 1], origin: [0.5, 0.9] };
    const sprite = this.scene.add.sprite(0, 0, cle, names[0]).setOrigin(meta.origin[0] / meta.cell[0], meta.origin[1] / meta.cell[1]);
    const ombre = this.scene.add.image(0, 0, EntityView.ombre(this.scene)).setAlpha(0.28);
    return { sprite, ombre, cle, counts, t: 0 };
  }

  /** Copie de la planche grise teinte aux couleurs de la race (une par race), sinon la planche grise en attendant la carte. */
  private texture(planche: string, fam: Famille, race: string): string {
    const zones = ZONES[fam], cle = `${planche}_r${race}`, tx = this.scene.textures;
    if (!zones) return planche;
    if (tx.exists(cle)) return cle;
    const zk = `${planche}_zones`;
    if (!tx.exists(zk)) {
      if (!this.demandees.has(zk)) {
        this.demandees.add(zk);
        // image chargée à part : ne dépend pas du chargeur de la scène (qui peut être occupé longtemps en monde ouvert)
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => { if (!tx.exists(zk)) tx.addImage(zk, img); };
        img.onerror = () => this.demandees.delete(zk);
        img.src = v(`assets/sprites/${zones}`);
      }
      return planche;
    }
    const base = tx.get(planche);
    if (base.source.length !== 1) return planche;
    const img = base.getSourceImage() as HTMLImageElement, zim = tx.get(zk).getSourceImage() as HTMLImageElement;
    if (img.width !== zim.width || img.height !== zim.height) return planche;
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const x = cv.getContext('2d', { willReadFrequently: true })!;
    try {
      x.drawImage(zim, 0, 0); const carte = x.getImageData(0, 0, cv.width, cv.height).data;
      x.clearRect(0, 0, cv.width, cv.height); x.drawImage(img, 0, 0);
      const px = x.getImageData(0, 0, cv.width, cv.height);
      teindre(px.data, carte, RACES[race].teinte); x.putImageData(px, 0, 0);
    } catch { return planche; }
    const t = tx.addCanvas(cle, cv)!;
    for (const n of base.getFrameNames()) {
      const f = base.get(n), g = t.add(n, 0, f.cutX, f.cutY, f.cutWidth, f.cutHeight);
      if (g && f.trimmed) g.setTrim(f.realWidth, f.realHeight, f.x, f.y, f.width, f.height);
    }
    t.customData = base.customData;
    return cle;
  }

  destroy() { for (const vu of this.vues.values()) { vu.sprite.destroy(); vu.ombre.destroy(); } this.vues.clear(); }
}
