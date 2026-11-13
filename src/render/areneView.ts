import Phaser from 'phaser';
import { ISO } from '../sim/iso';
import { RARITIES, RARITY_COLORS } from '../sim/items';
import type { World } from '../sim/world';
import { dossier, v } from './assetUrl';
import { textureUneFois } from './uneFois';
import { SOL } from './worldView';

const SP = 'assets/sprites';
/** Maquette « Coffres » (1A 2A 3A+3B 4A+4B+4C 5A 6B 7A 8A) : de vrais coffres vivants de Dofus 3, rendus depuis leur squelette
 *  (tools/extraction/monster_planche.py, SCALE 2,5, ANIMS repos, coup reçu, gueule, mort). Malle Animée (os 4543, invocation de
 *  l'Enutrof) partout ; Coffret précieux (os 2674, SCALE 1,8 : une seule page) pour les donjons marqués coffre: 'precieux' (Enfers, donjons à clés).
 *  gueule = l'animation où il ouvre la gueule, coupée à son ouverture maximale (part de l'animation). */
const COFFRES = {
  malle: { atlas: 'coffre_malle', gueule: 'AnimAttaque2_1', jusqua: 13 / 29, echelle: 0.55 },
  precieux: { atlas: 'coffre_precieux', gueule: 'AnimAttaque1_1', jusqua: 16 / 33, echelle: 0.62 },
};
const FPS = 30;
/** 3B : un petit sursaut (coup reçu officiel) toutes les 5 s, pour qu'on le sente vivant. */
const SURSAUT = 5;

/** Arène d'un donjon (maquette « Donjons en vagues » 13A) : à la mort du boss, le portail de sortie (il ramène devant
 *  le gardien) et le coffre du donjon à côté. Lecture seule : l'état vient de world.arene. */
export class AreneView {
  private portail: Phaser.GameObjects.Graphics;
  /** Lueur au sol (3A) et, si le coffre cache un objet Rare ou mieux, de sa couleur (4C). */
  private lueur: Phaser.GameObjects.Graphics;
  private coffre: Phaser.GameObjects.Sprite | null = null;
  private atlas = '';
  private nom: Phaser.GameObjects.Text;
  /** « Wabbits : 8B + 9A » : trou où le boss s'est enfui (mène au donjon suivant la première fois). */
  private trou: Phaser.GameObjects.Graphics;
  private trouNom: Phaser.GameObjects.Text;
  /** « Wabbits : 10A + 10B » : carapace Mékawapace sur le Wa Wobot, compte à rebours des Tamponneurs avant Twansmutation. */
  private wobot: Phaser.GameObjects.Graphics;
  private tw = 0;
  private t = 0;
  /** Temps depuis l'ouverture (-1 : fermé) ; temps depuis le dernier sursaut. */
  private ouvert = -1;
  private repos = 0;
  /** 0.6 (« Arènes : » 2D, 6B) : cercles de choix des Blops Royaux et toiles au sol, sous les télégraphes ; noms des cercles. */
  private sol06: Phaser.GameObjects.Graphics;
  private noms06: Phaser.GameObjects.Text[] = [];

