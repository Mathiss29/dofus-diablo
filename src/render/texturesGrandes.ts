import Phaser from 'phaser';

/** Carrés noirs sur l'AYN Thor (2026-11-16, rapport de l'écran du bas) : son GPU (Adreno 740 sous Chrome) refuse toute
 *  texture de plus de 4096 px (INVALID_VALUE), et beaucoup de planches de décor font 2048 x 4300 à 6300 px. L'image
 *  refusée s'affiche en noir. Quand une texture dépasse la taille permise par la carte graphique, ses images sont
 *  recopiées sur plusieurs pages qui tiennent (rangées simples, 2 px d'écart), sous la même clé et les mêmes noms
 *  d'images : le reste du jeu ne voit pas la différence. Sur PC (16384 px en général), rien ne change. */

type Image = HTMLImageElement | HTMLCanvasElement;
interface Case { n: string; x: number; y: number; w: number; h: number; trim?: { rw: number; rh: number; x: number; y: number; w: number; h: number };
  pivot?: { x: number; y: number }; page: number; px: number; py: number }

const ECART = 2;

/** Range les images dans des pages de max x max au plus (rangées, les plus hautes d'abord). */
export function ranger(cases: { w: number; h: number }[], max: number, largeur: number): { page: number; x: number; y: number }[] {
  const L = Math.min(max, largeur), ordre = cases.map((_, i) => i).sort((a, b) => cases[b].h - cases[a].h);
  const out: { page: number; x: number; y: number }[] = new Array(cases.length);
  let page = 0, x = 0, y = 0, rangee = 0;
  for (const i of ordre) {
    const { w, h } = cases[i];
    if (x + w > L) { x = 0; y += rangee + ECART; rangee = 0; }
    if (y + h > max) { page++; x = 0; y = 0; rangee = 0; }
    out[i] = { page, x, y };
    x += w + ECART; rangee = Math.max(rangee, h);
  }
  return out;
}

function decouper(T: Phaser.Textures.TextureManager, cle: string, max: number) {
  const t = T.get(cle), s = t.source[0];
  if (t.source.length !== 1 || (s.width <= max && s.height <= max)) return;
  const img = s.image as Image;
  if (!img || !(img instanceof HTMLImageElement || img instanceof HTMLCanvasElement)) return;
  const noms = t.getFrameNames().filter(n => n !== '__BASE');
  if (!noms.length) return;   // image seule (pas une planche) : on la laisse
  const cases: Case[] = noms.map(n => {
    const f = t.get(n), sss = (f as unknown as { data?: { spriteSourceSize?: unknown } }).data?.spriteSourceSize as { x: number; y: number; w: number; h: number } | undefined;
    return { n, x: f.cutX, y: f.cutY, w: f.cutWidth, h: f.cutHeight, page: 0, px: 0, py: 0,
      trim: f.trimmed && sss ? { rw: f.realWidth, rh: f.realHeight, x: sss.x, y: sss.y, w: sss.w, h: sss.h } : undefined,
      pivot: f.customPivot ? { x: f.pivotX, y: f.pivotY } : undefined };
  });
  const places = ranger(cases, max, s.width);
  cases.forEach((c, i) => Object.assign(c, { page: places[i].page, px: places[i].x, py: places[i].y }));
  const nb = Math.max(...cases.map(c => c.page)) + 1;
  const pages = Array.from({ length: nb }, (_, p) => {
    const sur = cases.filter(c => c.page === p);
    const cv = document.createElement('canvas');
    cv.width = Math.min(max, Math.max(1, ...sur.map(c => c.px + c.w)));
    cv.height = Math.min(max, Math.max(1, ...sur.map(c => c.py + c.h)));
    const ctx = cv.getContext('2d');
    for (const c of sur) ctx?.drawImage(img, c.x, c.y, c.w, c.h, c.px, c.py, c.w, c.h);
    return cv;
  });
  const custom = t.customData;
  T.remove(cle);
  const n = T.create(cle, pages, pages[0].width, pages[0].height);
  if (!n) return;
  n.customData = custom;
  n.add('__BASE', 0, 0, 0, pages[0].width, pages[0].height);
  for (const c of cases) {
    const f = n.add(c.n, c.page, c.px, c.py, c.w, c.h);
    if (!f) continue;
    if (c.trim) f.setTrim(c.trim.rw, c.trim.rh, c.trim.x, c.trim.y, c.trim.w, c.trim.h);
    if (c.pivot) { f.customPivot = true; f.pivotX = c.pivot.x; f.pivotY = c.pivot.y; }
  }
  console.info(`[GPU] planche « ${cle} » (${s.width}×${s.height}) recopiée sur ${nb} pages de ${max} px au plus`);
}

/** À appeler une fois le jeu prêt (main.ts) : surveille chaque texture ajoutée. */
export function brancherTexturesGrandes(game: Phaser.Game) {
  const r = game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
  if (!(r instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return;
  const essai = /gpumax=(\d+)/.exec(location.hash);   // essai sur PC : diablofus.com/#jeu-gpumax=4096
  const max = Math.min(r.getMaxTextureSize() || 16384, essai ? +essai[1] : Infinity);
  if (max >= 16384) return;
  const T = game.textures;
  for (const cle of T.getTextureKeys()) decouper(T, cle, max);
  T.on(Phaser.Textures.Events.ADD, (cle: string) => decouper(T, cle, max));
}
