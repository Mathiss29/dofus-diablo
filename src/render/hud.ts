import Phaser from 'phaser';
import { GAME_DATA } from '../sim/data';
import { ISO } from '../sim/iso';
import type { SimEvent } from '../sim/events';
import type { Monster } from '../sim/monster';
import type { WorldGrid } from '../sim/gridmap';
import type { World } from '../sim/world';

const FONT = 'Trebuchet MS, Verdana, sans-serif';
const STYLE = { fontFamily: FONT, fontSize: '14px', color: '#e8e2d4', stroke: '#000', strokeThickness: 3 };
const UI = 'assets/ui';

/** Images d'interface de Dofus 3 (bundles figs, uielements, uidarkstone, icons ; voir tools/extraction/LISEZMOI.md). */
const UI_IMAGES = [
  'slot_dark_background_full', 'slot_light_lock', 'icon_pv', 'iconBossSkull',
  'background_levelup_banner', 'background_defeat_banner',
  'i_character', 'i_bestiaire', 'i_journal', 'i_trophy', 'i_world', 'i_quests', 'i_spell',
];
/** Tête de chaque classe pour la fiche du perso (icônes de classe de Dofus 3). */
const HEADS: Record<string, string> = { iop: 'tete_iop', cra: 'tete_cra' };
/** Touches de la barre de sorts : 1 à 6, soit & é " ' ( - sur un clavier AZERTY. */
const KEYS = ['&', 'é', '"', "'", '(', '-'];
/** Colonne de menus (à droite de la mini-carte) : icône, nom, raccourci. */
const MENUS: [string, string, string][] = [
  ['i_character', 'Personnage', 'C'], ['i_spell', 'Sorts', 'S'], ['i_quests', 'Quêtes', 'J'],
  ['i_bestiaire', 'Bestiaire', 'B'], ['i_trophy', 'Succès', 'U'], ['i_world', 'Carte', 'M'],
];

const C = {
  panel: 0x14130f, panelA: 0.9, border: 0x3a3a2c, track: 0x2c281f,
  hp: 0xe0625a, pa: 0x6fb2e8, pm: 0x9ad15a, rage: 0xf08a2c, xp: 0xb9e54b, gold: 0xe2b75a,
};
const css = (n: number) => '#' + n.toString(16).padStart(6, '0');

type Fixed = Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth;
type Txt = Phaser.GameObjects.Text;
type Img = Phaser.GameObjects.Image;

interface SlotView { bg: Img; icon: Img | null; cd: Txt; key: Txt; cost: Txt }
interface FeedLine { text: Txt; t: number }

/** Interface fixe à l'écran, façon MMO Dofus 3 (choix 13D de la maquette), adaptée au temps réel :
 *  - en haut à gauche, la fiche du perso (PV, PA, PM, Rage) et la fiche de la cible ;
 *  - en haut au centre, les coordonnées et la sous-zone ; la jauge de boss juste dessous ;
 *  - en haut à droite, la mini-carte et la colonne de menus ;
 *  - en bas au centre, l'XP au-dessus d'une seule rangée de 6 sorts, le déplacement, la potion et la Rage ;
 *  - en bas à gauche, le suivi (à la place du chat) ; en bas à droite, le butin. */
export class Hud {
  static preload(scene: Phaser.Scene) {
    for (const k of UI_IMAGES) if (!scene.textures.exists(k)) scene.load.image(k, `${UI}/${k}.png`);
    for (const k of Object.values(HEADS)) if (!scene.textures.exists(k)) scene.load.image(k, `${UI}/${k}.png`);
    const icons = new Set<number>();
    for (const c of Object.values(GAME_DATA.classes)) for (const s of Object.values(c.spells)) icons.add(s.icon);
    for (const i of icons) if (!scene.textures.exists(`sort_${i}`)) scene.load.image(`sort_${i}`, `${UI}/sorts/sort_${i}.png`);
  }

  /** Clic sur une icône de la colonne de menus (le jeu ne se met pas en pause : multijoueur prévu). */
  onMenu: (name: string) => void = () => {};

