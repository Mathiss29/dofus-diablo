import sheet from '../data/icones_objets.json';

/** Planche unique des icônes d'objets (tools/extraction/items_export.py) : une case de 64 px par iconId. */
export const ICON_SHEET = { key: 'objets', url: 'ui/objets.webp', cell: sheet.cell };
const ICONS = sheet.icons as Record<string, number>;

/** Numéro de la case d'une icône (pour Phaser), -1 si absente. */
export const iconFrame = (icon: number) => ICONS[icon] ?? -1;

/** Icône en HTML : une case de la planche en fond, à la taille du conteneur (classe CSS « ic »). */
export function iconHtml(icon: number) {
  const n = iconFrame(icon);
  if (n < 0) return '<i class="ic"></i>';
  const x = (n % sheet.cols) / (sheet.cols - 1) * 100, y = Math.floor(n / sheet.cols) / (sheet.rows - 1) * 100;
  return `<i class="ic" style="background-position:${x.toFixed(3)}% ${y.toFixed(3)}%"></i>`;
}
export const ICON_CSS = `.ic{display:block;background:url(assets/${ICON_SHEET.url}) no-repeat;background-size:${sheet.cols * 100}% ${sheet.rows * 100}%}`;
