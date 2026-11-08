import Phaser from 'phaser';

/**
 * Calage au pixel de l'écran (Mathis, 2026-11-08 : « léger flou quand je me déplace »).
 *
 * La caméra du jeu suit le perso en douceur (lerp), donc son défilement tombe presque toujours entre deux pixels.
 * Au zoom 0,8 (ou tout zoom non entier), Phaser arrondit chaque coin d'image séparément : à chaque image le décor,
 * le perso et les monstres étaient rééchantillonnés autrement (largeur ±1 px, textures relissées) et l'image
 * « bavait » pendant la course, alors qu'elle est nette à l'arrêt.
 *
 * Remède : la caméra garde son défilement exact pour le suivi, mais on dessine avec un défilement arrondi à un
 * pixel d'écran entier. Tout le décor glisse alors d'un bloc, pixel par pixel, exactement comme il est dessiné à l'arrêt.
 * Les persos et monstres sont eux aussi posés pile sur un pixel de l'écran (voir `auPixel`).
 */
export function calerCamera(cam: Phaser.Cameras.Scene2D.Camera): void {
  let vrai: { x: number; y: number; cx: number; cy: number } | null = null;
  const caler = () => {
    const z = cam.zoom;
    if (!(z > 0)) return;
    const x = cam.scrollX, y = cam.scrollY;
    cam.scrollX = Math.round(x * z) / z; cam.scrollY = Math.round(y * z) / z;
    vrai = { x, y, cx: cam.scrollX, cy: cam.scrollY };
  };
  // À enregistrer AVANT les autres écouteurs (QuestView.caler lit le défilement déjà arrondi)
  cam.on(Phaser.Cameras.Scene2D.Events.FOLLOW_UPDATE, caler);
  const c = cam as unknown as { preRender: () => void };   // méthode « protégée » dans les types de Phaser
  const preRender = c.preRender.bind(cam);
  c.preRender = () => {
    // On rend au suivi son défilement exact, sauf si quelqu'un a déplacé la caméra entre-temps (centerOn…)
    if (vrai && cam.scrollX === vrai.cx && cam.scrollY === vrai.cy) { cam.scrollX = vrai.x; cam.scrollY = vrai.y; }
    vrai = null;
    preRender();
    if (!vrai) caler();   // caméra libre (vitrine, carte) : arrondie aussi
  };
}

/** Position du monde décalée de moins d'un pixel d'écran pour tomber pile sur un pixel (avec `calerCamera`). */
export function auPixel(cam: Phaser.Cameras.Scene2D.Camera, x: number, y: number): { x: number; y: number } {
  const z = cam.zoom;
  if (!(z > 0)) return { x, y };
  const ox = cam.width * cam.originX, oy = cam.height * cam.originY;
  return { x: Math.round((x - ox) * z) / z + ox, y: Math.round((y - oy) * z) / z + oy };
}
