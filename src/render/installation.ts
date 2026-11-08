/** Jeu installable comme application (Chrome / Edge sur PC) : manifest.webmanifest + public/sw.js.
 *  Le service worker ne met rien en cache (toujours la dernière version) ; ici on l'enregistre et on garde
 *  l'invitation du navigateur pour le bouton « Installer le jeu » de l'accueil. */
interface InvitationInstall extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let invitation: InvitationInstall | null = null;
const abonnes = new Set<() => void>();
const prevenir = () => abonnes.forEach(f => f());

/** Déjà ouvert comme application installée (fenêtre à part, sans barre d'adresse). */
export const dansApplication = () => matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: window-controls-overlay)').matches;
/** Le navigateur propose l'installation (pas encore installé, Chrome / Edge). */
export const installable = () => !!invitation && !dansApplication();
/** Prévenu quand l'installation devient possible ou ne l'est plus. */
export const surChangement = (f: () => void) => { abonnes.add(f); return () => abonnes.delete(f); };

/** Ouvre la fenêtre d'installation du navigateur. Renvoie true si le joueur a installé. */
export async function installer(): Promise<boolean> {
  const inv = invitation; if (!inv) return false;
  invitation = null; prevenir();   // une invitation ne sert qu'une fois
  await inv.prompt();
  return (await inv.userChoice).outcome === 'accepted';
}

export function preparerInstallation() {
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); invitation = e as InvitationInstall; prevenir(); });
  addEventListener('appinstalled', () => { invitation = null; prevenir(); });
  // seulement sur le site publié (en dév, Vite recharge tout seul)
  if (import.meta.env.PROD && 'serviceWorker' in navigator && isSecureContext)
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* pas installable, le jeu marche quand même */ }));
}
