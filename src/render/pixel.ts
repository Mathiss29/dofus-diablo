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

/**
 * Densité de l'écran (maquette « Décors : » 1A, 2026-11-08) : nombre de vrais pixels par pixel CSS.
 * Sur un Windows réglé à 125 % ou 150 %, le jeu est dessiné en vrais pixels (canevas 1,25 ou 1,5 fois plus grand)
 * au lieu d'être agrandi (donc flouté) par le navigateur. Plafonnée à 2 pour la carte graphique.
 * Les caméras du jeu et de l'interface sont zoomées d'autant : tout garde la même taille à l'écran.
 */
let pleine = true;
/** Réglage « Résolution » (Fluidité 3A) : false = un pixel du jeu par pixel CSS, plus rapide. */
export function reglerDensite(ecran: boolean) { pleine = ecran; }
export function densitePleine() { return pleine; }
export function densite(): number {
  if (!pleine) return 1;
  const d = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  return Math.min(2, Math.max(1, d));
}

/** Branche la densité sur le jeu : le canevas suit la taille de son parent multipliée par `densite()`
 *  (le CSS l'étire à 100 % du parent), et les textes sont dessinés aussi finement. */
export function brancherDensite(game: Phaser.Game): void {
  const sm = game.scale as unknown as {
    parent: HTMLElement | null; parentSize: Phaser.Structs.Size; canvas?: HTMLCanvasElement; canvasBounds: Phaser.Geom.Rectangle;
    getParentBounds(): boolean;
  };
  sm.getParentBounds = function () {
    if (!sm.parent) return false;
    const r = sm.parent.getBoundingClientRect(), d = densite();
    const w = Math.round(r.width * d), h = Math.round(r.height * d);
    if (sm.parentSize.width !== w || sm.parentSize.height !== h) { sm.parentSize.setSize(w, h); return true; }
    if (sm.canvas) { const c = sm.canvas.getBoundingClientRect(); return c.x !== sm.canvasBounds.x || c.y !== sm.canvasBounds.y; }
    return false;
  };
  // Phaser a déjà mesuré le parent en pixels CSS à sa création : on redimensionne une fois prêt
  game.events.once(Phaser.Core.Events.READY, () => game.scale.refresh());
  // Textes de Phaser (dégâts, noms, interface) : dessinés à la densité de l'écran, sinon ils seraient agrandis donc flous
  const F = Phaser.GameObjects.GameObjectFactory.prototype as unknown as { text: (...a: unknown[]) => Phaser.GameObjects.Text };
  const text = F.text;
  F.text = function (this: unknown, ...a: unknown[]) {
    const t = text.apply(this, a), d = densite();
    if (d > 1 && t.style.resolution === 1 && !(a[3] as { resolution?: number } | undefined)?.resolution) t.setResolution(d);
    return t;
  };
}
