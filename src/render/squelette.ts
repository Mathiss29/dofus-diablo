/** Dessin du perso en direct depuis son squelette Dofus (maquette Apparence, 6 nov. 2026 : 3A).
 *  Le perso n'est plus une planche rendue à l'avance : ses animations (anims_<classe>.json), son corps et sa tête
 *  (skin_<id>.json + .webp) sont assemblés dans le navigateur, avec les 6 couleurs choisies à la création.
 *  Chaque image est dessinée la première fois qu'elle sert, puis gardée (pages de 2048 px).
 *  Données faites par tools/extraction/squelette_export.py. Rendu identique à tools/extraction/render.html. */
import { v } from './assetUrl';

export const DOSSIER = 'assets/sprites/squelette';

/** Apparence choisie à la création (têtes et couleurs officielles). */
export interface Apparence {
  /** Index de la tête dans `tetes` (ordre officiel de création), 0 = première. */
  tete: number;
  /** 6 couleurs 0xRRGGBB : peau, cheveux, puis 4 zones de tenue. */
  couleurs: number[];
}

export interface FichePerso { classe: number; anims: string; corps: number; tetes: number[]; couleurs: number[]; os: string[] }
/** `c` : partie de la tête (cheveux, crane, oreille, patte) qu'une coiffe peut cacher ; `trou` : emplacement d'objet porté. */
interface Morceau { z: number; v: number[]; t: number[]; tex?: string; trou?: string; tf?: number[]; c?: string; d?: string }
interface Skin { tex: string; parts: Record<string, Morceau[]> }
/** [g, n, a, b, tx, c, d, ty, alpha, mulR, mulG, mulB, mulA] */
type Trace = number[];
export interface AnimsData { echelle: number; graphiques: Morceau[][]; noeuds: string[]; anims: Record<string, Trace[][]>; shots: Record<string, number> }

const json = async <T>(f: string): Promise<T> => (await fetch(v(`${DOSSIER}/${f}`))).json() as Promise<T>;
const cacheJson = new Map<string, Promise<unknown>>();
function charge<T>(f: string): Promise<T> {
  if (!cacheJson.has(f)) cacheJson.set(f, json<T>(f).catch(e => { cacheJson.delete(f); throw e; }));
  return cacheJson.get(f) as Promise<T>;
}
const cacheImg = new Map<string, Promise<HTMLImageElement>>();
function image(f: string): Promise<HTMLImageElement> {
  if (!cacheImg.has(f)) cacheImg.set(f, (async () => {
    const im = new Image(); im.crossOrigin = 'anonymous'; im.src = v(`${DOSSIER}/${f}`); await im.decode(); return im;
  })().catch(e => { cacheImg.delete(f); throw e; }));
  return cacheImg.get(f)!;
}

export const fiches = () => charge<Record<string, FichePerso>>('persos.json');
/** Objet officiel (id) -> dessin porté (skin), pour les coiffes, capes, boucliers et apparats (equipement_export.py) ;
 *  `caches` : parties de la tête cachées par une coiffe (règle par défaut « 0 », par classe « b8 », par tête « t2124 »). */
interface Equipement { objets: Record<string, number>; caches: Record<string, Record<string, string[]>> }
export const equipement = () => charge<Equipement>('equipement.json');
/** Objets dont on voit le dessin : coiffe, cape, bouclier ; l'apparat (5A) passe par-dessus, « 0 » cache l'objet porté. */
export const EMPLACEMENTS_VISIBLES = ['chapeau', 'cape', 'bouclier'] as const;
export type EmplacementVisible = typeof EMPLACEMENTS_VISIBLES[number];
/** Objets visibles d'après l'équipement et l'apparat du joueur (en jeu ou d'une sauvegarde).
 *  L'arme (maquette Armes 8A) se pose sur le nœud Arme_1/Arme_5 que seules les animations d'arme (AnimArme…) montrent. */
