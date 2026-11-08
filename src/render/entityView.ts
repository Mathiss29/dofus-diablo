import Phaser from 'phaser';
import { ISO } from '../sim/iso';
import { clamp } from '../sim/math';
import type { Entity } from '../sim/entity';
import type { Monster } from '../sim/monster';
import type { Look } from './looks';
import { PersoVivant } from './persoVivant';

/** Affiche une entité de la simulation avec sa planche de sprites.
 *  Orientations de Dofus : _0 droite, _1 bas-droite, _2 bas, _5 haut-gauche, _6 haut ; les autres par miroir
 *  (_3 = _1, _4 = _0, _7 = _5). La course et le repos ont les 5 orientations, donc 8 directions ;
 *  les attaques n'ont que _1 et _5, donc les 4 diagonales. */
const MIRROR: Record<number, number> = { 3: 1, 4: 0, 7: 5 };
/** Produit de deux teintes 0xRRGGBB. */
function mulTint(a: number, b: number) {
  const c = (s: number) => Math.round((((a >> s) & 255) * ((b >> s) & 255)) / 255) << s;
  return c(16) | c(8) | c(0);
}

export class EntityView {
  /** Teinte d'ambiance des personnages et des monstres (render/ambiance.ts : plus légère que celle des cartes, ils ressortent la nuit). */
  static ambiance = 0xffffff;
  /** Maj enfoncée (maquette Osamodas 14B) : barre de vie au-dessus de chaque bête, même pleine. */
  static barresAllies = false;
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly shadow: Phaser.GameObjects.Graphics;
  private readonly counts: Record<string, number> = {};
  /** Images du perso vivant plus fines que celles des planches : le sprite est réduit d'autant. */
  private k = 1;

  /** `vivant` : perso du joueur dessiné en direct depuis son squelette (apparence choisie à la création). */
  constructor(scene: Phaser.Scene, readonly look: Look, private vivant?: PersoVivant) {
    if (vivant) {
      Object.assign(this.counts, vivant.compte);
      const [k, f] = vivant.image('AnimStatiqueExplo0_1', 0), [cw, ch] = PersoVivant.CELLULE, [ox, oy] = PersoVivant.PIED;
      this.sprite = scene.add.sprite(0, 0, k, f).setOrigin(ox / cw, oy / ch).setScale(look.scale / PersoVivant.RESOLUTION);
      this.k = 1 / PersoVivant.RESOLUTION;
    } else {
      const tex = scene.textures.get(look.atlas);
      const names = tex.getFrameNames();
      for (const name of names) { const k = name.replace(/_\d+$/, ''); this.counts[k] = (this.counts[k] || 0) + 1; }
      // meta.origin = pied du personnage dans la cellule de la planche (écrit par trim_pack.py)
      const meta = (tex.customData as { meta?: { cell: number[]; origin: number[] } }).meta ?? { cell: [1, 1], origin: [0.5, 0.9] };
      this.sprite = scene.add.sprite(0, 0, look.atlas, names[0])
        .setOrigin(meta.origin[0] / meta.cell[0], meta.origin[1] / meta.cell[1]).setScale(look.scale);
    }
    this.bar = scene.add.graphics();
    this.shadow = scene.add.graphics();   // ombre dessinée par le jeu (celle de Dofus laissait une croix)
  }

  /** Perso réassemblé (nouvel objet porté, apparat, garde-robe) : les images suivantes viennent du nouveau. */
  changerVivant(v: PersoVivant) { this.vivant = v; Object.assign(this.counts, v.compte); }

