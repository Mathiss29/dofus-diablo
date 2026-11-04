import Phaser from 'phaser';
import { GAME_DATA } from '../sim/data';
import { SKILL_IDS, type SkillId } from '../sim/defs';
import type { Monster } from '../sim/monster';
import type { Entity } from '../sim/entity';
import type { World } from '../sim/world';
import { LOOKS } from './looks';

const STYLE = { fontFamily: 'Trebuchet MS, Verdana, sans-serif', fontSize: '16px', color: '#e8e2d4', stroke: '#000', strokeThickness: 3 };
const UI = 'assets/ui';

/** Images d'interface de Dofus 3 (bundles figs, uielements, uidarkstone ; voir tools/extraction/LISEZMOI.md). */
const UI_IMAGES = [
  'gaugeHeartBackground', 'gaugeHeartFilledRed', 'gaugeHeartBorder', 'gaugeHeartShadeEdge',
  'paCounter', 'pmCounter', 'floatingWindow_horizontal_bg',
  'slot_dark_background_full', 'slot_light_lock', 'icon_pv', 'iconBossSkull',
  'border_turn_timeline', 'background_timeline_red_normal', 'background_timeline_red_dark', 'background_timeline_blue_normal',
  'background_levelup_banner', 'background_defeat_banner',
];
/** Icône officielle (iconId de spellsdataroot) de chaque sort du Iop. L'attaque de base prend celle de Pression. */
const SKILL_ICONS: Record<SkillId, number> = { attaque: 11830, epee: 11843, bond: 11831, colere: 11851 };
/** 6 emplacements de sorts (voir bases du jeu) ; ceux au-delà des sorts connus sont verrouillés. */
const SLOTS = 6;
/** Portraits en haut à droite : le joueur puis les archimonstres et élites en vie. */
const PORTRAITS_MAX = 6;
const PA_BLUE = '#9cc3ff';

type Fixed = Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth;
type Txt = Phaser.GameObjects.Text;
type Img = Phaser.GameObjects.Image;

interface SlotView { bg: Img; icon?: Img; cd: Txt; key: Txt; cost: Txt }
interface PortraitView { bg: Img; sprite: Img; border: Img }

/** Interface fixe à l'écran, reprise du HUD de combat de Dofus 3 et adaptée au temps réel
 *  (choix de la maquette : 1A 2B 3B 4A 5B) :
 *  - cœur de PV, PA (étoile, ressource des sorts) et PM (losange, charges de Bond) ;
 *  - potion à gauche, 6 emplacements de sorts avec leur coût en PA, barre d'XP dessous ;
 *  - jauge de boss en haut au centre, portraits du joueur et des archimonstres en haut à droite ;
 *  - cartouche de zone en haut à gauche, bannières. */
export class Hud {
  static preload(scene: Phaser.Scene) {
    for (const k of UI_IMAGES) if (!scene.textures.exists(k)) scene.load.image(k, `${UI}/${k}.png`);
    for (const i of Object.values(SKILL_ICONS)) if (!scene.textures.exists(`sort_${i}`)) scene.load.image(`sort_${i}`, `${UI}/sorts/sort_${i}.png`);
  }

  private g: Phaser.GameObjects.Graphics;
  private panel: Phaser.GameObjects.NineSlice;
  private zonePanel: Phaser.GameObjects.NineSlice;
  private zoneTitle: Txt;
  private zoneInfo: Txt;
  private heart: { bg: Img; fill: Img; border: Img; shade: Img; text: Txt };
  private pa: { img: Img; text: Txt; max: Txt };
  private pm: { img: Img; text: Txt };
  private potion: { bg: Img; icon: Img; count: Txt; key: Txt };
  private level: Txt;
  private slots: SlotView[] = [];
  private portraits: PortraitView[] = [];
  private portraitMask: Phaser.GameObjects.Graphics;
  private archiLabel: Txt;
  private boss: { panel: Phaser.GameObjects.NineSlice; skull: Img; name: Txt; hp: Txt };
  private bannerBg: Img;
  private center: Txt;
  private toastText: Txt;
  private hurtRect: Phaser.GameObjects.Rectangle;
  private help: Txt;
  private helpAuto = true;
  private lastHp = -1;
  /** Grossissement passager du cœur (coup reçu, potion) et clignotement des compteurs sans ressource. */
  private pulse = { v: 1 };
  private shortOf = { pa: 0, pm: 0 };

