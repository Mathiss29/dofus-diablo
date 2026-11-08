import Phaser from 'phaser';
import { ISO } from '../sim/iso';
import { RARITIES, RARITY_COLORS } from '../sim/items';
import type { World } from '../sim/world';
import { dossier, v } from './assetUrl';
import { textureUneFois } from './uneFois';

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
  private t = 0;
  /** Temps depuis l'ouverture (-1 : fermé) ; temps depuis le dernier sursaut. */
  private ouvert = -1;
  private repos = 0;

  constructor(private scene: Phaser.Scene, private world: World) {
    this.portail = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.lueur = scene.add.graphics().setVisible(false);   // fondu normal : la couleur reste lisible sur un sol clair
    this.nom = scene.add.text(0, 0, 'Sortie', { fontFamily: 'Rowdies, Lexend, sans-serif', fontSize: '15px', color: '#cfe8ff', stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5, 1).setVisible(false);
    // planches chargées d'avance : le coffre doit être prêt à la mort du boss
    for (const c of Object.values(COFFRES)) this.planche(c.atlas);
  }
  private planche(a: string) { return textureUneFois(this.scene, a, l => l.multiatlas(a, v(`${SP}/${a}.json`), dossier(`${SP}/`))); }
  destroy() { this.portail.destroy(); this.lueur.destroy(); this.coffre?.destroy(); this.nom.destroy(); }

  update(dt: number) {
    const a = this.world.arene, vu = !!a?.fini;
    this.portail.setVisible(vu); this.nom.setVisible(vu); this.lueur.setVisible(vu);
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