  private g: Phaser.GameObjects.Graphics;
  private fixed: <T extends Fixed>(o: T, d?: number) => T;
  // fiche du perso
  private head: Img;
  private name: Txt; private hpText: Txt; private paText: Txt; private pmText: Txt; private rageText: Txt;
  // fiche de la cible
  private targetName: Txt; private targetHp: Txt;
  private targetId = -1; private targetT = 0;
  // haut centre
  private coords: Txt;
  private boss: { skull: Img; name: Txt; hp: Txt };
  // mini-carte
  private mini: Img | null = null;
  private miniScale = 1 / 36;
  private miniOrigin = { x: 0, y: 0 };
  private miniLabel: Txt;
  private menus: { icon: Img; zone: Phaser.GameObjects.Zone }[] = [];
  private menuTip: Txt;
  // barre du bas
  private slots: SlotView[] = [];
  private move: SlotView;
  private potion: SlotView;
  private xpText: Txt;
  private rageLabel: Txt;
  // suivi et butin
  private trackTitle: Txt; private trackBody: Txt;
  private feed: FeedLine[] = [];
  // bannières
  private bannerBg: Img;
  private center: Txt;
  private toastText: Txt;
  private hurtRect: Phaser.GameObjects.Rectangle;
  private help: Txt;
  private helpAuto = true;
  private shortOf = { pa: 0, pm: 0 };
  private rageFlash = 0;
  private areaKills = new Map<string, number>();

  constructor(private scene: Phaser.Scene, private world: World) {
    const fixed = <T extends Fixed>(o: T, d = 0) => { o.setScrollFactor(0); o.setDepth(2e6 + d); return o; };
    this.fixed = fixed;
    const img = (k: string, d = 2) => fixed(scene.add.image(0, 0, k), d);
    const txt = (size: number, extra: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}, d = 5) =>
      fixed(scene.add.text(0, 0, '', { ...STYLE, fontSize: `${size}px`, ...extra }), d);
    const bold = { fontStyle: 'bold' };
    const cls = world.player.cls;

    this.hurtRect = fixed(scene.add.rectangle(0, 0, 10, 10, 0xc0201a, 1).setOrigin(0).setAlpha(0), -1);
    this.g = fixed(scene.add.graphics(), 1);

    this.head = img(HEADS[Object.keys(GAME_DATA.classes).find(k => GAME_DATA.classes[k] === cls) ?? 'iop'] ?? 'tete_iop');
    this.name = txt(15, { ...bold, color: '#f1ecd8' }).setOrigin(0, 0.5);
    this.hpText = txt(12, bold).setOrigin(0.5);
    this.paText = txt(11, bold).setOrigin(0.5);
    this.pmText = txt(11, bold).setOrigin(0.5);
    this.rageText = txt(11, bold).setOrigin(0.5);
    this.targetName = txt(14, { ...bold, color: '#f1ecd8' }).setOrigin(0, 0.5);
    this.targetHp = txt(11, bold).setOrigin(0.5);

    this.coords = txt(15, { ...bold, strokeThickness: 4 }).setOrigin(0.5, 0);
    this.boss = { skull: img('iconBossSkull', 4), name: txt(16, { ...bold, color: '#ffe3b0' }).setOrigin(0.5), hp: txt(11, bold).setOrigin(0.5) };

