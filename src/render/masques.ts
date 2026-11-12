/** Transparence des planches de décor (maquette « Fluidité : » 1A, 2026-11-12) : pour savoir si le décor couvre le perso, on lit
 *  l'alpha de ses pixels. La lire au milieu du jeu, la première fois qu'un perso passe devant, bloquait une image de 40 à 90 ms
 *  (mesure du 12 nov.) : on la lit maintenant dans un fil à part (masqueWorker.ts) dès que la planche arrive, réduite au quart. */

/** Un point du masque = PAS x PAS pixels de la planche. */
export const PAS = 4;
export type Masque = { w: number; h: number; a: Uint8Array };

const prets = new Map<string, Masque>();
const attendus = new Set<string>();
let fil: Worker | null | undefined;

function ouvrir(): Worker | null {
  if (fil !== undefined) return fil;
  try {
    fil = typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' ? null
      : new Worker(new URL('./masqueWorker.ts', import.meta.url), { type: 'module' });
  } catch { fil = null; }
  fil?.addEventListener('message', (e: MessageEvent<{ cle: string; w: number; h: number; a: Uint8Array | null }>) => {
    const { cle, w, h, a } = e.data;
    if (!attendus.delete(cle)) return;   // planche oubliée entre-temps
    if (a) prets.set(cle, { w, h, a });
  });
  // fil qui ne démarre pas (navigateur, réglage de sécurité) : on revient à l'ancien calcul
  fil?.addEventListener('error', () => { fil?.terminate(); fil = null; attendus.clear(); });
  return fil;
}

/** Demande le masque de la planche `cle` (fichier déjà téléchargé, ou son adresse). Sans fil possible : rien, l'ancien calcul servira. */
export function demander(cle: string, src: Blob | string) {
  if (prets.has(cle) || attendus.has(cle)) return;
  const f = ouvrir();
  if (!f) return;
  attendus.add(cle);
  f.postMessage({ cle, src: typeof src === 'string' ? new URL(src, location.href).href : src, pas: PAS });
}
/** Masque prêt, 'attente' s'il est en cours de calcul, undefined si personne ne l'a demandé. */
export function masque(cle: string): Masque | 'attente' | undefined {
  return prets.get(cle) ?? (attendus.has(cle) ? 'attente' : undefined);
}
/** Planche retirée (carte déchargée). */
export function oublier(cle: string) { prets.delete(cle); attendus.delete(cle); }