export function objetsPortes(eq?: Partial<Record<string, { id: string } | undefined>>, apparat?: Partial<Record<EmplacementVisible, string>>): string[] {
  const o = objetsVisibles({ chapeau: eq?.chapeau?.id, cape: eq?.cape?.id, bouclier: eq?.bouclier?.id }, apparat);
  return eq?.arme?.id ? [...o, eq.arme.id] : o;
}
export function objetsVisibles(porte: Partial<Record<EmplacementVisible, string | undefined>>, apparat: Partial<Record<EmplacementVisible, string>> = {}): string[] {
  return EMPLACEMENTS_VISIBLES.map(e => apparat[e] ?? porte[e]).filter((x): x is string => !!x && x !== '0');
}

/** Couleurs par défaut et bornes : une apparence lue d'une sauvegarde est toujours valide. */
export function apparenceValide(f: FichePerso, a?: Partial<Apparence> | null): Apparence {
  const tete = Number.isInteger(a?.tete) && a!.tete! >= 0 && a!.tete! < f.tetes.length ? a!.tete! : 0;
  const c = Array.isArray(a?.couleurs) ? a!.couleurs! : [];
  return { tete, couleurs: f.couleurs.map((d, i) => (Number.isInteger(c[i]) && c[i] >= 0 && c[i] <= 0xffffff ? c[i] : d)) };
}

/** Emplacements d'objets portés qu'une tête ou un corps peut remplir lui-même (voir tools/extraction/skin_mesh.py). */
const EMPLACEMENT = /^(Chapeau|ChapeauB|Cape|CapeBas|Bouclier)_\d+$/;

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

/** Un perso assemblé (corps + tête + couleurs) : sait dessiner n'importe quelle image de ses animations. */
export class Assemblage {
  /** nœud exposé -> morceaux (corps puis tête) */
  private parts: Morceau[][];
  /** Morceaux de la tête choisie (sans coiffe) : pour cadrer le portrait du HUD sur le visage. */
  private deTete = new Set<Morceau>();
  private teintes = new Map<string, HTMLCanvasElement | HTMLImageElement>();
  private couleurs = new Map<string, [HTMLCanvasElement, number, number]>();

  private constructor(readonly data: AnimsData, private texs: Record<string, HTMLImageElement>, corps: Skin, tete: Skin, private app: Apparence, objets: Skin[] = [], caches = new Set<string>()) {
    // Objets portés (Apparence 4A+4B) : une coiffe se pose dans les emplacements vides de la tête (Chapeau_1...),
    // avec la transformation de l'emplacement ; les morceaux sans emplacement (Cape_1, Bouclier_1...) vont sur le nœud du même nom.
    const porte = new Map<string, Morceau[]>();
    for (const o of objets) for (const [k, ms] of Object.entries(o.parts)) porte.set(k, [...(porte.get(k) ?? []), ...ms.map(m => ({ ...m, tex: o.tex }))]);
    const poses = new Set<string>();
    const etendre = (ms: Morceau[] | undefined, tex: string): Morceau[] => (ms ?? []).flatMap(m => {
      // contenu propre à la tête dans un emplacement (cornes de l'Osamodas, chignon du Sacrieur) : remplacé par l'objet porté
      if (!m.trou) return m.t?.length && !(m.c && caches.has(m.c)) && !(m.d && porte.has(m.d)) ? [{ ...m, tex }] : [];
      const o = porte.get(m.trou); if (!o) return [];
      poses.add(m.trou);
      const f = m.tf!;
      return o.map(x => {
        const v = x.v.slice();
        for (let i = 0; i < v.length; i += 4) { const a = x.v[i], b = x.v[i + 1]; v[i] = f[0] * a + f[1] * b + f[2]; v[i + 1] = f[3] * a + f[4] * b + f[5]; }
        return { ...x, v };
      });
    });
    // nœud d'emplacement que la tête dessine elle-même (Chapeau_1 du Sacrieur...) : l'objet porté le remplace
    const propre = (sk: Skin, n: string) => (EMPLACEMENT.test(n) && porte.has(n) ? undefined : sk.parts[n]);
    this.parts = data.noeuds.map(n => {
      const t = etendre(propre(tete, n), tete.tex);
      for (const m of t) if (m.tex === tete.tex) this.deTete.add(m);   // la coiffe posée dans un emplacement de la tête a la texture de l'objet
      return [...etendre(propre(corps, n), corps.tex), ...t];
    });
    data.noeuds.forEach((n, i) => { if (!poses.has(n)) this.parts[i].push(...(porte.get(n) ?? [])); });
  }

