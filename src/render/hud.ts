import { coffreDe, couleurCoffre, nomsCoffre, palierCoffre, partageurCoffre, seuilsCoffre } from '../sim/enutrof';
import { nomOrne, styleDef } from '../sim/style';
import { RARITY_COLORS } from '../sim/items';
import { v } from './assetUrl';
import Phaser from 'phaser';
import { densite } from './pixel';
import { REGLES_BETES } from '../sim/bete';
import { effetsActifs, type EffetActif } from '../sim/effets';
import { DANGER } from '../sim/danger';
import { GAME_DATA, ITEMS } from '../sim/data';
import { ISO } from '../sim/iso';
import type { SimEvent } from '../sim/events';
import type { Monster } from '../sim/monster';
import type { World } from '../sim/world';
import { chrono } from '../sim/quests';
import { BOSS_MONDE, heureTexte, rendezVous, VIVANT } from '../sim/mondeVivant';
import { QUEST_ICON } from './questView';
import { MANIFESTE, Son } from './son';
import type { Reglages } from './ambiance';
import * as Touches from './touches';
import { famille, secret } from '../sim/carte';

const FONT = 'Lexend, Verdana, sans-serif';
const STYLE = { fontFamily: FONT, fontSize: '14px', color: '#e8e2d4', stroke: '#000', strokeThickness: 3 };
const UI = 'assets/ui';

/** Images d'interface de Dofus 3 (bundles figs, uielements, uidarkstone, icons ; voir tools/extraction/LISEZMOI.md). */
const UI_IMAGES = [
  'slot_dark_background_full', 'slot_light_lock', 'icon_pv', 'iconBossSkull',
  'background_levelup_banner', 'background_defeat_banner', 'success_ornament', 'scoreTitle',
  'tx_lifePoints', 'tx_actionPoints', 'tx_movementPoints',
];
/** Bulles d'effets actifs : icône tx_ de Dofus 3 pour un effet sans sort (malus de monstre). */
const CARAC_BULLE: Record<NonNullable<EffetActif['carac']>, string> = { pm: 'tx_movementPoints', dommages: 'tx_damage', puissance: 'tx_multiElement', vie: 'tx_lifePoints' };
/** Bord des bulles (4A) : vert = bonus de sort, rouge = malus, doré = pouvoir d'objet (2C). */
const BORD_BULLE = { sort: 0x6fd36f, monstre: 0xe05a4a, objet: 0xe6b85c };
/** Tête de chaque classe pour la fiche du perso (icônes de classe de Dofus 3). */
const HEADS: Record<string, string> = { iop: 'tete_iop', cra: 'tete_cra', iop_f: 'tete_iop_f', cra_f: 'tete_cra_f' };
/** Nom court d'une touche pour le coin d'un emplacement (« Espace » ne tient pas). */
const court = (t: string) => t === 'Espace' ? 'Esp.' : t;
/** Action (render/touches.ts) de chaque menu de la colonne, pour son raccourci dans l'infobulle. */
const ACTION_MENU: Record<string, string> = { Inventaire: 'inventaire', 'Caractéristiques': 'caracs', 'Métiers': 'metiers', Sorts: 'sorts', 'Carte du monde': 'carte', Bestiaire: 'bestiaire', 'Succès': 'succes', 'Havre-Sac': 'havresac', Social: 'social', Classement: 'ladder', Guide: 'guide', Boutique: 'boutique', 'Réglages': 'options' };
/** Modules de l'interface qu'on peut déplacer (Réglages 6A), avec leur nom affiché pendant le déplacement. */
const MODULES: Record<string, string> = { perso: 'Cadre du perso', mini: 'Mini-carte', suivi: 'Suivi de quête', dps: 'Dégâts par seconde' };
/** Colonne de menus avec les icônes officielles en couleur de Dofus 3 (uiassets_2x) : icône, nom, raccourci (vide si aucun).
 *  Seulement les menus utiles au jeu ; les autres (guilde, montures...) viendront avec leur fonctionnalité. */
const MENUS: [string, string, string][] = [
  ['inventory', 'Inventaire', 'I'], ['characteristic', 'Caractéristiques', 'C'], ['job', 'Métiers', 'J'], ['spells', 'Sorts', 'S'], ['quest', 'Quêtes', ''],
  ['map', 'Carte du monde', ''], ['bestiary', 'Bestiaire', 'B'], ['success', 'Succès', 'U'], ['breach', 'Failles', ''],
  ['home', 'Havre-Sac', 'H'], ['social', 'Social', 'P'], ['ladder', 'Classement', 'L'], ['guide', 'Guide', 'G'], ['shop', 'Boutique', ''], ['options', 'Réglages', 'O'],
];

const C = {
  panel: 0x14130f, panelA: 0.9, border: 0x3a3a2c, track: 0x2c281f,
  hp: 0xe0625a, shield: 0xa66be0, pa: 0x6fb2e8, pm: 0x9ad15a, rage: 0xf08a2c, xp: 0xb9e54b, gold: 0xe2b75a,
};
const css = (n: number) => '#' + n.toString(16).padStart(6, '0');

type Fixed = Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth;
type Txt = Phaser.GameObjects.Text;
type Img = Phaser.GameObjects.Image;

interface SlotView { bg: Img; icon: Img | null; cd: Txt; key: Txt; cost: Txt; ch: Txt; zone?: Phaser.GameObjects.Zone }
interface FeedLine { text: Txt; t: number }

/** Interface fixe à l'écran, façon MMO Dofus 3 (choix 13D de la maquette), adaptée au temps réel :
 *  - en haut à gauche, la fiche du perso (PV, PA, PM, Rage) et la fiche de la cible ;
 *  - en haut au centre, la zone et la sous-zone (plus de coordonnées de carte, choix 4A) ; la jauge de boss juste dessous ;
 *  - en haut à droite, la mini-carte et la colonne de menus ;
 *  - en bas au centre, l'XP au-dessus d'une seule rangée de 6 sorts, le déplacement, la potion et la Rage ;
 *  - en bas à gauche, le suivi (à la place du chat) ; en bas à droite, le butin. */
export class Hud {
  static preload(scene: Phaser.Scene) {
    for (const k of UI_IMAGES) if (!scene.textures.exists(k)) scene.load.image(k, v(`${UI}/${k}.png`));
    for (const [k] of MENUS) if (!scene.textures.exists(`menu_${k}`)) scene.load.image(`menu_${k}`, v(`${UI}/menu/${k}.png`));
    // ornements officiels (menu des succès 6B) : à côté du nom du perso
    for (const i of [0, 1, 2]) if (!scene.textures.exists(`orn_${i}`)) scene.load.image(`orn_${i}`, `${UI}/succes/o_${i}.webp`);
    for (const k of Object.values(HEADS)) if (!scene.textures.exists(k)) scene.load.image(k, v(`${UI}/${k}.png`));
    // Emblème de la classe dans le bandeau du cadre (icônes officielles de l'écran de création)
    for (const c of Object.keys(GAME_DATA.classes)) if (!scene.textures.exists(`embleme_${c}`)) scene.load.image(`embleme_${c}`, v(`assets/accueil/c_${c}.png`));
    const icons = new Set<number>();
    for (const c of Object.values(GAME_DATA.classes)) for (const s of Object.values(c.spells)) icons.add(s.icon);
    for (const i of icons) if (!scene.textures.exists(`sort_${i}`)) scene.load.image(`sort_${i}`, v(`${UI}/sorts/sort_${i}.png`));
    // Bulles d'effets actifs : icônes officielles des caractéristiques pour les malus des monstres
    for (const k of Object.values(CARAC_BULLE)) if (!scene.textures.exists(`carac_${k}`)) scene.load.image(`carac_${k}`, v(`${UI}/d3/caracs/${k}.png`));
    // Auto-attaque à l'arme : icônes officielles weapon_<typeId> (arme_0 = sans arme)
    for (const t of [0, 2, 3, 4, 5, 6, 7, 8, 19, 22, 271]) if (!scene.textures.exists(`arme_${t}`)) scene.load.image(`arme_${t}`, v(`${UI}/sorts/arme_${t}.png`));
  }