  constructor(private scene: Phaser.Scene, private world: World) {
    this.portail = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.lueur = scene.add.graphics().setVisible(false);   // fondu normal : la couleur reste lisible sur un sol clair
    this.nom = scene.add.text(0, 0, 'Sortie', { fontFamily: 'Rowdies, Lexend, sans-serif', fontSize: '15px', color: '#cfe8ff', stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5, 1).setVisible(false);
    this.trou = scene.add.graphics().setVisible(false);
    this.wobot = scene.add.graphics();
    this.trouNom = scene.add.text(0, 0, '', { fontFamily: 'Rowdies, Lexend, sans-serif', fontSize: '15px', color: '#ffd9a0', stroke: '#000', strokeThickness: 4, align: 'center' })
      .setOrigin(0.5, 1).setVisible(false);
    // planches chargées d'avance : le coffre doit être prêt à la mort du boss
    for (const c of Object.values(COFFRES)) this.planche(c.atlas);
    this.sol06 = scene.add.graphics().setDepth(SOL + 40);
  }
  /** 2D : un cercle de la couleur de chaque Royal, son nom au-dessus ; 6B : toiles (blanches, collantes) ou brûlées (cendre). */
  private dessiner06() {
    const a = this.world.arene, g = this.sol06.clear(), C = a?.choix ?? [];
    for (const [i, c] of C.entries()) {
      const s = ISO.toScreen(c.x, c.y), col = Phaser.Display.Color.HexStringToColor(c.couleur).color, p = 0.5 + 0.5 * Math.sin(this.tw * 3 + i);
      g.fillStyle(col, 0.18 + 0.1 * p).fillEllipse(s.x, s.y, 104, 52);
      g.lineStyle(3, col, 0.7 + 0.3 * p).strokeEllipse(s.x, s.y, 104 + 8 * p, 52 + 4 * p);
      const t = this.noms06[i] ??= this.scene.add.text(0, 0, '', { fontFamily: 'Rowdies, Lexend, sans-serif', fontSize: '14px', color: '#fff', stroke: '#000', strokeThickness: 4, align: 'center' }).setOrigin(0.5, 1);
      t.setText(c.nom).setColor(c.couleur).setPosition(s.x, s.y - 30).setDepth(s.y + 1).setVisible(true);
    }
    for (let i = C.length; i < this.noms06.length; i++) this.noms06[i].setVisible(false);
    for (const t of a?.toiles ?? []) {
      const s = ISO.toScreen(t.x, t.y), rx = t.r, ry = t.r / 2, fin = t.vie != null ? Math.min(1, t.vie / 2) : 1;
      if (t.brule > 0) { g.fillStyle(0x2a2420, 0.45 * fin).fillEllipse(s.x, s.y, rx * 2, ry * 2); continue; }
      g.lineStyle(1.5, 0xf4f0ff, 0.55 * fin);
      for (let k = 0; k < 8; k++) { const an = k * Math.PI / 4 + 0.2; g.lineBetween(s.x, s.y, s.x + Math.cos(an) * rx, s.y + Math.sin(an) * ry); }
      for (const f of [0.35, 0.65, 0.95]) {
        g.beginPath();
        for (let k = 0; k <= 8; k++) { const an = k * Math.PI / 4 + 0.2, x = s.x + Math.cos(an) * rx * f, y = s.y + Math.sin(an) * ry * f; if (k) g.lineTo(x, y); else g.moveTo(x, y); }
        g.strokePath();
      }
      g.fillStyle(0xe8e4ff, 0.08 * fin).fillEllipse(s.x, s.y, rx * 2, ry * 2);
    }
  }
  /** Carapace = demi-dôme d'acier autour du Wa Wobot, qui se fissure à mesure qu'on la frappe ; Tamponneur = anneau qui se vide. */
  private dessinerWobot(dt: number) {
    const g = this.wobot.clear();
    this.tw += dt;
    if (!this.world.arene) return;
    let prof = 0;
    for (const m of this.world.monsters) {
      if (m.dead || (!m.carapace && !(m.twansT > 0))) continue;
      const s = ISO.toScreen(m.x, m.y);
      prof = Math.max(prof, s.y + 1);
      if (m.carapace > 0) {
        const r = 84, k = m.carapace;
        g.fillStyle(0x9fb0c8, 0.18 + 0.12 * k).fillEllipse(s.x, s.y - 70, r * 2, r * 2.2);
        g.lineStyle(7, 0xb8c4d8, 0.45 + 0.45 * k).strokeEllipse(s.x, s.y - 70, r * 2, r * 2.2);
        g.lineStyle(2, 0xffffff, 0.5 * k + 0.2 * Math.sin(this.tw * 6)).strokeEllipse(s.x, s.y - 70, r * 2 + 8, r * 2.2 + 8);
        // fissures : plus la carapace est entamée, plus il y en a
        g.lineStyle(2, 0x2a2f3a, 0.9);
        const n = Math.round((1 - k) * 8);
        for (let i = 0; i < n; i++) {
          const a0 = i * 2.4 + 0.3, x0 = s.x + Math.cos(a0) * r, y0 = s.y - 70 + Math.sin(a0) * r * 1.1;
          g.lineBetween(x0, y0, x0 - Math.cos(a0) * 18 + Math.sin(a0) * 6, y0 - Math.sin(a0) * 18);
        }
      }
      if (m.twansT > 0) {   // Tamponneur : l'anneau se vide jusqu'à la Twansmutation, rouge et clignotant à la fin
        const f = Math.min(1, m.twansT / 6), urgent = m.twansT < 2, c = urgent ? 0xff5a3a : 0xffd36b;
        g.lineStyle(4, 0x000000, 0.5).strokeCircle(s.x, s.y - 70, 16);
        g.lineStyle(4, c, urgent ? 0.6 + 0.4 * Math.sin(this.tw * 14) : 0.9).beginPath()
          .arc(s.x, s.y - 70, 16, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2).strokePath();
      }
    }
    g.setDepth(prof + 300);
  }
  private planche(a: string) { return textureUneFois(this.scene, a, l => l.multiatlas(a, v(`${SP}/${a}.json`), dossier(`${SP}/`))); }
  destroy() { this.sol06.destroy(); this.noms06.forEach(t => t.destroy()); this.wobot.destroy(); this.trou.destroy(); this.trouNom.destroy(); this.portail.destroy(); this.lueur.destroy(); this.coffre?.destroy(); this.nom.destroy(); }

  update(dt: number) {
    const a = this.world.arene, vu = !!a?.fini;
    this.dessinerWobot(dt);
    this.dessiner06();
    this.portail.setVisible(vu); this.nom.setVisible(vu); this.lueur.setVisible(vu);
    // trou du boss enfui : visible seulement pour qui il mène encore quelque part
    const t = vu && a!.trou && a!.premiers.has(this.world.player.id) ? a!.trou : null;
    this.trou.setVisible(!!t); this.trouNom.setVisible(!!t);
    if (t) {
      const s = ISO.toScreen(t.x, t.y), k = Math.min(1, this.t / 0.5), g = this.trou.clear().setDepth(s.y - 2);
      g.fillStyle(0x2a1a0c, 0.95).fillEllipse(s.x, s.y, 84 * k, 40 * k);
      g.fillStyle(0x000000, 0.9).fillEllipse(s.x, s.y + 2, 64 * k, 28 * k);
      g.lineStyle(3, 0x8a5a2a, 0.9).strokeEllipse(s.x, s.y, 86 * k, 42 * k);
      g.lineStyle(2, 0xffd36b, 0.35 + 0.25 * Math.sin(this.t * 4)).strokeEllipse(s.x, s.y, 100 * k, 50 * k);
      this.trouNom.setPosition(s.x, s.y - 34).setDepth(s.y + 2).setAlpha(k).setText(`Trou du ${a!.boss?.def.name ?? "boss"}\n${a!.d.fuite?.suite ?? ''}`);
    }
    if (!a || !vu) { this.t = 0; this.ouvert = -1; this.coffre?.setVisible(false); return; }
    this.t += dt;
    const k = Math.min(1, this.t / 0.6);   // le portail s'ouvre en 0,6 s
    // portail : anneaux de lumière bleue qui tournent au-dessus d'un cercle au sol
    const s = ISO.toScreen(a.pts.sortie.x, a.pts.sortie.y), g = this.portail.clear().setDepth(s.y + 1);
    const R = 46 * k, H = 110 * k;
    g.fillStyle(0x3a8fe0, 0.25).fillEllipse(s.x, s.y, R * 2.4, R * 1.2);
    for (let i = 0; i < 4; i++) {
      const ph = this.t * 2.2 + i * Math.PI / 2, w = R * (1.1 + 0.18 * Math.sin(ph)), h = H * (1 + 0.05 * Math.cos(ph));
      g.lineStyle(4 - i * 0.6, i % 2 ? 0x8fd3ff : 0x4aa8ff, 0.55 - i * 0.08).strokeEllipse(s.x, s.y - h / 2, w, h);
    }
    g.fillStyle(0x9fe0ff, 0.18 + 0.08 * Math.sin(this.t * 5)).fillEllipse(s.x, s.y - H / 2, R * 0.9, H * 0.85);
    this.nom.setPosition(s.x, s.y - H - 6).setDepth(s.y + 2).setAlpha(k);
    this.majCoffre(dt, a.d.coffre === 'precieux' ? COFFRES.precieux : COFFRES.malle, a.coffreOuvert, a.rareteCoffre, ISO.toScreen(a.pts.coffre.x, a.pts.coffre.y));
  }

  private majCoffre(dt: number, C: typeof COFFRES.malle, ouvert: boolean, rarete: typeof RARITIES[number] | null, c: { x: number; y: number }) {
    // lueur : dorée au sol (3A), ou de la couleur du meilleur objet à l'intérieur s'il est Rare ou mieux (4C) ; s'éteint à l'ouverture
    const q = this.lueur.clear().setDepth(c.y - 1), pulse = 0.5 + 0.5 * Math.sin(this.t * 3);
    const couleur = rarete && RARITIES.indexOf(rarete) >= 1 ? Phaser.Display.Color.HexStringToColor(RARITY_COLORS[rarete]).color : 0xffd36b;
    const fondu = this.ouvert < 0 ? 1 : Math.max(0, 1 - this.ouvert / 0.6);
    if (fondu > 0) {
      q.fillStyle(couleur, (0.22 + 0.14 * pulse) * fondu).fillEllipse(c.x, c.y, 120, 50);
      q.lineStyle(2, couleur, (0.5 + 0.3 * pulse) * fondu).strokeEllipse(c.x, c.y, 120 + 10 * pulse, 50 + 4 * pulse);
      if (couleur !== 0xffd36b) q.fillStyle(couleur, 0.22 * fondu).fillRect(c.x - 8, c.y - 160, 16, 160);   // faisceau, comme le butin au sol
    }
    if (!this.planche(C.atlas)) return;   // planche pas encore arrivée
    if (!this.coffre || this.atlas !== C.atlas) {
      this.coffre?.destroy();
      const tex = this.scene.textures.get(C.atlas), meta = (tex.customData as { meta?: { cell: number[]; origin: number[] } }).meta ?? { cell: [1, 1], origin: [0.5, 0.85] };
      this.coffre = this.scene.add.sprite(0, 0, C.atlas, 'AnimStatique_1_0').setOrigin(meta.origin[0] / meta.cell[0], meta.origin[1] / meta.cell[1]).setScale(C.echelle);
      this.atlas = C.atlas;
    }
    const sp = this.coffre.setPosition(c.x, c.y).setDepth(c.y);
    const n = (anim: string) => { let i = 0; while (this.scene.textures.get(C.atlas).has(`${anim}_${i}`)) i++; return i; };
    if (ouvert && this.ouvert < 0) this.ouvert = 0;
    if (this.ouvert >= 0) {
      // 2A : il ouvre la gueule, puis éclate en pièces d'or (sa mort officielle) ; le butin jaillit à l'éclat (ARENE.eclat)
      this.ouvert += dt;
      const g = Math.max(1, Math.round(n(C.gueule) * C.jusqua)), m = n('AnimMort_1'), f = Math.floor(this.ouvert * FPS);
      if (f < g) sp.setFrame(`${C.gueule}_${f}`).setVisible(true);
      else if (f < g + m) sp.setFrame(`AnimMort_1_${f - g}`).setVisible(true);
      else sp.setVisible(false);
      return;
    }
    // 3B : un sursaut de temps en temps, sinon immobile
    this.repos += dt;
    const h = n('AnimHit_1'), f = Math.floor((this.repos - SURSAUT) * FPS);
    if (f >= h) this.repos = 0;
    sp.setFrame(f >= 0 && f < h ? `AnimHit_1_${f}` : 'AnimStatique_1_0').setVisible(true);
  }
}
