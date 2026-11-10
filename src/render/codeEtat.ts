/** Code d'état de la partie de test (maquette « Panneau test » 8B) : tout le perso de test (classe, niveau, sac, Dofus, quêtes, lieu,
 *  réglages) en un texte à copier-coller, pour envoyer un état à un testeur ou montrer un bug dans le même état.
 *  JSON compressé (deflate) puis en base64 sans caractères gênants, précédé de « DF1. ». */
const PREFIXE = 'DF1.';

async function flux(data: Uint8Array, t: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([data as BlobPart]).stream().pipeThrough(t));
  return new Uint8Array(await out.arrayBuffer());
}
const b64 = (u: Uint8Array) => { let s = ''; for (const c of u) s += String.fromCharCode(c); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const deB64 = (s: string) => { const t = atob(s.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(t, c => c.charCodeAt(0)); };

export async function encoderEtat(etat: unknown): Promise<string> {
  const z = await flux(new TextEncoder().encode(JSON.stringify(etat)), new CompressionStream('deflate-raw'));
  return PREFIXE + b64(z);
}
/** null : ce n'est pas un code d'état (mal copié, autre texte). */
export async function decoderEtat<T>(code: string): Promise<T | null> {
  const c = code.replace(/\s+/g, '');
  if (!c.startsWith(PREFIXE)) return null;
  try {
    const u = await flux(deB64(c.slice(PREFIXE.length)), new DecompressionStream('deflate-raw'));
    return JSON.parse(new TextDecoder().decode(u)) as T;
  } catch { return null; }
}