  /** Clic sur une icône de la colonne de menus (le jeu ne se met pas en pause : multijoueur prévu). */
  onMenu: (name: string) => void = () => {};
  /** Survol d'un emplacement de sort (id du sort, centre haut de l'emplacement à l'écran) ; null quand on le quitte. */
  onSlotHover: (id: string | null, x: number, y: number) => void = () => {};
  /** Menu sorts 10D : clic sur une case de la barre = fiche du sort. */
  onSlotClick: (id: string) => void = () => {};
  /** Rectangles de l'interface à l'écran (un clic dessus ne doit pas faire attaquer). */
  private rects: [number, number, number, number][] = [];
  /** Son coupé (Ctrl+M, maquette Son 8B ; M = carte du monde, 0.2 18A) : petit haut-parleur barré dans le coin de la mini-carte. */
  muet = false;
  /** Cadres des bêtes de l'Osamodas (demande de Mathis, 2026-11-08) : sous le cadre du perso, même style en plus petit :
   *  portrait (repos de sa planche), nom, temps d'Éveil ou de domptage, PV et PA (encoches). */
  /** Bulles d'effets actifs (maquette « Bulles : 1A 2A+2B+2C 3A 4A 5A 6A 7A 8A ») : une rangée au-dessus de la barre de sorts. */
  private bulles: { img: Img; t: Txt; ch: Txt }[] = [];
  /** Moment où chaque bulle est apparue (8A : petit rebond d'apparition). */
  private bulleVue = new Map<string, number>();
  private bulleTip!: Txt;
  private dessinerBulles(g: Phaser.GameObjects.Graphics, xa: number, xb: number, y: number, juice: boolean) {
    const w = this.world, effets = effetsActifs(w.player), gs = this.gSlots, R = 19, pas = 48;
    const vus = new Set(effets.map(e => e.id));
    for (const k of [...this.bulleVue.keys()]) if (!vus.has(k)) this.bulleVue.delete(k);
    const nb = Math.min(effets.length, Math.max(0, Math.floor((xb - xa) / pas)));
    while (this.bulles.length < nb) {
      const f = this.fixed!;
      this.bulles.push({
        img: f(this.scene.add.image(0, 0, 'tx_lifePoints'), 3),
        t: f(this.scene.add.text(0, 0, '', { ...STYLE, fontSize: '11px', fontStyle: 'bold', strokeThickness: 3 }), 6).setOrigin(0.5, 0),
        ch: f(this.scene.add.text(0, 0, '', { ...STYLE, fontSize: '10px', fontStyle: 'bold', color: '#9fd0ff', strokeThickness: 3 }), 6).setOrigin(0.5),
      });
    }
    const ptr = this.scene.input.activePointer;
    let survol: EffetActif | null = null, sx = 0;
    this.bulles.forEach((b, i) => {
      const e = effets[i];
      if (!e || i >= nb) { b.img.setVisible(false); b.t.setVisible(false); b.ch.setVisible(false); return; }
      if (!this.bulleVue.has(e.id)) this.bulleVue.set(e.id, w.time);
      const x = xa + R + 4 + i * pas, age = w.time - this.bulleVue.get(e.id)!;
      // 8A : la bulle apparaît avec un petit rebond
      const k = juice && age < 0.3 ? Math.max(0.2, 1 + 2.7 * Math.pow(age / 0.3 - 1, 3) + 1.7 * Math.pow(age / 0.3 - 1, 2)) : 1, r = R * k;
      // 3A : clignote dans les 2 dernières secondes
      const a = juice && e.t < 2 ? 0.45 + 0.55 * Math.abs(Math.cos(w.time * 6)) : 1;
      const bord = BORD_BULLE[e.sorte];
      g.fillStyle(0x14130f, 0.92 * a); g.fillCircle(x, y, r + 3);
      gs.lineStyle(3, 0x000000, 0.55 * a); gs.strokeCircle(x, y, r + 1.5);
      const frac = !isFinite(e.t) ? 1 : e.tMax > 0 ? Math.max(0, Math.min(1, e.t / e.tMax)) : 1;
      gs.lineStyle(3, bord, a); gs.beginPath(); gs.arc(x, y, r + 1.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac, false); gs.strokePath();
      const key = e.sort != null ? `sort_${e.sort}` : `carac_${CARAC_BULLE[e.carac ?? 'vie']}`;
      if (b.img.texture.key !== key && this.scene.textures.exists(key)) b.img.setTexture(key);
      const s = e.sort != null ? r * 1.4 : r * 1.2, fr = b.img.frame, kk = Math.min(s / fr.width, s / fr.height);
      b.img.setVisible(true).setPosition(x, y).setDisplaySize(fr.width * kk, fr.height * kk).setAlpha(a);
      b.t.setVisible(true).setPosition(x, y + R + 3).setText(!isFinite(e.t) ? '∞' : e.t >= 1 ? `${Math.ceil(e.t)}s` : `${e.t.toFixed(1)}s`.replace('.', ','))
        .setColor(e.t < 2 ? '#ff8a7a' : '#ffffff').setAlpha(a);
      if (e.charges) {
        const cx = x + R - 2, cy = y - R + 2;
        gs.fillStyle(0x14202e, 0.95); gs.fillCircle(cx, cy, 8); gs.lineStyle(1.5, 0x5aa8ff, 1); gs.strokeCircle(cx, cy, 8);
        b.ch.setVisible(true).setPosition(cx, cy).setText(String(e.charges));
      } else b.ch.setVisible(false);
      this.rects.push([x - R - 3, y - R - 3, 2 * R + 6, 2 * R + 20]);
      if (Math.hypot(ptr.x - x, ptr.y - y) <= R + 4) { survol = e; sx = x; }
    });
    // 5A : infobulle au survol
    const sv = survol as EffetActif | null;
    if (sv) this.bulleTip.setVisible(true).setText([sv.nom, ...sv.lignes].join('\n')).setPosition(sx, y - R - 8)
      .setColor(sv.sorte === 'monstre' ? '#ffb4a8' : '#e8e2d4');
    else this.bulleTip.setVisible(false);
  }
  private betesUi: { img: Phaser.GameObjects.Image; nom: Phaser.GameObjects.Text; pv: Phaser.GameObjects.Text; info: Phaser.GameObjects.Text }[] = [];
  /** Portraits du groupe (maquette « Social : » 3A) : les autres joueurs de la partie sous le cadre du perso (et de ses bêtes) :
   *  emblème de la classe, nom, niveau, PV, « à terre ». */
  private groupeUi: { img: Phaser.GameObjects.Image; nom: Txt; info: Txt }[] = [];
  /** Cases des portraits du groupe (x, y, l, h, id du joueur) : l'Eniripsa vise un allié en survolant ou cliquant son portrait (3D). */
  private portraits: [number, number, number, number, number][] = [];
  joueurPortrait(x: number, y: number): number | null {
    x /= this.k; y /= this.k;
    return this.portraits.find(([rx, ry, rw, rh]) => x >= rx && y >= ry && x <= rx + rw && y <= ry + rh)?.[4] ?? null;
  }
  /** Enutrof (interface du coffre 1A + 1D) : le vrai Coffre Animé dans un anneau de pièces à crans (un par palier jusqu'à Trésor,
   *  puis un anneau rouge de surcharge), ses PV en dessous, le nom du palier ; il tremble en rouge quand le coffre est frappé.
   *  Clic : la fenêtre du coffre. */
  private medaillon(g: Phaser.GameObjects.Graphics, cx: number, cy: number, dt: number, juice: boolean) {
    const w = this.world, p = w.player, CF = p.cls.coffre!, S = seuilsCoffre(CF), tres = CF.paliers[CF.paliers.length - 1];
    const pal = palierCoffre(p), c = coffreDe(p, w), ko = p.coffreKoT > 0, R = 25, t = w.time;
    // 1D : le coffre perd des PV → alerte (tremblement rouge + pièces qui tombent)
    if (c && this.medPv >= 0 && c.hp < this.medPv - 0.5) {
      this.medAlerte = 0.7;
      Son.jouer(Son.auHasard(MANIFESTE.kamas), 'effets', { vol: 0.45, vitesse: 0.78 + Math.random() * 0.08, cle: 'coffreFrappe', ecart: 1.2 });
    }
    this.medPv = c ? c.hp : -1;
    this.medAlerte = Math.max(0, this.medAlerte - dt);
    const hr = c ? Phaser.Math.Clamp(c.hp / c.maxHp, 0, 1) : 0, bas = c && hr < 0.3 && Math.floor(t * 6) % 2 === 0;
    const sh = juice && this.medAlerte > 0 ? 2.5 * Math.sin(t * 70) : 0, x = cx + sh, y = cy;
    this.medRect = [cx - R - 4, cy - R - 4, 2 * R + 8, 2 * R + 22];
    this.rects.push(this.medRect);
    const col = Phaser.Display.Color.HexStringToColor(couleurCoffre(pal)).color;
    // anneau : fond, pièces jusqu'à Trésor, crans des paliers
    g.lineStyle(6, 0x241d16, 1); g.strokeCircle(x, y, R);
    const f = Phaser.Math.Clamp(p.coffrePieces / tres, 0, 1), a0 = -Math.PI / 2;
    if (f > 0) { g.lineStyle(6, col, 1); g.beginPath(); g.arc(x, y, R, a0, a0 + f * Math.PI * 2); g.strokePath(); }
    g.lineStyle(2, 0x000000, 0.9);
    for (const n of CF.paliers.slice(0, -1)) { const a = a0 + (n / tres) * Math.PI * 2; g.lineBetween(x + Math.cos(a) * (R - 4), y + Math.sin(a) * (R - 4), x + Math.cos(a) * (R + 4), y + Math.sin(a) * (R + 4)); }
    // 6B : surcharge, un anneau rouge par-dessus qui pulse
    if (p.coffrePieces > tres) {
      const fs = Phaser.Math.Clamp((p.coffrePieces - tres) / (S[S.length - 1] - tres), 0, 1), k = 0.6 + 0.4 * Math.sin(t * 8);
      g.lineStyle(3, 0xff3a2a, k); g.beginPath(); g.arc(x, y, R + 5, a0, a0 + fs * Math.PI * 2); g.strokePath();
    }
    // disque, bord rouge si frappé ou à moins de 30 % de PV
    g.fillStyle(0x16100a, 1); g.fillCircle(x, y, R - 4);
    const rouge = this.medAlerte > 0 || bas;
    g.lineStyle(2, rouge ? 0xd24a3a : 0x6a5232, 1); g.strokeCircle(x, y, R - 4);
    if (rouge && juice) { g.lineStyle(6, 0xd24a3a, 0.35); g.strokeCircle(x, y, R + 2); }
    // image : première image de la planche du coffre (gardée quand il est assommé)
    const tex = c && this.scene.textures.exists(c.look) ? this.scene.textures.get(c.look) : null;
    const fr = tex && (tex.has('AnimStatique_1_0') ? 'AnimStatique_1_0' : tex.getFrameNames().sort()[0]);
    const im = this.medImg;
    if (tex && fr && im.frame !== tex.get(fr)) im.setTexture(c!.look, fr);
    if (im.texture.key !== '__DEFAULT') {
      const fm = im.frame, ss = (fm as unknown as { data: { spriteSourceSize?: { x: number; y: number; w: number; h: number } } | null }).data?.spriteSourceSize;
      const r = fm.trimmed && ss ? ss : { x: 0, y: 0, w: fm.realWidth, h: fm.realHeight }, k = (2 * R - 14) / Math.max(r.w, r.h);
      im.setDisplayOrigin(r.x + r.w / 2, r.y + r.h / 2).setPosition(x, y).setScale(k).setVisible(true).setAlpha(ko ? 0.35 : 1);
      if (ko) im.setTint(0x888888); else if (pal >= CF.paliers.length) im.setTint(0xffb090); else im.clearTint();
    }
    // PV du coffre et nom du palier (ou temps d'assommé)
    const bw = 40, by = cy + R + 4;
    g.fillStyle(0x2b1210, 1); g.fillRoundedRect(cx - bw / 2, by, bw, 4, 2);
    if (hr > 0) { g.fillStyle(0xd24a3a, 1); g.fillRoundedRect(cx - bw / 2, by, Math.max(3, bw * hr), 4, 2); }
    if (c && c.shield > 0) { g.fillStyle(0x9fd3ff, 0.95); g.fillRoundedRect(cx - bw / 2, by, Math.max(3, bw * Math.min(1, c.shield / c.maxHp)), 2, 1); }
    this.rageLabel.setPosition(cx, by + 5)
      .setText(ko ? `Assommé ${Math.ceil(p.coffreKoT)} s` : pal >= 0 ? nomsCoffre(CF)[pal] : `${p.coffrePieces} / ${CF.paliers[0]}`)
      .setColor(ko ? '#c8c8c8' : couleurCoffre(pal));
  }
  /** Enutrof (interface du coffre 7C) : flèche au bord de l'écran vers le coffre quand il est hors de vue. */
  private flecheCoffre(W: number, H: number) {
    const w = this.world, p = w.player, c = p.cls.coffre ? coffreDe(p, w) : undefined, cam = this.scene.cameras.main;
    let vue = false;
    if (c) {
      const s2 = ISO.toScreen(c.x, c.y), r = cam.worldView, ex = (s2.x - r.x) * cam.zoom, ey = (s2.y - r.y) * cam.zoom, m = 64;
      if (ex < 0 || ey < 0 || ex > W || ey > H) {
        vue = true;
        const cx = W / 2, cy = H / 2, ang = Math.atan2(ey - cy, ex - cx), co = Math.cos(ang), si = Math.sin(ang);
        const d = Math.min((W / 2 - m) / Math.max(1e-6, Math.abs(co)), (H / 2 - m) / Math.max(1e-6, Math.abs(si)));
        const ax = Phaser.Math.Clamp(cx + co * d, m, W - 84), ay = Phaser.Math.Clamp(cy + si * d, 150, H - 150);
        const pt = (l: number, w2: number) => ({ x: ax + co * l - si * w2, y: ay + si * l + co * w2 });
        const pts = [pt(20, 0), pt(-8, 13), pt(-2, 0), pt(-8, -13)];
        this.arrow.fillStyle(Phaser.Display.Color.HexStringToColor(couleurCoffre(palierCoffre(p))).color, 0.92); this.arrow.lineStyle(2.5, 0x3a2208, 1);
        this.arrow.fillPoints(pts, true); this.arrow.strokePoints(pts, true, true);
        const lb = pt(-26, 0), cases = Math.round(Math.hypot(c.x - p.x, c.y - p.y) / 48);
        this.cofFleche.setText(`Coffre\n${cases} cases`).setOrigin(co > 0.35 ? 1 : co < -0.35 ? 0 : 0.5, si > 0.35 ? 1 : si < -0.35 ? 0 : 0.5).setPosition(lb.x, lb.y);
      }
    }
    this.cofFleche.setVisible(vue);
  }
  private cadresGroupe(g: Phaser.GameObjects.Graphics, x0: number, y0: number, juice: boolean) {
    const w = this.world, L = w.players.filter(p => p !== w.player).slice(0, 3), W = 236, H = 40, gap = 5;
    while (this.groupeUi.length < L.length) {
      const st = { ...STYLE, fontStyle: 'bold', strokeThickness: 0 };
      this.groupeUi.push({
        img: this.fixed(this.scene.add.image(0, 0, '__DEFAULT'), 3),
        nom: this.fixed(this.scene.add.text(0, 0, '', { ...st, fontSize: '13px', color: '#ffffff' }).setOrigin(0, 0.5), 5),
        info: this.fixed(this.scene.add.text(0, 0, '', { ...st, fontSize: '11px', color: '#c9c4ab' }).setOrigin(1, 0.5), 5),
      });
    }
    this.groupeUi.forEach((u, i) => { const on = i < L.length; u.img.setVisible(on); u.nom.setVisible(on); u.info.setVisible(on); });
    L.forEach((p, i) => {
      const u = this.groupeUi[i], y = y0 + i * (H + gap), cls = Object.keys(GAME_DATA.classes).find(k => GAME_DATA.classes[k] === p.cls) ?? 'iop';
      this.rects.push([x0, y, W, H]); this.portraits.push([x0, y, W, H, p.id]);
      g.fillStyle(0x08080a, 0.78); g.fillRoundedRect(x0, y, W, H, 8);
      const key = `embleme_${cls}`;
      if (this.scene.textures.exists(key)) { if (u.img.texture.key !== key) u.img.setTexture(key); u.img.setPosition(x0 + 20, y + H / 2).setDisplaySize(26, 26 * (u.img.height / u.img.width || 1)).setAlpha(p.dead ? 0.4 : 1); }
      const bx = x0 + 40, tx = x0 + W - 8, bw = tx - bx;
      u.nom.setPosition(bx, y + 12).setText(p.nom || GAME_DATA.classes[cls].name);
      u.info.setPosition(tx, y + 12).setText(p.dead ? 'à terre' : `niv. ${p.level}`).setColor(p.dead ? '#ff8a7a' : '#c9c4ab');
      const hr = Phaser.Math.Clamp(p.hp / (p.maxHp || 1), 0, 1);
      g.fillStyle(0x2b2b2e, 1); g.fillRoundedRect(bx, y + 24, bw, 8, 3);
      if (hr > 0) { g.fillStyle(hr < 0.3 && juice && Math.floor(w.time * 6) % 2 ? 0xff8a7a : C.hp, 1); g.fillRoundedRect(bx, y + 24, Math.max(5, bw * hr), 8, 3); }
      if (p.shield > 0) { g.fillStyle(0x9a6bff, 0.9); g.fillRoundedRect(bx, y + 24, Math.max(4, bw * Math.min(1, p.shield / (p.maxHp || 1))), 3, 1); }
      // Enutrof (interface du coffre 8B) : le coffre qui partage avec le groupe, son palier et ses pièces
      const CF = p.cls.coffre;
      if (CF && partageurCoffre(w) === p) {
        const pal = palierCoffre(p), tres = CF.paliers[CF.paliers.length - 1], col = Phaser.Display.Color.HexStringToColor(couleurCoffre(pal)).color;
        g.fillStyle(0x241d16, 1); g.fillRoundedRect(bx, y + 34, bw, 3, 1);
        g.fillStyle(col, 1); g.fillRoundedRect(bx, y + 34, Math.max(2, bw * Math.min(1, p.coffrePieces / tres)), 3, 1);
        if (!p.dead) u.info.setText(`${pal >= 0 ? `Coffre ${nomsCoffre(CF)[pal]}` : 'Coffre'} · niv. ${p.level}`).setColor(couleurCoffre(pal));
      }
    });
  }
  private cadresBetes(g: Phaser.GameObjects.Graphics, x0: number, y0: number, juice: boolean): number {
    const L = this.world.betes.filter(b => !b.dead).slice(0, 6), W = 236, H = 50, gap = 5;
    while (this.betesUi.length < L.length) {
      const st = { ...STYLE, fontStyle: 'bold', strokeThickness: 0 };
      this.betesUi.push({
        img: this.fixed(this.scene.add.image(0, 0, '__DEFAULT'), 3),
        nom: this.fixed(this.scene.add.text(0, 0, '', { ...st, fontSize: '13px', color: '#ffffff' }).setOrigin(0, 0.5), 5),
        pv: this.fixed(this.scene.add.text(0, 0, '', { ...st, fontSize: '12px' }).setOrigin(1, 0.5), 5),
        info: this.fixed(this.scene.add.text(0, 0, '', { ...st, fontSize: '11px', color: '#ffd87a' }).setOrigin(1, 0.5), 5),
      });
    }
    this.betesUi.forEach((u, i) => { const on = i < L.length; u.img.setVisible(on); u.nom.setVisible(on); u.pv.setVisible(on); u.info.setVisible(on); });
    L.forEach((b, i) => {
      const u = this.betesUi[i], y = y0 + i * (H + gap), R = REGLES_BETES;
      this.rects.push([x0, y, W, H]);
      g.fillStyle(0x08080a, 0.78); g.fillRoundedRect(x0, y, W, H, 8);
      // portrait : première image du repos, dans une case de 40 px
      const ps = 40, px = x0 + 5, py = y + 5;
      g.fillStyle(0x1c2620, 1); g.fillRoundedRect(px, py, ps, ps, 5);
      const eveil = b.eveilT > 0, dompte = b.dompteT > 0;
      g.lineStyle(2, eveil ? 0xffc04d : dompte ? 0x7fd0ff : 0x8c8c86, 1); g.strokeRoundedRect(px + 1, py + 1, ps - 2, ps - 2, 5);
      const tex = this.scene.textures.exists(b.look) ? this.scene.textures.get(b.look) : null;
      const fr = tex && (tex.has('AnimStatique_1_0') ? 'AnimStatique_1_0' : tex.getFrameNames()[0]);
      if (tex && fr) {
        // la planche a pu être déchargée puis rechargée sous la même clé (changement de salle) :
        // on compare le cadre lui-même, sinon l'image garde un cadre détruit (data = null)
        if (u.img.frame !== tex.get(fr)) u.img.setTexture(b.look, fr);
        // planche rognée : on centre le dessin lui-même (pas la cellule de rendu, presque vide)
        const f = u.img.frame, ss = (f as unknown as { data: { spriteSourceSize?: { x: number; y: number; w: number; h: number } } | null }).data?.spriteSourceSize;
        const r = f.trimmed && ss ? ss : { x: 0, y: 0, w: f.realWidth, h: f.realHeight }, k = (ps - 6) / Math.max(r.w, r.h);
        u.img.setDisplayOrigin(r.x + r.w / 2, r.y + r.h / 2).setPosition(px + ps / 2, py + ps / 2).setScale(k).setVisible(true);
      } else u.img.setVisible(false);
      // nom, temps restant (Éveil / domptage)
      const tx = x0 + W - 8, bx = px + ps + 8, bw = tx - bx;
      u.nom.setPosition(bx, y + 12).setText(b.def.name);
      u.info.setPosition(tx, y + 12).setText(eveil ? `Éveil ${Math.ceil(b.eveilT)} s` : dompte ? `Dompté ${Math.ceil(b.dompteT)} s` : '').setColor(eveil ? '#ffd87a' : '#9fd0ff');
      // PV (barre + chiffres) et PA de la bête (encoches)
      const hr = Phaser.Math.Clamp(b.hp / b.maxHp, 0, 1);
      g.fillStyle(0x2b2b2e, 1); g.fillRoundedRect(bx, y + 22, bw - 62, 9, 3);
      if (hr > 0) { g.fillStyle(hr < 0.3 && juice && Math.floor(this.world.time * 6) % 2 ? 0xff8a7a : C.hp, 1); g.fillRoundedRect(bx, y + 22, Math.max(5, (bw - 62) * hr), 9, 3); }
      u.pv.setPosition(tx, y + 27).setText(`${Math.max(0, Math.ceil(b.hp))} / ${b.maxHp}`);
      const pw = bw - 62, n = R.paMax;
      g.fillStyle(0x2b2b2e, 1); g.fillRoundedRect(bx, y + 36, pw, 6, 2);
      g.fillStyle(C.pa, 1); g.fillRoundedRect(bx, y + 36, Math.max(0, pw * Math.min(1, b.pa / n)), 6, 2);
      g.fillStyle(0x141416, 1);
      for (let j = 1; j < n; j++) g.fillRect(Math.round(bx + (pw * j) / n) - 1, y + 36, 2, 6);
    });
    return L.length;
  }

