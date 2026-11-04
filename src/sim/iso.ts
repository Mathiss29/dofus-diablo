/** Projection isométrique 2:1 (comme Dofus).
 *  Monde = sol plat (x, y) + hauteur z. Écran = pixels avant caméra. */
export interface Vec { x: number; y: number }

export const ISO = {
  toScreen(x: number, y: number, z = 0): Vec { return { x: x - y, y: (x + y) / 2 - z }; },
  toWorld(sx: number, sy: number): Vec { return { x: sy + sx / 2, y: sy - sx / 2 }; },
  /** Direction écran (clavier : haut = haut de l'écran) -> direction monde normalisée. */
  dirFromScreen(dx: number, dy: number): Vec {
    const w = { x: dy + dx / 2, y: dy - dx / 2 };
    const l = Math.hypot(w.x, w.y) || 1;
    return { x: w.x / l, y: w.y / l };
  },
};
