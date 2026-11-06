import { RARITY_COLORS } from '../sim/items';
import { v } from './assetUrl';
import Phaser from 'phaser';
import { GAME_DATA } from '../sim/data';
import { ISO } from '../sim/iso';
import type { SimEvent } from '../sim/events';
import type { Monster } from '../sim/monster';
import type { World } from '../sim/world';
import { QUEST_ICON } from './questView';

const FONT = 'Trebuchet MS, Verdana, sans-serif';
const STYLE = { fontFamily: FONT, fontSize: '14px', color: '#e8e2d4', stroke: '#000', strokeThickness: 3 };
const UI = 'assets/ui';

/** Images d'interface de Dofus 3 (bundles figs, uielements, uidarkstone, icons ; voir tools/extraction/LISEZMOI.md). */
const UI_IMAGES = [
  'slot_dark_background_full', 'slot_light_lock', 'icon_pv', 'iconBossSkull',
  'background_levelup_banner', 'background_defeat_banner', 'success_ornament', 'scoreTitle',
];
/** Tête de chaque classe pour la fiche du perso (icônes de classe de Dofus 3). */
const HEADS: Record<string, string> = { iop: 'tete_iop', cra: 'tete_cra', iop_f: 'tete_iop_f', cra_f: 'tete_cra_f' };
/** Touches de la barre de sorts : 1 à 6, soit & é " ' ( - sur un clavier AZERTY. */
const KEYS = ['&', 'é', '"', "'", '(', '-'];
/** Colonne de menus avec les icônes officielles en couleur de Dofus 3 (uiassets_2x) : icône, nom, raccourci (vide si aucun).
 *  Seulement les menus utiles au jeu ; les autres (guilde, montures...) viendront avec leur fonctionnalité. */
const MENUS: [string, string, string][] = [
  ['inventory', 'Inventaire', 'I'], ['characteristic', 'Caractéristiques', 'C'], ['job', 'Métiers', 'J'], ['spells', 'Sorts', 'S'], ['quest', 'Quêtes', ''],
  ['map', 'Carte du monde', ''], ['bestiary', 'Bestiaire', ''], ['success', 'Succès', ''], ['breach', 'Failles', ''],
  ['options', 'Réglages', 'O'],
];

const C = {
  panel: 0x14130f, panelA: 0.9, border: 0x3a3a2c, track: 0x2c281f,
  hp: 0xe0625a, shield: 0xa66be0, pa: 0x6fb2e8, pm: 0x9ad15a, rage: 0xf08a2c, xp: 0xb9e54b, gold: 0xe2b75a,
};
const css = (n: number) => '#' + n.toString(16).padStart(6, '0');

type Fixed = Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth;
type Txt = Phaser.GameObjects.Text;
type Img = Phaser.GameObjects.Image;

interface SlotView { bg: Img; icon: Img | null; cd: Txt; key: Txt; cost: Txt; zone?: Phaser.GameObjects.Zone }
interface FeedLine { text: Txt; t: number }

/** Interface fixe à l'écran, façon MMO Dofus 3 (choix 13D de la maquette), adaptée au temps réel :
 *  - en haut à gauche, la fiche du perso (PV, PA, PM, Rage) et la fiche de la cible ;
 *  - en haut au centre, les coordonnées et la sous-zone ; la jauge de boss juste dessous ;
 *  - en haut à droite, la mini-carte et la colonne de menus ;
 *  - en bas au centre, l'XP au-dessus d'une seule rangée de 6 sorts, le déplacement, la potion et la Rage ;
 *  - en bas à gauche, le suivi (à la place du chat) ; en bas à droite, le butin. */
export class Hud {
  static preload(scene: Phaser.Scene) {
    for (const k of UI_IMAGES) if (!scene.textures.exists(k)) scene.load.image(k, v(`${UI}/${k}.png`));
    for (const [k] of MENUS) if (!scene.textures.exists(`menu_${k}`)) scene.load.image(`menu_${k}`, v(`${UI}/menu/${k}.png`));
    for (const k of Object.values(HEADS)) if (!scene.textures.exists(k)) scene.load.image(k, v(`${UI}/${k}.png`));
    const icons = new Set<number>();
    for (const c of Object.values(GAME_DATA.classes)) for (const s of Object.values(c.spells)) icons.add(s.icon);
    for (const i of icons) if (!scene.textures.exists(`sort_${i}`)) scene.load.image(`sort_${i}`, v(`${UI}/sorts/sort_${i}.png`));
    // Auto-attaque à l'arme : icônes officielles weapon_<typeId> (arme_0 = sans arme)
    for (const t of [0, 2, 3, 4, 5, 6, 7, 8, 19, 22]) if (!scene.textures.exists(`arme_${t}`)) scene.load.image(`arme_${t}`, v(`${UI}/sorts/arme_${t}.png`));
  }

