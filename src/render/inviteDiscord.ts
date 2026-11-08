// Invitation au Discord à la fin du tutoriel (maquette « Accueil : », idée B) : une seule fois par navigateur,
// une petite carte en haut de l'écran, qui se ferme d'elle-même.
import { DISCORD_INVITATION } from './liens';

const CLE = 'diablofus.inviteDiscord';

export function inviterDiscord() {
  try { if (localStorage.getItem(CLE)) return; localStorage.setItem(CLE, '1'); } catch { return; }
  const d = document.createElement('div');
  d.setAttribute('role', 'status');
  d.style.cssText = 'position:fixed;left:50%;top:14vh;transform:translateX(-50%);z-index:30;display:flex;gap:14px;align-items:center;'
    + 'background:#1d1e15f2;border:1px solid #45452f;border-radius:10px;padding:12px 16px;box-shadow:0 6px 18px #000a;'
    + 'font:600 14px Lexend,Nunito,system-ui,sans-serif;color:#f1ecd8;transition:opacity .4s';
  d.innerHTML = `<span><b style="font:400 17px Rowdies,Lexend,sans-serif;color:#b9e54b">Tutoriel terminé !</b><br>Tu as aimé ? Rejoins les autres aventuriers sur Discord.</span>
    <a href="${DISCORD_INVITATION}" target="_blank" rel="noopener" style="background:#5865f2;color:#fff;text-decoration:none;border-radius:6px;padding:8px 12px;white-space:nowrap">Rejoindre le Discord</a>
    <button type="button" aria-label="Fermer" style="all:unset;cursor:pointer;color:#c9c4ab;font-size:18px;padding:0 4px">✕</button>`;
  // les clics sur la carte ne vont pas au jeu derrière
  for (const ev of ['pointerdown', 'pointerup', 'wheel'] as const) d.addEventListener(ev, e => e.stopPropagation());
  const fermer = () => { d.style.opacity = '0'; setTimeout(() => d.remove(), 400); };
  d.querySelector('button')!.onclick = fermer;
  d.querySelector('a')!.addEventListener('click', () => setTimeout(fermer, 200));
  document.body.appendChild(d);
  setTimeout(fermer, 15000);
}
