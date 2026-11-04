import Phaser from 'phaser';
import { GAME_DATA } from '../sim/data';
import { SKILL_IDS, type SkillId } from '../sim/defs';
import type { Entity } from '../sim/entity';
import type { World } from '../sim/world';
import { LOOKS } from './looks';

const STYLE = { fontFamily: 'Trebuchet MS, Verdana, sans-serif', fontSize: '16px', color: '#e8e2d4', stroke: '#000', strokeThickness: 3 };
const UI = 'assets/ui';

/** Images d'interface de Dofus 3 (bundles figs, uielements, uidarkstone ; voir tools/extraction/LISEZMOI.md). */
const UI_IMAGES = [
  'gaugeHeartBackground', 'gaugeHeartFilledRed', 'gaugeHeartBorder', 'gaugeHeartShadeEdge',
  'paCounter', 'pmCounter', 'floatingWindow_horizontal_bg',
  'slot_dark_background_full', 'slot_light_lock',
  'border_turn_timeline', 'background_timeline_red_normal', 'background_timeline_red_dark', 'background_timeline_blue_normal',
  'background_levelup_banner', 'background_defeat_banner',
];
/** Icône officielle (iconId de spellsdataroot) de chaque sort du Iop. L'attaque de base prend celle de Pression. */
const SKILL_ICONS: Record<SkillId, number> = { attaque: 11830, epee: 11843, bond: 11831, colere: 11851 };
/** 6 emplacements de sorts (voir bases du jeu) ; ceux au-delà des sorts connus sont verrouillés. */
const SLOTS = 6;
const TIMELINE_MAX = 10;

type Fixed = Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth;

interface SlotView { bg: Phaser.GameObjects.Image; icon?: Phaser.GameObjects.Image; cd: Phaser.GameObjects.Text; key: Phaser.GameObjects.Text }
interface TimelineView { bg: Phaser.GameObjects.Image; sprite: Phaser.GameObjects.Image; border: Phaser.GameObjects.Image }

/** Interface fixe à l'écran, reprise du HUD de combat de Dofus 3 :
 *  cœur de PV avec PA (étoile) et PM (losange), barre de sorts, timeline des combattants, bannières. */
export class Hud {
  static preload(scene: Phaser.Scene) {
    for (const k of UI_IMAGES) if (!scene.textures.exists(k)) scene.load.image(k, `${UI}/${k}.png`);
    for (const i of Object.values(SKILL_ICONS)) if (!scene.textures.exists(`sort_${i}`)) scene.load.image(`sort_${i}`, `${UI}/sorts/sort_${i}.png`);
  }

  private g: Phaser.GameObjects.Graphics;
  private info: Phaser.GameObjects.Text;
  private panel: Phaser.GameObjects.NineSlice;
  private heart: { bg: Phaser.GameObjects.Image; fill: Phaser.GameObjects.Image; border: Phaser.GameObjects.Image; shade: Phaser.GameObjects.Image; text: Phaser.GameObjects.Text };
  private pa: { img: Phaser.GameObjects.Image; text: Phaser.GameObjects.Text };
  private pm: { img: Phaser.GameObjects.Image; text: Phaser.GameObjects.Text };
  private slots: SlotView[] = [];
  private timeline: TimelineView[] = [];
  /** Masque des portraits (cases de la timeline) : un portrait zoomé ne déborde pas du cadre. */
  private tlMask: Phaser.GameObjects.Graphics;
  private bannerBg: Phaser.GameObjects.Image;
  private center: Phaser.GameObjects.Text;
  private toastText: Phaser.GameObjects.Text;
  private hurtRect: Phaser.GameObjects.Rectangle;
  private help: Phaser.GameObjects.Text;
  private lastHp = -1;
  /** Grossissement passager du cœur quand on est touché. */
  private pulse = { v: 1 };