  /** Réglages de la partie (maquette « Réglages ») : échelle, modules, compteurs ; branchés par la scène. */
  reglages: Reglages | null = null;
  /** Modules déplacés (6A) : la scène sauvegarde les réglages. */
  onModules: () => void = () => {};
  /** Échelle de l'interface (7A) : la caméra de l'interface est zoomée depuis le coin haut gauche. */
  // calculé une fois par image (draw) : lu des centaines de fois, et densite() relit window.devicePixelRatio
  private kImage = 0;
  private get k() { return this.kImage || this.calcK(); }
  private calcK() { return Phaser.Math.Clamp(this.reglages?.echelle || 1, 0.8, 1.5) * densite(); }   // × vrais pixels de l'écran
  /** Rectangle de chaque module déplaçable cette image, et son décalage. */
  private modRects = new Map<string, [number, number, number, number]>();
  private modTxt = new Map<string, Txt>();
  private drag: { id: string; x: number; y: number; ox: number; oy: number } | null = null;
  /** Place un module (6A) : position de départ + décalage choisi, gardé dans l'écran. */
  private place(id: string, x: number, y: number, w: number, h: number): [number, number] {
    const W = this.scene.scale.width / this.k, H = this.scene.scale.height / this.k, o = this.reglages?.modules?.[id] ?? [0, 0];
    const nx = Phaser.Math.Clamp(x + o[0], 0, Math.max(0, W - w)), ny = Phaser.Math.Clamp(y + o[1], 0, Math.max(0, H - h));
    this.modRects.set(id, [nx, ny, w, h]);
    return [nx, ny];
  }
  /** Dégâts par seconde (4B) : total des coups portés depuis le début du combat (4 s sans toucher = nouveau combat). */
  private dps = { total: 0, debut: 0, dernier: -99, aff: 0 };
  private dpsTxt!: Txt;
  private fpsTxt!: Txt;
  /** 9B : bords de l'écran qui pulsent en rouge sous 25 % de PV. */
  private pulse!: Phaser.GameObjects.Image;

  /** Haut du suivi de quête, en pixels CSS de la page (le chat se pose juste au-dessus). */
  hautSuivi() { const r = this.modRects.get('suivi'); return r ? r[1] * this.k / densite() : window.innerHeight - 140; }
  blocks(x: number, y: number) { x /= this.k; y /= this.k; return this.rects.some(([rx, ry, rw, rh]) => x >= rx && y >= ry && x <= rx + rw && y <= ry + rh); }

  private g: Phaser.GameObjects.Graphics;
  /** Par-dessus les icônes de la barre (voile de recharge, charges, éclat) : g est dessous. */
  private gSlots: Phaser.GameObjects.Graphics;
  private fixed: <T extends Fixed>(o: T, d?: number) => T;
  // fiche du perso
  private head: Img;
  /** Portrait vivant (Interface 4A + demande de Mathis) : la tête du perso dessiné en direct, qui respire (animation de repos). */
  private portrait: Img;
  /** Perso du joueur dessiné en direct, fourni par la scène (null : perso en planche, on garde la tête de classe). */
  vivant: (() => { image(anim: string, idx: number): [string, string]; cadreTete(anim: string, idx: number): [number, number, number] | null; compte: Record<string, number> } | null) | null = null;
  private portraitImg = ''; private portraitCases = new Map<string, number>(); private portraitVue: [number, number, number, string] | null = null;
  private embleme: Img; private lvText: Txt; private ornImg!: Img;
  private icoPv: Img; private icoPa: Img; private icoPm: Img;
  private name: Txt; private hpText: Txt; private paText: Txt; private pmText: Txt; private shieldText: Txt;
  private hpLab: Txt; private paLab: Txt; private pmLab: Txt;
  /** Interface 8A : PV perdus qui restent un instant en blanc puis glissent. */
  private hpTrail = 1; private hpTrailHold = 0;
  private targetIco: Img; private targetTrail = 1; private targetTrailId = -1;
  // fiche de la cible
  private targetName: Txt; private targetHp: Txt;
  private targetId = -1; private targetT = 0;
  /** Image d'un PNJ pour la fiche de cible pendant un dialogue (Dialogues 2C) ; fournie par la scène (QuestView). */
  portraitPnj: ((id: string) => { key: string; frame: string } | null) | null = null;
  private pnjImg: Phaser.GameObjects.Image | null = null;
  // haut centre
  private coords: Txt;
  private boss: { skull: Img; name: Txt; hp: Txt };
  // mini-carte
  private miniCam: Phaser.Cameras.Scene2D.Camera | null = null;
  private miniLabel: Txt;
  /** Arène d'un donjon (12A) : « Vague 2 / 3 » et le chrono, sous la mini-carte. */
  private areneTxt: Txt;
  /** 0.5 « monde vivant » : prochain boss du monde, invasion de l'heure, événement proche, bonus du week-end. */
  private vivantTxt: Txt;
  private menus: { icon: Img; zone: Phaser.GameObjects.Zone; label: string }[] = [];
  /** Social 5B : pastille sur le bouton Social (demandes d'ami en attente), branchée par la scène. */
  pastilleSocial: () => number = () => 0;
  private pastille!: Txt;
  /** Menu des succès 8C : pastille sur le bouton Succès (récompenses à récupérer). */
  private pastilleSucces!: Txt;
  /** 8B : clic sur la ligne « Succès : … » du suivi, branché par la scène (ouvre la fiche). */
  onSucces: (id: string) => void = () => {};
  private succesId = '';
  private menuTip: Txt;
  // barre du bas
  private slots: SlotView[] = [];
  private auto: SlotView;
  private potion: SlotView;
  private xpText: Txt;
  private rageLabel: Txt;
  /** Enutrof (interface du coffre 1A + 1D + 7C) : image du coffre dans le médaillon, sa case (clic = fenêtre), alerte quand il est frappé,
   *  PV vus à l'image d'avant, et l'étiquette de la flèche quand il est hors de l'écran. */
  private medImg!: Phaser.GameObjects.Image;
  private medRect: [number, number, number, number] | null = null;
  private medAlerte = 0;
  private medPv = -1;
  private cofFleche!: Txt;
  /** Le point (x, y) de l'écran tombe-t-il sur le médaillon du coffre ? */
  surMedaillon(x: number, y: number): boolean {
    const r = this.medRect; x /= this.k; y /= this.k;
    return !!r && x >= r[0] && y >= r[1] && x <= r[0] + r[2] && y <= r[1] + r[3];
  }
  // suivi et butin
  private trackTitle: Txt; private trackBody: Txt;
  /** Quêtes : icône de la quête suivie, bouton « Passer » (tutoriel, 7A), ligne de succès discrète (19B), flèche au bord de l'écran (8B). */
  private trackIcon: Img; private skipBtn: Txt; private succesLine: Txt; private succesT = 0; private arrow: Phaser.GameObjects.Graphics;
  /** Flèche des quêtes (maquette Flèche 2A 3A+3B 6A) : icône officielle de la quête et nom du but + distance. */
  private arrowIcon: Img; private arrowLabel: Txt; private miniIcon: Img;
  /** Points des monstres sur la mini-carte : des images rondes réutilisées (un fillCircle par monstre et par image
   *  donnait des milliers de commandes de dessin à trianguler à chaque image). */
  private readonly ptsMini: Img[] = [];
  /** Boutons de la colonne de menus : dessinés seulement quand la fenêtre change de taille (36 rectangles arrondis par image avant). */
  private imMenus!: Phaser.GameObjects.Image;
  private cleMenus = '';
  private nMenus = 0;
  private pointMini(i: number, x: number, y: number, r: number, couleur: number) {
    const k = 'point_mini';
    if (!this.scene.textures.exists(k)) {
      const t = this.scene.textures.createCanvas(k, 16, 16), c = t?.getContext();
      if (t && c) { c.fillStyle = '#fff'; c.beginPath(); c.arc(8, 8, 8, 0, Math.PI * 2); c.fill(); t.refresh(); }
    }
    const im = this.ptsMini[i] ??= this.fixed(this.scene.add.image(0, 0, k), 0.5);
    im.setVisible(true).setPosition(x, y).setDisplaySize(2 * r, 2 * r).setTint(couleur);
  }
  /** Réglages 8A : la flèche peut être coupée. */
  flecheQuete = true;
  /** Idée 5 : arrivée en vue du but, la flèche grossit et s'efface (0,6 s) avec un petit son. */
  private flecheAvant: { quete: string; fin: { x: number; y: number }; x: number; y: number; ang: number; coul: number } | null = null;
  private arrivee: { t: number; x: number; y: number; ang: number; coul: number } | null = null;
  /** Clic sur « Passer » (quête id). */
  onPasser: (id: string) => void = () => {};
  /** Idée 3 : clic sur les objectifs du suivi = carte M centrée sur le but. */
  onCarteQuete: () => void = () => {};
  /** Clic sur la mini-carte (carte 11A) : la carte du monde s'ouvre. */
  onMini: () => void = () => {};
  /** Drapeau suivi (carte 9A), en point du jeu : flèche au bord de l'écran comme pour une quête. */
  drapeauSuivi: { x: number; y: number; note?: string } | null = null;
  /** Drapeaux du joueur et du groupe (14A) et tombe (15A) en points du jeu, pour la mini-carte. */
  marquesMini: { x: number; y: number; genre: 'drapeau' | 'tombe' | 'allie' | 'vivant'; coul: number }[] = [];
  private rpMini: Phaser.GameObjects.Image[] = [];
  private rpDemandes = new Set<string>();
  private rpPos: { wg: unknown; l: { x: number; y: number; g: number }[] } | null = null;
  private miniRect: [number, number, number, number] = [0, 0, 0, 0];
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
  /** Bords de l'écran rougis par un gros coup reçu (maquette « Danger » 3A). */
  private vignette: Phaser.GameObjects.Image;
  /** Tutoriel (3A) : la touche à presser, au-dessus de l'emplacement entouré. */
  private haloKey: Txt;
  private shortOf = { pa: 0, pm: 0 };
  private rageFlash = 0;
  /** Maquette Recharges 9C : éclat doré d'un sort dont la recharge vient de revenir. */
  private eclats: Record<string, number> = {};
  private areaKills = new Map<string, number>();