  /** Hors de l'écran : rien à dessiner (on ne recalcule pas l'animation). */
  hide() { this.sprite.setVisible(false); this.bar.setVisible(false); this.shadow.setVisible(false); }
  sync(e: Entity) {
    if (!this.sprite.visible) { this.sprite.setVisible(true); this.bar.setVisible(true); this.shadow.setVisible(true); }
    const L = this.look, p = ISO.toScreen(e.x, e.y);
    const fd = ISO.toScreen(Math.cos(e.facing), Math.sin(e.facing));
    const st = L.map[e.anim] ?? L.map[e.anim.replace(/\d+$/, '')] ?? L.map.idle;   // windup1 -> windup si l'animation du sort manque
    // secteur de 45° mesuré après avoir « redressé » la vue isométrique (y x 2) : 0 = droite, 2 = bas, 6 = haut
    const sector = ((Math.round(Math.atan2(fd.y * 2, fd.x) / (Math.PI / 4)) % 8) + 8) % 8;
    let o = MIRROR[sector] ?? sector, flip = sector in MIRROR;
    if (!this.counts[`${st.anim}_${o}`]) {   // animation à 2 orientations : la diagonale la plus proche
      const back = fd.y < -0.05;
      o = back ? 5 : 1; flip = back ? fd.x > 0 : fd.x < 0;
    }
    const base = `${st.anim}_${o}`;
    const name = this.counts[base] ? base : `${st.anim}_1`;
    const n = this.counts[name] || 1;
    const a = Math.floor((st.from ?? 0) * n), b = Math.max(a + 1, Math.round((st.to ?? 1) * n));
    const idx = st.loop
      ? a + (Math.floor(e.age * (st.fps ?? 25)) % (b - a))
      : a + Math.min(b - a - 1, Math.floor(clamp(e.animT, 0, 0.999) * (b - a)));
    if (this.vivant) { const [k, f] = this.vivant.image(name, idx); this.sprite.setTexture(k, f); }
    else this.sprite.setFrame(`${name}_${idx}`);
    let sy = L.scale * this.k, alpha = 1;
    if (e.anim === 'idle') sy *= 1 + Math.sin(e.age * 4) * 0.02;
    if (e.anim === 'spawn') alpha = e.animT;
    if ((e as { state?: string }).state === 'return') alpha = 0.5;   // maquette « Aggro » 7A : il abandonne et rentre
    if (e.anim === 'die') alpha = e.animT < 0.7 ? 1 : 1 - (e.animT - 0.7) / 0.3;
    this.sprite.setScale((flip ? -L.scale : L.scale) * this.k, sy).setAlpha(alpha);
    this.sprite.setPosition(p.x, p.y - (L.ignoreZ ? 0 : e.z)).setDepth(p.y);
    if (e.flash > 0) this.sprite.setTintFill(0xffffff);
    else if (L.tint || EntityView.ambiance !== 0xffffff) this.sprite.setTint(mulTint(L.tint ?? 0xffffff, EntityView.ambiance));
    else this.sprite.clearTint();
    // Ombre au sol : reste au sol pendant les sauts
    const sh = this.shadow; sh.clear();
    if (!(e.dead && e.animT > 0.7)) {
      const w = Math.max(30, e.radius * 2.6) * (1 / (1 + e.z / 120));
      sh.setDepth(p.y - 1); sh.fillStyle(0x000000, 0.28 * alpha); sh.fillEllipse(p.x, p.y, w, w * 0.45);
    }
    // Barre de vie des monstres touchés
    const g = this.bar; g.clear();
    if (e.faction === 'monster' && e.hp < e.maxHp && !e.dead) {
      const elite = (e as Monster).def.boss || (e as Monster).def.elite;
      const w = Math.max(30, e.radius * 2.2), y = p.y - L.height * L.scale - 6;
      g.setDepth(p.y + 1);
      g.fillStyle(0x000000, 0.6); g.fillRect(p.x - w / 2 - 1, y - 1, w + 2, 6);
      g.fillStyle(elite ? 0xe0a030 : 0xc93c3c); g.fillRect(p.x - w / 2, y, w * (e.hp / e.maxHp), 4);
    } else if (e.faction === 'allie' && !e.dead && (e.hp < e.maxHp || EntityView.barresAllies)) {
      // bête de l'Osamodas : barre verte
      const w = Math.max(30, e.radius * 2.2), y = p.y - L.height * L.scale - 6;
      g.setDepth(p.y + 1);
      g.fillStyle(0x000000, 0.6); g.fillRect(p.x - w / 2 - 1, y - 1, w + 2, 6);
      g.fillStyle(0x58c048); g.fillRect(p.x - w / 2, y, w * (e.hp / e.maxHp), 4);
    }
  }

  /** Le point (x, y) du monde tombe-t-il sur le corps dessiné ? On teste le rectangle rogné de la frame
   *  (getBounds() prend la cellule de rendu entière, bien plus grande que le monstre), à `pad` pixels près.
   *  Renvoie la distance au centre du corps, ou -1 si le point est à côté. */
  hit(x: number, y: number, pad = 6): number {
    const s = this.sprite, f = s.frame;
    if (!s.visible || !s.scaleX || !s.scaleY) return -1;
    const ss = ((f as unknown as { data: object }).data as { spriteSourceSize?: { x: number; y: number; w: number; h: number } }).spriteSourceSize;
    const r = f.trimmed && ss ? ss : { x: 0, y: 0, w: f.realWidth, h: f.realHeight };
    const k = Math.abs(s.scaleX);
    const px = (x - s.x) / s.scaleX + s.originX * f.realWidth, py = (y - s.y) / s.scaleY + s.originY * f.realHeight, pd = pad / k;
    if (px < r.x - pd || px > r.x + r.w + pd || py < r.y - pd || py > r.y + r.h + pd) return -1;
    return Math.hypot(px - (r.x + r.w / 2), py - (r.y + r.h / 2)) * k;
  }

  destroy() { this.sprite.destroy(); this.bar.destroy(); this.shadow.destroy(); }
}