  constructor(private scene: Phaser.Scene) {
    const fixed = <T extends Fixed>(o: T, d = 0) => { o.setScrollFactor(0); o.setDepth(2e6 + d); return o; };
    const img = (k: string, d = 1) => fixed(scene.add.image(0, 0, k), d);
    const txt = (size: number, d = 5, extra: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}) =>
      fixed(scene.add.text(0, 0, '', { ...STYLE, fontSize: `${size}px`, ...extra }).setOrigin(0.5), d);
    const bold = { fontStyle: 'bold', strokeThickness: 4 };
    const nine = (w: number, h: number) => fixed(scene.add.nineslice(0, 0, 'floatingWindow_horizontal_bg', undefined, w, h, 12, 12, 12, 12), 0);

    this.hurtRect = fixed(scene.add.rectangle(0, 0, 10, 10, 0xc0201a, 1).setOrigin(0).setAlpha(0), -1);
    this.panel = nine(100, 80);
    this.g = fixed(scene.add.graphics(), 3);

    this.zonePanel = nine(250, 62).setOrigin(0);
    this.zoneTitle = fixed(scene.add.text(0, 0, '', { ...STYLE, fontSize: '17px', color: '#ffe3b0', fontStyle: 'bold' }), 5);
    this.zoneInfo = fixed(scene.add.text(0, 0, '', { ...STYLE, fontSize: '13px' }), 5);

    this.heart = {
      bg: img('gaugeHeartBackground'), fill: img('gaugeHeartFilledRed', 2), shade: img('gaugeHeartShadeEdge', 3),
      border: img('gaugeHeartBorder', 4), text: txt(22, 6, bold),
    };
    this.pa = { img: img('paCounter', 4), text: txt(20, 6, bold), max: txt(11, 6) };
    this.pm = { img: img('pmCounter', 4), text: txt(20, 6, bold) };
    this.potion = {
      bg: img('slot_dark_background_full'), icon: img('icon_pv', 2), count: txt(15, 6, bold),
      key: fixed(scene.add.text(0, 0, 'E', { ...STYLE, fontSize: '11px' }).setOrigin(0, 0), 6),
    };
    this.level = fixed(scene.add.text(0, 0, '', { ...STYLE, fontSize: '13px' }).setOrigin(1, 0.5), 6);

    for (let i = 0; i < SLOTS; i++) {
      const id = SKILL_IDS[i];
      const s: SlotView = {
        bg: img(id ? 'slot_dark_background_full' : 'slot_light_lock'),
        cd: txt(18, 6, bold),
        key: fixed(scene.add.text(0, 0, '', { ...STYLE, fontSize: '11px', strokeThickness: 3 }).setOrigin(1, 1), 6),
        cost: txt(11, 6, { color: PA_BLUE, fontStyle: 'bold' }),
      };
      if (id) s.icon = img(`sort_${SKILL_ICONS[id]}`, 2);
      this.slots.push(s);
    }

    this.portraitMask = scene.make.graphics({}, false);
    this.portraitMask.setScrollFactor(0);
    const mask = this.portraitMask.createGeometryMask();
    for (let i = 0; i < PORTRAITS_MAX; i++) {
      const t: PortraitView = { bg: img('background_timeline_red_normal'), sprite: img('__DEFAULT', 2).setMask(mask), border: img('border_turn_timeline', 4) };
      this.portraits.push(t);
    }
    this.archiLabel = fixed(scene.add.text(0, 0, 'Archimonstres', { ...STYLE, fontSize: '12px', color: '#ffd87a' }).setOrigin(1, 0.5), 5);

    this.boss = { panel: nine(600, 42), skull: img('iconBossSkull', 4), name: txt(18, 6, { color: '#ffe3b0', fontStyle: 'bold' }), hp: txt(12, 6) };

