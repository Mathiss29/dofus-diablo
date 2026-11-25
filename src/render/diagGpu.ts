// Diagnostic de la carte graphique (carrés noirs sur l'AYN Thor, 2026-11-16) : compte les textures envoyées au GPU,
// leur poids vivant, et note chaque envoi refusé (gl.getError après texImage2D) et chaque perte du contexte WebGL.
// Actif seulement sur écran tactile (consoles, téléphones) ou avec #diag dans l'adresse : getError attend le GPU à chaque envoi.
// Le résultat part dans le rapport de l'écran du bas (compagnon.ts).

/** Essai (écran du bas) : une seule texture par lot de dessin, contre les textures noires de certains GPU mobiles. */
export const CLE_UNE_TEXTURE = 'diablofus.gpu.uneTexture';
export function uneTexture() { try { return localStorage.getItem(CLE_UNE_TEXTURE) === '1'; } catch { return false; } }

export interface DiagGpu {
  actif: boolean; uneTexture: boolean; carte: string; maxTexture: number; textures: number; mo: number; moMax: number; envois: number;
  echecs: { w: number; h: number; err: string; t: number }[]; pertes: number;
}

const d: DiagGpu = { actif: false, uneTexture: uneTexture(), carte: '?', maxTexture: 0, textures: 0, mo: 0, moMax: 0, envois: 0, echecs: [], pertes: 0 };
const poids = new Map<WebGLTexture, number>();
const liee = new WeakMap<object, WebGLTexture | null>();
const ERR: Record<number, string> = { 0x500: 'INVALID_ENUM', 0x501: 'INVALID_VALUE', 0x502: 'INVALID_OPERATION', 0x505: 'OUT_OF_MEMORY', 0x9242: 'CONTEXT_LOST' };
const debut = performance.now();
let derniereLecture = 0;

export const diagGpu = (): DiagGpu => d;

export function brancherDiagGpu() {
  let actif = false;
  try { actif = matchMedia('(pointer: coarse)').matches || location.hash.includes('diag'); } catch { /* rien */ }
  if (!actif || d.actif) return;
  d.actif = true;
  const protos = [window.WebGLRenderingContext?.prototype, window.WebGL2RenderingContext?.prototype].filter(Boolean) as WebGLRenderingContext[];
  for (const P of protos) {
    const bind = P.bindTexture, envoi = P.texImage2D as (...a: unknown[]) => void, suppr = P.deleteTexture;
    P.bindTexture = function (this: WebGLRenderingContext, cible: number, tex: WebGLTexture | null) {
      if (cible === this.TEXTURE_2D) liee.set(this, tex);
      return bind.call(this, cible, tex);
    };
    (P as unknown as { texImage2D: (...a: unknown[]) => void }).texImage2D = function (this: WebGLRenderingContext, ...a: unknown[]) {
      envoi.apply(this, a);
      if (a[1] !== 0) return;   // niveaux de mipmap : seul le niveau 0 compte
      const src = a[a.length - 1] as { width?: number; height?: number } | null;
      const w = a.length >= 9 ? a[3] as number : src?.width ?? 0, h = a.length >= 9 ? a[4] as number : src?.height ?? 0;
      d.envois++;
      if (!d.maxTexture) premierContact(this);
      // getError attend la carte graphique : au plus 4 fois par seconde (l'erreur reste notée jusqu'à sa lecture)
      const t = performance.now(), e = t - derniereLecture > 250 ? this.getError() : 0;
      if (t - derniereLecture > 250) derniereLecture = t;
      if (e) { d.echecs.push({ w, h, err: ERR[e] ?? `0x${e.toString(16)}`, t: Math.round((performance.now() - debut) / 1000) }); if (d.echecs.length > 12) d.echecs.shift(); console.warn('[GPU] envoi de texture refusé', w, h, ERR[e] ?? e); }
      const tex = liee.get(this);
      if (tex) { poids.set(tex, w * h * 4); recompter(); }
    };
    P.deleteTexture = function (this: WebGLRenderingContext, tex: WebGLTexture | null) {
      if (tex && poids.delete(tex)) recompter();
      return suppr.call(this, tex);
    };
  }
  addEventListener('webglcontextlost', () => { d.pertes++; console.warn('[GPU] contexte WebGL perdu'); }, true);
}

function premierContact(gl: WebGLRenderingContext) {
  d.maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  d.carte = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  gl.getError();   // vide l'erreur éventuelle de ces lectures
}

function recompter() {
  let o = 0;
  for (const v of poids.values()) o += v;
  d.textures = poids.size; d.mo = Math.round(o / 1048576); d.moMax = Math.max(d.moMax, d.mo);
  if (d.mo >= noteMo + 64) noterMemoire('monte');
}

/** Dernier poids noté dans le journal de l'appli Thor. */
let noteMo = 0;
/** Note la mémoire (textures + JavaScript) dans le journal de l'appli Thor : l'appli garde les erreurs de la console,
 *  qui survivent à la page tuée par Android (plantage au Zaap Incarnam → Bastion, 2026-11-17). Une ligne par zone
 *  et une à chaque tranche de 64 Mo de textures en plus. */
export function noterMemoire(etape: string) {
  if (!d.actif) return;
  noteMo = d.mo;
  const m = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  const js = m ? `, JS ${Math.round(m.usedJSHeapSize / 1048576)}/${Math.round(m.jsHeapSizeLimit / 1048576)} Mo` : '';
  console.error(`[mémoire] ${etape} : textures ${d.mo} Mo (${d.textures})${js}`);
}

/** Lignes lisibles pour le rapport. */
export function texteDiag(g: DiagGpu): string[] {
  if (!g.actif) return ['Carte graphique : diagnostic inactif'];
  return [
    `Carte graphique : ${g.carte}, textures jusqu'à ${g.maxTexture} px`,
    `Textures : ${g.textures} en mémoire, ${g.mo} Mo (au plus ${g.moMax} Mo), ${g.envois} envois`,
    `Envois refusés : ${g.echecs.length ? g.echecs.map(e => `${e.w}×${e.h} ${e.err} à ${e.t} s`).join(', ') : 'aucun'}`,
    `Contexte WebGL perdu : ${g.pertes} fois`,
    `Essai « une texture à la fois » : ${g.uneTexture ? 'oui' : 'non'}`,
  ];
}
