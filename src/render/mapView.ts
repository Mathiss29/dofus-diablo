import Phaser from 'phaser';
import { GridMap, type WorldGrid } from '../sim/gridmap';

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

/** Pose un monde ouvert : le sol de chaque carte Dofus (une image par carte) et tout le décor,
 *  trié en profondeur sur la grande grille : on passe derrière un arbre même s'il est sur la carte voisine. */
export function drawWorld(scene: Phaser.Scene, wg: WorldGrid, key: (name: string) => string) {
  const S = GridMap.S, h = wg.data.grid.h;
  for (const m of wg.world.maps) {
    const o = wg.toScreen(m.sol.x, m.sol.y);
    scene.add.image(o.x, o.y, key(`sol_${m.tag}`)).setOrigin(0).setScale(S).setDepth(-10000);
    for (const p of m.decor) {
      const s = wg.toScreen(p.x, p.y), cc = wg.cellCenter(p.c), cs = wg.toScreen(cc.x, cc.y + h / 2);
      scene.add.image(s.x, s.y, key('decor'), p.f).setScale(S).setDepth(cs.y + p.o * 0.01);
    }
  }
}
