/** Partie de test (maquette « Panneau test » 10B) : les erreurs du jeu, notées pour les voir dans le panneau (onglet Debug)
 *  et les joindre au rapport de bug (10A). Seulement en partie de test : la partie normale n'écoute rien. */
export interface ErreurNotee { t: string; msg: string; n: number }

const MAX = 30;
export const ERREURS: ErreurNotee[] = [];
const auditeurs = new Set<() => void>();
let branche = false;

export function noterErreur(msg: string) {
  msg = msg.replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!msg) return;
  const der = ERREURS[ERREURS.length - 1];
  if (der && der.msg === msg) der.n++;   // la même erreur à chaque image : une seule ligne, avec le compte
  else { ERREURS.push({ t: new Date().toLocaleTimeString('fr-FR'), msg, n: 1 }); if (ERREURS.length > MAX) ERREURS.shift(); }
  for (const f of auditeurs) f();
}
export function ecouterErreurs(f: () => void): () => void { auditeurs.add(f); return () => auditeurs.delete(f); }
export function viderErreurs() { ERREURS.length = 0; for (const f of auditeurs) f(); }

const texte = (x: unknown) => {
  if (x instanceof Error) return x.message;
  if (typeof x === 'string') return x;
  try { return JSON.stringify(x) ?? String(x); } catch { return String(x); }
};
export function brancherErreurs() {
  if (branche) return;
  branche = true;
  window.addEventListener('error', e => noterErreur(`${e.message}${e.filename ? ` (${e.filename.split('/').pop()}:${e.lineno})` : ''}`));
  window.addEventListener('unhandledrejection', e => { const r = e.reason as { message?: string } | undefined; noterErreur(`Promesse : ${r?.message ?? String(r)}`); });
  const ce = console.error.bind(console);
  console.error = (...a: unknown[]) => { noterErreur(a.map(texte).join(' ')); ce(...a); };
}
