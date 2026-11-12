import sheet from '../data/icones_objets.json';

/** Icônes d'objets (tools/extraction/icones_ajout.py, paquet item_assets_2x de Dofus 3) : planche objets.webp (64 px) pour Phaser,
 *  et un fichier de 128 px par icône (ui/objets/<id>.webp) pour les fenêtres, nettes à toutes les tailles et échelles d'interface.
 *  (Une seule planche de 128 px pesait 140 Mo une fois décodée : l'inventaire attendait qu'elle le soit à chaque ouverture.) */
export const ICON_SHEET = { key: 'objets', url: 'ui/objets.webp', cell: sheet.cell };
const ICONS = sheet.icons as Record<string, number>;

/** Numéro de la case d'une icône (pour Phaser), -1 si absente. */
export const iconFrame = (icon: number) => ICONS[icon] ?? -1;

/** Icône en HTML : son fichier en fond, à la taille du conteneur (classe CSS « ic »). */
export function iconHtml(icon: number) {
  if (iconFrame(icon) < 0) return '<i class="ic"></i>';
  return `<i class="ic" style="background-image:url(${iconUrl(icon)})"></i>`;
}
const iconUrl = (icon: number) => `assets/ui/objets/${icon}.webp`;
export const ICON_CSS = '.ic{display:block;background-repeat:no-repeat;background-position:center;background-size:contain}';

/** Icônes déjà demandées au navigateur (gardées pour qu'il ne les oublie pas). */
const prechargees = new Map<number, HTMLImageElement>();
/** Charge et décode d'avance ces icônes (sac, équipement...) : les fenêtres qui les montrent s'ouvrent sans attendre. */
export function prechargerIcones(icones: Iterable<number>) {
  for (const icon of icones) {
    if (prechargees.has(icon) || iconFrame(icon) < 0) continue;
    const im = new Image(); im.decoding = 'async'; im.src = iconUrl(icon);
    prechargees.set(icon, im); im.decode?.().catch(() => {});
  }
}