  constructor(private scene: Phaser.Scene) {
    const fixed = <T extends Fixed>(o: T, d = 0) => { o.setScrollFactor(0); o.setDepth(2e6 + d); return o; };
    const img = (k: string, d = 1) => fixed(scene.add.image(0, 0, k), d);
    const txt = (size: number, d = 5, extra: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}) =>
      fixed(scene.add.text(0, 0, '', { ...STYLE, fontSize: `${size}px`, ...extra }).setOrigin(0.5), d);

    this.hurtRect = fixed(scene.add.rectangle(0, 0, 10, 10, 0xc0201a, 1).setOrigin(0).setAlpha(0), -1);
    this.panel = fixed(scene.add.nineslice(0, 0, 'floatingWindow_horizontal_bg', undefined, 100, 80, 12, 12, 12, 12), 0);
    this.g = fixed(scene.add.graphics(), 3);
    this.info = fixed(scene.add.text(16, 14, '', STYLE), 5);

    this.heart = {
      bg: img('gaugeHeartBackground'), fill: img('gaugeHeartFilledRed', 2), shade: img('gaugeHeartShadeEdge', 3),
      border: img('gaugeHeartBorder', 4), text: txt(22, 6, { fontStyle: 'bold', strokeThickness: 4 }),
    };
    this.pa = { img: img('paCounter', 4), text: txt(20, 6, { fontStyle: 'bold', strokeThickness: 4 }) };
    this.pm = { img: img('pmCounter', 4), text: txt(20, 6, { fontStyle: 'bold', strokeThickness: 4 }) };

    for (let i = 0; i < SLOTS; i++) {
      const id = SKILL_IDS[i];
      const s: SlotView = {
        bg: img(id ? 'slot_dark_background_full' : 'slot_light_lock'),
        cd: txt(18, 6, { fontStyle: 'bold', strokeThickness: 4 }),
        key: fixed(scene.add.text(0, 0, '', { ...STYLE, fontSize: '11px', strokeThickness: 3 }).setOrigin(1, 1), 6),
      };
      if (id) s.icon = img(`sort_${SKILL_ICONS[id]}`, 2);
      this.slots.push(s);
    }
    this.tlMask = scene.make.graphics({}, false);
    this.tlMask.setScrollFactor(0);
    const mask = this.tlMask.createGeometryMask();
    for (let i = 0; i < TIMELINE_MAX; i++) {
      const t: TimelineView = { bg: img('background_timeline_red_normal'), sprite: img('__DEFAULT', 2).setMask(mask), border: img('border_turn_timeline', 4) };
      t.border.setTint(0xd9c9a3);
      this.timeline.push(t);
    }

