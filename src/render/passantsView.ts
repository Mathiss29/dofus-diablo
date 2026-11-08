import Phaser from 'phaser';
import { dossier, v } from './assetUrl';
import type { Look } from './looks';
import { EntityView } from './entityView';
import type { Entity } from '../sim/entity';
import { HABITANTS, type Passants } from '../sim/passants';

const SP = 'assets/sprites';
/** Planches des habitants (habitant_planche.py) : rendues à l'échelle 0,5 au lieu de 0,7, affichées d'autant plus grand. */
const LOOK = (id: string): Look => ({
  atlas: `hab_${id}`, scale: 0.82 * 0.7 / 0.5, height: 120, ignoreZ: true, multi: true,
  map: { idle: { anim: 'AnimStatiqueExplo0', loop: true, fps: 20 }, walk: { anim: 'AnimMarche', loop: true, fps: 24 } },
});

/** Habitants du Bastion (maquette Ville 5F) : lit world.passants, dessine chacun comme une entité (repos, marche, 8 directions). */
export class PassantsView {
  static preload(scene: Phaser.Scene) {
    for (const h of HABITANTS) { const k = `hab_${h.id}`; if (!scene.textures.exists(k)) scene.load.multiatlas(k, v(`${SP}/${k}.json`), dossier(`${SP}/`)); }
  }
  private vues = new Map<number, EntityView>();
  constructor(scene: Phaser.Scene, private passants: Passants) {
    for (const p of passants.liste) if (scene.textures.exists(`hab_${p.def.id}`)) this.vues.set(p.id, new EntityView(scene, LOOK(p.def.id)));
  }
  update() {
    for (const p of this.passants.liste) this.vues.get(p.id)?.sync(p as unknown as Entity);
  }
}