  /** `objets` : objets portés dont on montre le dessin (idObjet officiel : coiffe, cape, bouclier), voir equipement.json. */
  static async creer(cle: string, app?: Partial<Apparence> | null, objets: string[] = []): Promise<Assemblage> {
    const f = (await fiches())[cle];
    if (!f) throw new Error(`perso inconnu : ${cle}`);
    const a = apparenceValide(f, app);
    const tid = f.tetes[a.tete];
    const eq = objets.length ? await equipement() : { objets: {}, caches: {} };
    const ids = [...new Set(objets.map(o => eq.objets[o]).filter((x): x is number => x != null))];
    // cheveux, oreilles... cachés par la coiffe : règle de la tête, sinon de la classe, sinon par défaut
    const caches = new Set(ids.flatMap(id => { const r = eq.caches[id]; return r ? r[`t${tid}`] ?? r[`b${f.classe}`] ?? r['0'] ?? [] : []; }));
    const [data, corps, tete, ...os] = await Promise.all([charge<AnimsData>(f.anims), charge<Skin>(`skin_${f.corps}.json`), charge<Skin>(`skin_${tid}.json`),
      ...ids.map(id => charge<Skin>(`skin_${id}.json`))]);
    const noms = [corps.tex, tete.tex, ...f.os, ...os.map(o => o.tex)];
    const ims = await Promise.all(noms.map(image));
    return new Assemblage(data, Object.fromEntries(noms.map((n, i) => [n, ims[i]])), corps, tete, a, os, caches);
  }

  /** Les 6 couleurs du perso (peau, cheveux, tenue) : les familiers « aux couleurs du porteur » les reprennent. */
  get couleursPerso(): readonly number[] { return this.app.couleurs; }

  /** Change les couleurs (même tête) : les textures teintées sont refaites à la prochaine image. */
  recolorer(couleurs: number[]) {
    if (couleurs.length === this.app.couleurs.length && couleurs.every((c, i) => c === this.app.couleurs[i])) return;
    this.app = { ...this.app, couleurs: [...couleurs] };
    this.teintes.clear(); this.couleurs.clear();
  }

  /** Nombre d'images de chaque animation (clé AnimCourse_1...). */
  get compte(): Record<string, number> { return Object.fromEntries(Object.entries(this.data.anims).map(([k, l]) => [k, l.length])); }

  /** Texture teintée d'une zone de couleur (mode « overlay » sur le gris, comme Dofus). */
  private tex(m: Morceau): HTMLCanvasElement | HTMLImageElement {
    const base = this.texs[m.tex!];
    if (!m.z) return base;
    const key = m.tex + '|' + m.z;
    let c = this.teintes.get(key);
    if (!c) {
      const cv = document.createElement('canvas'); cv.width = base.width; cv.height = base.height;
      const x = cv.getContext('2d')!;
      x.drawImage(base, 0, 0); x.globalCompositeOperation = 'overlay';
      x.fillStyle = hex(this.app.couleurs[m.z - 1] ?? 0x808080); x.fillRect(0, 0, cv.width, cv.height);
      x.globalCompositeOperation = 'destination-in'; x.drawImage(base, 0, 0);
      this.teintes.set(key, c = cv);
    }
    return c;
  }