    this.bannerBg = img('background_levelup_banner', 7).setAlpha(0);
    this.center = txt(34, 8, { fontStyle: 'bold', stroke: '#3a2208', strokeThickness: 6, align: 'center', lineSpacing: -4 }).setAlpha(0);
    this.toastText = txt(15, 8).setAlpha(0);
    this.help = fixed(scene.add.text(0, 0,
      'ZQSD / WASD : se déplacer   ·   Clic gauche (maintenu) : Attaque, combo 3 coups\n' +
      'Clic droit ou 1 : Épée Céleste   ·   Espace : Bond (annule tout, invulnérable)   ·   R ou 2 : Colère de Iop\n' +
      'F : effets d\'impact ON/OFF   ·   H : masquer l\'aide', { ...STYLE, fontSize: '13px', align: 'center' }).setOrigin(0.5, 0), 5);
  }

  toggleHelp() { this.help.setVisible(!this.help.visible); }

  /** Bannière centrale ; defeat = ruban rouge de défaite au lieu du ruban doré. */
  banner(text: string, ms = 1400, defeat = false) {
    const c = this.center, b = this.bannerBg;
    b.setTexture(defeat ? 'background_defeat_banner' : 'background_levelup_banner');
    c.setText(text).setAlpha(1).setScale(1.3);
    // le ruban s'élargit avec le texte et s'épaissit pour deux lignes
    const sx = Math.max(1, (c.width + 260) / 600), sy = text.includes('\n') ? 1.45 : 1;
    b.setAlpha(1).setScale(sx * 1.2, sy * 1.3);
    this.scene.tweens.killTweensOf([c, b]);
    this.scene.tweens.add({ targets: c, scale: 1, duration: 200, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: b, scaleX: sx, scaleY: sy, duration: 200, ease: 'Back.Out' });
    if (ms) this.scene.tweens.add({ targets: [c, b], alpha: 0, delay: ms, duration: 400 });
  }
  toast(text: string) {
    this.toastText.setText(text).setAlpha(1);
    this.scene.tweens.killTweensOf(this.toastText);
    this.scene.tweens.add({ targets: this.toastText, alpha: 0, delay: 1200, duration: 400 });
  }
  hurtFlash(strong: boolean) {
    this.hurtRect.setAlpha(strong ? 0.28 : 0.1);
    this.scene.tweens.add({ targets: this.hurtRect, alpha: 0, duration: 300 });
    // le cœur tressaille quand on prend un coup
    this.scene.tweens.killTweensOf(this.pulse);
    this.pulse.v = 1.08;
    this.scene.tweens.add({ targets: this.pulse, v: 1, duration: 180, ease: 'Quad.Out' });
  }

  draw(world: World, juice: boolean) {
    const W = this.scene.scale.width, H = this.scene.scale.height, g = this.g, p = world.player, S = p.cls.skills;
    g.clear();
    this.hurtRect.setSize(W, H);
    const alive = world.monsters.filter(m => !m.dead);
    this.info.setText(`${world.zone.name}   ·   Vague ${world.wave}   ·   Monstres ${alive.length}   ·   Tués ${world.kills}   ·   Combo ${p.combo + 1}/3${juice ? '' : '   ·   EFFETS OFF'}`);

    // --- Bandeau du bas : PA/PM, cœur, sorts ---
    const slot = 60, gap = 6, heartSize = 104;
    const barW = SLOTS * slot + (SLOTS - 1) * gap;
    const totalW = 52 + heartSize + 14 + barW;
    const x0 = Math.round(W / 2 - totalW / 2), cy = H - 62;
    this.panel.setPosition(x0 + 52 + heartSize - 10 + (barW + 34) / 2, cy + 6).setSize(barW + 34, slot + 26);

    // PA (étoile) et PM (losange) à gauche du cœur, comme dans Dofus 3
    const cls = p.cls;
    this.pa.img.setPosition(x0 + 24, cy - 22).setDisplaySize(50, 50);
    this.pa.text.setPosition(x0 + 24, cy - 21).setText(String(cls.pa ?? 6));
    this.pm.img.setPosition(x0 + 24, cy + 28).setDisplaySize(50, 50);
    this.pm.text.setPosition(x0 + 24, cy + 29).setText(String(cls.pm ?? 3));

    // Cœur : le rouge se vide par le haut à mesure que les PV baissent
    const hx = x0 + 52 + heartSize / 2, ratio = Phaser.Math.Clamp(p.hp / p.maxHp, 0, 1), k = heartSize / 112 * this.pulse.v;
    const h = this.heart;
    h.bg.setPosition(hx, cy + 1).setScale(k);
    h.fill.setPosition(hx, cy).setScale(k);
    const cut = Math.round(112 * (1 - ratio));
    h.fill.setCrop(0, cut, 112, 112 - cut);
    h.shade.setPosition(hx, cy).setScale(k);
    h.border.setPosition(hx, cy).setScale(k);
    const hp = Math.max(0, Math.ceil(p.hp));
    if (hp !== this.lastHp) { h.text.setText(String(hp)); this.lastHp = hp; }
    h.text.setPosition(hx, cy - 2);

    // Barre de sorts
    const sx = x0 + 52 + heartSize + 14;
    this.slots.forEach((s, i) => {
      const x = sx + i * (slot + gap) + slot / 2, y = cy + 6, id = SKILL_IDS[i];
      s.bg.setPosition(x, y).setDisplaySize(slot, slot);
      if (!id || !s.icon) { s.cd.setText(''); s.key.setText(''); return; }
      const def = S[id], cd = p.cd[id], frac = def.cooldown ? cd / def.cooldown : 0;
      s.icon.setPosition(x, y).setDisplaySize(slot - 8, slot - 8).setTint(cd > 0 ? 0x8a8a8a : 0xffffff);
      if (frac > 0) {
        const top = y - (slot - 8) / 2, hh = (slot - 8) * frac;
        g.fillStyle(0x000000, 0.55); g.fillRect(x - (slot - 8) / 2, top, slot - 8, hh);
      }
      if (p.skill?.id === id) { g.lineStyle(2, 0xf2d36b, 1); g.strokeRoundedRect(x - slot / 2 + 2, y - slot / 2 + 2, slot - 4, slot - 4, 6); }
      s.cd.setPosition(x, y).setText(cd > 0 ? (cd >= 1 ? String(Math.ceil(cd)) : cd.toFixed(1)) : '');
      s.key.setPosition(x + slot / 2 - 4, y + slot / 2 - 2).setText(def.key);
    });

    // --- Timeline (haut droite) : le joueur puis les monstres en vie, boss d'abord ---
    const fighters: Entity[] = [p, ...alive.sort((a, b) => Number(!!b.def.boss) - Number(!!a.def.boss))].slice(0, TIMELINE_MAX);
    const tl = 54, tgap = 4, tx0 = W - 16 - fighters.length * (tl + tgap) + tgap, ty = 22 + tl / 2;
    this.tlMask.clear().fillStyle(0xffffff);
    this.timeline.forEach((t, i) => {
      const e = fighters[i], vis = !!e;
      t.bg.setVisible(vis); t.sprite.setVisible(vis); t.border.setVisible(vis);
      if (!e) return;
      const x = tx0 + i * (tl + tgap) + tl / 2;
      this.tlMask.fillRect(x - tl / 2 + 3, ty - tl / 2 + 3, tl - 6, tl - 6);
      const isPlayer = e.faction === 'player';
      t.bg.setTexture(isPlayer ? 'background_timeline_blue_normal' : e.flash > 0 ? 'background_timeline_red_dark' : 'background_timeline_red_normal')
        .setPosition(x, ty).setDisplaySize(tl - 4, tl - 4);
      t.border.setPosition(x, ty).setDisplaySize(tl, tl).setTint(i === 0 ? 0xf2d36b : 0xd9c9a3);
      const look = isPlayer ? LOOKS.iop : LOOKS[GAME_DATA.monsters[(e as { type?: string }).type!].look];
      const frame = isPlayer ? 'AnimStatiqueCombat0_1_0' : 'AnimStatique_1_0';
      if (t.sprite.texture.key !== look.atlas || t.sprite.frame.name !== frame) t.sprite.setTexture(look.atlas, frame);
      // même point d'ancrage que sur la carte (pied du personnage), mis à l'échelle de sa hauteur
      const meta = (t.sprite.texture.customData as { meta?: { cell: number[]; origin: number[] } }).meta ?? { cell: [1, 1], origin: [0.5, 0.9] };
      const inner = tl - 12;
      t.sprite.setOrigin(meta.origin[0] / meta.cell[0], meta.origin[1] / meta.cell[1])
        .setPosition(x, ty + inner / 2 * (look.portraitZoom ?? 1)).setScale(inner / look.height * (look.portraitZoom ?? 1))
        .setTint(look.tint ?? 0xffffff);
      // petite jauge de vie sous chaque portrait
      const r = Phaser.Math.Clamp(e.hp / e.maxHp, 0, 1), bw = tl - 8, by = ty + tl / 2 + 3;
      g.fillStyle(0x000000, 0.7); g.fillRect(x - bw / 2 - 1, by - 1, bw + 2, 6);
      g.fillStyle(isPlayer ? 0x4aa3e8 : 0xd23b2e); g.fillRect(x - bw / 2, by, bw * r, 4);
    });

    this.center.setPosition(W / 2, H * 0.3);
    this.bannerBg.setPosition(W / 2, H * 0.3 + 8);
    this.toastText.setPosition(W / 2, H * 0.18);
    this.help.setPosition(W / 2, 44);
  }
}