  /** Clic sur une icône de la colonne de menus (le jeu ne se met pas en pause : multijoueur prévu). */
  onMenu: (name: string) => void = () => {};
  /** Survol d'un emplacement de sort (id du sort, centre haut de l'emplacement à l'écran) ; null quand on le quitte. */
  onSlotHover: (id: string | null, x: number, y: number) => void = () => {};
  /** Rectangles de l'interface à l'écran (un clic dessus ne doit pas faire attaquer). */
  private rects: [number, number, number, number][] = [];
  blocks(x: number, y: number) { return this.rects.some(([rx, ry, rw, rh]) => x >= rx && y >= ry && x <= rx + rw && y <= ry + rh); }

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
  private miniCam: Phaser.Cameras.Scene2D.Camera | null = null;
  private miniLabel: Txt;
  private menus: { icon: Img; zone: Phaser.GameObjects.Zone }[] = [];
  private menuTip: Txt;
  // barre du bas
  private slots: SlotView[] = [];
  private auto: SlotView;
  private potion: SlotView;
  private xpText: Txt;
  private rageLabel: Txt;
  // suivi et butin
  private trackTitle: Txt; private trackBody: Txt;
  /** Quêtes : icône de la quête suivie, bouton « Passer » (tutoriel, 7A), ligne de succès discrète (19B), flèche au bord de l'écran (8B). */
  private trackIcon: Img; private skipBtn: Txt; private succesLine: Txt; private succesT = 0; private arrow: Phaser.GameObjects.Graphics;
  /** Clic sur « Passer » (quête id). */
  onPasser: (id: string) => void = () => {};
  private feed: FeedLine[] = [];
  // bannières
  private bannerBg: Img;
  /** Bandeau de zone (maquette « Bandeau » : 1B+1C 2A+2C 3A) : grand nom + ornement doré, ou plaque dorée discrète. */
  private zoneName: Txt;
  private zoneOrn: Img;
  private zoneSub: Txt;
  private zonePlate: Img;
  private zonePlateTxt: Txt;
  private center: Txt;
  private toastText: Txt;
  private hurtRect: Phaser.GameObjects.Rectangle;
  private help: Txt;
  /** Tutoriel (3A) : la touche à presser, au-dessus de l'emplacement entouré. */
  private haloKey: Txt;
  private helpAuto = true;
  private shortOf = { pa: 0, pm: 0 };
  private rageFlash = 0;
  private areaKills = new Map<string, number>();

  constructor(private scene: Phaser.Scene, private world: World, private perso?: { nom: string; sexe: 'm' | 'f' }) {
    // Mini-carte façon Dofus 3 : une petite caméra qui filme le vrai décor autour du perso (vue de dessus réduite)
    if (world.worldGrid) {
      this.miniCam = scene.cameras.add(0, 0, 210, 150).setName('mini').setZoom(0.16).setBackgroundColor('#0d0c0a');
      scene.cameras.cameras.forEach(c => { if (c.name === 'ui') { scene.cameras.cameras.splice(scene.cameras.cameras.indexOf(c), 1); scene.cameras.cameras.push(c); } });
    }
    // L'interface est dessinée par la caméra « ui » (sans zoom) et ignorée par la caméra du jeu (zoomable)
    const fixed = <T extends Fixed>(o: T, d = 0) => {
      o.setScrollFactor(0); o.setDepth(2e6 + d);
      (o as unknown as Phaser.GameObjects.GameObject).cameraFilter = 0;
      scene.cameras.main.ignore(o as unknown as Phaser.GameObjects.GameObject);
      this.miniCam?.ignore(o as unknown as Phaser.GameObjects.GameObject);
      return o;
    };
    this.fixed = fixed;
    const img = (k: string, d = 2) => fixed(scene.add.image(0, 0, k), d);
    const txt = (size: number, extra: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}, d = 5) =>
      fixed(scene.add.text(0, 0, '', { ...STYLE, fontSize: `${size}px`, ...extra }), d);
    const bold = { fontStyle: 'bold' };
    const cls = world.player.cls;

    this.hurtRect = fixed(scene.add.rectangle(0, 0, 10, 10, 0xc0201a, 1).setOrigin(0).setAlpha(0), -1);
    this.g = fixed(scene.add.graphics(), 1);

    const clsId = Object.keys(GAME_DATA.classes).find(k => GAME_DATA.classes[k] === cls) ?? 'iop';
    this.head = img(HEADS[clsId + (perso?.sexe === 'f' ? '_f' : '')] ?? HEADS[clsId] ?? 'tete_iop');
    this.name = txt(15, { ...bold, color: '#f1ecd8' }).setOrigin(0, 0.5);
    this.hpText = txt(12, bold).setOrigin(0.5);
    this.paText = txt(11, bold).setOrigin(0.5);
    this.pmText = txt(11, bold).setOrigin(0.5);
    this.rageText = txt(11, bold).setOrigin(0.5);
    this.targetName = txt(14, { ...bold, color: '#f1ecd8' }).setOrigin(0, 0.5);
    this.targetHp = txt(11, bold).setOrigin(0.5);