  /** Transformation de couleur d'un nœud (rgb × mul / 127), sur la zone de texture du morceau. */
  private couleur(m: Morceau, T: HTMLCanvasElement | HTMLImageElement, mul: number[], id: string): [CanvasImageSource, number, number] {
    if (mul[0] === 127 && mul[1] === 127 && mul[2] === 127) return [T, 0, 0];
    const key = id + '|' + mul.join(',');
    let r = this.couleurs.get(key);
    if (!r) {
      const W = T.width, H = T.height; let x0 = W, y0 = H, x1 = 0, y1 = 0;
      for (let i = 0; i < m.v.length; i += 4) { const u = m.v[i + 2] * W, w = (1 - m.v[i + 3]) * H; x0 = Math.min(x0, u); y0 = Math.min(y0, w); x1 = Math.max(x1, u); y1 = Math.max(y1, w); }
      x0 = Math.max(0, Math.floor(x0) - 1); y0 = Math.max(0, Math.floor(y0) - 1); x1 = Math.min(W, Math.ceil(x1) + 1); y1 = Math.min(H, Math.ceil(y1) + 1);
      const c = document.createElement('canvas'); c.width = Math.max(1, x1 - x0); c.height = Math.max(1, y1 - y0);
      const g = c.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(T, -x0, -y0);
      const d = g.getImageData(0, 0, c.width, c.height), p = d.data, mr = mul[0] / 127, mg = mul[1] / 127, mb = mul[2] / 127;
      for (let i = 0; i < p.length; i += 4) { p[i] *= mr; p[i + 1] *= mg; p[i + 2] *= mb; }
      g.putImageData(d, 0, 0);
      this.couleurs.set(key, r = [c, x0, y0]);
    }
    return r;
  }

  private *morceaux(tr: Trace): Generator<[Morceau, string]> {
    if (tr[0] >= 0) for (let i = 0; i < this.data.graphiques[tr[0]].length; i++) yield [this.data.graphiques[tr[0]][i], `g${tr[0]}.${i}`];
    if (tr[1] >= 0) for (let i = 0; i < this.parts[tr[1]].length; i++) yield [this.parts[tr[1]][i], `n${tr[1]}.${i}`];
  }

  /** Bornes d'une image en unités du squelette (y vers le bas), ou null si elle est vide. */
  bornes(anim: string, i: number): [number, number, number, number] | null {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const tr of this.data.anims[anim][i]) for (const [m] of this.morceaux(tr)) for (let k = 0; k < m.v.length; k += 4) {
      const x = m.v[k], y = m.v[k + 1];
      const X = tr[2] * x + tr[3] * y + tr[4], Y = -(tr[5] * x + tr[6] * y + tr[7]);
      if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
    }
    return x0 <= x1 ? [x0, y0, x1, y1] : null;
  }

  /** Bornes de la tête seule (visage et cheveux, sans coiffe) d'une image, en unités du squelette ; null si absente. */
  bornesTete(anim: string, i: number): [number, number, number, number] | null {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const tr of this.data.anims[anim]?.[i] ?? []) for (const [m] of this.morceaux(tr)) if (this.deTete.has(m)) for (let k = 0; k < m.v.length; k += 4) {
      const x = m.v[k], y = m.v[k + 1];
      const X = tr[2] * x + tr[3] * y + tr[4], Y = -(tr[5] * x + tr[6] * y + tr[7]);
      if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
    }
    return x0 <= x1 ? [x0, y0, x1, y1] : null;
  }

  /** Dessine l'image `i` de `anim`, pied du perso en (ox, oy), à l'échelle `sc`. */
  dessiner(ctx: CanvasRenderingContext2D, anim: string, i: number, ox: number, oy: number, sc: number) {
    for (const tr of this.data.anims[anim][i]) {
      const alpha = Math.max(0, Math.min(1, (tr[8] / 127) * (tr[12] / 127)));
      if (alpha <= 0) continue;
      for (const [m, id] of this.morceaux(tr)) {
        const T0 = this.tex(m), W = T0.width, H = T0.height;
        const [T, tx, ty] = this.couleur(m, T0, [tr[9], tr[10], tr[11]], id + '|' + m.z);
        ctx.globalAlpha = alpha;
        const P: number[] = [];
        for (let k = 0; k < m.v.length; k += 4) {
          const x = m.v[k], y = m.v[k + 1];
          P.push(ox + (tr[2] * x + tr[3] * y + tr[4]) * sc, oy - (tr[5] * x + tr[6] * y + tr[7]) * sc, m.v[k + 2] * W, (1 - m.v[k + 3]) * H);
        }
        const t = m.t;
        for (let k = 0; k < t.length; k += 3) {
          const a = t[k] * 4, b = t[k + 1] * 4, c = t[k + 2] * 4;
          const du1 = P[b + 2] - P[a + 2], dv1 = P[b + 3] - P[a + 3], du2 = P[c + 2] - P[a + 2], dv2 = P[c + 3] - P[a + 3];
          const det = du1 * dv2 - du2 * dv1; if (Math.abs(det) < 1e-9) continue;
          const dx1 = P[b] - P[a], dy1 = P[b + 1] - P[a + 1], dx2 = P[c] - P[a], dy2 = P[c + 1] - P[a + 1];
          const A = (dx1 * dv2 - dx2 * dv1) / det, C = (dx2 * du1 - dx1 * du2) / det;
          const B = (dy1 * dv2 - dy2 * dv1) / det, D = (dy2 * du1 - dy1 * du2) / det;
          const E = P[a] - A * P[a + 2] - C * P[a + 3], F = P[a + 1] - B * P[a + 2] - D * P[a + 3];
          // léger gonflement du triangle pour éviter les fissures (comme render.html)
          const cx = (P[a] + P[b] + P[c]) / 3, cy = (P[a + 1] + P[b + 1] + P[c + 1]) / 3;
          ctx.save(); ctx.beginPath();
          for (const q of [a, b, c]) {
            const dx = P[q] - cx, dy = P[q + 1] - cy, l = Math.hypot(dx, dy) || 1;
            if (q === a) ctx.moveTo(P[q] + dx / l, P[q + 1] + dy / l); else ctx.lineTo(P[q] + dx / l, P[q + 1] + dy / l);
          }
          ctx.closePath(); ctx.clip();
          ctx.transform(A, B, C, D, E, F); ctx.drawImage(T, tx, ty); ctx.restore();
        }
      }
    }
    ctx.globalAlpha = 1;
  }
}

