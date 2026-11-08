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
