import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { WorldData } from '../src/sim/gridmap';

/** Détecteurs des cartes (choix de Mathis « Cartes : 4B », 2026-11-07) : ce qu'un export peut casser sans que ça se voie
 *  dans les autres tests. Ils ne lisent que les JSON (les images sont sur R2, pas dans git). */
const dossier = (w: string) => new URL(`../public/assets/mondes/${w}/`, import.meta.url);
const lire = (w: string) => JSON.parse(readFileSync(new URL('monde.json', dossier(w)), 'utf8')) as WorldData;
const lourds = JSON.parse(readFileSync(new URL('../src/data/fichiers-lourds.json', import.meta.url), 'utf8')) as Record<string, string>;
type Frame = { frame: { w: number; h: number }; spriteSourceSize: { x: number; y: number }; sourceSize: { w: number; h: number } };
const pages = new Map<string, Record<string, Frame>>();
function frames(w: string, cle: string) {
  const k = `${w}/${cle}`;
  if (!pages.has(k)) {
    const u = new URL(`decor_${cle}.json`, dossier(w));
    pages.set(k, existsSync(u) ? JSON.parse(readFileSync(u, 'utf8')).frames : {});
  }
  return pages.get(k)!;
}
type Img = { tag: string; mx: number; my: number; x: number; y: number; w: number; h: number; lum: boolean };
function images(w: string, data: WorldData) {
  const L: Img[] = [], manque: string[] = [];
  for (const m of data.maps) for (const p of m.decor) {
    const cle = p.p !== undefined ? `p${p.p}` : m.tag, F = frames(w, cle)[p.f];
    if (!F) { manque.push(`${m.tag} ${cle} ${p.f}`); continue; }
    const z = p.z ?? 1;
    if (m.inside) continue;
    L.push({ tag: m.tag, mx: m.x, my: m.y, x: p.x + (F.spriteSourceSize.x - F.sourceSize.w / 2) * z, y: p.y + (F.spriteSourceSize.y - F.sourceSize.h / 2) * z,
      w: F.frame.w * z, h: F.frame.h * z, lum: !!p.b || p.c < 0 });
  }
  return { L, manque };
}
/** Paires d'images de cartes voisines posées l'une sur l'autre (même taille, à d px près). */
function doubles(L: Img[], d: number, aireMin: number) {
  const G = new Map<string, Img[]>(), res: [Img, Img][] = [];
  for (const e of L) if (!e.lum && e.w * e.h >= aireMin) {
    const k = `${Math.floor(e.x / 256)},${Math.floor(e.y / 256)}`;
    (G.get(k) ?? G.set(k, []).get(k)!).push(e);
  }
  for (const e of L) if (!e.lum && e.w * e.h >= aireMin) {
    for (let cx = -1; cx <= 1; cx++) for (let cy = -1; cy <= 1; cy++)
      for (const o of G.get(`${Math.floor(e.x / 256) + cx},${Math.floor(e.y / 256) + cy}`) ?? []) {
        if (o === e || o.tag <= e.tag || Math.abs(o.mx - e.mx) > 1 || Math.abs(o.my - e.my) > 1) continue;
        if (Math.abs(o.x - e.x) <= d && Math.abs(o.y - e.y) <= d && Math.abs(o.w - e.w) <= 3 && Math.abs(o.h - e.h) <= 3) res.push([e, o]);
      }
  }
  return res;
}

describe.each(['incarnam', 'astrub'])('cartes de %s', (w) => {
  const data = lire(w), { L, manque } = images(w, data);
  it('chaque image de décor existe dans son atlas, chaque sol et chaque page sont hébergés', () => {
    expect(manque).toEqual([]);
    const absents: string[] = [];
    for (const m of data.maps) {
      if (!lourds[`mondes/${w}/sol_${m.tag}.webp`]) absents.push(`sol_${m.tag}`);
      for (const p of new Set(m.decor.map(p => p.p !== undefined ? `p${p.p}` : m.tag)))
        if (!lourds[`mondes/${w}/decor_${p}.webp`]) absents.push(`decor_${p}`);
    }
    expect(absents).toEqual([]);
  });
  it('aucun bâtiment posé deux fois par deux cartes voisines', () => {
    const d = doubles(L, 2, 8000).map(([a, b]) => `${a.tag} / ${b.tag} (${Math.round(a.x)}, ${Math.round(a.y)}) ${a.w}x${a.h}`);
    expect(d).toEqual([]);
  });
});

describe('bâtiments (tools/extraction/batiments.py)', () => {
  it.each(['incarnam', 'astrub'])('%s : décor rangé en bâtiments, un bâtiment a au moins une grande image', (w) => {
    const data = lire(w), tailles = new Map<number, number>();
    for (const m of data.maps) {
      expect(m.batiments, m.tag).toBe(1);
      for (const p of m.decor) if (p.bt !== undefined) {
        const F = frames(w, p.p !== undefined ? `p${p.p}` : m.tag)[p.f];
        tailles.set(p.bt, Math.max(tailles.get(p.bt) ?? 0, F.frame.w * F.frame.h * (p.z ?? 1) ** 2));
      }
    }
    expect(tailles.size).toBeGreaterThan(500);
    for (const [bt, t] of tailles) expect(t, `bâtiment ${bt}`).toBeGreaterThan(20000);
  });
});