    const wg = world.worldGrid;
    if (wg) this.buildMinimap(wg);
    this.miniLabel = txt(11, { color: '#d8d0b8' }).setOrigin(0.5, 0);
    this.menuTip = txt(12, { backgroundColor: '#14130f', padding: { x: 6, y: 3 } }, 9).setOrigin(1, 0.5).setVisible(false);
    for (const [icon, label, key] of MENUS) {
      const ic = img(icon, 4);
      const zone = fixed(scene.add.zone(0, 0, 30, 30).setInteractive({ useHandCursor: true }), 4);
      zone.on('pointerover', () => this.menuTip.setText(`${label} (${key})`).setVisible(true).setPosition(zone.x - 22, zone.y));
      zone.on('pointerout', () => this.menuTip.setVisible(false));
      zone.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => { ev.stopPropagation(); this.onMenu(label); });
      this.menus.push({ icon: ic, zone });
    }

    const mkSlot = (icon: number | null, key: string): SlotView => ({
      bg: img(icon ? 'slot_dark_background_full' : 'slot_light_lock', 2),
      icon: icon ? img(`sort_${icon}`, 3) : null,
      cd: txt(17, { ...bold, strokeThickness: 4 }, 6).setOrigin(0.5),
      key: txt(12, { ...bold, strokeThickness: 3 }, 6).setOrigin(0, 0).setText(key),
      cost: txt(11, { ...bold, color: css(C.pa) }, 6).setOrigin(1, 1),
    });
    for (let i = 0; i < 6; i++) {
      const id = cls.bar[i];
      this.slots.push(mkSlot(id ? cls.spells[id].icon : null, KEYS[i]));
    }
    this.move = mkSlot(cls.spells[cls.mobility].icon, 'Esp.');
    this.potion = mkSlot(null, 'E');
    this.potion.bg.setTexture('slot_dark_background_full');
    this.potion.icon = img('icon_pv', 3);
    this.xpText = txt(12, bold).setOrigin(0.5);
    this.rageLabel = txt(11, { ...bold, color: css(C.rage) }).setOrigin(0.5, 0).setText(cls.rage.name);

    this.trackTitle = txt(13, { ...bold, color: css(C.xp) });
    this.trackBody = txt(12, { lineSpacing: 3 });

    this.bannerBg = img('background_levelup_banner', 7).setAlpha(0);
    this.center = txt(34, { ...bold, stroke: '#3a2208', strokeThickness: 6, align: 'center', lineSpacing: -4 }, 8).setOrigin(0.5).setAlpha(0);
    this.toastText = txt(15, {}, 8).setOrigin(0.5).setAlpha(0);
    const S = cls.spells, bar = cls.bar.map((id, i) => `${KEYS[i]} ${S[id].name}`).join('  ·  ');
    this.help = txt(13, { align: 'center' }).setOrigin(0.5, 0).setText(
      `ZQSD : se déplacer   ·   Clic gauche (maintenu) : ${cls.basic ? S[cls.basic].name : cls.attaque.name}   ·   Clic droit : ${S[cls.favorite].name}   ·   Espace : ${S[cls.mobility].name}   ·   E : potion   ·   I : inventaire\n` +
      `${bar}\n` +
      `${cls.rage.name} pleine : le sort suivant est renforcé   ·   K : changer de classe (Iop / Crâ)   ·   F : effets d'impact   ·   H : aide`);
  }

  /** Mini-carte : les cases marchables du monde, projetées comme à l'écran et réduites, colorées par sous-zone. */
  private buildMinimap(wg: WorldGrid) {
    const k = this.miniScale, pts = wg.free.map(c => { const w = wg.cellToWorld(c), s = ISO.toScreen(w.x, w.y); return { c, x: s.x * k, y: s.y * k }; });
    const minX = Math.min(...pts.map(p => p.x)) - 4, minY = Math.min(...pts.map(p => p.y)) - 4;
    const W = Math.ceil(Math.max(...pts.map(p => p.x)) - minX + 8), H = Math.ceil(Math.max(...pts.map(p => p.y)) - minY + 8);
    const key = 'minimap_' + wg.world.maps.length;
    const tex = this.scene.textures.exists(key) ? this.scene.textures.get(key) as Phaser.Textures.CanvasTexture : this.scene.textures.createCanvas(key, W, H)!;
    const ctx = tex.getContext(), subs = [...new Set(wg.world.maps.map(m => m.sub))];
    const tints = ['#6f8f4a', '#8a9a5a', '#5f7f8f', '#8f7a5a', '#7a6f9a'];
    ctx.fillStyle = '#0d0c0a'; ctx.fillRect(0, 0, W, H);
    for (const p of pts) {
      const m = wg.mapOfCell(p.c);
      ctx.fillStyle = tints[Math.max(0, subs.indexOf(m?.sub ?? -1)) % tints.length];
      ctx.fillRect(p.x - minX - 1.5, p.y - minY - 1, 3.5, 2);
    }
    tex.refresh();
    this.miniOrigin = { x: minX, y: minY };
    this.mini = this.fixed(this.scene.add.image(0, 0, key).setOrigin(0), 2);
  }

  /** H : l'aide reste ensuite comme le joueur l'a laissée. */
  toggleHelp() { this.helpAuto = false; this.help.setVisible(!this.help.visible); }

  /** Bannière centrale ; defeat = ruban rouge de défaite au lieu du ruban doré. */
  banner(text: string, ms = 1400, defeat = false) {
    const c = this.center, b = this.bannerBg;
    b.setTexture(defeat ? 'background_defeat_banner' : 'background_levelup_banner');
    c.setText(text).setAlpha(1).setScale(1.3);
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
    this.scene.tweens.add({ targets: this.toastText, alpha: 0, delay: 1600, duration: 400 });
  }
  hurtFlash(strong: boolean) {
    this.hurtRect.setAlpha(strong ? 0.28 : 0.1);
    this.scene.tweens.add({ targets: this.hurtRect, alpha: 0, duration: 300 });
  }
  /** Sort lancé sans assez de PA (ou de PM) : la barre clignote en rouge. */
  noResource(res: 'pa' | 'pm') { this.shortOf[res] = 0.35; }
  /** Ligne dans le journal de butin (en bas à droite). */
  loot(text: string, color = '#e8e2d4') {
    const t = this.fixed(this.scene.add.text(0, 0, text, { ...STYLE, fontSize: '13px', color }).setOrigin(1, 1), 5);
    this.feed.unshift({ text: t, t: 5 });
    for (const f of this.feed.splice(6)) f.text.destroy();
  }

  /** Événements de la simulation utiles à l'interface. */
  handle(e: SimEvent) {
    const w = this.world;
    switch (e.k) {
      case 'hit': if (e.target === 'monster' && e.id !== undefined) { this.targetId = e.id; this.targetT = 5; } break;
      case 'kill': {
        const d = GAME_DATA.monsters[e.monster];
        this.loot(`${d.name}  ·  +${d.xp ?? Math.round(d.hp / 5)} XP`);
        const a = w.area?.name ?? '';
        this.areaKills.set(a, (this.areaKills.get(a) ?? 0) + 1);
        if (this.helpAuto && w.kills >= 6) { this.help.setVisible(false); this.helpAuto = false; }
        break;
      }
      case 'rageFull': this.rageFlash = 1.2; break;
      case 'groupCleared': this.loot('Groupe vaincu  ·  +1 potion', '#7be07b'); break;
    }
  }

  draw(juice: boolean, dt = 1 / 60) {
    const world = this.world, W = this.scene.scale.width, H = this.scene.scale.height, g = this.g, p = world.player, cls = p.cls;
    g.clear();
    this.hurtRect.setSize(W, H);
    this.shortOf.pa = Math.max(0, this.shortOf.pa - dt); this.shortOf.pm = Math.max(0, this.shortOf.pm - dt);
    this.rageFlash = Math.max(0, this.rageFlash - dt);
    const blink = (v: number) => v > 0 && Math.floor(v * 12) % 2 === 0;
    const panel = (x: number, y: number, w: number, h: number, a = C.panelA) => {
      g.fillStyle(C.panel, a); g.fillRoundedRect(x, y, w, h, 5);
      g.lineStyle(1, C.border, 1); g.strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, 5);
    };
    const bar = (x: number, y: number, w: number, h: number, r: number, col: number) => {
      g.fillStyle(C.track, 1); g.fillRoundedRect(x, y, w, h, h / 2);
      if (r > 0) { g.fillStyle(col, 1); g.fillRoundedRect(x, y, Math.max(h, w * Phaser.Math.Clamp(r, 0, 1)), h, h / 2); }
    };

    // --- Fiche du perso (haut gauche) ---
    const fx = 12, fy = 10, fw = 270, fh = 92;
    panel(fx, fy, fw, fh);
    this.head.setPosition(fx + 38, fy + fh / 2).setDisplaySize(60, 60);
    const bx = fx + 76, bw = fw - 88;
    this.name.setPosition(bx, fy + 16).setText(`${cls.name}  ·  niv. ${p.level}`);
    bar(bx, fy + 28, bw, 15, p.hp / p.maxHp, C.hp);
    this.hpText.setPosition(bx + bw / 2, fy + 35.5).setText(`${Math.max(0, Math.ceil(p.hp))} / ${p.maxHp}`);
    const hw = (bw - 6) / 2;
    bar(bx, fy + 48, hw, 13, p.pa / p.paMax, blink(this.shortOf.pa) ? 0xff5040 : C.pa);
    this.paText.setPosition(bx + hw / 2, fy + 54.5).setText(`${Math.floor(p.pa)} PA`);
    bar(bx + hw + 6, fy + 48, hw, 13, p.pm / p.pmMax, blink(this.shortOf.pm) ? 0xff5040 : C.pm);
    this.pmText.setPosition(bx + hw + 6 + hw / 2, fy + 54.5).setText(`${Math.floor(p.pm)} PM`);
    const rr = p.rage / cls.rage.max, rageCol = p.rageFull ? (Math.floor(world.time * 6) % 2 ? 0xffc04d : C.rage) : C.rage;
    bar(bx, fy + 66, bw, 13, rr, rageCol);
    this.rageText.setPosition(bx + bw / 2, fy + 72.5).setText(p.rageFull ? `${cls.rage.name} pleine !` : `${cls.rage.name} ${Math.floor(p.rage)}`);

    // --- Fiche de la cible (à côté) : le dernier monstre touché ---
    this.targetT -= dt;
    const tgt = world.monsters.find(m => m.id === this.targetId && !m.dead) as Monster | undefined;
    const showT = !!tgt && this.targetT > 0;
    this.targetName.setVisible(showT); this.targetHp.setVisible(showT);
    if (tgt && showT) {
      const tx = fx + fw + 8, tw = 210, th = 52;
      panel(tx, fy, tw, th);
      this.targetName.setPosition(tx + 10, fy + 15).setText(`${tgt.def.name}  ·  niv. ${this.world.monsterLevel(tgt)}`);
      bar(tx + 10, fy + 28, tw - 20, 14, tgt.hp / tgt.maxHp, tgt.def.boss || tgt.def.elite ? C.gold : C.hp);
      this.targetHp.setPosition(tx + tw / 2, fy + 35).setText(`${Math.max(0, Math.ceil(tgt.hp))} / ${tgt.maxHp}`);
    }

    // --- Coordonnées et sous-zone (haut centre) ---
    const map = world.worldGrid?.mapAt(p.x, p.y);
    this.coords.setPosition(W / 2, 10).setText(map ? `${map.x},${map.y}  ${world.zone.name}${world.area ? ` (${world.area.name})` : ''}` : world.zone.name);

    // --- Jauge de boss ---
    const boss = world.monsters.find(m => m.def.boss && !m.dead);
    const Bv = this.boss, vis = !!boss;
    Bv.skull.setVisible(vis); Bv.name.setVisible(vis); Bv.hp.setVisible(vis);
    if (boss) {
      const w = Math.min(520, W * 0.36), x = W / 2 - w / 2, y = 48;
      panel(x - 40, y - 26, w + 60, 50);
      bar(x, y + 2, w, 14, boss.hp / boss.maxHp, 0xc8352b);
      Bv.skull.setPosition(x - 20, y + 9).setDisplaySize(28, 28);
      Bv.name.setPosition(W / 2, y - 10).setText(boss.def.name);
      Bv.hp.setPosition(W / 2, y + 9).setText(`${Math.max(0, Math.ceil(boss.hp))} / ${boss.maxHp}`);
    }

    // --- Mini-carte et colonne de menus (haut droite) ---
    const colX = W - 12 - 34, mw = 210, mh = 150, mx = colX - 8 - mw, my = 10;
    panel(mx - 3, my - 3, mw + 6, mh + 6, 1);
    if (this.mini) {
      const s = ISO.toScreen(p.x, p.y), k = this.miniScale;
      const px = s.x * k - this.miniOrigin.x, py = s.y * k - this.miniOrigin.y;
      const tw = this.mini.width, th = this.mini.height;
      const cx = Phaser.Math.Clamp(px - mw / 2, 0, Math.max(0, tw - mw)), cy = Phaser.Math.Clamp(py - mh / 2, 0, Math.max(0, th - mh));
      this.mini.setCrop(cx, cy, mw, mh).setPosition(mx - cx, my - cy);
      // monstres proches (points rouges) et joueur (point clair)
      for (const m of world.monsters) {
        if (m.dead) continue;
        const ms = ISO.toScreen(m.x, m.y), ox = ms.x * k - this.miniOrigin.x - cx, oy = ms.y * k - this.miniOrigin.y - cy;
        if (ox < 0 || oy < 0 || ox > mw || oy > mh) continue;
        g.fillStyle(m.def.boss || m.def.elite ? C.gold : 0xd04030, 1); g.fillCircle(mx + ox, my + oy, m.def.boss ? 3 : 1.6);
      }
      g.fillStyle(0xffffff, 1); g.fillCircle(mx + px - cx, my + py - cy, 3.2);
      g.lineStyle(1.5, 0x000000, 1); g.strokeCircle(mx + px - cx, my + py - cy, 3.2);
    }
    this.miniLabel.setPosition(mx + mw / 2, my + mh + 6).setText(world.area?.name ?? world.zone.name);
    this.menus.forEach((m, i) => {
      const y = my + 17 + i * 36;
      panel(colX, y - 16, 34, 32, 1);
      m.icon.setPosition(colX + 17, y).setDisplaySize(26, 26);
      m.zone.setPosition(colX + 17, y);
    });

    // --- Barre du bas : XP, 6 sorts, déplacement, potion, Rage ---
    const slot = 54, gap = 5, n = 6;
    const barW = n * slot + (n - 1) * gap, extra = 16 + slot + gap + slot + 16 + 64;
    const totalW = barW + extra + 24, x0 = Math.round(W / 2 - totalW / 2), y0 = H - 12 - (slot + 44);
    panel(x0, y0, totalW, slot + 44);
    const xr = p.level >= cls.maxLevel ? 1 : p.xp / p.xpNeeded;
    bar(x0 + 12, y0 + 10, totalW - 24, 12, xr, C.xp);
    this.xpText.setPosition(W / 2, y0 + 16).setText(p.level >= cls.maxLevel ? `NIV. ${p.level} (max)` : `XP ${Math.floor(p.xp)} / ${p.xpNeeded}  ·  NIV. ${p.level}`);
    const sy = y0 + 30 + slot / 2;
    const drawSlot = (s: SlotView, x: number, id: string | null) => {
      s.bg.setPosition(x, sy).setDisplaySize(slot, slot);
      if (!id || !s.icon) { s.cd.setText(''); s.cost.setText(''); return; }
      const def = cls.spells[id], cd = p.cd[id] ?? 0, frac = def.cooldown ? cd / def.cooldown : 0;
      const ok = p.hasResource(id), inner = slot - 8;
      s.icon.setPosition(x, sy).setDisplaySize(inner, inner).setTint(cd > 0 ? 0x8a8a8a : ok ? 0xffffff : 0x6f86b8);
      if (frac > 0) { g.fillStyle(0x000000, 0.55); g.fillRect(x - inner / 2, sy - inner / 2, inner, inner * frac); }
      if (p.skill?.id === id) { g.lineStyle(2, 0xf2d36b, 1); g.strokeRoundedRect(x - slot / 2 + 1, sy - slot / 2 + 1, slot - 2, slot - 2, 6); }
      if (p.rageFull && !def.move) { g.lineStyle(2, C.rage, 0.5 + 0.5 * Math.sin(world.time * 8)); g.strokeRoundedRect(x - slot / 2 - 1, sy - slot / 2 - 1, slot + 2, slot + 2, 7); }
      const st = p.stacks[id];
      s.cd.setPosition(x, sy).setText(cd > 0 ? (cd >= 1 ? `${Math.ceil(cd)}s` : cd.toFixed(1)) : st ? `x${st.n}` : '');
      s.key.setPosition(x - slot / 2 + 4, sy - slot / 2 + 1);
      s.cost.setPosition(x + slot / 2 - 3, sy + slot / 2 - 1).setText(def.pm ? `${def.pm} PM` : def.pa ? `${def.pa}` : '').setColor(def.pm ? css(C.pm) : css(C.pa));
    };
    const sx0 = x0 + 12 + slot / 2;
    this.slots.forEach((s, i) => drawSlot(s, sx0 + i * (slot + gap), cls.bar[i] ?? null));
    const mvx = sx0 + n * (slot + gap) + 16;
    drawSlot(this.move, mvx, cls.mobility);
    // Potion (E) : charges, +1 par groupe vaincu
    const po = this.potion, pox = mvx + slot + gap, pcd = p.potionCd / cls.potion.cooldown;
    po.bg.setPosition(pox, sy).setDisplaySize(slot, slot);
    po.icon!.setPosition(pox, sy).setDisplaySize(30, 30).setAlpha(p.potions > 0 ? 1 : 0.35);
    po.key.setPosition(pox - slot / 2 + 4, sy - slot / 2 + 1);
    po.cost.setPosition(pox + slot / 2 - 3, sy + slot / 2 - 1).setText(String(p.potions)).setColor('#ffffff');
    if (pcd > 0) { g.fillStyle(0x000000, 0.55); g.fillRect(pox - 23, sy - 23, 46, 46 * pcd); }
    // Rage : jauge verticale qui clignote une fois pleine
    const rx = pox + slot / 2 + 30, rh = slot - 14, ry = sy - slot / 2 + 2;
    g.fillStyle(C.track, 1); g.fillRoundedRect(rx - 9, ry, 18, rh, 5);
    g.fillStyle(rageCol, 1); g.fillRoundedRect(rx - 9, ry + rh * (1 - rr), 18, Math.max(4, rh * rr), 5);
    if (this.rageFlash > 0 && juice) { g.lineStyle(3, 0xffc04d, this.rageFlash); g.strokeRoundedRect(rx - 12, ry - 3, 24, rh + 6, 6); }
    this.rageLabel.setPosition(rx, ry + rh + 1);

    // --- Suivi (bas gauche) ---
    const a = world.area, kills = this.areaKills.get(a?.name ?? '') ?? 0;
    this.trackTitle.setText(a ? `Exploration · ${a.name}` : world.zone.name);
    this.trackBody.setText([
      a ? `Monstres du coin vaincus : ${kills}` : `Monstres vaincus : ${world.kills}`,
      `Point de retour : ${world.checkpointName}`,
      juice ? '' : 'Effets d\'impact désactivés (F)',
    ].filter(Boolean).join('\n'));
    const tw2 = Math.max(this.trackTitle.width, this.trackBody.width) + 20, th2 = this.trackTitle.height + this.trackBody.height + 18;
    const tx2 = 12, ty2 = H - 12 - th2;
    panel(tx2, ty2, tw2, th2, 0.8);
    this.trackTitle.setPosition(tx2 + 10, ty2 + 7);
    this.trackBody.setPosition(tx2 + 10, ty2 + 10 + this.trackTitle.height);

    // --- Butin (bas droite) : les dernières lignes s'effacent ---
    this.feed.forEach((f, i) => { f.t -= dt; f.text.setPosition(W - 16, H - 16 - i * 18).setAlpha(Phaser.Math.Clamp(f.t, 0, 1)); });
    for (const f of this.feed.filter(f => f.t <= 0)) f.text.destroy();
    this.feed = this.feed.filter(f => f.t > 0);

    this.center.setPosition(W / 2, H * 0.3);
    this.bannerBg.setPosition(W / 2, H * 0.3 + 8);
    this.toastText.setPosition(W / 2, H * 0.2);
    this.help.setPosition(W / 2, boss ? 104 : 40);
  }
}
