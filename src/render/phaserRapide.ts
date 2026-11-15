import Phaser from 'phaser';

/** Petites corrections de Phaser pour la fluidité (fil « Fluidité en combat », 2026-11-08).
 *  Text.setColor redessine le texte et renvoie son image à la carte graphique même quand la couleur ne change pas :
 *  la barre de sorts, la potion et la jauge de classe le faisaient à chaque image (une dizaine d'envois par image). */
const style = Phaser.GameObjects.TextStyle.prototype as unknown as {
  color: string | CanvasGradient | CanvasPattern;
  parent: Phaser.GameObjects.Text;
  setColor(c: string | CanvasGradient | CanvasPattern): Phaser.GameObjects.Text;
  setFill(c: string | CanvasGradient | CanvasPattern): Phaser.GameObjects.Text;
};
for (const nom of ['setColor', 'setFill'] as const) {
  const avant = style[nom];
  style[nom] = function (this: typeof style, c) { return this.color === c ? this.parent : avant.call(this, c); };
}

/** Arcs de Graphics (coins arrondis, cercles) : Phaser coupe CHAQUE arc en 100 segments, même un coin de 5 px.
 *  Le cadre du perso, les panneaux et les barres de l'interface, redessinés à chaque image, envoyaient ainsi ~670 Ko
 *  de sommets par image et découpaient des centaines de points en triangles (mesure du 15 nov. 2026).
 *  Ici, autant de segments qu'il en faut pour que l'écart à l'arc vrai reste sous ~0,08 px (4 pour un coin de 5 px,
 *  ~40 pour un cercle de 30 px), jamais plus de 100 comme avant. Même tracé : des lineTo, comme le fait l'ARC de Phaser. */
const PI2 = Math.PI * 2, ECART = 0.08;
const gfx = Phaser.GameObjects.Graphics.prototype as unknown as {
  arc(x: number, y: number, r: number, a0: number, a1: number, anti?: boolean, over?: number): Phaser.GameObjects.Graphics;
  lineTo(x: number, y: number): Phaser.GameObjects.Graphics;
};
const arcPhaser = gfx.arc;
gfx.arc = function (this: Phaser.GameObjects.Graphics, x, y, r, a0, a1, anti = false, over = 0) {
  if (over || !(r > 0)) return arcPhaser.call(this, x, y, r, a0, a1, anti, over);
  // même normalisation de l'angle que le rendu WebGL de Phaser (GraphicsWebGLRenderer, Commands.ARC)
  let d = a1 - a0;
  if (anti) { if (d < -PI2) d = -PI2; else if (d > 0) d = -PI2 + d % PI2; }
  else if (d > PI2) d = PI2;
  else if (d < 0) d = PI2 + d % PI2;
  const pas = r <= ECART ? Math.PI : 2 * Math.acos(1 - ECART / r);
  const n = Math.max(1, Math.min(100, Math.ceil(Math.abs(d) / pas)));
  for (let i = 0; i <= n; i++) { const a = a0 + d * (i / n); this.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  return this;
};