    this.coords = txt(15, { ...bold, strokeThickness: 4 }).setOrigin(0.5, 0);
    this.boss = { skull: img('iconBossSkull', 4), name: txt(16, { ...bold, color: '#ffe3b0' }).setOrigin(0.5), hp: txt(11, bold).setOrigin(0.5) };

    this.miniLabel = txt(11, { color: '#d8d0b8' }).setOrigin(0.5, 0);
    this.menuTip = txt(12, { backgroundColor: '#14130f', padding: { x: 6, y: 3 } }, 9).setOrigin(1, 0.5).setVisible(false);
    for (const [icon, label, key] of MENUS) {
      const ic = img(`menu_${icon}`, 4);
      const zone = fixed(scene.add.zone(0, 0, 30, 30).setInteractive({ useHandCursor: true }), 4);
      zone.on('pointerover', () => this.menuTip.setText(key ? `${label} (${key})` : label).setVisible(true).setPosition(zone.x - 22, zone.y));
      zone.on('pointerout', () => this.menuTip.setVisible(false));
      zone.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => { ev.stopPropagation(); this.onMenu(label); });
      this.menus.push({ icon: ic, zone });
    }

    const anyIcon = Object.values(cls.spells)[0].icon;
    const mkSlot = (icon: number | null, key: string): SlotView => ({
      bg: img(icon ? 'slot_dark_background_full' : 'slot_light_lock', 2),
      icon: img(`sort_${icon ?? anyIcon}`, 3).setVisible(!!icon),
      cd: txt(17, { ...bold, strokeThickness: 4 }, 6).setOrigin(0.5),
      key: txt(12, { ...bold, strokeThickness: 3 }, 6).setOrigin(0, 0).setText(key),
      cost: txt(11, { ...bold, color: css(C.pa) }, 6).setOrigin(1, 1),
    });
    // Barre du joueur (Player.bar) : 6 touches, le clic droit (case libre, choix 6A) et Espace ; les icônes suivent la barre
    for (let i = 0; i < 8; i++) this.slots.push(mkSlot(null, i < 6 ? KEYS[i] : i === 6 ? 'Clic D' : 'Esp.'));
    // Auto-attaque (clic gauche) : l'icône suit l'arme portée
    this.auto = mkSlot(cls.spells[cls.basic ?? cls.mobility].icon, 'Clic');
    this.auto.icon!.setTexture(cls.basic ? `sort_${cls.spells[cls.basic].icon}` : 'arme_0');
    // Survol : infobulle du sort
    const hover = (sv: SlotView, id: () => string | null) => {
      const z = fixed(scene.add.zone(0, 0, 54, 54).setInteractive(), 4);
      z.on('pointerover', () => { const i = id(); if (i) this.onSlotHover(i, z.x, z.y - 27); });
      z.on('pointerout', () => this.onSlotHover(null, 0, 0));
      sv.zone = z;
    };
    this.slots.forEach((sv, i) => hover(sv, () => world.player.bar[i] ?? null));
    hover(this.auto, () => world.player.autoAttack);
    this.potion = mkSlot(null, 'E');
    this.potion.bg.setTexture('slot_dark_background_full');
    this.potion.icon = img('icon_pv', 3);
    this.xpText = txt(12, bold).setOrigin(0.5);
    this.rageLabel = txt(11, { ...bold, color: css(C.rage) }).setOrigin(0.5, 0).setText(cls.rage.name);

    this.trackTitle = txt(13, { ...bold, color: css(C.xp) });
    this.trackBody = txt(12, { lineSpacing: 3 });
    this.trackIcon = img('qi_quest', 5).setVisible(false);
    this.succesLine = txt(12, { ...bold, color: '#f2d36b' }).setAlpha(0);
    this.skipBtn = txt(12, { ...bold, color: '#c9c4ab', backgroundColor: '#2e2d28', padding: { x: 6, y: 2 } }, 6).setText('Passer ›').setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.skipBtn.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation(); const q = world.quetes, id = q?.suivie; if (id) this.onPasser(id);
    });
    this.arrow = fixed(scene.add.graphics(), 3);

    this.bannerBg = img('background_levelup_banner', 7).setAlpha(0);
    this.center = txt(34, { ...bold, stroke: '#3a2208', strokeThickness: 6, align: 'center', lineSpacing: -4 }, 8).setOrigin(0.5).setAlpha(0);
    this.toastText = txt(15, {}, 8).setOrigin(0.5).setAlpha(0);
    this.zoneName = txt(40, { ...bold, stroke: '#1d1408', strokeThickness: 7 }, 8).setOrigin(0.5).setAlpha(0);
    this.zoneOrn = img('success_ornament', 7).setOrigin(0.5).setAlpha(0);
    this.zoneSub = txt(15, { ...bold, color: '#5a3305', strokeThickness: 0 }, 8).setOrigin(0.5).setAlpha(0);
    this.zonePlate = img('scoreTitle', 7).setOrigin(0.5).setAlpha(0);
    this.zonePlateTxt = txt(13, { ...bold, color: '#4a2a05', strokeThickness: 0, align: 'center', lineSpacing: -2 }, 8).setOrigin(0.5).setAlpha(0);
    this.help = txt(13, { align: 'center' }).setOrigin(0.5, 0).setText(
      `Clic gauche : aller / attaquer (maintenu : continuer)   ·   Maj + clic : attaquer sur place   ·   Clic droit et & é " ' ( - : sorts de la barre   ·   Espace : ${cls.spells[cls.mobility].name}   ·   E : potion   ·   Molette : zoom\n` +
      `S : sorts (nouveaux sorts aux niveaux officiels, glisser dans la barre)   ·   I : inventaire   ·   C : caractéristiques\n` +
      `${cls.rage.name} pleine : le sort suivant est renforcé   ·   F : effets d'impact   ·   O : réglages   ·   H : aide`);
    // Le tutoriel apprend les touches (maquette « Tutoriel d'Incarnam ») : la fiche ne s'affiche plus d'office, H la montre.
    this.help.setVisible(false); this.helpAuto = false;
    this.haloKey = txt(15, { ...bold, color: '#2a1e05', backgroundColor: '#e6b85c', padding: { x: 7, y: 3 }, strokeThickness: 0 }, 7).setOrigin(0.5, 1).setVisible(false);
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
  /** Entrée dans une sous-zone : la première fois, grand nom + ornement doré officiel ; ensuite, la petite plaque dorée.
   *  En haut de l'écran pour ne pas cacher le combat, 3 secondes. */
  zoneBanner(name: string, region: string, level: number, first: boolean) {
    const big = [this.zoneName, this.zoneOrn, this.zoneSub], small = [this.zonePlate, this.zonePlateTxt];
    this.scene.tweens.killTweensOf([...big, ...small]);
    for (const o of [...big, ...small]) o.setAlpha(0);
    const show = first ? big : small;
    if (first) { this.zoneName.setText(name); this.zoneSub.setText(`${region} · Niveau ${level}`); }
    else this.zonePlateTxt.setText(`${name}\nNiveau ${level}`);
    this.scene.tweens.add({ targets: show, alpha: 1, duration: 400 });
    this.scene.tweens.add({ targets: show, alpha: 0, delay: 3000, duration: 700 });
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

  /** Succès obtenu : une ligne discrète dans le suivi (19B), pas de bannière. */
  succes(nom: string, points: number) { this.succesLine.setText(`Succès : ${nom}  (+${points} pt${points > 1 ? 's' : ''})`).setAlpha(1); this.succesT = 6; }

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
    this.rects = [];
    const panel = (x: number, y: number, w: number, h: number, a = C.panelA) => {
      this.rects.push([x, y, w, h]);
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
    this.name.setPosition(bx, fy + 16).setText(this.perso ? `${this.perso.nom}  ·  ${cls.name} niv. ${p.level}` : `${cls.name}  ·  niv. ${p.level}`);
    bar(bx, fy + 28, bw, 15, p.hp / p.maxHp, C.hp);
    if (p.shield > 0) {   // bouclier en violet, comme dans Dofus : à la suite des PV, ou par-dessus la fin de la barre si elle est pleine
      const sw = Math.max(4, bw * Math.min(1, p.shield / p.maxHp)), sx = Math.min(bx + bw * Phaser.Math.Clamp(p.hp / p.maxHp, 0, 1), bx + bw - sw);
      g.fillStyle(C.shield, 0.95); g.fillRoundedRect(sx, fy + 28, sw, 15, 7);
    }
    this.hpText.setPosition(bx + bw / 2, fy + 35.5).setText(`${Math.max(0, Math.ceil(p.hp))} / ${p.maxHp}${p.shield > 0 ? `  +${Math.ceil(p.shield)}` : ''}`);
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
    this.coords.setPosition(W / 2, 10).setText(map ? `${map.inside ? '' : `${map.x},${map.y}  `}${world.zone.name}${world.area ? ` (${world.area.name})` : ''}` : world.zone.name);

    // --- Jauge de boss ---
    const wgr = world.worldGrid, ici = wgr?.mapAt(world.player.x, world.player.y)?.tag;   // seulement le boss de la carte du joueur
    const boss = world.monsters.find(m => m.def.boss && !m.dead && (!wgr || wgr.mapAt(m.homeX, m.homeY)?.tag === ici));
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
    const colX = W - 12 - 36, mw = 210, mh = 150, mx = colX - 10 - mw, my = 10;
    // cadre seulement : l'intérieur est filmé par la caméra de la mini-carte, dessinée avant l'interface
    this.rects.push([mx - 3, my - 3, mw + 6, mh + 6]);
    g.lineStyle(3, 0x24231d, 1); g.strokeRoundedRect(mx - 2, my - 2, mw + 4, mh + 4, 5);
    g.lineStyle(1, 0x5a584c, 1); g.strokeRoundedRect(mx - 3.5, my - 3.5, mw + 7, mh + 7, 6);
    const mc = this.miniCam;
    if (mc) {
      const ps = ISO.toScreen(p.x, p.y);
      mc.setViewport(mx, my, mw, mh).centerOn(ps.x, ps.y - 20);
      // monstres (points rouges, dorés pour les élites) par-dessus le décor filmé
      const toMini = (wx: number, wy: number) => { const s2 = ISO.toScreen(wx, wy); return { x: mx + mw / 2 + (s2.x - ps.x) * mc.zoom, y: my + mh / 2 + (s2.y - ps.y + 20) * mc.zoom }; };
      for (const m of world.monsters) {
        if (m.dead) continue;
        const q = toMini(m.x, m.y);
        if (q.x < mx || q.y < my || q.x > mx + mw || q.y > my + mh) continue;
        g.fillStyle(m.def.boss || m.def.elite ? C.gold : 0xd04030, 1); g.fillCircle(q.x, q.y, m.def.boss ? 3.5 : 2.2);
      }
      // objets Épique, Légendaire et Mythique au sol : un losange de leur couleur (choix 3D)
      for (const d of world.drops) {
        if (d.t < 0 || !d.item || !['epique', 'legendaire', 'mythique'].includes(d.item.rarity) || !world.shown(d)) continue;
        const q = toMini(d.x, d.y);
        if (q.x < mx || q.y < my || q.x > mx + mw || q.y > my + mh) continue;
        g.fillStyle(parseInt(RARITY_COLORS[d.item.rarity].slice(1), 16), 1); g.lineStyle(1, 0x000000, 1);
        g.fillTriangle(q.x, q.y - 5, q.x + 4, q.y, q.x - 4, q.y); g.fillTriangle(q.x, q.y + 5, q.x + 4, q.y, q.x - 4, q.y);
      }
      // quêtes (8B) : PNJ qui ont une quête (point vert), et la destination de la quête suivie (point doré qui pulse)
      const Q = world.quetes;
      if (Q) {
        for (const n of Q.pnjs) {
          if (!Q.icone(n.id) && !Q.attendParler(n.id)) continue;
          const q = toMini(n.x, n.y);
          if (q.x < mx || q.y < my || q.x > mx + mw || q.y > my + mh) continue;
          g.fillStyle(0x9ad15a, 1); g.lineStyle(1, 0x000000, 1); g.fillCircle(q.x, q.y, 3); g.strokeCircle(q.x, q.y, 3);
        }
        const tq = Q.cible();
        if (tq) {
          const q = toMini(tq.x, tq.y), cx = Phaser.Math.Clamp(q.x, mx + 6, mx + mw - 6), cy = Phaser.Math.Clamp(q.y, my + 6, my + mh - 6);
          const k = 0.5 + 0.5 * Math.sin(world.time * 5);
          g.fillStyle(C.gold, 1); g.lineStyle(1.5, 0x3a2208, 1); g.fillCircle(cx, cy, 4); g.strokeCircle(cx, cy, 4);
          g.lineStyle(1.5, C.gold, 0.4 + 0.5 * k); g.strokeCircle(cx, cy, 6 + 3 * k);
        }
      }
      // le perso (losange bleu) et les coins du cadre, comme dans Dofus 3
      const q = toMini(p.x, p.y);
      g.fillStyle(0x3a8fe0, 1); g.lineStyle(1.5, 0xffffff, 1);
      g.fillTriangle(q.x, q.y - 7, q.x + 5, q.y, q.x - 5, q.y); g.fillTriangle(q.x, q.y + 5, q.x + 5, q.y, q.x - 5, q.y);
      g.strokeTriangle(q.x, q.y - 7, q.x + 5, q.y, q.x - 5, q.y);
      const L = 12, k = 0xf1ecd8; g.lineStyle(2.5, k, 0.9);
      for (const [cx, cy, sx, sy] of [[mx + 6, my + 6, 1, 1], [mx + mw - 6, my + 6, -1, 1], [mx + 6, my + mh - 6, 1, -1], [mx + mw - 6, my + mh - 6, -1, -1]]) {
        g.beginPath(); g.moveTo(cx, cy + sy * L); g.lineTo(cx, cy); g.lineTo(cx + sx * L, cy); g.strokePath();
      }
    }
    this.miniLabel.setPosition(mx + mw / 2, my + mh + 6).setText(world.area?.name ?? world.zone.name);
    // Colonne de menus : boutons carrés sombres en relief, comme le bandeau de Dofus 3
    // Boutons carrés sombres serrés les uns contre les autres ; ils rapetissent si l'écran est bas
    const step = Math.min(38, Math.floor((H - 150 - my) / this.menus.length)), bs = step - 2;
    this.menus.forEach((m, i) => {
      const y = my + bs / 2 + i * step, x = colX + (36 - bs) / 2;
      this.rects.push([x, y - bs / 2, bs, bs]);
      g.fillStyle(0x1b1a16, 1); g.fillRoundedRect(x, y - bs / 2, bs, bs, 5);
      g.fillStyle(0x3a3933, 1); g.fillRoundedRect(x + 1.5, y - bs / 2 + 1.5, bs - 3, bs - 3, 4);
      g.fillStyle(0x47463f, 1); g.fillRoundedRect(x + 2, y - bs / 2 + 2, bs - 4, (bs - 4) / 2, { tl: 3, tr: 3, bl: 0, br: 0 });
      const s = bs - 8, f = m.icon.frame, k = Math.min(s / f.width, s / f.height);
      m.icon.setPosition(x + bs / 2, y).setDisplaySize(f.width * k, f.height * k);
      m.zone.setPosition(x + bs / 2, y).setSize(bs, bs);
    });

    // --- Barre du bas : XP, 6 sorts, clic droit, déplacement, potion, Rage ---
    const slot = 54, gap = 5, n = 6;
    const barW = n * slot + (n - 1) * gap, extra = slot + 14 + 10 + slot + gap + 16 + slot + gap + slot + 16 + 64;
    const totalW = barW + extra + 24, x0 = Math.round(W / 2 - totalW / 2), y0 = H - 12 - (slot + 44);
    panel(x0, y0, totalW, slot + 44);
    const xr = p.level >= cls.maxLevel ? 1 : p.xp / p.xpNeeded;
    bar(x0 + 12, y0 + 10, totalW - 24, 12, xr, C.xp);
    this.xpText.setPosition(W / 2, y0 + 16).setText(p.level >= cls.maxLevel ? `NIV. ${p.level} (max)` : `XP ${Math.floor(p.xp)} / ${p.xpNeeded}  ·  NIV. ${p.level}`);
    const sy = y0 + 30 + slot / 2;
    const drawSlot = (s: SlotView, x: number, id: string | null) => {
      s.bg.setPosition(x, sy).setDisplaySize(slot, slot);
      s.zone?.setPosition(x, sy);
      s.key.setPosition(x - slot / 2 + 4, sy - slot / 2 + 1);
      const def = id ? p.spell(id) : undefined;
      if (s !== this.auto) {
        s.bg.setTexture(def ? 'slot_dark_background_full' : 'slot_light_lock');
        s.icon?.setVisible(!!def);
        if (def && s.icon && s.icon.texture.key !== `sort_${def.icon}`) s.icon.setTexture(`sort_${def.icon}`);
      }
      if (!id || !def || !s.icon) { s.cd.setText(''); s.cost.setText(''); return; }
      const cd = p.cd[id] ?? 0, cdMax = Math.max(def.cooldown, (p.grade(id)?.relance ?? 0) * 3), frac = cdMax ? Math.min(1, cd / cdMax) : 0;
      const ok = p.hasResource(id), inner = slot - 8;
      s.icon.setPosition(x, sy).setDisplaySize(inner, inner).setTint(cd > 0 ? 0x8a8a8a : ok ? 0xffffff : 0x6f86b8);
      if (frac > 0) { g.fillStyle(0x000000, 0.55); g.fillRect(x - inner / 2, sy - inner / 2, inner, inner * frac); }
      if (p.skill?.id === id) { g.lineStyle(2, 0xf2d36b, 1); g.strokeRoundedRect(x - slot / 2 + 1, sy - slot / 2 + 1, slot - 2, slot - 2, 6); }
      if (p.rageFull && !def.move) { g.lineStyle(2, C.rage, 0.5 + 0.5 * Math.sin(world.time * 8)); g.strokeRoundedRect(x - slot / 2 - 1, sy - slot / 2 - 1, slot + 2, slot + 2, 7); }
      const st = p.stacks[id];
      s.cd.setPosition(x, sy).setText(cd > 0 ? (cd >= 1 ? `${Math.ceil(cd)}s` : cd.toFixed(1)) : st ? `x${st.n}` : '');
      s.key.setPosition(x - slot / 2 + 4, sy - slot / 2 + 1);
      const pa = p.paCost(id);
      s.cost.setPosition(x + slot / 2 - 3, sy + slot / 2 - 1).setText(def.pm ? `${def.pm} PM` : pa ? `${pa}` : '').setColor(def.pm ? css(C.pm) : css(C.pa));
    };
    // Auto-attaque (à gauche de la barre) : icône de l'arme portée (weapon_<type> officielle), sinon le coup de la classe
    const ax = x0 + 12 + slot / 2, wd = p.weaponDef;
    this.auto.icon!.setTexture(wd ? `arme_${wd.icon}` : cls.basic ? `sort_${cls.spells[cls.basic].icon}` : 'arme_0');
    drawSlot(this.auto, ax, p.autoAttack === 'attaque' ? null : p.autoAttack);
    if (p.autoAttack === 'attaque') this.auto.icon!.setPosition(ax, sy).setDisplaySize(slot - 8, slot - 8).clearTint();
    this.auto.zone?.setPosition(ax, sy);
    const sx0 = ax + slot + 14;
    for (let i = 0; i < 6; i++) drawSlot(this.slots[i], sx0 + i * (slot + gap), p.bar[i]);
    const cdx = sx0 + n * (slot + gap) + 10;          // clic droit, un peu à part
    drawSlot(this.slots[6], cdx, p.bar[6]);
    const mvx = cdx + slot + gap + 16;
    drawSlot(this.slots[7], mvx, p.bar[7]);
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
    // Tutoriel (3A) : halo doré qui pulse sur l'emplacement de l'étape suivie, et sa touche au-dessus
    const qs = world.quetes, qc = qs?.enCours.find(c => c.id === qs.suivie), halo = qc && !qc.aRendre ? qs!.etapeDe(qc)?.halo : undefined;
    if (halo != null) {
      const hj = halo === 'jauge', hx = halo === 'potion' ? pox : hj ? rx : halo === 7 ? mvx : halo === 6 ? cdx : sx0 + halo * (slot + gap);
      const hw = hj ? 28 : slot + 8, hh = hj ? rh + 10 : slot + 8, hy = hj ? ry + rh / 2 : sy, pulse = 0.55 + 0.45 * Math.sin(world.time * 6);
      g.lineStyle(3, 0xffd66b, pulse); g.strokeRoundedRect(hx - hw / 2, hy - hh / 2, hw, hh, 8);
      g.lineStyle(7, 0xe6b85c, 0.25 * pulse); g.strokeRoundedRect(hx - hw / 2 - 3, hy - hh / 2 - 3, hw + 6, hh + 6, 10);
      const lab = halo === 'potion' ? 'E' : hj ? cls.rage.name : halo === 7 ? 'Espace' : halo === 6 ? 'Clic droit' : KEYS[halo];
      this.haloKey.setVisible(true).setText(lab).setPosition(hx, y0 - 4 - 5 * Math.abs(Math.sin(world.time * 3)));
    } else this.haloKey.setVisible(false);

    // --- Suivi (bas gauche) : la quête suivie (8A), sinon l'exploration ---
    const a = world.area, kills = this.areaKills.get(a?.name ?? '') ?? 0, Q = world.quetes;
    const cq = Q && (Q.enCours.find(c => c.id === Q.suivie) ?? Q.enCours[0]);
    let iconW = 0;
    if (Q && cq) {
      const def = Q.def(cq.id), e = Q.etapeDe(cq);
      const [give, back] = QUEST_ICON[def.type];
      this.trackIcon.setTexture(`qi_${cq.aRendre ? back : give}`).setVisible(true);
      const k = 20 / Math.max(this.trackIcon.width, this.trackIcon.height); this.trackIcon.setScale(k); iconW = 24;
      this.trackTitle.setText(def.nom);
      const lines = cq.aRendre ? [`  Retourner voir ${Q.data.pnj[def.rendre!]?.nom ?? ''}`]
        : (e?.objectifs ?? []).map((o, i) => {
          const tot = Q.total(o), n = Math.min(cq.compte[i] ?? 0, tot), done = n >= tot;
          return `${done ? '✓' : '•'} ${o.texte}${tot > 1 ? `  ${n}/${tot}` : ''}`;
        });
      const autres = Q.enCours.length - 1;
      this.trackBody.setText([e && !cq.aRendre ? e.nom : '', ...lines, autres > 0 ? `+${autres} autre${autres > 1 ? 's' : ''} quête${autres > 1 ? 's' : ''} (journal)` : '', juice ? '' : 'Effets d\'impact désactivés (F)']
        .filter(Boolean).join('\n'));
      this.skipBtn.setVisible(!!def.options?.passable);
    } else {
      this.trackIcon.setVisible(false); this.skipBtn.setVisible(false);
      this.trackTitle.setText(a ? `Exploration · ${a.name}` : world.zone.name);
      this.trackBody.setText([
        a ? `Monstres du coin vaincus : ${kills}` : `Monstres vaincus : ${world.kills}`,
        `Point de retour : ${world.checkpointName}`,
        juice ? '' : 'Effets d\'impact désactivés (F)',
      ].filter(Boolean).join('\n'));
    }
    this.succesT = Math.max(0, this.succesT - dt); this.succesLine.setAlpha(Phaser.Math.Clamp(this.succesT, 0, 1));
    const sl = this.succesT > 0 ? this.succesLine.height + 4 : 0;
    const tw2 = Math.max(this.trackTitle.width + iconW + (this.skipBtn.visible ? this.skipBtn.width + 12 : 0), this.trackBody.width, this.succesT > 0 ? this.succesLine.width : 0) + 20;
    const th2 = this.trackTitle.height + this.trackBody.height + 18 + sl;
    const tx2 = 12, ty2 = H - 12 - th2;
    panel(tx2, ty2, tw2, th2, 0.8);
    this.rects.push([tx2, ty2, tw2, th2]);
    this.trackIcon.setPosition(tx2 + 18, ty2 + 7 + this.trackTitle.height / 2);
    this.trackTitle.setPosition(tx2 + 10 + iconW, ty2 + 7);
    this.skipBtn.setPosition(tx2 + tw2 - this.skipBtn.width - 8, ty2 + 6);
    this.trackBody.setPosition(tx2 + 10, ty2 + 10 + this.trackTitle.height);
    this.succesLine.setPosition(tx2 + 10, ty2 + 12 + this.trackTitle.height + this.trackBody.height);
    // flèche au bord de l'écran vers la destination de la quête suivie, quand elle est hors de l'écran (8B)
    this.arrow.clear();
    const tq = Q?.cible(), cam = this.scene.cameras.main;
    if (tq) {
      const s2 = ISO.toScreen(tq.x, tq.y), r = cam.worldView;
      const sx = (s2.x - r.x) * cam.zoom, sy2 = (s2.y - r.y) * cam.zoom, m = 46;
      if (sx < 0 || sy2 < 0 || sx > W || sy2 > H) {
        const cx = W / 2, cy = H / 2, ang = Math.atan2(sy2 - cy, sx - cx);
        const kx = (W / 2 - m) / Math.max(1e-6, Math.abs(Math.cos(ang))), ky = (H / 2 - m) / Math.max(1e-6, Math.abs(Math.sin(ang))), d = Math.min(kx, ky);
        // pas sous la colonne de menus (droite) ni sous la barre de sorts (bas)
        const ax2 = Phaser.Math.Clamp(cx + Math.cos(ang) * d, m, W - 70), ay2 = Phaser.Math.Clamp(cy + Math.sin(ang) * d, m, H - 120), pul = 0.75 + 0.25 * Math.sin(world.time * 5);
        const pt = (l: number, w2: number) => ({ x: ax2 + Math.cos(ang) * l - Math.sin(ang) * w2, y: ay2 + Math.sin(ang) * l + Math.cos(ang) * w2 });
        const t0 = pt(18, 0), t1 = pt(-10, 13), t2 = pt(-4, 0), t3 = pt(-10, -13);
        this.arrow.fillStyle(C.gold, pul); this.arrow.lineStyle(2, 0x3a2208, 1);
        this.arrow.fillPoints([t0, t1, t2, t3], true); this.arrow.strokePoints([t0, t1, t2, t3], true, true);
      }
    }

    // --- Butin (bas droite) : les dernières lignes s'effacent ---
    this.feed.forEach((f, i) => { f.t -= dt; f.text.setPosition(W - 16, H - 16 - i * 18).setAlpha(Phaser.Math.Clamp(f.t, 0, 1)); });
    for (const f of this.feed.filter(f => f.t <= 0)) f.text.destroy();
    this.feed = this.feed.filter(f => f.t > 0);

    this.center.setPosition(W / 2, H * 0.3);
    this.bannerBg.setPosition(W / 2, H * 0.3 + 8);
    this.toastText.setPosition(W / 2, H * 0.2);
    const zy = Math.max(84, H * 0.13);
    this.zoneName.setPosition(W / 2, zy);
    this.zoneOrn.setPosition(W / 2, zy + 44).setScale(Math.min(1, (W * 0.6) / 733));
    this.zoneSub.setPosition(W / 2, zy + 47);
    this.zonePlate.setPosition(W / 2, 62).setScale(1.25, 1.15);
    this.zonePlateTxt.setPosition(W / 2, 62);
    this.help.setPosition(W / 2, boss ? 110 : 118);
  }
}
