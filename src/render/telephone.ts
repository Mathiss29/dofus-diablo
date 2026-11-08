// Écran léger pour téléphone et tablette (maquette « Accueil : » 7A) : Diablofus se joue au clavier et à la souris.
// Il s'affiche tout de suite, sans charger le jeu : présentation, lien à copier pour le PC, Discord.
// « Continuer quand même » charge le jeu comme sur PC (retenu pour la session).
import { v } from './assetUrl';
import { DISCORD_INVITATION } from './liens';

const CLE = 'diablofus.telephone';
const ADRESSE = 'https://diablofus.com';

/** Vrai sur un appareil tactile sans souris ni pavé tactile (téléphone, tablette), si on n'a pas déjà choisi de continuer. */
export function surTelephone(): boolean {
  try { if (sessionStorage.getItem(CLE)) return false; } catch { /* stockage bloqué */ }
  if (/test|cra|astrub|jeu/.test(location.hash)) return false;
  return matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
}

/** Montre l'écran ; continuer() lance le jeu quand le joueur insiste. */
export function ecranTelephone(continuer: () => void) {
  document.getElementById('chargement')?.setAttribute('hidden', '');
  const st = document.createElement('style');
  st.textContent = `
#tel{position:fixed;inset:0;z-index:60;overflow:auto;background:radial-gradient(ellipse at 50% 30%,#232619,#12141b 70%);color:#e8e2d4;font-family:Lexend,Nunito,system-ui,sans-serif;
  display:flex;flex-direction:column;align-items:center;gap:18px;text-align:center;padding:max(28px,env(safe-area-inset-top)) max(20px,env(safe-area-inset-right)) max(28px,env(safe-area-inset-bottom)) max(20px,env(safe-area-inset-left));box-sizing:border-box}
#tel img{width:min(82vw,420px);height:auto;filter:drop-shadow(0 8px 18px #000c)}
#tel h1{margin:0;font:400 clamp(20px,6vw,28px)/1.2 Rowdies,Lexend,system-ui,sans-serif;max-width:22em;text-wrap:balance}
#tel h1 em{font-style:normal;color:#b9e54b}
#tel p{margin:0;max-width:26em;font-size:15px;line-height:1.55;color:#cfc8b0}
#tel p b{color:#ffc14d}
#tel .pastilles{display:flex;flex-wrap:wrap;justify-content:center;gap:6px}
#tel .pastilles span{font-size:12px;font-weight:600;color:#d7ecb0;border:1px solid #4d5a2c;border-radius:20px;padding:3px 10px;background:#1a1d10cc}
#tel .b{all:unset;box-sizing:border-box;cursor:pointer;width:min(100%,360px);border-radius:10px;padding:14px;font:400 18px Rowdies,Lexend,system-ui,sans-serif;text-align:center}
#tel .copier{background:linear-gradient(#d3f46f,#a2d332);color:#1d2a06;box-shadow:0 3px 0 #5d7d14}
#tel .discord{background:#5865f2;color:#fff;box-shadow:0 3px 0 #2f3699;font-size:16px}
#tel .adresse{font:600 15px ui-monospace,Menlo,monospace;color:#ffc14d;user-select:all;-webkit-user-select:all}
#tel .plus{all:unset;cursor:pointer;color:#a7a28a;font-size:14px;text-decoration:underline;text-underline-offset:3px;margin-top:4px}
#tel .b:focus-visible,#tel .plus:focus-visible{outline:2px solid #b9e54b;outline-offset:3px}`;
  document.head.appendChild(st);
  const d = document.createElement('div'); d.id = 'tel';
  d.innerHTML = `<img src="${v('assets/logo/logo.webp')}" alt="Diablofus : Les Douze Enfers">
    <h1>Un action-RPG <em>en temps réel</em> dans le Monde des Douze.</h1>
    <div class="pastilles"><span>Gratuit</span><span>Dans le navigateur</span><span>Sans téléchargement</span></div>
    <p>Diablofus <b>se joue sur PC</b>, au clavier et à la souris. Ouvre cette adresse sur ton ordinateur :</p>
    <div class="adresse">diablofus.com</div>
    <button type="button" class="b copier">Copier le lien</button>
    <a class="b discord" href="${DISCORD_INVITATION}" target="_blank" rel="noopener">Rejoindre le Discord</a>
    <p style="font-size:13px;color:#8e8a78">Sur Discord, tu peux suivre les nouveautés et poser tes questions en attendant.</p>
    <button type="button" class="plus">Continuer quand même</button>`;
  document.body.appendChild(d);
  const copier = d.querySelector<HTMLButtonElement>('.copier')!;
  copier.onclick = () => {
    const fait = () => { copier.textContent = 'Lien copié'; setTimeout(() => { copier.textContent = 'Copier le lien'; }, 2000); };
    navigator.clipboard?.writeText(ADRESSE).then(fait, () => {
      const r = document.createRange(); r.selectNodeContents(d.querySelector('.adresse')!); const s = getSelection(); s?.removeAllRanges(); s?.addRange(r);
      copier.textContent = 'Adresse sélectionnée';
    }) ?? fait();
  };
  d.querySelector<HTMLButtonElement>('.plus')!.onclick = () => {
    try { sessionStorage.setItem(CLE, '1'); } catch { /* rien */ }
    d.remove(); st.remove();
    document.getElementById('chargement')?.removeAttribute('hidden');
    continuer();
  };
}
