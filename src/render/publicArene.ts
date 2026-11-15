import Phaser from 'phaser';
import A from '../data/arene_ames.json';
import type { Entity } from '../sim/entity';
import type { SimEvent } from '../sim/events';
import { ISO } from '../sim/iso';
import { HABITANTS } from '../sim/passants';
import type { World } from '../sim/world';
import { EntityView } from './entityView';
import { LOOK } from './passantsView';

/** « Arène : » 11B : le public des gradins de l'arène des âmes. Des habitants du Bastion assis sur les marches (places écrites par
 *  tools/extraction/marche.py dans arene_ames.json > public) regardent la piste ; ils sautent et crient quand une âme revient, sur
 *  les gros coups et les victoires, et huent quand le groupe tombe. Purement décoratif : rien ne passe par la partie. */
interface Spectateur { id: number; x: number; y: number; z: number; facing: number; anim: 'idle'; animT: number; age: number; flash: number; radius: number; dead: false; faction: 'pnj'; hp: 1; maxHp: 1; saut: number; vue: EntityView }
const CRIS = { joie: ['Ouais !', 'Bravo !', 'Encore !', 'Allez !', 'Waouh !'], victoire: ['Champion !', 'Bravo !', 'Gloire !', 'Hourra !'], hue: ['Bouh !', 'Ouh…', 'Nul !', 'Remboursez !'], arrivee: ['Le voilà !', 'Ouh là…', 'Allez !'] };
const STYLE = { fontFamily: 'Lexend, Verdana, sans-serif', fontSize: '22px', fontStyle: 'bold', color: '#fff2c8', stroke: '#14130f', strokeThickness: 5 };

export class PublicArene {
  private liste: Spectateur[] = [];
  private t = 0;
  private prochain = 2;
  constructor(private scene: Phaser.Scene, private world: World) {
    const defs = HABITANTS.filter(h => scene.textures.exists(`hab_${h.id}`));
    if (!defs.length || !world.worldGrid?.mapByTag('arene')) return;
    const c = world.openestCellOf('arene'), wg = world.worldGrid;
    // places en pixels des cartes (comme le décor) : écran puis monde
    (A as unknown as { public?: [number, number][] }).public?.forEach(([mx, my], i) => {
      const e = wg.toScreen(mx + ((Math.imul(i + 7, 40503) >>> 4) % 17) - 8, my), { x, y } = ISO.toWorld(e.x, e.y);
      const h = Math.imul(i + 1, 2654435761) >>> 0, def = defs[h % defs.length];   // mélangés, sans colonnes de jumeaux
      const vue = new EntityView(scene, { ...LOOK(def.id), ignoreZ: false });
      this.liste.push({ id: -500 - i, x, y, z: 0, facing: Math.atan2(c.y - y, c.x - x), anim: 'idle', animT: 0, age: i * 0.37, flash: 0, radius: 14, dead: false, faction: 'pnj', hp: 1, maxHp: 1, saut: 0, vue });
    });
  }
  /** Le joueur de cet écran regarde-t-il l'arène ? */
  private get present() { const p = this.world.player, wg = this.world.worldGrid; return !!wg && wg.mapAt(p.x, p.y)?.tag === 'arene'; }
  update(dt: number) {
    this.t += dt;
    const ici = this.present;
    // pendant un combat, la foule s'agite d'elle-même de temps en temps
    if (ici && this.world.combatAmes && !this.world.combatAmes.victoire && (this.prochain -= dt) <= 0) { this.prochain = 1.2 + Math.random() * 2; this.reagir('joie', 0.08, 1); }
    for (const s of this.liste) {
      s.age += dt;
      if (s.saut > 0) { s.saut = Math.max(0, s.saut - dt); s.z = Math.abs(Math.sin(s.saut * Math.PI * 2.5)) * 16; } else s.z = 0;
      if (!ici) { s.vue.hide(); continue; }
      s.vue.sync(s as unknown as Entity);
      s.vue.sprite.setDepth(ISO.toScreen(s.x, s.y).y + 180);   // debout sur sa marche : devant la marche qui le porte
    }
  }
  /** Événements de la partie : la foule réagit à ce qui se passe sur la piste. */
  evenement(e: SimEvent) {
    if (!this.liste.length || !this.present) return;
    switch (e.k) {
      case 'areneAmesVague': this.reagir('arrivee', 0.5, 4); break;
      case 'kill': this.reagir('joie', 0.25, 2); break;
      case 'grosCoup': this.reagir('joie', 0.2, 1); break;
      case 'areneAmesDefi': this.reagir('hue', 0.15, 2, false); break;
      case 'areneAmesFin': if (e.victoire) this.reagir('victoire', 0.9, 7, true, 1.6); else this.reagir('hue', 0.6, 5, false); break;
      case 'playerDeath': this.reagir('hue', 0.4, 3, false); break;
    }
  }
  /** Une part `part` du public saute (ou pas, pour les huées) ; `cris` d'entre eux lancent une bulle. */
  private reagir(sorte: keyof typeof CRIS, part: number, cris: number, saute = true, duree = 0.8) {
    const l = this.liste.filter(() => Math.random() < part);
    for (const s of l) if (saute) s.saut = duree * (0.7 + Math.random() * 0.6);
    for (const s of l.sort(() => Math.random() - 0.5).slice(0, cris)) this.bulle(s, CRIS[sorte][Math.floor(Math.random() * CRIS[sorte].length)], sorte === 'hue' ? '#ffb3a0' : '#fff2c8');
  }
  private bulle(s: Spectateur, texte: string, couleur: string) {
    const p = ISO.toScreen(s.x, s.y), t = this.scene.add.text(p.x, p.y - 120, texte, { ...STYLE, color: couleur }).setOrigin(0.5, 1).setDepth(p.y + 100000);
    this.scene.tweens.add({ targets: t, y: t.y - 36, alpha: { from: 1, to: 0 }, duration: 1400, ease: 'Sine.easeOut', onComplete: () => t.destroy() });
  }
  destroy() { for (const s of this.liste) s.vue.destroy(); this.liste = []; }
}