    this.bannerBg = img('background_levelup_banner', 7).setAlpha(0);
    this.center = txt(34, 8, { fontStyle: 'bold', stroke: '#3a2208', strokeThickness: 6, align: 'center', lineSpacing: -4 }).setAlpha(0);
    this.toastText = txt(15, 8).setAlpha(0);
    this.help = fixed(scene.add.text(0, 0,
      'ZQSD / WASD : se déplacer   ·   Clic gauche (maintenu) : Attaque, combo 3 coups   ·   E : potion\n' +
      'Clic droit ou 1 : Épée Céleste (3 PA)   ·   Espace : Bond (1 PM, invulnérable)   ·   R ou 2 : Colère de Iop (4 PA)\n' +
      'F : effets d\'impact ON/OFF   ·   H : afficher / masquer l\'aide', { ...STYLE, fontSize: '13px', align: 'center' }).setOrigin(0.5, 0), 5);
  }

  /** H : l'aide reste ensuite comme le joueur l'a laissée. */
  toggleHelp() { this.helpAuto = false; this.help.setVisible(!this.help.visible); }

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
  private heartPulse(v: number) {
    this.scene.tweens.killTweensOf(this.pulse);
    this.pulse.v = v;
    this.scene.tweens.add({ targets: this.pulse, v: 1, duration: 180, ease: 'Quad.Out' });
  }
  hurtFlash(strong: boolean) {
    this.hurtRect.setAlpha(strong ? 0.28 : 0.1);
    this.scene.tweens.add({ targets: this.hurtRect, alpha: 0, duration: 300 });
    this.heartPulse(1.08);   // le cœur tressaille quand on prend un coup
  }
  potionDrunk() { this.heartPulse(1.12); }
  /** Sort lancé sans assez de PA (ou de PM) : le compteur clignote en rouge. */
  noResource(res: 'pa' | 'pm') { this.shortOf[res] = 0.35; }
  /** La première vague terminée, l'aide se range (H pour la revoir). */
  onWave(n: number) { if (n >= 2 && this.helpAuto) { this.help.setVisible(false); this.helpAuto = false; } }

  draw(world: World, juice: boolean, dt = 1 / 60) {
    const W = this.scene.scale.width, H = this.scene.scale.height, g = this.g, p = world.player, C = p.cls, S = C.skills;
    g.clear();
    this.hurtRect.setSize(W, H);
    this.shortOf.pa = Math.max(0, this.shortOf.pa - dt); this.shortOf.pm = Math.max(0, this.shortOf.pm - dt);
    const alive = world.monsters.filter(m => !m.dead);

    // --- Cartouche de zone (haut gauche) ---
    this.zonePanel.setPosition(12, 10);
    this.zoneTitle.setPosition(28, 20).setText(world.zone.name);
    this.zoneTitle.setText(`${world.zone.name}`);
    this.zoneInfo.setPosition(28, 44).setText(`Niv. ${world.zone.level}   ·   Vague ${world.wave}   ·   ${alive.length} monstre${alive.length > 1 ? 's' : ''}   ·   ${world.kills} tués${juice ? '' : '   ·   effets OFF'}`);
    this.zonePanel.setSize(Math.max(this.zoneTitle.width, this.zoneInfo.width) + 34, 62);

    // --- Bandeau du bas : potion, PA/PM, cœur, sorts, XP ---
    const slot = 60, gap = 6, heartSize = 104, potW = 70, leftW = 52;
    const barW = SLOTS * slot + (SLOTS - 1) * gap;
    const totalW = potW + leftW + heartSize + 14 + barW;
    const x0 = Math.round(W / 2 - totalW / 2), cy = H - 66;
    const px = x0 + potW, hx = px + leftW + heartSize / 2, sx = px + leftW + heartSize + 14;
    this.panel.setPosition(sx - 12 + (barW + 24) / 2, cy + 6).setSize(barW + 24, slot + 26);

    // Potion (E) : 3 charges, +1 à chaque vague
    const pot = this.potion, pcd = p.potionCd / C.potion.cooldown;
    pot.bg.setPosition(x0 + 28, cy + 6).setDisplaySize(56, 56);
    pot.icon.setPosition(x0 + 28, cy + 6).setDisplaySize(32, 32).setAlpha(p.potions > 0 ? 1 : 0.35);
    pot.count.setPosition(x0 + 46, cy + 24).setText(String(p.potions));
    pot.key.setPosition(x0 + 4, cy - 20);
    if (pcd > 0) { g.fillStyle(0x000000, 0.55); g.fillRect(x0 + 2, cy - 22, 52, 52 * pcd); }

    // PA (étoile) : partie entière, la recharge se voit au remplissage bleu sous l'étoile
    const paShort = this.shortOf.pa > 0 && Math.floor(this.shortOf.pa * 12) % 2 === 0;
    this.pa.img.setPosition(px + 25, cy - 22).setDisplaySize(50, 50).setTint(paShort ? 0xff6b5b : 0xffffff);
    this.pa.text.setPosition(px + 25, cy - 21).setText(String(Math.floor(p.pa)));
    this.pa.max.setPosition(px + 25, cy - 52).setText(`${C.pa.max} max`);
    // PM (losange) : charges de Bond
    const pmShort = this.shortOf.pm > 0 && Math.floor(this.shortOf.pm * 12) % 2 === 0;
    this.pm.img.setPosition(px + 25, cy + 28).setDisplaySize(50, 50).setTint(pmShort ? 0xff6b5b : 0xffffff);
    this.pm.text.setPosition(px + 25, cy + 29).setText(String(Math.floor(p.pm)));
    // recharge de la prochaine charge : arc vert autour du losange
    if (p.pm < C.pm.max) {
      const f = p.pm - Math.floor(p.pm);
      g.lineStyle(3, 0x000000, 0.6); g.strokeCircle(px + 25, cy + 28, 24);
      g.lineStyle(3, 0x9fd05a, 1); g.beginPath();
      g.arc(px + 25, cy + 28, 24, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); g.strokePath();
    }
    // Cœur : le rouge se vide par le haut à mesure que les PV baissent
    const ratio = Phaser.Math.Clamp(p.hp / p.maxHp, 0, 1), k = heartSize / 112 * this.pulse.v;
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

    // Barre de sorts : coût en PA au-dessus, icône assombrie sans assez de ressources
    this.slots.forEach((s, i) => {
      const x = sx + i * (slot + gap) + slot / 2, y = cy + 6, id = SKILL_IDS[i];
      s.bg.setPosition(x, y).setDisplaySize(slot, slot);
      if (!id || !s.icon) { s.cd.setText(''); s.key.setText(''); s.cost.setText(''); return; }
      const def = S[id], cd = p.cd[id], frac = def.cooldown ? cd / def.cooldown : 0;
      const ok = p.hasResource(id), inner = slot - 8;
      s.icon.setPosition(x, y).setDisplaySize(inner, inner).setTint(cd > 0 ? 0x8a8a8a : ok ? 0xffffff : 0x6f86b8);
      if (frac > 0) { g.fillStyle(0x000000, 0.55); g.fillRect(x - inner / 2, y - inner / 2, inner, inner * frac); }
      if (p.skill?.id === id) { g.lineStyle(2, 0xf2d36b, 1); g.strokeRoundedRect(x - slot / 2 + 2, y - slot / 2 + 2, slot - 4, slot - 4, 6); }
      s.cd.setPosition(x, y).setText(cd > 0 ? (cd >= 1 ? String(Math.ceil(cd)) : cd.toFixed(1)) : '');
      s.key.setPosition(x + slot / 2 - 4, y + slot / 2 - 2).setText(def.key);
      const cost = id === 'bond' ? '1 PM' : p.paCost(id) ? `${p.paCost(id)} PA` : '';
      s.cost.setPosition(x, y - slot / 2 - 8).setText(cost).setColor(id === 'bond' ? '#b6e38a' : PA_BLUE);
    });

    // XP : fine barre dorée sous le bandeau
    const by = cy + 6 + (slot + 26) / 2 + 4, xr = p.level >= C.maxLevel ? 1 : p.xp / p.xpNeeded;
    g.fillStyle(0x000000, 0.7); g.fillRoundedRect(x0, by, totalW, 6, 3);
    g.fillStyle(0xe2b13c); g.fillRoundedRect(x0 + 1, by + 1, Math.max(0, (totalW - 2) * xr), 4, 2);
    this.level.setPosition(x0 - 8, by + 3).setText(`Niv. ${p.level}`);

    // --- Jauge de boss (haut centre) ---
    const boss = alive.find(m => m.def.boss);
    const B = this.boss, vis = !!boss;
    B.panel.setVisible(vis); B.skull.setVisible(vis); B.name.setVisible(vis); B.hp.setVisible(vis);
    if (boss) {
      const bw = Math.min(560, W * 0.4), bx = W / 2 - bw / 2, byy = 34, r = Phaser.Math.Clamp(boss.hp / boss.maxHp, 0, 1);
      B.panel.setPosition(W / 2, byy + 8).setSize(bw + 28, 40);
      g.fillStyle(0x1a0d0d); g.fillRoundedRect(bx, byy, bw, 16, 3);
      g.fillStyle(0xc8352b); g.fillRoundedRect(bx + 1, byy + 1, (bw - 2) * r, 14, 2);
      g.fillStyle(0xff8a7f, 0.5); g.fillRect(bx + 1, byy + 1, (bw - 2) * r, 4);
      B.skull.setPosition(bx - 28, byy + 8).setDisplaySize(32, 32);
      B.name.setPosition(W / 2, byy - 12).setText(boss.def.name);
      B.hp.setPosition(W / 2, byy + 8).setText(`${Math.max(0, Math.ceil(boss.hp))} / ${boss.maxHp}`);
    }

    // --- Portraits (haut droite) : le joueur puis les archimonstres / élites en vie ---
    const elites = alive.filter(m => m.def.elite);
    const fighters: Entity[] = [p, ...elites].slice(0, PORTRAITS_MAX);
    const tl = 54, tgap = 4, tx0 = W - 16 - fighters.length * (tl + tgap) + tgap, ty = 22 + tl / 2;
    this.portraitMask.clear().fillStyle(0xffffff);
    this.archiLabel.setVisible(elites.length > 0).setPosition(tx0 - 8, ty);
    this.portraits.forEach((t, i) => {
      const e = fighters[i], vis = !!e;
      t.bg.setVisible(vis); t.sprite.setVisible(vis); t.border.setVisible(vis);
      if (!e) return;
      const x = tx0 + i * (tl + tgap) + tl / 2;
      this.portraitMask.fillRect(x - tl / 2 + 3, ty - tl / 2 + 3, tl - 6, tl - 6);
      const isPlayer = e.faction === 'player';
      t.bg.setTexture(isPlayer ? 'background_timeline_blue_normal' : e.flash > 0 ? 'background_timeline_red_dark' : 'background_timeline_red_normal')
        .setPosition(x, ty).setDisplaySize(tl - 4, tl - 4);
      t.border.setPosition(x, ty).setDisplaySize(tl, tl).setTint(isPlayer ? 0xf2d36b : 0xd9c9a3);
      const look = isPlayer ? LOOKS.iop : LOOKS[GAME_DATA.monsters[(e as Monster).type].look];
      const frame = isPlayer ? 'AnimStatiqueCombat0_1_0' : 'AnimStatique_1_0';
      if (t.sprite.texture.key !== look.atlas || t.sprite.frame.name !== frame) t.sprite.setTexture(look.atlas, frame);
      // même point d'ancrage que sur la carte (pied du personnage), mis à l'échelle de sa hauteur
      const meta = (t.sprite.texture.customData as { meta?: { cell: number[]; origin: number[] } }).meta ?? { cell: [1, 1], origin: [0.5, 0.9] };
      const inner = tl - 12, zoom = look.portraitZoom ?? 1;
      t.sprite.setOrigin(meta.origin[0] / meta.cell[0], meta.origin[1] / meta.cell[1])
        .setPosition(x, ty + inner / 2 * zoom).setScale(inner / look.height * zoom).setTint(look.tint ?? 0xffffff);
      const r = Phaser.Math.Clamp(e.hp / e.maxHp, 0, 1), bw = tl - 8, bby = ty + tl / 2 + 3;
      g.fillStyle(0x000000, 0.7); g.fillRect(x - bw / 2 - 1, bby - 1, bw + 2, 6);
      g.fillStyle(isPlayer ? 0x4aa3e8 : 0xd23b2e); g.fillRect(x - bw / 2, bby, bw * r, 4);
    });

    this.center.setPosition(W / 2, H * 0.3);
    this.bannerBg.setPosition(W / 2, H * 0.3 + 8);
    this.toastText.setPosition(W / 2, H * 0.18);
    this.help.setPosition(W / 2, boss ? 84 : 44);
  }
}
