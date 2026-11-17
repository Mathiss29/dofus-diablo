import Phaser from 'phaser';
import { LOOKS } from './looks';
import { modeConsole } from './console';
import { appliNative } from './manette';

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

/** Planches de personnages (monstres, classes, PNJ, habitants, coffres) : allégées sur console et dans l'appli. */
const LEGERES = new Set(Object.values(LOOKS).map(l => l.atlas));
const aAlleger = (cle: string) => LEGERES.has(cle) || /^(pnj_|hab_|coffre_|fx_)/.test(cle);
/** Plus petite page allégée (en pixels) : en dessous, le gain ne vaut pas la copie. */
const PETITE = 1024 * 1024;

/** Mémoire sur la Thor (2026-11-16, la page fermée par Android au Bastion : 666 Mo d'images) : sur console et dans
 *  l'appli, chaque planche de personnage est gardée à moitié de sa taille (4 fois moins de mémoire). Les images gardent
 *  leurs coordonnées d'origine : seule la page envoyée à la carte graphique est plus petite (largeur de la source
 *  remise à celle d'origine, donc mêmes coordonnées de texture), le reste du jeu ne voit pas la différence. Ces
 *  planches sont affichées à 0,3-0,5 de leur taille : la moitié ne se voit pas sur un écran de 6 pouces. */
export function alleger(T: Phaser.Textures.TextureManager, cle: string, max: number): boolean {
  const t = T.get(cle);
  if ((t.customData as { leger?: boolean })?.leger) return true;
  if (!aAlleger(cle) || !(modeConsole() || appliNative() || /[?&]leger\b/.test(location.search))) return false;   // ?leger : essai sur PC
  const srcs = t.source;
  if (!srcs.length || srcs.every(s => s.width * s.height <= PETITE)) return false;
  if (!srcs.every(s => s.image instanceof HTMLImageElement || (typeof ImageBitmap !== 'undefined' && s.image instanceof ImageBitmap))) return false;
  const noms = t.getFrameNames().filter(n => n !== '__BASE');
  if (!noms.length) return false;
  const dims = srcs.map(s => [s.width, s.height] as const);
  if (dims.some(([w, h]) => Math.ceil(w / 2) > max || Math.ceil(h / 2) > max)) return false;   // encore trop grande : découpée plus bas
  const pages = srcs.map(s => {
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(s.width / 2); cv.height = Math.ceil(s.height / 2);
    const ctx = cv.getContext('2d');
    if (ctx) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(s.image as CanvasImageSource, 0, 0, cv.width, cv.height); }
    return cv;
  });
  const images = noms.map(n => {
    const f = t.get(n);
    return { n, src: f.sourceIndex, x: f.cutX, y: f.cutY, w: f.cutWidth, h: f.cutHeight,
      trim: f.trimmed ? [f.realWidth, f.realHeight, f.x, f.y, f.width, f.height] as const : null,
      pivot: f.customPivot ? [f.pivotX, f.pivotY] as const : null, data: f.customData };
  });
  const custom = t.customData;
  T.remove(cle);
  const n = T.create(cle, pages, pages[0].width, pages[0].height);
  if (!n) return true;
  n.source.forEach((s, i) => { s.width = dims[i][0]; s.height = dims[i][1]; });   // coordonnées d'origine
  n.customData = Object.assign(Object.create(Object.getPrototypeOf(custom ?? {})), custom, { leger: true });
  n.add('__BASE', 0, 0, 0, dims[0][0], dims[0][1]);
  for (const c of images) {
    const f = n.add(c.n, c.src, c.x, c.y, c.w, c.h);
    if (!f) continue;
    if (c.trim) f.setTrim(...c.trim);
    if (c.pivot) { f.customPivot = true; f.pivotX = c.pivot[0]; f.pivotY = c.pivot[1]; }
    f.customData = c.data;
  }
  return true;
}

function decouper(T: Phaser.Textures.TextureManager, cle: string, max: number) {
  const t = T.get(cle), s = t.source[0];
  if ((t.customData as { leger?: boolean })?.leger) return;
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
  const T = game.textures;
  const ajout = (cle: string) => { if (!alleger(T, cle, max) && max < 16384) decouper(T, cle, max); };
  for (const cle of T.getTextureKeys()) ajout(cle);
  T.on(Phaser.Textures.Events.ADD, ajout);
}
