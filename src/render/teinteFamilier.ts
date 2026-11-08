/** Familiers « aux couleurs du porteur » (Dofus 3) : la planche est grise, et sa carte des zones (familiers_export.py)
 *  dit, pour chaque pixel, quelle couleur du perso le teint (1 peau, 2 cheveux, 3 à 6 tenue). */

/** Aplat de chaque zone sur la carte (ZONES_RVB de familiers_export.py) ; le noir = pas de couleur. */
export const ZONES_RVB = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
const PALETTE = [0x000000, ...ZONES_RVB].map(c => [c >> 16, (c >> 8) & 255, c & 255]);

/** Zone d'un pixel de la carte (0 = aucune) : l'aplat le plus proche (les bords lissés mélangent deux aplats). */
export function zoneDe(r: number, g: number, b: number): number {
  let best = 0, d = Infinity;
  PALETTE.forEach(([pr, pg, pb], i) => { const e = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2; if (e < d) { d = e; best = i; } });
  return best;
}

/** Mélange « incrustation » (overlay), comme les persos et le rendu des planches : gris de la planche × couleur. */
const incruste = (a: number, c: number) => (a < 128 ? (2 * a * c) / 255 : 255 - (2 * (255 - a) * (255 - c)) / 255);

/** Teint en place les pixels RVBA de la planche avec les couleurs du perso, d'après la carte (même taille, même disposition). */
export function teindre(px: Uint8ClampedArray, carte: Uint8ClampedArray, couleurs: readonly number[]) {
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3] || !carte[i + 3]) continue;
    const z = zoneDe(carte[i], carte[i + 1], carte[i + 2]);
    const c = z ? couleurs[z - 1] : undefined;
    if (c == null) continue;
    px[i] = incruste(px[i], c >> 16); px[i + 1] = incruste(px[i + 1], (c >> 8) & 255); px[i + 2] = incruste(px[i + 2], c & 255);
  }
}

/** Clé de la texture teinte : planche + couleurs (une par jeu de couleurs). */
export const cleTeinte = (planche: string, couleurs: readonly number[]) => `${planche}_c${couleurs.map(c => c.toString(16)).join('_')}`;