/** Palettes toutes faites (maquette Apparence 2C) : cheveux et 4 zones de tenue ; la peau reste celle du joueur. */
export const PALETTES: { nom: string; c: number[] }[] = [
  { nom: 'Or', c: [0xf2d36b, 0xffffff, 0xc9a227, 0x8a5a12, 0xf5e6b0] },
  { nom: 'Sombre', c: [0x2b2b3a, 0x5a1a2a, 0x3a3a46, 0x1c1c24, 0x7a2030] },
  { nom: 'Forêt', c: [0x6b3b1e, 0x3f7a3a, 0x2a4d2a, 0x8a6a2a, 0x9ac46a] },
  { nom: 'Glace', c: [0xdfe9ff, 0x5fa8e0, 0x2a5a9a, 0xe0f0ff, 0x9ad0ff] },
  { nom: 'Braise', c: [0xd8401c, 0x2a1a14, 0xe07a1c, 0x5a1a0c, 0xf2b23a] },
  { nom: 'Royal', c: [0x3a2a6a, 0x7a4ad0, 0xe8c24a, 0x2a1a4a, 0xd0b0ff] },
];
export const ZONES = ['Peau', 'Cheveux', 'Tenue 1', 'Tenue 2', 'Tenue 3', 'Tenue 4'];

const assemblages = new Map<string, Promise<Assemblage>>();
/** Assemblage d'un perso pour les écrans d'accueil (une tête = un assemblage, les couleurs se changent dessus). */
export function assemblagePour(cle: string, app: Apparence, objets: string[] = []): Promise<Assemblage> {
  const k = `${cle}|${app.tete}|${objets.join(',')}`;
  if (!assemblages.has(k)) assemblages.set(k, Assemblage.creer(cle, app, objets).catch(e => { assemblages.delete(k); throw e; }));
  return assemblages.get(k)!.then(a => { a.recolorer(app.couleurs); return a; });
}
