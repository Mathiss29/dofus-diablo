import Phaser from 'phaser';
import { auPixel } from './pixel';
import { ISO } from '../sim/iso';
import { clamp } from '../sim/math';
import type { Entity } from '../sim/entity';
import type { Monster } from '../sim/monster';
import type { Player } from '../sim/player';
import { couleurCoffre, palierCoffre } from '../sim/enutrof';
import { TEINTES, type Carte } from '../sim/ecaflip';
import { VIVANT } from '../sim/mondeVivant';
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
  /** Le monstre compte-t-il pour la quête (losange) ; branché par la scène sur world.quetes.pourQuete. */
  static deQuete: ((m: Monster) => boolean) | null = null;
  /** Horloge du jeu pour faire flotter le losange. */
  static temps = 0;
  /** Teinte d'ambiance des personnages et des monstres (render/ambiance.ts : plus légère que celle des cartes, ils ressortent la nuit). */
  static ambiance = 0xffffff;
  /** Maj enfoncée (maquette Osamodas 14B) : barre de vie au-dessus de chaque bête, même pleine. */
  static barresAllies = false;
  /** Réglages 4C : barres de vie des monstres toujours, blessés seulement, ou seulement le monstre survolé (EntityView.survol). */
  static barresVie: 'toujours' | 'blesses' | 'survol' = 'blesses';
  static survol: number | null = null;
  readonly sprite: Phaser.GameObjects.Sprite;
  /** Losange de quête seulement (vide sinon : un Graphics vide ne coûte rien à l'affichage). */
  private readonly bar: Phaser.GameObjects.Graphics;
  /** Ombre et barre de vie : des images (et non plus des Graphics redessinés à chaque image) pour que les monstres,
   *  leurs ombres et leurs barres partent ensemble vers la carte graphique, sans changer de programme entre chaque. */
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly fond: Phaser.GameObjects.Image;
  private readonly vie: Phaser.GameObjects.Image;
  private readonly counts: Record<string, number> = {};
  /** Images du perso vivant plus fines que celles des planches : le sprite est réduit d'autant. */
  private k = 1;
  /** Enutrof (interface du coffre 1B) : pièces au-dessus du coffre au trésor (créé seulement pour lui). */
  private pieces: Phaser.GameObjects.Text | null = null;
  /** « Archis : » 2C : halo doré au sol sous un archimonstre (créé seulement pour eux). */
  private halo: Phaser.GameObjects.Image | null = null;
  /** Écaflip 15A : les cartes de la Main qui tournent autour de lui (créé seulement pour lui). */
  private cartes: Phaser.GameObjects.Graphics | null = null;
  /** Sadida 13A : icône officielle « Infecté » au-dessus du monstre (créée seulement pour eux). */
  private infecte: Phaser.GameObjects.Image | null = null;

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
    // ombre dessinée par le jeu (celle de Dofus laissait une croix)
    this.shadow = scene.add.image(0, 0, EntityView.ombre(scene));
    this.fond = scene.add.image(0, 0, '__WHITE').setOrigin(0).setTint(0x000000).setAlpha(0.6).setVisible(false);
    this.vie = scene.add.image(0, 0, '__WHITE').setOrigin(0).setVisible(false);
  }

  /** Texture de l'ombre au sol : une ellipse noire pleine, faite une fois. */
  static ombre(scene: Phaser.Scene): string {
    const k = 'ombre_entite';
    if (!scene.textures.exists(k)) {
      const t = scene.textures.createCanvas(k, EntityView.OMBRE[0], EntityView.OMBRE[1]);
      const c = t?.getContext();
      if (t && c) { c.fillStyle = '#000'; c.beginPath(); c.ellipse(t.width / 2, t.height / 2, t.width / 2, t.height / 2, 0, 0, Math.PI * 2); c.fill(); t.refresh(); }
    }
    return k;
  }
  static readonly OMBRE: [number, number] = [128, 58];
  /** Texture du halo des archimonstres : un disque doré qui s'estompe vers le bord (dessiné en mode additif). */
  static haloDore(scene: Phaser.Scene): string {
    const k = 'halo_archi';
    if (!scene.textures.exists(k)) {
      const t = scene.textures.createCanvas(k, 128, 128), c = t?.getContext();
      if (t && c) {
        const g = c.createRadialGradient(64, 64, 4, 64, 64, 64);
        g.addColorStop(0, 'rgba(255,226,130,0.95)'); g.addColorStop(0.45, 'rgba(255,196,70,0.55)'); g.addColorStop(0.8, 'rgba(255,170,40,0.18)'); g.addColorStop(1, 'rgba(255,160,30,0)');
        c.fillStyle = g; c.fillRect(0, 0, 128, 128); t.refresh();
      }
    }
    return k;
  }

  /** Barre de vie (fond noir + jauge) au-dessus de l'entité. */
  private barre(x: number, y: number, w: number, frac: number, couleur: number, depth: number) {
    this.fond.setVisible(true).setPosition(x - w / 2 - 1, y - 1).setDisplaySize(w + 2, 6).setDepth(depth);
    this.vie.setVisible(frac > 0).setPosition(x - w / 2, y).setDisplaySize(Math.max(0.01, w * frac), 4).setTint(couleur).setDepth(depth);
  }

  /** Perso réassemblé (nouvel objet porté, apparat, garde-robe) : les images suivantes viennent du nouveau. */
  changerVivant(v: PersoVivant) { this.vivant = v; Object.assign(this.counts, v.compte); }

  /** Hors de l'écran : rien à dessiner (on ne recalcule pas l'animation). */
  hide() { this.sprite.setVisible(false); this.bar.setVisible(false); this.shadow.setVisible(false); this.fond.setVisible(false); this.vie.setVisible(false); this.pieces?.setVisible(false); this.halo?.setVisible(false); this.cartes?.setVisible(false); this.infecte?.setVisible(false); }
  sync(e: Entity) {
    if (!this.sprite.visible) { this.sprite.setVisible(true); this.bar.setVisible(true); }
    const L = this.look, p = ISO.toScreen(e.x, e.y);
    const fd = ISO.toScreen(Math.cos(e.facing), Math.sin(e.facing));
    const arme = (e as { arme?: boolean }).arme && L.map[`${e.anim}_arme`];   // Forgelance Armé : variante qui montre la Lance en main
    const st = arme || (L.map[e.anim] ?? L.map[e.anim.replace(/\d+$/, '')] ?? L.map.idle);   // windup1 -> windup si l'animation du sort manque
    // secteur de 45° mesuré après avoir « redressé » la vue isométrique (y x 2) : 0 = droite, 2 = bas, 6 = haut
    const sector = ((Math.round(Math.atan2(fd.y * 2, fd.x) / (Math.PI / 4)) % 8) + 8) % 8;
    let o = MIRROR[sector] ?? sector, flip = sector in MIRROR;
    if (st.diag || !this.counts[`${st.anim}_${o}`]) {   // animation à 2 orientations : la diagonale la plus proche
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
    // Enutrof 16C : le coffre au trésor grossit à chaque palier, et dore à partir de l'Or
    const own = (e as { base?: string; owner?: Player }).base === 'coffre_tresor' ? (e as { owner?: Player }).owner : undefined;
    const pal = own?.cls?.coffre ? palierCoffre(own) : -1;
    let kc = (1 + 0.12 * (Math.min(pal, 3) + 1)) * ((e as Monster).bossMonde ? VIVANT.boss.echelle : 1);
    const sur = !!own && pal >= own.cls.coffre!.paliers.length;
    // Sadida : un Arbre pas encore Feuillu est plus petit et terne ; le Feuillu est en plein et respire en vert
    const sadi = (e as { sadi?: { feuillu: boolean; vie?: boolean } | null; def?: { sadida?: { arbre?: boolean } } }), arbre = !!sadi.sadi && !!sadi.def?.sadida?.arbre;
    if (arbre && !sadi.sadi!.feuillu) kc *= 0.72;
    const vie = arbre && !!sadi.sadi!.vie;   // Arbre de Vie : plus grand, doré
    if (vie) kc *= 1.2;
    let sy = L.scale * this.k * kc, alpha = 1;
    if (e.anim === 'idle') sy *= 1 + Math.sin(e.age * 4) * 0.02;
    if (e.anim === 'spawn') alpha = e.animT;
    if ((e as { state?: string }).state === 'return') alpha = 0.5;   // maquette « Aggro » 7A : il abandonne et rentre
    if (e.anim === 'die') alpha = e.animT < 0.7 ? 1 : 1 - (e.animT - 0.7) / 0.3;
    if ((e as Monster).intouchable && (e as Monster).bossMonde) alpha *= 0.55 + 0.1 * Math.sin(EntityView.temps * 5);   // 0.5 (1B, 3C) : intouchable, il pâlit
    this.sprite.setScale((flip ? -L.scale : L.scale) * this.k * kc, sy).setAlpha(alpha);
    // posé pile sur un pixel de l'écran : il ne « bave » plus quand la caméra le suit (voir pixel.ts)
    const cam = this.sprite.scene.cameras.main, pp = auPixel(cam, p.x, p.y - (L.ignoreZ ? 0 : e.z));
    this.sprite.setPosition(pp.x, pp.y).setDepth(p.y);
    if (e.flash > 0) this.sprite.setTintFill(0xffffff);
    else if (sur) { const k = 0.5 + 0.5 * Math.sin(EntityView.temps * 7); this.sprite.setTint(mulTint(Phaser.Display.Color.GetColor(255, Math.round(150 + 60 * k), Math.round(90 + 60 * k)), EntityView.ambiance)); }   // 6B : surcharge, il rougeoie
    else if (vie) this.sprite.setTint(mulTint(Phaser.Display.Color.GetColor(255, Math.round(225 + 20 * Math.sin(EntityView.temps * 2.5 + e.id)), 150), EntityView.ambiance));
    else if (arbre) this.sprite.setTint(mulTint(sadi.sadi!.feuillu ? Phaser.Display.Color.GetColor(Math.round(215 + 25 * Math.sin(EntityView.temps * 3 + e.id)), 255, Math.round(200 + 25 * Math.sin(EntityView.temps * 3 + e.id))) : 0x9c9c84, EntityView.ambiance));
    else if ((e as Monster).dore) { const k = 0.5 + 0.5 * Math.sin(EntityView.temps * 4 + e.id); this.sprite.setTint(mulTint(Phaser.Display.Color.GetColor(255, Math.round(205 + 25 * k), Math.round(90 + 50 * k)), EntityView.ambiance)); }   // 0.6 (22B) : monstre doré
    else if (pal >= 2) this.sprite.setTint(mulTint(pal >= 3 ? 0xffc870 : 0xffe9a0, EntityView.ambiance));
    else if (L.tint || EntityView.ambiance !== 0xffffff) this.sprite.setTint(mulTint(L.tint ?? 0xffffff, EntityView.ambiance));
    else this.sprite.clearTint();
    // Ombre au sol : reste au sol pendant les sauts
    const sh = this.shadow;
    sh.setVisible(!(e.dead && e.animT > 0.7));
    if (sh.visible) {
      const w = Math.max(30, e.radius * 2.6) * (1 / (1 + e.z / 120));
      sh.setPosition(p.x, p.y).setDisplaySize(w, w * 0.45).setDepth(p.y - 1).setAlpha(0.28 * alpha);
    }
    // « Archis : » 2C : halo doré au sol, qui respire, visible de loin
    // 0.5 : halo doré des archimonstres, violet des envahisseurs (5B), éclatant pour la Gelée Royale qui brille (1B)
    const mo = e as Monster, brille = !!mo.brille && !mo.intouchable;
    if (mo.def?.archiDe || mo.envahi || brille) {
      const h = this.halo ??= this.sprite.scene.add.image(0, 0, EntityView.haloDore(this.sprite.scene)).setBlendMode(Phaser.BlendModes.ADD);
      const w = Math.max(70, e.radius * 5.5) * (brille ? 1.6 : mo.envahi && !mo.def?.archiDe ? 0.85 : 1) * (1 + 0.08 * Math.sin(EntityView.temps * (brille ? 6 : 3)));
      h.setVisible(sh.visible).setPosition(p.x, p.y).setDisplaySize(w, w * 0.5).setDepth(p.y - 2).setAlpha((brille ? 1 : 0.75) * alpha);
      if (mo.def?.archiDe || brille) h.clearTint(); else h.setTint(0xb07bff);
    } else this.halo?.setVisible(false);
    // Barre de vie des monstres touchés
    const g = this.bar; g.clear();
    let barre = false;
    const bv = EntityView.barresVie;
    if (e.faction === 'monster' && !e.dead && (bv === 'toujours' || (bv === 'survol' ? EntityView.survol === e.id : e.hp < e.maxHp))) {
      const elite = (e as Monster).def.boss || (e as Monster).def.elite;
      this.barre(p.x, p.y - L.height * L.scale - 6, Math.max(30, e.radius * 2.2), e.hp / e.maxHp, elite ? 0xe0a030 : 0xc93c3c, p.y + 1);
      barre = true;
    }
    // monstre qui compte pour la quête : petit losange vert (couleur des icônes de quête de Dofus 3) qui flotte au-dessus
    if (e.faction === 'monster' && !e.dead && EntityView.deQuete?.(e as Monster)) {
      // au-dessus du corps dessiné (haut du rectangle rogné de l'image), pas de la hauteur nominale du look
      const sp = this.sprite, f = sp.frame, ss = ((f as unknown as { data: object }).data as { spriteSourceSize?: { y: number } }).spriteSourceSize;
      const haut = sp.y + (-sp.originY * f.realHeight + (f.trimmed && ss ? ss.y : 0)) * Math.abs(sp.scaleY);
      const y = Math.min(haut, p.y - L.height * L.scale) - (e.hp < e.maxHp ? 16 : 10) - 3 * Math.sin(EntityView.temps * 4 + e.id), r = 6;
      g.setDepth(p.y + 1);
      g.fillStyle(0x000000, 0.35); g.fillPoints([{ x: p.x + 1, y: y - r + 2 }, { x: p.x + r + 1, y: y + 2 }, { x: p.x + 1, y: y + r + 2 }, { x: p.x - r + 1, y: y + 2 }], true);
      g.fillStyle(0x86cc1c, 1); g.lineStyle(2, 0x14230a, 1);
      const d = [{ x: p.x, y: y - r }, { x: p.x + r, y }, { x: p.x, y: y + r }, { x: p.x - r, y }];
      g.fillPoints(d, true); g.strokePoints(d, true, true);
      g.fillStyle(0xffffff, 0.5); g.fillTriangle(p.x, y - r + 2, p.x + r - 3, y, p.x - r + 3, y);
    }
    if (own && !e.dead) {
      // Enutrof (interface du coffre 1B) : le coffre au trésor a toujours sa barre de vie et ses pièces, comme un allié
      const y = p.y - L.height * L.scale * kc - 6;
      this.barre(p.x, y, 44, e.hp / e.maxHp, 0xd24a3a, p.y + 1);
      barre = true;
      const t = this.pieces ??= this.sprite.scene.add.text(0, 0, '', { fontFamily: 'Lexend, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#ffd86a', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 1);
      t.setVisible(true).setText(String(own.coffrePieces)).setColor(couleurCoffre(Math.max(0, pal))).setPosition(p.x, y - 2).setDepth(p.y + 1);
    } else this.pieces?.setVisible(false);
    // Écaflip 15A : les cartes de la Main tournent autour du perso, de la couleur de leur famille
    const main = (e as { cls?: { poker?: unknown }; ecaMain?: Carte[] }).cls?.poker ? (e as { ecaMain?: Carte[] }).ecaMain : null;
    if (main?.length && !e.dead && this.sprite.visible) {
      const g = this.cartes ??= this.sprite.scene.add.graphics();
      g.clear().setVisible(true).setDepth(p.y + 2);
      main.forEach((k, i) => {
        const a = e.age * 1.8 + (i * Math.PI * 2) / main.length, x = p.x + Math.cos(a) * 30, y = p.y - 58 + Math.sin(a) * 11, col = Phaser.Display.Color.HexStringToColor(TEINTES[k.c]).color;
        g.fillStyle(0x000000, 0.35); g.fillRoundedRect(x - 5, y - 6, 11, 15, 2);
        g.fillStyle(0xf6efe0, 1); g.fillRoundedRect(x - 5.5, y - 7.5, 11, 15, 2);
        g.lineStyle(1.5, col, 1); g.strokeRoundedRect(x - 5.5, y - 7.5, 11, 15, 2);
        g.fillStyle(col, 1); g.fillCircle(x, y, k.v === 0 ? 2 : 3);
      });
    } else this.cartes?.setVisible(false);
    if (own) { /* barre déjà dessinée */ } else if (e.faction === 'monster') { /* barre déjà dessinée */ } else if (e.faction === 'allie' && !e.dead && (e.hp < e.maxHp || EntityView.barresAllies)) {
      // bête de l'Osamodas : barre verte
      this.barre(p.x, p.y - L.height * L.scale - 6, Math.max(30, e.radius * 2.2), e.hp / e.maxHp, 0x58c048, p.y + 1);
      barre = true;
    }
    if (!barre) { this.fond.setVisible(false); this.vie.setVisible(false); }
    // Sadida 13A : icône officielle de l'état Infecté au-dessus du monstre
    const it = (e as Monster).infecteT;
    if (it > 0 && !e.dead && this.sprite.scene.textures.exists('sadi_infecte')) {
      const im = this.infecte ??= this.sprite.scene.add.image(0, 0, 'sadi_infecte').setDisplaySize(20, 20);
      im.setVisible(true).setPosition(p.x + Math.max(18, e.radius * 1.2), p.y - L.height * L.scale - 14).setDepth(p.y + 2).setAlpha(Math.min(1, it * 2));
    } else this.infecte?.setVisible(false);
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

  destroy() { this.sprite.destroy(); this.bar.destroy(); this.shadow.destroy(); this.fond.destroy(); this.vie.destroy(); this.pieces?.destroy(); this.halo?.destroy(); this.cartes?.destroy(); this.infecte?.destroy(); }
}