  constructor(private scene: Phaser.Scene, private world: World, private perso?: { nom: string; sexe: 'm' | 'f' }) {
    // Mini-carte façon Dofus 3 : une petite caméra qui filme le vrai décor autour du perso (vue de dessus réduite)
    if (world.worldGrid) {
      this.miniCam = scene.cameras.add(0, 0, 210, 150).setName('mini').setZoom(0.16).setBackgroundColor('#0d0c0a').setRoundPixels(false);
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
    if (!scene.textures.exists('vignetteRouge')) {   // dégradé : centre transparent, bords rouge sang
      const tx = scene.textures.createCanvas('vignetteRouge', 256, 256)!, cx = tx.getContext();
      const gr = cx.createRadialGradient(128, 128, 60, 128, 128, 182);
      gr.addColorStop(0, 'rgba(150,10,5,0)'); gr.addColorStop(0.55, 'rgba(160,12,6,0.35)'); gr.addColorStop(1, 'rgba(170,14,8,0.95)');
      cx.fillStyle = gr; cx.fillRect(0, 0, 256, 256); tx.refresh();
    }
    this.vignette = fixed(scene.add.image(0, 0, 'vignetteRouge').setOrigin(0).setAlpha(0), -1);
    this.pulse = fixed(scene.add.image(0, 0, 'vignetteRouge').setOrigin(0).setAlpha(0), -1);
    // Réglages 6A : modules déplaçables quand « Verrouiller la position des modules » est décoché
    const pt = (p: Phaser.Input.Pointer) => [p.x / this.k, p.y / this.k];
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.reglages?.verrou !== false) {
        const [x, y] = pt(p), [rx, ry, rw, rh] = this.miniRect;
        if (p.leftButtonDown() && x >= rx && y >= ry && x <= rx + rw && y <= ry + rh) this.onMini();
        return;
      }
      const [x, y] = pt(p);
      for (const [id, [rx, ry, rw, rh]] of this.modRects) if (x >= rx && y >= ry && x <= rx + rw && y <= ry + rh) {
        const o = this.reglages.modules?.[id] ?? [0, 0]; this.drag = { id, x, y, ox: o[0], oy: o[1] }; break;
      }
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const d = this.drag, r = this.reglages; if (!d || !r) return;
      const [x, y] = pt(p); r.modules = { ...r.modules, [d.id]: [Math.round(d.ox + x - d.x), Math.round(d.oy + y - d.y)] };
    });
    const lacher = () => { if (!this.drag) return; this.drag = null; this.onModules(); };
    scene.input.on('pointerup', lacher); scene.input.on('pointerupoutside', lacher);
    this.g = fixed(scene.add.graphics(), 1);
    this.imMenus = fixed(scene.add.image(0, 0, '__DEFAULT').setOrigin(0).setVisible(false), 1);
    this.gSlots = fixed(scene.add.graphics(), 4);

    const clsId = Object.keys(GAME_DATA.classes).find(k => GAME_DATA.classes[k] === cls) ?? 'iop';
    this.head = img(HEADS[clsId + (perso?.sexe === 'f' ? '_f' : '')] ?? HEADS[clsId] ?? 'tete_iop');
    this.portrait = img(HEADS[clsId] ?? 'tete_iop', 3).setVisible(false);
    // Cadre façon Sanstour (maquette Interface) : textes sans contour sur fond noir, chiffres alignés à droite
    const net = { ...bold, strokeThickness: 0 };
    this.embleme = img(`embleme_${clsId}`, 3);
    this.ornImg = img('orn_0', 3).setVisible(false);
    this.name = txt(15, { ...net, color: '#ffffff' }).setOrigin(0, 0.5);
    this.lvText = txt(13, { ...net, color: '#1d1a14' }, 6).setOrigin(0.5);
    this.icoPv = img('tx_lifePoints', 3); this.icoPa = img('tx_actionPoints', 3); this.icoPm = img('tx_movementPoints', 3);
    this.hpText = txt(14, net).setOrigin(1, 0.5);
    this.paText = txt(14, net).setOrigin(1, 0.5);
    this.pmText = txt(14, net).setOrigin(1, 0.5);
    const lab = { ...net, color: '#aaa49a' };
    this.hpLab = txt(12, lab).setOrigin(1, 0.5).setText('PV');
    this.paLab = txt(12, lab).setOrigin(1, 0.5).setText('PA');
    this.pmLab = txt(12, lab).setOrigin(1, 0.5).setText('PM');
    this.shieldText = txt(11, { ...bold, color: '#e3ccff', strokeThickness: 3 }, 6).setOrigin(1, 0.5);
    this.targetName = txt(14, { ...net, color: '#ffffff' }).setOrigin(0, 0.5);
    this.targetHp = txt(13, net).setOrigin(1, 0.5);
    this.targetIco = img('tx_lifePoints', 3);

    this.coords = txt(15, { ...bold, strokeThickness: 4 }).setOrigin(0.5, 0);
    this.boss = { skull: img('iconBossSkull', 4), name: txt(16, { ...bold, color: '#ffe3b0' }).setOrigin(0.5), hp: txt(11, bold).setOrigin(0.5) };

    this.miniLabel = txt(11, { color: '#d8d0b8' }).setOrigin(0.5, 0);
    this.dpsTxt = txt(13, { ...bold, strokeThickness: 0, lineSpacing: 2 }).setVisible(false);
    this.fpsTxt = txt(11, { ...bold, color: '#b9e54b', strokeThickness: 3 }, 6).setOrigin(0, 0).setVisible(false);
    for (const [id, n] of Object.entries(MODULES)) this.modTxt.set(id, txt(11, { ...bold, color: '#2a1e05', backgroundColor: '#e6b85c', padding: { x: 5, y: 2 }, strokeThickness: 0 }, 9).setText(n).setVisible(false));
    this.areneTxt = txt(14, { ...bold, color: '#ffe3b0', stroke: '#14130f', strokeThickness: 4 }).setOrigin(0.5, 0);
    this.vivantTxt = txt(12, { ...bold, color: '#e6dcc0', stroke: '#14130f', strokeThickness: 4, align: 'center', lineSpacing: 2 }).setOrigin(0.5, 0);
    this.bulleTip = txt(12, { backgroundColor: '#14130f', padding: { x: 8, y: 5 }, lineSpacing: 2 }, 9).setOrigin(0.5, 1).setVisible(false);
    this.menuTip = txt(12, { backgroundColor: '#14130f', padding: { x: 6, y: 3 } }, 9).setOrigin(1, 0.5).setVisible(false);
    this.pastille = txt(10, { ...bold, color: '#ffffff', backgroundColor: '#d8402f', padding: { x: 4, y: 1 }, strokeThickness: 0 }, 6).setOrigin(0.5).setVisible(false);
    this.pastilleSucces = txt(10, { ...bold, color: '#ffffff', backgroundColor: '#d8402f', padding: { x: 4, y: 1 }, strokeThickness: 0 }, 6).setOrigin(0.5).setVisible(false);
    for (const [icon, label, key] of MENUS) {
      const ic = img(`menu_${icon}`, 4);
      const zone = fixed(scene.add.zone(0, 0, 30, 30).setInteractive({ useHandCursor: true }), 4);
      zone.on('pointerover', () => { const t = ACTION_MENU[label] ? Touches.nomAction(ACTION_MENU[label]) : key; this.menuTip.setText(t ? `${label} (${t})` : label).setVisible(true).setPosition(zone.x - 22, zone.y); });
      zone.on('pointerout', () => this.menuTip.setVisible(false));
      zone.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => { ev.stopPropagation(); this.onMenu(label); });
      this.menus.push({ icon: ic, zone, label });
    }

    const anyIcon = Object.values(cls.spells)[0].icon;
    const mkSlot = (icon: number | null, key: string): SlotView => ({
      bg: img(icon ? 'slot_dark_background_full' : 'slot_light_lock', 2),
      icon: img(`sort_${icon ?? anyIcon}`, 3).setVisible(!!icon),
      cd: txt(17, { ...bold, strokeThickness: 4 }, 6).setOrigin(0.5),
      key: txt(12, { ...bold, strokeThickness: 3 }, 6).setOrigin(0, 0).setText(key),
      cost: txt(11, { ...bold, color: css(C.pa) }, 6).setOrigin(1, 1),
      ch: txt(11, { ...bold, color: '#9fd0ff', strokeThickness: 3 }, 6).setOrigin(0.5),
    });
    // Barre du joueur (Player.bar) : 6 touches, le clic droit (case libre, choix 6A) et Espace ; les icônes suivent la barre
    for (let i = 0; i < 8; i++) this.slots.push(mkSlot(null, ''));   // touches : render/touches.ts, à chaque image (Réglages 3A)
    // Osamodas (maquette 2A) : 4 cases d'invocation sur A Z R T (Player.INVOC à INVOC + 3), au-dessus de la barre ; seulement pour les classes à Éveil (l'Épée Vorace du Sacrieur va dans la barre normale)
    if (cls.rage.mode === 'eveil' && Object.values(cls.spells).some(s => s.invoque)) for (let i = 0; i < 4; i++) this.slots.push(mkSlot(null, ''));
    // Auto-attaque (clic gauche) : l'icône suit l'arme portée
    this.auto = mkSlot(cls.spells[cls.basic ?? cls.mobility].icon, 'Clic');
    this.auto.icon!.setTexture(cls.basic ? `sort_${cls.spells[cls.basic].icon}` : 'arme_0');
    // Survol : infobulle du sort
    const hover = (sv: SlotView, id: () => string | null) => {
      const z = fixed(scene.add.zone(0, 0, 54, 54).setInteractive(), 4);
      z.on('pointerover', () => { const i = id(); if (i) this.onSlotHover(i, z.x, z.y - 27); });
      z.on('pointerout', () => this.onSlotHover(null, 0, 0));
      z.on('pointerdown', (ptr: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        const i = id(); if (!i || !ptr.leftButtonDown()) return;
        ev.stopPropagation(); this.onSlotClick(i);
      });
      sv.zone = z;
    };
    this.slots.forEach((sv, i) => hover(sv, () => world.player.bar[i] ?? null));
    hover(this.auto, () => world.player.autoAttack);
    this.potion = mkSlot(null, '');
    this.potion.bg.setTexture('slot_dark_background_full');
    this.potion.icon = img('icon_pv', 3);
    this.xpText = txt(12, bold).setOrigin(0.5);
    this.rageLabel = txt(11, { ...bold, color: css(C.rage) }).setOrigin(0.5, 0).setText(cls.rage.name);
    this.medImg = img('__DEFAULT', 3).setVisible(false);
    this.cofFleche = txt(11, { ...bold, color: '#ffd86a', stroke: '#1a140c', strokeThickness: 4, align: 'center' }, 3).setVisible(false);

    this.trackTitle = txt(13, { ...bold, color: css(C.xp) });
    this.trackBody = txt(12, { lineSpacing: 3 });
    this.trackIcon = img('qi_quest', 5).setVisible(false);
    this.succesLine = txt(12, { ...bold, color: '#f2d36b' }).setAlpha(0).setInteractive({ useHandCursor: true });
    this.succesLine.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      if (this.succesT <= 0 || !this.succesId) return; ev.stopPropagation(); this.onSucces(this.succesId);
    });
    this.skipBtn = txt(12, { ...bold, color: '#c9c4ab', backgroundColor: '#2e2d28', padding: { x: 6, y: 2 } }, 6).setText('Passer ›').setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.skipBtn.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation(); const q = world.quetes, id = q?.suivie; if (id) this.onPasser(id);
    });
    this.arrow = fixed(scene.add.graphics(), 3);
    this.arrowIcon = img('qi_quest', 3).setVisible(false);
    this.arrowLabel = txt(12, { ...bold, color: '#f1ecd8', stroke: '#1a140c', strokeThickness: 4, align: 'center', lineSpacing: -1 }, 3).setVisible(false);
    this.miniIcon = img('qi_questObjective', 5).setVisible(false);
    this.trackBody.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      if (!world.quetes?.enCours.length) return;
      ev.stopPropagation(); this.onCarteQuete();
    });
    // 7A : un clic sur le suivi passe à la quête suivante
    this.trackTitle.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      const q = world.quetes; if (!q || q.enCours.length < 2) return;
      ev.stopPropagation();
      const i = q.enCours.findIndex(c => c.id === q.suivie);
      q.suivie = q.enCours[(i + 1) % q.enCours.length].id;
    });

    this.bannerBg = img('background_levelup_banner', 7).setAlpha(0);
    this.center = txt(34, { ...bold, stroke: '#3a2208', strokeThickness: 6, align: 'center', lineSpacing: -4 }, 8).setOrigin(0.5).setAlpha(0);
    this.toastText = txt(15, {}, 8).setOrigin(0.5).setAlpha(0);
    this.zoneName = txt(40, { ...bold, stroke: '#1d1408', strokeThickness: 7 }, 8).setOrigin(0.5).setAlpha(0);
    this.zoneOrn = img('success_ornament', 7).setOrigin(0.5).setAlpha(0);
    this.zoneSub = txt(15, { ...bold, color: '#5a3305', strokeThickness: 0 }, 8).setOrigin(0.5).setAlpha(0);
    this.zonePlate = img('scoreTitle', 7).setOrigin(0.5).setAlpha(0);
    this.zonePlateTxt = txt(13, { ...bold, color: '#4a2a05', strokeThickness: 0, align: 'center', lineSpacing: -2 }, 8).setOrigin(0.5).setAlpha(0);
    this.haloKey = txt(15, { ...bold, color: '#2a1e05', backgroundColor: '#e6b85c', padding: { x: 7, y: 3 }, strokeThickness: 0 }, 7).setOrigin(0.5, 1).setVisible(false);
  }

  /** Bannière centrale ; defeat = ruban rouge de défaite au lieu du ruban doré. */
  /** 0.5 « monde vivant » (2D) : ce qu'on suit sous la mini-carte. */
  private texteVivant(world: World): string {
    const v = world.vueVivant, h = world.opts.horloge, l: string[] = [], p = world.player;
    if (!v || !h || world.donjonIci()) return '';
    const s = h();
    if (v.boss && !v.boss.fin) l.push(`☠ ${v.boss.nom} · ${v.boss.lieu}${v.boss.reste != null ? ` · ${chrono(v.boss.reste)}` : ''}`);
    else {
      const sv = rendezVous(s).suivant, d = BOSS_MONDE[sv.cle], dans = Math.ceil((sv.debut - s) / 60);
      if (d) l.push(dans <= 60 ? `Boss du monde dans ${dans} min : ${d.nom}` : `Prochain boss du monde : ${heureTexte(sv.debut)}`);
    }
    const inv = v.invasion;
    if (inv) {
      const ec = p.resources[VIVANT.invasion.eclat] ?? 0;
      l.push(inv.pleine ? `Invasion repoussée : ${inv.nom}${inv.coffre ? ` · coffre ${ec} / ${VIVANT.invasion.coffre.prix} Éclats` : ''}` : `Invasion : ${inv.nom} · ${inv.jauge} / ${inv.max}${ec ? ` · ${ec} Éclats` : ''}`);
    }
    for (const e of v.evenements) if (!e.fin && Math.hypot(e.x - p.x, e.y - p.y) < 1400)
      l.push(e.sorte === 'defense' ? `Défends ${e.nom} · ${e.pv} % · ${e.reste} s` : `Coffre gardé · vague ${Math.min(e.vague + 1, e.vagues)} / ${e.vagues}`);
    const we = world.weekEnd;
    if (we) l.push(`Week-end : ${we.nom}`);
    return l.join('\n');
  }

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
  /** Petit bandeau doré en haut de l'écran (la plaque des sous-zones), pour une annonce qui ne doit pas cacher le combat. */
  plaque(text: string, ms = 3200) {
    const small = [this.zonePlate, this.zonePlateTxt];
    this.scene.tweens.killTweensOf([this.zoneName, this.zoneOrn, this.zoneSub, ...small]);
    for (const o of [this.zoneName, this.zoneOrn, this.zoneSub]) o.setAlpha(0);
    this.zonePlateTxt.setText(text);
    this.scene.tweens.add({ targets: small, alpha: 1, duration: 300 });
    this.scene.tweens.add({ targets: small, alpha: 0, delay: ms, duration: 700 });
  }
  toast(text: string, duree = 1600) {
    this.toastText.setText(text).setAlpha(1);
    this.scene.tweens.killTweensOf(this.toastText);
    this.scene.tweens.add({ targets: this.toastText, alpha: 0, delay: duree, duration: 400 });
  }
  hurtFlash(strong: boolean) {
    this.hurtRect.setAlpha(strong ? 0.28 : 0.1);
    this.scene.tweens.add({ targets: this.hurtRect, alpha: 0, duration: 300 });
  }
  /** 3A : gros coup reçu, les bords de l'écran rougissent puis s'effacent. */
  grosCoup() {
    this.scene.tweens.killTweensOf(this.vignette);
    this.vignette.setAlpha(0.9);
    this.scene.tweens.add({ targets: this.vignette, alpha: 0, duration: 650, ease: 'Quad.In' });
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
  succes(nom: string, points: number, id = '') { this.succesId = id; this.succesLine.setText(`Succès : ${nom}  (+${points} pt${points > 1 ? 's' : ''})`).setAlpha(1); this.succesT = 6; }

  /** Événements de la simulation utiles à l'interface. */
  handle(e: SimEvent) {
    const w = this.world;
    switch (e.k) {
      case 'hit': if (e.target === 'monster') {
        if (e.id !== undefined) { this.targetId = e.id; this.targetT = 5; }
        const d = this.dps, t = w.time;
        if (t - d.dernier > 4) { d.total = 0; d.debut = t; }
        d.total += e.amount; d.dernier = t;
      } break;
      case 'kill': {
        const d = GAME_DATA.monsters[e.monster];
        this.loot(`${d.name}  ·  +${d.xp ?? Math.round(d.hp / 5)} XP`);
        const a = w.area?.name ?? '';
        this.areaKills.set(a, (this.areaKills.get(a) ?? 0) + 1);
        break;
      }
      case 'rageFull': this.rageFlash = 1.2; break;
      case 'rechargePrete': this.eclats[e.id] = 0.8; break;
      case 'groupCleared': this.loot('Groupe vaincu  ·  +1 potion', '#7be07b'); break;
      case 'massacre': this.toast(`Massacre ×${e.n}  ·  +${e.bonus} % XP`); break;
      case 'massacreFin': this.loot(`Massacre de ${e.n} monstres`, '#e6b85c'); break;
    }
  }

  draw(juice: boolean, dt = 1 / 60) {
    this.kImage = this.calcK();
    const k = this.k, world = this.world, W = this.scene.scale.width / k, H = this.scene.scale.height / k, g = this.g, p = world.player, cls = p.cls;
    const R = this.reglages;
    this.modRects.clear();
    g.clear(); this.gSlots.clear();
    this.hurtRect.setSize(W, H); this.vignette.setDisplaySize(W, H); this.pulse.setDisplaySize(W, H);
    // 9B : sous 25 % de PV, les bords de l'écran battent en rouge
    const bas = R?.pulsePv !== false && p.hp > 0 && p.hp / p.maxHp < 0.25;
    this.pulse.setAlpha(bas ? 0.25 + 0.3 * Math.max(0, Math.sin(world.time * 6)) : 0);
    this.shortOf.pa = Math.max(0, this.shortOf.pa - dt); this.shortOf.pm = Math.max(0, this.shortOf.pm - dt);
    this.rageFlash = Math.max(0, this.rageFlash - dt);
    for (const k of Object.keys(this.eclats)) if ((this.eclats[k] -= dt) <= 0) delete this.eclats[k];
    const blink = (v: number) => v > 0 && Math.floor(v * 12) % 2 === 0;
    this.rects = []; this.portraits = [];
    const panel = (x: number, y: number, w: number, h: number, a = C.panelA) => {
      this.rects.push([x, y, w, h]);
      g.fillStyle(C.panel, a); g.fillRoundedRect(x, y, w, h, 5);
      g.lineStyle(1, C.border, 1); g.strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, 5);
    };
    const bar = (x: number, y: number, w: number, h: number, r: number, col: number) => {
      g.fillStyle(C.track, 1); g.fillRoundedRect(x, y, w, h, h / 2);
      if (r > 0) { g.fillStyle(col, 1); g.fillRoundedRect(x, y, Math.max(h, w * Phaser.Math.Clamp(r, 0, 1)), h, h / 2); }
    };

    // --- Cadre du perso (haut gauche), façon Sanstour (maquette Interface : 1A 2A 3A 4A 5A 6C 7A 8A+8B+8C 9A 10A) ---
    // fond noir translucide sans bordure, bandeau emblème + nom, portrait vivant + pastille de niveau, PV / PA / PM
    const cadre = (x: number, y: number, w: number, h: number, hd = 30) => {
      this.rects.push([x, y, w, h]);
      g.fillStyle(0x08080a, 0.82); g.fillRoundedRect(x, y, w, h, 9);
      g.fillStyle(0xffffff, 0.09); g.fillRect(x, y + hd, w, 1);
    };
    /** Barre fine du cadre : `n` encoches (une par PA / PM, 3A), `trail` = PV perdus encore en blanc (8A). */
    const barre = (x: number, y: number, w: number, r: number, col: number, n = 0, trail = 0) => {
      const h = 10, k = Phaser.Math.Clamp(r, 0, 1);
      g.fillStyle(0x2b2b2e, 1); g.fillRoundedRect(x, y, w, h, 3);
      if (trail > k) { g.fillStyle(0xffffff, 0.9); g.fillRoundedRect(x, y, Math.max(6, w * Math.min(1, trail)), h, 3); }
      if (k > 0) { g.fillStyle(col, 1); g.fillRoundedRect(x, y, Math.max(6, w * k), h, 3); }
      g.fillStyle(0x141416, 1);
      for (let i = 1; i < n; i++) g.fillRect(Math.round(x + (w * i) / n) - 1, y, 2, h);
    };
    const fw = 320, hd = 30, fh = hd + 80, [fx, fy] = this.place('perso', 12, 10, fw, fh);
    cadre(fx, fy, fw, fh, hd);
    this.embleme.setPosition(fx + 19, fy + hd / 2).setDisplaySize(17, 17 * (this.embleme.height / this.embleme.width || 1));
    const titre = this.world.quetes?.titre;   // titre d'un succès (Tour 7A)
    const orne = styleDef('ornements', this.world.player.style.ornements);   // « Apparats : » 5B : ornement de nom
    this.name.setPosition(fx + 34, fy + hd / 2).setText(`${nomOrne(this.perso?.nom ?? cls.name, orne?.id)}${titre ? `  « ${titre} »` : ''}`).setColor(orne?.couleur ?? '#ffffff');
    const orn = this.world.quetes?.ornement;   // ornement porté (menu des succès 6B)
    if (orn && this.scene.textures.exists(`orn_${orn.icone}`)) this.ornImg.setTexture(`orn_${orn.icone}`).setVisible(true).setDisplaySize(20, 20).setPosition(this.name.x + this.name.width + 14, fy + hd / 2);
    else this.ornImg.setVisible(false);
    // Portrait : case carrée, la tête du perso dessiné en direct qui respire (repos AnimStatiqueExplo0, face)
    const ps = 60, px = fx + 10, py = fy + hd + 10, pcx = px + ps / 2;
    g.fillStyle(0x1c2620, 1); g.fillRoundedRect(px, py, ps, ps, 6);
    const vv = this.vivant?.(), idle = 'AnimStatiqueExplo0_1', nIdle = vv?.compte[idle] ?? 0;
    if (vv && nIdle) {
      const [k, f] = vv.image(idle, Math.floor(world.time * 20) % nIdle), P = this.portrait;
      if (this.portraitImg !== k + f) {   // nouvelle image de l'animation : on la montre dans la case (128 px, affichée en 60)
        this.portraitImg = k + f;
        // Chaque image du repos est recopiée UNE fois dans une case de la planche 'portrait_vivant' (8 × 8 cases de 128 px) ;
        // ensuite on ne fait que changer de case : plus d'envoi à la carte graphique 20 fois par seconde (mesure du 10 nov. 2026)
        let cell = this.portraitCases.get(k + f);
        if (cell === undefined) {
          if (this.portraitCases.size >= 64) this.portraitCases.clear();   // autre perso, autre tenue : on repart de zéro
          cell = this.portraitCases.size; this.portraitCases.set(k + f, cell);
          const fr = this.scene.textures.getFrame(k, f), src = fr.source.image as CanvasImageSource;
          const ss = (fr as unknown as { data: { spriteSourceSize?: { x: number; y: number } } }).data.spriteSourceSize;
          const sx = fr.trimmed && ss ? ss.x : 0, sy = fr.trimmed && ss ? ss.y : 0;
          // fenêtre fixe sur le visage, prise sur la 1re image du repos : la tête respire dedans (coiffe comprise, sans la suivre)
          if (this.portraitVue?.[3] !== k) {
            const c = vv.cadreTete(idle, 0) ?? [fr.realWidth / 2, sy + 120, 300];
            this.portraitVue = [c[0] - c[2] / 2, c[1] - c[2] / 2, c[2], k];
          }
          const [wx, wy, vue] = this.portraitVue, S = 128 / vue;
          const tex = this.scene.textures.exists('portrait_vivant') ? this.scene.textures.get('portrait_vivant') as Phaser.Textures.CanvasTexture
            : this.scene.textures.createCanvas('portrait_vivant', 1024, 1024)!;
          const ctx = tex.getContext(), cx = (cell % 8) * 128, cy = Math.floor(cell / 8) * 128;
          ctx.save(); ctx.beginPath(); ctx.rect(cx, cy, 128, 128); ctx.clip();
          ctx.clearRect(cx, cy, 128, 128); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(src, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, cx + (sx - wx) * S, cy + (sy - wy) * S, fr.cutWidth * S, fr.cutHeight * S);
          ctx.restore();
          if (!tex.has(`c${cell}`)) tex.add(`c${cell}`, 0, cx, cy, 128, 128);
          tex.refresh();
        }
        P.setTexture('portrait_vivant', `c${cell}`);
      }
      P.setVisible(true).setPosition(pcx, py + ps / 2).setDisplaySize(ps - 2, ps - 2); this.head.setVisible(false);
    } else {
      this.portrait.setVisible(false);
      this.head.setVisible(true).setPosition(pcx, py + ps / 2).setDisplaySize(ps - 4, ps - 4);
    }
    const gs = this.gSlots;   // bord, Rage et pastille par-dessus le portrait
    gs.lineStyle(2, 0x8c8c86, 1); gs.strokeRoundedRect(px + 1, py + 1, ps - 2, ps - 2, 6);
    // 6C : la Rage (ou la Précision) remplit le bord du portrait, qui s'embrase une fois pleine
    // Sacrieur : la jauge montre la Souffrance (palier / 10), en rouge sang, qui palpite à partir de 6
    const sf = cls.souffrance ? p.souffrance : -1;
    // Forgelance (6A) : pas de jauge ; le bord montre le temps restant du bonus de reprise de la Lance, en or
    const rep = cls.lance ? p.mods.find(m => m.src === 'reprise') : undefined, fl = cls.lance ? (rep ? rep.t / (rep.t0 || 1) : 0) : -1;
    // Enutrof : les pièces du coffre au trésor (palier en cours : bronze, argent, or, puis orange au palier Trésor)
    const cof = cls.coffre, pal = cof ? palierCoffre(p) : -1;
    const rr = fl >= 0 ? fl : sf >= 0 ? sf / 10 : cof ? p.coffrePieces / cof.paliers[cof.paliers.length - 1] : p.rage / cls.rage.max;
    // Eniripsa : l'Éloquence en vert d'eau, qui scintille une fois pleine
    const eloq = cls.rage.mode === 'eloquence';
    const rageCol = fl >= 0 ? 0xe8b860 : sf >= 0 ? (sf >= 6 && Math.floor(world.time * 4) % 2 ? 0xff4a3a : 0xc0262a)
      : eloq ? (p.rageFull && Math.floor(world.time * 6) % 2 ? 0xc8ffd8 : 0x4fd88a)
      : cof ? Phaser.Display.Color.HexStringToColor(couleurCoffre(pal)).color : p.rageFull ? (Math.floor(world.time * 6) % 2 ? 0xffc04d : C.rage) : C.rage;
    if (p.rageFull) {
      const k = 0.5 + 0.5 * Math.sin(world.time * 10);
      gs.lineStyle(7, 0xffcf4d, 0.25 + 0.3 * k); gs.strokeRoundedRect(px - 3, py - 3, ps + 6, ps + 6, 8);
      gs.lineStyle(3, rageCol, 1); gs.strokeRoundedRect(px - 1, py - 1, ps + 2, ps + 2, 7);
    } else if (rr > 0) {
      // le long du bord, depuis le milieu du haut, dans le sens des aiguilles d'une montre
      const x0 = px - 1, y0 = py - 1, s2 = ps + 2, per = s2 * 4;
      let reste = per * Phaser.Math.Clamp(rr, 0, 1);
      const pts: [number, number][] = [[x0 + s2 / 2, y0], [x0 + s2, y0], [x0 + s2, y0 + s2], [x0, y0 + s2], [x0, y0], [x0 + s2 / 2, y0]];
      gs.lineStyle(3, rageCol, 1); gs.beginPath(); gs.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length && reste > 0; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i], l = Math.hypot(bx - ax, by - ay), t = Math.min(1, reste / l);
        gs.lineTo(ax + (bx - ax) * t, ay + (by - ay) * t); reste -= l;
      }
      gs.strokePath();
    }
    // pastille de niveau en bas à droite du portrait
    const lv = String(p.level), lw = Math.max(20, 9 + lv.length * 8);
    gs.fillStyle(0x000000, 0.5); gs.fillRoundedRect(px + ps - lw + 6, py + ps - 13, lw, 20, 5);
    gs.fillStyle(0xbdb39e, 1); gs.fillRoundedRect(px + ps - lw + 6, py + ps - 14, lw, 20, 5);
    this.lvText.setPosition(px + ps - lw / 2 + 6, py + ps - 4).setText(lv);
    // trois lignes : icône officielle, barre, « PV 248 / 248 » aligné à droite
    const ix = px + ps + 20, bx = ix + 16, tx = fx + fw - 10, bw = tx - 106 - bx, ry0 = py + 9;
    const hr = p.hp / p.maxHp;
    if (hr >= this.hpTrail) { this.hpTrail = hr; this.hpTrailHold = 0.4; }
    else if ((this.hpTrailHold -= dt) <= 0) this.hpTrail = Math.max(hr, this.hpTrail - dt * 0.6);
    const bat = hr < 0.3 && p.hp > 0 ? 1 + 0.22 * Math.max(0, Math.sin(world.time * 9)) : 1;   // 8C : le cœur bat sous 30 % de PV
    this.icoPv.setPosition(ix, ry0).setDisplaySize(18 * bat, 18 * bat);
    barre(bx, ry0 - 5, bw, hr, C.hp, 0, juice ? this.hpTrail : 0);
    if (p.shield > 0) {   // 7A : bouclier en violet à la suite des PV, ou par-dessus la fin de la barre si elle est pleine
      const sw = Math.max(4, bw * Math.min(1, p.shield / p.maxHp)), sx = Math.min(bx + bw * Phaser.Math.Clamp(hr, 0, 1), bx + bw - sw);
      g.fillStyle(C.shield, 0.95); g.fillRoundedRect(sx, ry0 - 5, sw, 10, 3);
    }
    this.shieldText.setVisible(p.shield > 0).setPosition(bx + bw - 2, ry0).setText(`+${Math.ceil(p.shield)}`);
    this.hpText.setPosition(tx, ry0).setText(`${Math.max(0, Math.ceil(p.hp))} / ${p.maxHp}`);
    this.hpLab.setPosition(tx - this.hpText.width - 4, ry0 + 1);
    const ry1 = ry0 + 21, ry2 = ry1 + 21;
    this.icoPa.setPosition(ix, ry1).setDisplaySize(18, 18);
    barre(bx, ry1 - 5, bw, p.pa / p.paMax, blink(this.shortOf.pa) ? 0xff5040 : C.pa, Math.round(p.paMax));
    this.paText.setPosition(tx, ry1).setText(`${Math.floor(p.pa)} / ${Math.round(p.paMax)}`);
    this.paLab.setPosition(tx - this.paText.width - 4, ry1 + 1);
    this.icoPm.setPosition(ix, ry2).setDisplaySize(18, 18);
    barre(bx, ry2 - 5, bw, p.pm / p.pmMax, blink(this.shortOf.pm) ? 0xff5040 : C.pm, Math.round(p.pmMax));
    this.pmText.setPosition(tx, ry2).setText(`${Math.floor(p.pm)} / ${Math.round(p.pmMax)}`);
    this.pmLab.setPosition(tx - this.pmText.width - 4, ry2 + 1);
    const nbBetes = this.cadresBetes(g, fx, fy + fh + 6, juice);
    this.cadresGroupe(g, fx, fy + fh + 6 + nbBetes * 55, juice);

    // --- Fiche de la cible (à côté), même style (9A) : le dernier monstre touché, ou le PNJ pendant un dialogue ---
    this.targetT -= dt;
    const tgt = world.monsters.find(m => m.id === this.targetId && !m.dead) as Monster | undefined;
    const dlg = world.quetes?.dialogue, port = dlg ? this.portraitPnj?.(dlg.pnj) : null;
    const showT = !!tgt && this.targetT > 0 && !dlg;
    this.targetName.setVisible(showT || !!dlg); this.targetHp.setVisible(showT); this.targetIco.setVisible(showT);
    if (this.pnjImg) this.pnjImg.setVisible(!!port);
    const tx0 = fx + fw + 8, tw = 240;
    if (dlg) {   // pendant un dialogue, la fiche de cible montre le PNJ : son portrait et son nom
      const th = 56;
      cadre(tx0, fy, tw, th, th);
      if (port) {
        this.pnjImg ??= this.fixed(this.scene.add.image(0, 0, port.key, port.frame), 6);
        this.pnjImg.setTexture(port.key, port.frame).setOrigin(0.5, 0);
        const k = 92 / this.pnjImg.height;   // le haut du corps : la tête dans la case
        this.pnjImg.setScale(k).setPosition(tx0 + 28, fy + 5).setCrop(0, 0, this.pnjImg.width, 46 / k);
      }
      this.targetName.setPosition(tx0 + 58, fy + th / 2).setText(world.quetes!.data.pnj[dlg.pnj]?.nom ?? '');
    }
    if (tgt && showT) {
      const th = hd + 30, r = tgt.hp / tgt.maxHp;
      if (this.targetTrailId !== tgt.id) { this.targetTrailId = tgt.id; this.targetTrail = r; }
      this.targetTrail = r >= this.targetTrail ? r : Math.max(r, this.targetTrail - dt * 0.8);
      cadre(tx0, fy, tw, th, hd);
      this.targetName.setPosition(tx0 + 10, fy + hd / 2).setText(`${tgt.def.name}  ·  niv. ${this.world.monsterLevel(tgt)}`);
      const ty = fy + hd + 15, ttx = tx0 + tw - 10;
      this.targetIco.setPosition(tx0 + 19, ty).setDisplaySize(18, 18);
      this.targetHp.setPosition(ttx, ty).setText(`${Math.max(0, Math.ceil(tgt.hp))} / ${tgt.maxHp}`);
      barre(tx0 + 35, ty - 5, ttx - this.targetHp.width - 10 - (tx0 + 35), r, tgt.def.boss || tgt.def.elite ? C.gold : C.hp, 0, juice ? this.targetTrail : 0);
    }

    // --- Coordonnées et sous-zone (haut centre) ---
    const map = world.worldGrid?.mapAt(p.x, p.y);
    this.coords.setPosition(W / 2, 10).setText(map ? `${world.area?.region ?? world.zone.name}${world.lieu ?? world.area ? ` (${world.lieu ?? world.area!.name})` : ''}` : world.zone.name);   // dedans : le nom de l'intérieur (maquette Entrées 5A)   // sans coordonnées (choix 4A : rien ne rappelle les cartes ; elles iront sur la carte du monde, touche M)

    // --- Jauge de boss ---
    const wgr = world.worldGrid, ici = wgr?.mapAt(world.player.x, world.player.y)?.tag;   // seulement le boss de la carte du joueur
    const boss = world.monsters.find(m => m.def.boss && !m.dead && (!wgr || wgr.mapAt(m.homeX, m.homeY)?.tag === ici));
    const Bv = this.boss, vis = !!boss;
    Bv.skull.setVisible(vis); Bv.name.setVisible(vis); Bv.hp.setVisible(vis);
    if (boss) {
      const w = Math.min(520, W * 0.36), x = W / 2 - w / 2, y = 48;
      panel(x - 40, y - 26, w + 60, 50);
      bar(x, y + 2, w, 14, boss.hp / boss.maxHp, boss.furieux ? 0xe8471c : 0xc8352b);
      g.fillStyle(C.gold, 1); g.fillRect(x + w * DANGER.furieux.seuil - 1, y - 1, 2, 20);   // 5A : marque de la phase Furieux
      Bv.skull.setPosition(x - 20, y + 9).setDisplaySize(28, 28);
      Bv.name.setPosition(W / 2, y - 10).setText(boss.furieux ? `${boss.def.name} · Furieux` : boss.def.name).setColor(boss.furieux ? '#ff8a6a' : '#ffe3b0');
      Bv.hp.setPosition(W / 2, y + 9).setText(`${Math.max(0, Math.ceil(boss.hp))} / ${boss.maxHp}`);
    }

    // --- Mini-carte et colonne de menus (haut droite) ---
    const colX = W - 12 - 36, mw = 210, mh = 150, [mx, my] = this.place('mini', colX - 10 - mw, 10, mw, mh + 20);
    // cadre seulement : l'intérieur est filmé par la caméra de la mini-carte, dessinée avant l'interface
    this.rects.push([mx - 3, my - 3, mw + 6, mh + 6]); this.miniRect = [mx, my, mw, mh];
    g.lineStyle(3, 0x24231d, 1); g.strokeRoundedRect(mx - 2, my - 2, mw + 4, mh + 4, 5);
    g.lineStyle(1, 0x5a584c, 1); g.strokeRoundedRect(mx - 3.5, my - 3.5, mw + 7, mh + 7, 6);
    if (this.muet) {
      const ix = mx + 8, iy = my + mh - 22;
      g.fillStyle(0x0d0c0a, 0.75); g.fillRoundedRect(ix - 4, iy - 4, 30, 22, 4);
      g.fillStyle(0xe8e2cc, 1); g.fillRect(ix, iy + 4, 5, 6); g.fillTriangle(ix + 4, iy + 7, ix + 11, iy, ix + 11, iy + 14);
      g.lineStyle(2, 0xe05040, 1); g.lineBetween(ix + 14, iy + 2, ix + 22, iy + 12); g.lineBetween(ix + 22, iy + 2, ix + 14, iy + 12);
    }
    const mc = this.miniCam;
    this.miniIcon.setVisible(false);
    let nPts = 0;
    if (mc) {
      const ps = ISO.toScreen(p.x, p.y);
      mc.setViewport(Math.round(mx * this.k), Math.round(my * this.k), Math.round(mw * this.k), Math.round(mh * this.k)).setZoom(0.16 * this.k).centerOn(ps.x, ps.y - 20);
      // monstres (points rouges, dorés pour les élites) par-dessus le décor filmé
      const toMini = (wx: number, wy: number) => { const s2 = ISO.toScreen(wx, wy); return { x: mx + mw / 2 + (s2.x - ps.x) * mc.zoom / this.k, y: my + mh / 2 + (s2.y - ps.y + 20) * mc.zoom / this.k }; };
      // tri grossier d'abord (distance monde) : la carte ne montre qu'environ 1000 unités autour du perso, le reste du monde ouvert est sauté
      const zk = mc.zoom / this.k, lim = Math.max(mw, mh) / zk * 1.6;
      for (const m of world.monsters) {
        if (m.dead || Math.abs(m.x - p.x) + Math.abs(m.y - p.y) > lim) continue;
        const q = toMini(m.x, m.y);
        if (q.x < mx || q.y < my || q.x > mx + mw || q.y > my + mh) continue;
        this.pointMini(nPts++, q.x, q.y, m.def.boss ? 3.5 : 2.2, m.def.boss || m.def.elite ? C.gold : 0xd04030);
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
        const it = this.flecheQuete ? Q.itineraire() : null, cq2 = Q.enCours.find(c => c.id === Q.suivie) ?? Q.enCours[0];
        if (it && cq2) {
          // 5A : l'icône officielle de la quête (au bord de la mini-carte si le but est loin), sur le but ou la prochaine porte
          const tq = it.but && !it.pts.some(o => o.genre === 'porte' || o.genre === 'zaap' || o.genre === 'portail') ? it.but : it.pts[it.pts.length - 1];
          const q = toMini(tq.x, tq.y), cx = Phaser.Math.Clamp(q.x, mx + 8, mx + mw - 8), cy = Phaser.Math.Clamp(q.y, my + 8, my + mh - 8);
          const k = 0.5 + 0.5 * Math.sin(world.time * 5), [, back] = QUEST_ICON[Q.def(cq2.id).type];
          g.lineStyle(1.5, C.gold, 0.4 + 0.5 * k); g.strokeCircle(cx, cy, 9 + 3 * k);
          this.miniIcon.setTexture(`qi_${back}`).setVisible(true).setPosition(cx, cy);
          this.miniIcon.setScale(16 / Math.max(this.miniIcon.width, this.miniIcon.height));
        } else this.miniIcon.setVisible(false);
      }
      // 11A : repères officiels avec les icônes de la carte du monde ; drapeaux, tombe et groupe
      const wg = world.worldGrid;
      let nRp = 0;
      if (wg?.world.reperes && this.rpPos?.wg !== wg) {
        const l: { x: number; y: number; g: number }[] = [], parCarte = new Map<string, number>();
        for (const r of wg.world.reperes) {
          if (!famille(r) || secret(r)) continue;
          const m = wg.mapByTag(r.t); if (!m || m.inside) continue;
          const c = wg.cellCenter(wg.cellOf(r.t, 280)), s2 = wg.toScreen(c.x, c.y), q = ISO.toWorld(s2.x, s2.y), i = parCarte.get(r.t) ?? 0;
          parCarte.set(r.t, i + 1); l.push({ x: q.x + i * 90, y: q.y - i * 90, g: r.g });
        }
        this.rpPos = { wg, l };
      }
      for (const r of this.rpPos?.wg === wg ? this.rpPos.l : []) {
        if (Math.abs(r.x - p.x) + Math.abs(r.y - p.y) > lim) continue;
        const q = toMini(r.x, r.y);
        if (q.x < mx + 6 || q.y < my + 6 || q.x > mx + mw - 6 || q.y > my + mh - 6) continue;
        const key = `rp_${r.g}`;
        if (!this.scene.textures.exists(key)) {
          if (!this.rpDemandes.has(key)) { this.rpDemandes.add(key); this.scene.load.image(key, v(`assets/ui/reperes/${r.g}.webp`)); this.scene.load.start(); }
          continue;
        }
        const im = this.rpMini[nRp] ??= this.fixed(this.scene.add.image(0, 0, key), 0.4);
        im.setTexture(key).setVisible(true).setPosition(q.x, q.y).setDisplaySize(16, 16); nRp++;
      }
      for (const o of this.marquesMini) {
        const q = toMini(o.x, o.y), cx = Phaser.Math.Clamp(q.x, mx + 6, mx + mw - 6), cy = Phaser.Math.Clamp(q.y, my + 6, my + mh - 6);
        g.lineStyle(1, 0x000000, 1);
        if (o.genre === 'drapeau') { g.fillStyle(0x3a2a14, 1); g.fillRect(cx - 1, cy - 9, 2, 10); g.fillStyle(o.coul, 1); g.fillTriangle(cx + 1, cy - 9, cx + 8, cy - 6, cx + 1, cy - 3); }
        else if (o.genre === 'tombe') { g.fillStyle(0xd8d2c0, 1); g.fillRect(cx - 1, cy - 7, 2, 10); g.fillRect(cx - 4, cy - 4, 8, 2); }
        else if (o.genre === 'vivant') {   // 0.5 : losange qui pulse (boss du monde, coffre d'invasion, événement)
          const r = 5.5 + Math.sin(this.scene.time.now / 160);
          const d = [{ x: cx, y: cy - r }, { x: cx + r, y: cy }, { x: cx, y: cy + r }, { x: cx - r, y: cy }];
          g.fillStyle(o.coul, 1); g.fillPoints(d, true); g.lineStyle(1.5, 0x000000, 1); g.strokePoints(d, true, true);
        }
        else { g.fillStyle(o.coul, 1); g.fillCircle(cx, cy, 3.5); g.strokeCircle(cx, cy, 3.5); }
      }
      for (let i = nRp; i < this.rpMini.length; i++) this.rpMini[i].setVisible(false);
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
    for (let i = nPts; i < this.ptsMini.length; i++) this.ptsMini[i].setVisible(false);
    // 6B : coordonnées de la carte, comme dans Sanstour
    const ici2 = world.worldGrid?.mapAt(p.x, p.y), co = R?.coords !== false && ici2 && !ici2.inside ? `  [${ici2.x},${ici2.y}]` : '';
    this.miniLabel.setPosition(mx + mw / 2, my + mh + 6).setText(`${world.lieu ?? world.area?.name ?? world.zone.name}${co}`);
    // 7C : compteur d'images, dans le coin de la mini-carte
    this.fpsTxt.setVisible(!!R?.compteurFps).setPosition(mx + 6, my + 4);
    if (R?.compteurFps) this.fpsTxt.setText(`${Math.round(this.scene.game.loop.actualFps)} FPS`);
    const ar = world.arene, ga = !ar && world.guerre?.attaque && !world.guerre.attaque.fini && world.guerre.surIle().includes(p) ? world.guerre.attaque : null;
    if (ga) this.areneTxt.setVisible(true).setPosition(mx + mw / 2, my + mh + 22).setText(`${ga.c.nom}\nVague ${ga.vague} / 5 · ${ga.restantes} / ${ga.cawottes.length} cawottes · ${chrono(ga.chrono)}`);
    else this.areneTxt.setVisible(!!ar).setPosition(mx + mw / 2, my + mh + 22);
    if (ar) this.areneTxt.setText(ar.fini ? `Terminé en ${chrono(ar.chrono)}` : !ar.demarre ? `${ar.total} vagues + le boss` : ar.vague > ar.total ? `Boss · ${chrono(ar.chrono)}` : `Vague ${ar.vague} / ${ar.total} · ${chrono(ar.chrono)}`);
    const txtVivant = this.texteVivant(world);
    this.vivantTxt.setVisible(!!txtVivant && !ar).setPosition(mx + mw / 2, my + mh + (ga ? 62 : 22));
    if (txtVivant && !ar && this.vivantTxt.text !== txtVivant) this.vivantTxt.setText(txtVivant);
    // Colonne de menus : boutons carrés sombres en relief, comme le bandeau de Dofus 3
    // Boutons carrés sombres serrés les uns contre les autres ; ils rapetissent si l'écran est bas
    const top = 10;   // la colonne reste en haut même quand la mini-carte est déplacée (6A)
    const step = Math.min(38, Math.floor((H - 150 - top) / this.menus.length)), bs = step - 2;
    // dessinés une fois dans une image (un Graphics, même inchangé, est retriangulé à chaque image)
    const cleMenus = `${colX}|${top}|${step}|${this.menus.length}`;
    const gm = cleMenus !== this.cleMenus ? this.scene.make.graphics({}, false) : null;
    this.menus.forEach((m, i) => {
      const y = top + bs / 2 + i * step, x = colX + (36 - bs) / 2;
      this.rects.push([x, y - bs / 2, bs, bs]);
      if (gm) {
        const lx = x - colX, ly = y - top;
        gm.fillStyle(0x1b1a16, 1); gm.fillRoundedRect(lx, ly - bs / 2, bs, bs, 5);
        gm.fillStyle(0x3a3933, 1); gm.fillRoundedRect(lx + 1.5, ly - bs / 2 + 1.5, bs - 3, bs - 3, 4);
        gm.fillStyle(0x47463f, 1); gm.fillRoundedRect(lx + 2, ly - bs / 2 + 2, bs - 4, (bs - 4) / 2, { tl: 3, tr: 3, bl: 0, br: 0 });
      }
      const s = bs - 8, f = m.icon.frame, k = Math.min(s / f.width, s / f.height);
      m.icon.setPosition(x + bs / 2, y).setDisplaySize(f.width * k, f.height * k);
      m.zone.setPosition(x + bs / 2, y).setSize(bs, bs);
      if (m.label === 'Social') { const n = this.pastilleSocial(); this.pastille.setVisible(n > 0).setText(String(n)).setPosition(x + bs - 3, y - bs / 2 + 4); }
      if (m.label === 'Succès') { const n = world.quetes?.nbARecuperer ?? 0; this.pastilleSucces.setVisible(n > 0).setText(String(n)).setPosition(x + bs - 3, y - bs / 2 + 4); }
    });
    if (gm) {
      this.cleMenus = cleMenus;
      const k = `hud_menus_${this.nMenus++ % 2}`;   // deux clés en alternance : l'image n'affiche jamais une texture détruite
      if (this.scene.textures.exists(k)) this.scene.textures.remove(k);
      gm.generateTexture(k, 36, Math.max(1, this.menus.length * step)); gm.destroy();
      this.imMenus.setTexture(k).setPosition(colX, top).setVisible(true);
    }

    // --- Barre du bas : XP, 6 sorts, clic droit, déplacement, potion, Rage ---
    const slot = 54, gap = 5, n = 6;
    const barW = n * slot + (n - 1) * gap, extra = slot + 14 + 10 + slot + gap + 16 + slot + gap + slot + 16 + 64;
    const totalW = barW + extra + 24, x0 = Math.round(W / 2 - totalW / 2), y0 = H - 12 - (slot + 44);
    panel(x0, y0, totalW, slot + 44);
    const xr = p.level >= cls.maxLevel ? 1 : p.xp / p.xpNeeded;
    bar(x0 + 12, y0 + 10, totalW - 24, 12, xr, C.xp);
    this.xpText.setPosition(W / 2, y0 + 16).setText(p.level >= cls.maxLevel ? `NIV. ${p.level} (max)` : `XP ${Math.floor(p.xp)} / ${p.xpNeeded}  ·  NIV. ${p.level}`);
    const sy0 = y0 + 30 + slot / 2, sy = sy0;
    // touches de la barre (Réglages 3A + 3C : celles choisies, écrites selon le clavier ; 5B : clic droit et gauche échangés)
    const droit = R?.deplacement === 'droit';
    this.slots.forEach((s, i) => s.key.setText(i < 6 ? court(Touches.nomAction(`sort${i + 1}`)) : i === 6 ? (droit ? 'Clic G' : 'Clic D') : i === 7 ? court(Touches.nomAction('deplacement')) : court(Touches.nomAction(`invoc${i - 7}`))));
    this.auto.key.setText(droit ? 'Clic D' : 'Clic'); this.potion.key.setText(court(Touches.nomAction('potion')));
    const drawSlot = (s: SlotView, x: number, id: string | null, sy = sy0) => {
      s.bg.setPosition(x, sy).setDisplaySize(slot, slot);
      s.zone?.setPosition(x, sy);
      s.key.setPosition(x - slot / 2 + 4, sy - slot / 2 + 1);
      const def = id ? p.spell(id) : undefined;
      if (s !== this.auto) {
        s.bg.setTexture(def ? 'slot_dark_background_full' : 'slot_light_lock');
        s.icon?.setVisible(!!def);
        if (def && s.icon && s.icon.texture.key !== `sort_${def.icon}`) s.icon.setTexture(`sort_${def.icon}`);
      }
      if (!id || !def || !s.icon) { s.cd.setText(''); s.cost.setText(''); s.ch.setText(''); return; }
      // Maquette Recharges : voile en horloge (9A) pendant une recharge, ou quand toutes les charges sont parties (3A)
      const ch = p.charges(id), vide = ch.max > 0 && ch.n === 0;
      const cdT = p.cd[id] ?? 0, cdMax = p.cdMax[id] || p.recharge(id);
      const cd = cdT > 0 ? cdT : vide ? ch.prochaine : 0, frac = cdT > 0 ? (cdMax ? Math.min(1, cdT / cdMax) : 0) : vide ? ch.prochaine / p.retourCharge : 0;
      const ok = p.hasResource(id), inner = slot - 8;
      s.icon.setPosition(x, sy).setDisplaySize(inner, inner).setTint(cd > 0 ? 0x8a8a8a : ok ? 0xffffff : 0x6f86b8);
      const gs = this.gSlots;
      if (frac > 0) horloge(gs, x, sy, inner / 2, frac);
      // 9B : pastille de charges (en bas à gauche) ; un filet bleu montre le retour de la prochaine charge.
      // Les sorts de base (3 lancers par tour ou plus) ne l'affichent que si l'on entame vraiment leurs charges.
      if (ch.max && (ch.max === 2 || ch.n < ch.max)) {
        const px = x - slot / 2 + 10, py = sy + slot / 2 - 10;
        gs.fillStyle(0x14202e, 0.95); gs.fillCircle(px, py, 8); gs.lineStyle(1.5, 0x5aa8ff, 1); gs.strokeCircle(px, py, 8);
        s.ch.setPosition(px, py).setText(`${ch.n}`);
        if (ch.n > 0 && ch.n < ch.max) { gs.fillStyle(0x5aa8ff, 0.8); gs.fillRect(x - inner / 2, sy + inner / 2 - 3, inner * (1 - ch.prochaine / p.retourCharge), 3); }
      } else s.ch.setText('');
      const ec = this.eclats[id];
      if (ec && juice) { gs.lineStyle(3, 0xe6b85c, Math.min(1, ec / 0.5)); gs.strokeRoundedRect(x - slot / 2 - 2, sy - slot / 2 - 2, slot + 4, slot + 4, 8); }
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
    // invocations de l'Osamodas : une rangée de 4 au-dessus des sorts
    if (this.slots.length > 8) {
      // calée à droite, au-dessus du clic droit et d'Espace (le bandeau « Partie de test » occupe le milieu)
      const iy = y0 - slot / 2 - 14, iw = 4 * slot + 3 * gap + 16, ix = x0 + totalW - iw;
      panel(ix, iy - slot / 2 - 8, iw, slot + 16);
      for (let i = 0; i < 4; i++) drawSlot(this.slots[8 + i], ix + 8 + slot / 2 + i * (slot + gap), p.bar[8 + i], iy);
    }
    // Bulles d'effets actifs : au-dessus de la barre, à gauche de la rangée A Z R T de l'Osamodas
    const bx1 = this.slots.length > 8 ? x0 + totalW - (4 * slot + 3 * gap + 16) - 12 : x0 + totalW;
    this.dessinerBulles(g, x0 + 4, bx1, y0 - 34, juice);
    // Potion (E) : charges, +1 par groupe vaincu
    const po = this.potion, pox = mvx + slot + gap, pcd = p.potionCd / cls.potion.cooldown;
    po.bg.setPosition(pox, sy).setDisplaySize(slot, slot);
    po.icon!.setPosition(pox, sy).setDisplaySize(30, 30).setAlpha(p.potions > 0 ? 1 : 0.35);
    po.key.setPosition(pox - slot / 2 + 4, sy - slot / 2 + 1);
    po.cost.setPosition(pox + slot / 2 - 3, sy + slot / 2 - 1).setText(String(p.potions)).setColor('#ffffff');
    if (pcd > 0) horloge(this.gSlots, pox, sy, 23, Math.min(1, pcd));
    // Rage : jauge verticale qui clignote une fois pleine (Enutrof : le médaillon du coffre au trésor)
    const rx = pox + slot / 2 + 30, rh = slot - 14, ry = sy - slot / 2 + 2;
    if (cof) this.medaillon(g, pox + slot / 2 + 38, sy - 2, dt, juice);
    else {
      g.fillStyle(C.track, 1); g.fillRoundedRect(rx - 9, ry, 18, rh, 5);
      g.fillStyle(rageCol, 1); g.fillRoundedRect(rx - 9, ry + rh * (1 - rr), 18, Math.max(4, rh * rr), 5);
      if (this.rageFlash > 0 && juice) { g.lineStyle(3, 0xffc04d, this.rageFlash); g.strokeRoundedRect(rx - 12, ry - 3, 24, rh + 6, 6); }
      this.rageLabel.setPosition(rx, ry + rh + 1);
      this.medImg.setVisible(false); this.medRect = null;
    }
    if (sf >= 0) this.rageLabel.setText(sf ? `${cls.rage.name} ${sf}` : cls.rage.name).setColor(sf ? '#ff6a5a' : '#c9a49c');
    if (fl >= 0) this.rageLabel.setText(p.lance ? 'Désarmé' : 'Armé').setColor(p.lance ? '#e8b860' : '#c9c2b0');
    // Tutoriel (3A) : halo doré qui pulse sur l'emplacement de l'étape suivie, et sa touche au-dessus
    const qs = world.quetes, qc = qs?.enCours.find(c => c.id === qs.suivie), halo = qc && !qc.aRendre ? qs!.etapeDe(qc)?.halo : undefined;
    if (halo != null) {
      const hj = halo === 'jauge', hx = halo === 'potion' ? pox : hj ? rx : halo === 7 ? mvx : halo === 6 ? cdx : sx0 + halo * (slot + gap);
      const hw = hj ? 28 : slot + 8, hh = hj ? rh + 10 : slot + 8, hy = hj ? ry + rh / 2 : sy, pulse = 0.55 + 0.45 * Math.sin(world.time * 6);
      g.lineStyle(3, 0xffd66b, pulse); g.strokeRoundedRect(hx - hw / 2, hy - hh / 2, hw, hh, 8);
      g.lineStyle(7, 0xe6b85c, 0.25 * pulse); g.strokeRoundedRect(hx - hw / 2 - 3, hy - hh / 2 - 3, hw + 6, hh + 6, 10);
      const lab = halo === 'potion' ? Touches.nomAction('potion') : hj ? cls.rage.name : halo === 7 ? Touches.nomAction('deplacement') : halo === 6 ? (droit ? 'Clic gauche' : 'Clic droit') : Touches.nomAction(`sort${halo + 1}`);
      this.haloKey.setVisible(true).setText(lab).setPosition(hx, y0 - 4 - 5 * Math.abs(Math.sin(world.time * 3)));
    } else this.haloKey.setVisible(false);

    // --- Suivi (bas gauche) : la quête suivie (8A), sinon l'exploration ---
    const a = world.area, kills = this.areaKills.get(a?.name ?? '') ?? 0, Q = world.quetes;
    const cq = Q && (Q.enCours.find(c => c.id === Q.suivie) ?? Q.enCours[0]);
    let iconW = 0;
    // Métiers UI 9A : la recette épinglée, sous la quête ; ses ingrédients se cochent au ramassage
    const rs = world.player.recetteSuivie, rec = rs ? ITEMS.recipes?.find(r => r.result === rs) : undefined, pr = world.player;
    const recL = rec ? ['', `Recette : ${(ITEMS.resources[rec.result] ?? ITEMS.equipment[rec.result])?.name ?? ''}`, ...rec.ingredients.map(([id, n]) => {
      const a = pr.resources[id] ?? 0; return `${a >= n ? '✓' : '•'} ${ITEMS.resources[id]?.name ?? id}  ${Math.min(a, n)}/${n}`;
    }), ...(Math.max(1, pr.metierLevel(rec.metier)) < rec.level ? [`  ${ITEMS.metiers?.[rec.metier]?.name ?? ''} niveau ${rec.level} requis`] : [])] : [];
    // Menu des succès 7C : les succès épinglés, sous la quête, avec leur compteur
    if (Q) for (const id of Q.epingles) {
      const sd = Q.data.succes[id]; if (!sd) continue;
      const pr2 = sd.objectifs.length === 1 ? Q.progres(sd.objectifs[0]) : [sd.objectifs.filter(o => Q.objectifSuccesFait(o)).length, sd.objectifs.length];
      recL.push(...(recL.length && recL[recL.length - 1].startsWith('★') ? [] : ['']), `★ ${sd.nom}  ${pr2[0]}/${pr2[1]}`);
    }
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
      this.trackBody.setText([e && !cq.aRendre ? e.nom : '', ...lines, autres > 0 ? `+${autres} autre${autres > 1 ? 's' : ''} quête${autres > 1 ? 's' : ''} (clic sur le titre)` : '', juice ? '' : 'Effets d\'impact désactivés (F)']
        .filter(Boolean).concat(recL).join('\n'));
      this.skipBtn.setVisible(!!def.options?.passable);
    } else {
      this.trackIcon.setVisible(false); this.skipBtn.setVisible(false);
      this.trackTitle.setText(a ? `Exploration · ${a.name}` : world.zone.name);
      this.trackBody.setText([
        a ? `Monstres du coin vaincus : ${kills}` : `Monstres vaincus : ${world.kills}`,
        `Point de retour : ${world.checkpointName}`,
        juice ? '' : 'Effets d\'impact désactivés (F)',
      ].filter(Boolean).concat(recL).join('\n'));
    }
    this.succesT = Math.max(0, this.succesT - dt); this.succesLine.setAlpha(Phaser.Math.Clamp(this.succesT, 0, 1));
    const sl = this.succesT > 0 ? this.succesLine.height + 4 : 0;
    const tw2 = Math.max(this.trackTitle.width + iconW + (this.skipBtn.visible ? this.skipBtn.width + 12 : 0), this.trackBody.width, this.succesT > 0 ? this.succesLine.width : 0) + 20;
    const th2 = this.trackTitle.height + this.trackBody.height + 18 + sl;
    // Petite fenêtre : si le suivi touche la barre de sorts, il remonte au-dessus d'elle (le bouton « Passer » reste visible)
    const [tx2, ty2] = this.place('suivi', 12, 12 + tw2 + 8 > x0 ? y0 - 8 - th2 : H - 12 - th2, tw2, th2);
    panel(tx2, ty2, tw2, th2, 0.8);
    this.rects.push([tx2, ty2, tw2, th2]);
    this.trackIcon.setPosition(tx2 + 18, ty2 + 7 + this.trackTitle.height / 2);
    this.trackTitle.setPosition(tx2 + 10 + iconW, ty2 + 7);
    this.skipBtn.setPosition(tx2 + tw2 - this.skipBtn.width - 8, ty2 + 6);
    this.trackBody.setPosition(tx2 + 10, ty2 + 10 + this.trackTitle.height);
    this.succesLine.setPosition(tx2 + 10, ty2 + 12 + this.trackTitle.height + this.trackBody.height);
    // flèche au bord de l'écran (maquette Flèche 1A 2A 3A+3B 6A) : elle suit le trajet (passages, portes, portail, Zaap),
    // couleur et icône officielles du type de quête, nom du but et distance en cartes ; seulement quand le point est hors de l'écran
    this.arrow.clear();
    const it = this.flecheQuete && cq ? Q?.itineraire() : null, cam = this.scene.cameras.main;
    let fleche = false;
    if (it && Q && cq) {
      // visible tant que la porte (ou le but) n'est pas à l'écran ; la pointe suit le prochain passage du trajet
      const ecran = (x: number, y: number) => { const s2 = ISO.toScreen(x, y), r = cam.worldView; return { x: (s2.x - r.x) * cam.zoom, y: (s2.y - r.y) * cam.zoom }; };
      const fin = it.pts[it.pts.length - 1] ?? it, ef = ecran(fin.x, fin.y), e2 = ecran(it.x, it.y), sx = e2.x, sy2 = e2.y, m = 58;
      if (ef.x < 0 || ef.y < 0 || ef.x > W || ef.y > H) {
        fleche = true;
        const cx = W / 2, cy = H / 2, ang = Math.atan2(sy2 - cy, sx - cx), co = Math.cos(ang), si = Math.sin(ang);
        const kx = (W / 2 - m) / Math.max(1e-6, Math.abs(co)), ky = (H / 2 - m) / Math.max(1e-6, Math.abs(si)), d = Math.min(kx, ky);
        // pas sous le cadre du perso, la mini-carte ni le bandeau (haut), la colonne de menus (droite) ni la barre de sorts (bas)
        const ax2 = Phaser.Math.Clamp(cx + co * d, m, W - 84), ay2 = Phaser.Math.Clamp(cy + si * d, 150, H - 150), pul = 0.8 + 0.2 * Math.sin(world.time * 5);
        const pt = (l: number, w2: number) => ({ x: ax2 + co * l - si * w2, y: ay2 + si * l + co * w2 });
        const def = Q.def(cq.id), bleu = def.type === 'prime' || !!def.repetable, coul = bleu ? 0x37c3ea : 0x86cc1c;
        const t0 = pt(30, 0), t1 = pt(-14, 22), t2 = pt(-4, 0), t3 = pt(-14, -22), ombre = [t0, t1, t2, t3].map(o => ({ x: o.x + 2, y: o.y + 3 }));
        this.arrow.fillStyle(0x000000, 0.4); this.arrow.fillPoints(ombre, true);
        this.arrow.fillStyle(coul, pul); this.arrow.lineStyle(3, 0x14230a, 1);
        this.arrow.fillPoints([t0, t1, t2, t3], true); this.arrow.strokePoints([t0, t1, t2, t3], true, true);
        this.arrow.fillStyle(0xffffff, 0.35); this.arrow.fillTriangle(pt(26, 0).x, pt(26, 0).y, pt(-8, -15).x, pt(-8, -15).y, pt(-2, 0).x, pt(-2, 0).y);
        // icône officielle de la quête, derrière la pointe
        const [give, back] = QUEST_ICON[def.type], ic = pt(-36, 0);
        this.arrowIcon.setTexture(`qi_${cq.aRendre ? back : give}`).setVisible(true).setPosition(ic.x, ic.y);
        this.arrowIcon.setScale(36 / Math.max(this.arrowIcon.width, this.arrowIcon.height));
        // 3A + 3B : le but et la distance (ou la zone, le portail, le Zaap)
        const n = it.cartes, detail = it.autreZone ? `${it.autreZone} · ${it.via === 'zaap' ? `Zaap ${it.zaap ?? ''}`.trim() : 'par le portail'}`
          : it.via === 'zaap' ? `${n} cartes · Zaap ${it.zaap ?? ''}` : n > 0 ? `${n} carte${n > 1 ? 's' : ''}` : '';
        const lb = pt(-58, 0);
        this.flecheAvant = { quete: cq.id, fin: { x: fin.x, y: fin.y }, x: ax2, y: ay2, ang, coul };
        this.arrowLabel.setText(it.autreZone ? `${it.nom === it.autreZone ? def.nom : it.nom}\n${detail}` : detail ? `${it.nom}\n${detail}` : it.nom).setVisible(true)
          .setOrigin(co > 0.35 ? 1 : co < -0.35 ? 0 : 0.5, si > 0.35 ? 1 : si < -0.35 ? 0 : 0.5).setPosition(lb.x, lb.y);
      }
    }
    this.flecheCoffre(W, H);   // Enutrof (interface du coffre 7C)
    // drapeau suivi (carte 9A) : flèche dorée au bord de l'écran tant qu'il est hors de vue
    const ds = this.drapeauSuivi;
    if (ds) {
      const s2 = ISO.toScreen(ds.x, ds.y), r = cam.worldView, ex = (s2.x - r.x) * cam.zoom, ey = (s2.y - r.y) * cam.zoom, m = 70;
      if (ex < 0 || ey < 0 || ex > W || ey > H) {
        const cx = W / 2, cy = H / 2, ang = Math.atan2(ey - cy, ex - cx), co = Math.cos(ang), si = Math.sin(ang);
        const d = Math.min((W / 2 - m) / Math.max(1e-6, Math.abs(co)), (H / 2 - m) / Math.max(1e-6, Math.abs(si)));
        const ax2 = Phaser.Math.Clamp(cx + co * d, m, W - 84), ay2 = Phaser.Math.Clamp(cy + si * d, 150, H - 150);
        const pt = (l: number, w2: number) => ({ x: ax2 + co * l - si * w2, y: ay2 + si * l + co * w2 });
        const pts = [pt(24, 0), pt(-10, 16), pt(-2, 0), pt(-10, -16)];
        this.arrow.fillStyle(0xf2d36b, 0.9); this.arrow.lineStyle(2.5, 0x3a2208, 1);
        this.arrow.fillPoints(pts, true); this.arrow.strokePoints(pts, true, true);
        const fl = pt(-30, 0);
        this.arrow.fillStyle(0x3a2a14, 1); this.arrow.fillRect(fl.x - 1, fl.y - 9, 2, 16);
        this.arrow.fillStyle(0xf2d36b, 1); this.arrow.fillTriangle(fl.x + 1, fl.y - 9, fl.x + 10, fl.y - 5, fl.x + 1, fl.y - 1);
      }
    }
    if (!fleche) {
      this.arrowIcon.setVisible(false); this.arrowLabel.setVisible(false);
      // idée 5 : la porte ou le but vient d'entrer à l'écran, pour la même quête et le même point : on est arrivé
      const av = this.flecheAvant, fin = it?.pts[it.pts.length - 1];
      if (av && it && cq && av.quete === cq.id && fin && Math.hypot(fin.x - av.fin.x, fin.y - av.fin.y) < 60) {
        this.arrivee = { t: 0, x: av.x, y: av.y, ang: av.ang, coul: av.coul };
        Son.jouer(MANIFESTE.ui.ok, 'interface', { vol: 0.5, vitesse: 1.15, cle: 'arrivee', ecart: 2 });
      }
      this.flecheAvant = null;
    } else this.arrivee = null;
    if (this.arrivee) {
      const a = this.arrivee; a.t += dt;
      const k = a.t / 0.6, sc = 1 + 0.7 * k, co = Math.cos(a.ang), si = Math.sin(a.ang);
      const pt = (l: number, w2: number) => ({ x: a.x + (co * l - si * w2) * sc, y: a.y + (si * l + co * w2) * sc });
      if (k >= 1) this.arrivee = null;
      else {
        this.arrow.fillStyle(a.coul, 1 - k); this.arrow.lineStyle(3, 0x14230a, 1 - k);
        const pts = [pt(30, 0), pt(-14, 22), pt(-4, 0), pt(-14, -22)];
        this.arrow.fillPoints(pts, true); this.arrow.strokePoints(pts, true, true);
      }
    }

    // --- Butin (bas droite) : les dernières lignes s'effacent ---
    const feedY = W - 16 - Math.max(0, ...this.feed.map(f => f.text.width)) < x0 + totalW + 8 ? y0 - 8 : H - 16;   // pareil pour le butin
    this.feed.forEach((f, i) => { f.t -= dt; f.text.setPosition(W - 16, feedY - i * 18).setAlpha(Phaser.Math.Clamp(f.t, 0, 1)); });
    for (const f of this.feed.filter(f => f.t <= 0)) f.text.destroy();
    this.feed = this.feed.filter(f => f.t > 0);

    // --- Dégâts par seconde (Réglages 4B) : sous la mini-carte, déplaçable ---
    const dv = !!R?.dps;
    this.dpsTxt.setVisible(dv);
    if (dv) {
      const d = this.dps, enCours = world.time - d.dernier < 4, duree = Math.max(1, d.dernier - d.debut);
      const val = d.total / duree;
      d.aff += (val - d.aff) * Math.min(1, dt * 4);
      const n = (x: number) => Math.round(x).toLocaleString('fr-FR');
      const [dx, dy] = this.place('dps', mx + mw - 170, my + mh + 58, 170, 46);
      panel(dx, dy, 170, 46, 0.8);
      this.dpsTxt.setPosition(dx + 10, dy + 6).setColor(enCours ? '#ffffff' : '#a8a294')
        .setText(d.total ? `${n(d.aff)} dégâts / s\n${n(d.total)} en ${n(duree)} s` : 'Dégâts par seconde\nFrappe un monstre');
    }
    // --- Modules déverrouillés (6A) : un cadre doré et leur nom, on les glisse ---
    const libre = R?.verrou === false;
    for (const [id, t] of this.modTxt) {
      const r = this.modRects.get(id);
      t.setVisible(libre && !!r);
      if (!libre || !r) continue;
      const [rx, ry, rw, rh] = r, a = this.drag?.id === id ? 1 : 0.55 + 0.35 * Math.sin(world.time * 4);
      // cadre sombre puis clair : il se voit sur le sol doré d'Incarnam comme sur la nuit
      const gs2 = this.gSlots, cadreMod = (e: number, c: number, al: number) => {
        const x1 = rx - e, y1 = ry - e, w1 = rw + 2 * e, h1 = rh + 2 * e;
        gs2.fillStyle(c, al); gs2.fillRect(x1, y1, w1, 2); gs2.fillRect(x1, y1 + h1 - 2, w1, 2); gs2.fillRect(x1, y1, 2, h1); gs2.fillRect(x1 + w1 - 2, y1, 2, h1);
      };
      cadreMod(5, 0x14130f, 0.85); cadreMod(3, 0xffffff, a);
      t.setPosition(rx + 4, ry - 18 < 0 ? ry + rh + 4 : ry - 18);
    }

    this.center.setPosition(W / 2, H * 0.3);
    this.bannerBg.setPosition(W / 2, H * 0.3 + 8);
    this.toastText.setPosition(W / 2, H * 0.2);
    const zy = Math.max(84, H * 0.13);
    this.zoneName.setPosition(W / 2, zy);
    this.zoneOrn.setPosition(W / 2, zy + 44).setScale(Math.min(1, (W * 0.6) / 733));
    this.zoneSub.setPosition(W / 2, zy + 47);
    this.zonePlate.setPosition(W / 2, 62).setScale(Math.max(1.25, (this.zonePlateTxt.width + 90) / Math.max(1, this.zonePlate.width)), 1.15);
    this.zonePlateTxt.setPosition(W / 2, 62);
  }
}

/** Voile en horloge (maquette Recharges 9A) : la part restante, dans le sens des aiguilles, coupée au carré de l'icône. */
function horloge(g: Phaser.GameObjects.Graphics, cx: number, cy: number, h: number, frac: number) {
  const pts: Phaser.Types.Math.Vector2Like[] = [{ x: cx, y: cy }];
  const a0 = -Math.PI / 2 + (1 - frac) * Math.PI * 2, a1 = Math.PI * 1.5, n = Math.max(2, Math.ceil(frac * 48));
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n), c = Math.cos(a), si = Math.sin(a), k = h / Math.max(Math.abs(c), Math.abs(si));
    pts.push({ x: cx + c * k, y: cy + si * k });
  }
  g.fillStyle(0x000000, 0.6); g.fillPoints(pts, true);
}
