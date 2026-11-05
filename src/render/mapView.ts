import Phaser from 'phaser';
import { GridMap } from '../sim/gridmap';

/** Pose une carte Dofus : sol fusionné + éléments de décor triés en profondeur.
 *  La profondeur d'un élément = bas de sa case, comme les personnages : on passe derrière
 *  les arbres et les maisons. */
export function drawMap(scene: Phaser.Scene, map: GridMap, solKey: string, decorKey: string) {
  const d = map.data, S = GridMap.S, o = map.toScreen(d.sol!.x, d.sol!.y);
  scene.add.image(o.x, o.y, solKey).setOrigin(0).setScale(S).setDepth(-10000);
  for (const p of d.decor!) {
    const s = map.toScreen(p.x, p.y), cc = map.cellCenter(p.c), cs = map.toScreen(cc.x, cc.y + d.grid.h / 2);
    scene.add.image(s.x, s.y, decorKey, p.f).setScale(S).setDepth(cs.y + p.o * 0.01);
  }
}

