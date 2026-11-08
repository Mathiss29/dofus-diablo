// Fenêtre Social façon Dofus 3 (maquette « Social : 1A+1B 2A… 7A+7B+7C … 9A ») : onglets Amis, Discord, Groupe, Ignorés.
// Onglet Groupe (jouer à plusieurs avec son perso en ligne ; la partie tourne sur le serveur, qui lit et sauve le perso du
// compte) et onglet Discord (joueurs connectés, invitation). Amis et Ignorés viennent ensuite. Touche Social (P).
import { GAME_DATA } from '../sim/data';
import type { World } from '../sim/world';
import { classeDe } from '../sim/miroir';
import { Coop } from './coop';
import { Compte } from './compte';
import { lirePersos } from './persos';
import { EnLigne } from './presence';

export const SOCIAL_CSS = `.dw .win.social{width:440px}
.dw .soc{padding:8px 14px 14px;display:flex;flex-direction:column;gap:10px}
.dw .soc-t{display:flex;gap:4px}
.dw .soc-t span{flex:1;text-align:center;padding:6px 0;border-radius:3px;background:#2e2d28;border:1px solid #45433b;font-weight:bold;color:#d8d2bf;font-size:13px}
.dw .soc-t span.on{background:linear-gradient(#6f9a2a,#4c6e17);border-color:#b9e54b;color:#fff}
.dw .soc-t span.off{opacity:.45;cursor:default}
.dw .soc p{margin:0;font-size:13px;line-height:1.45;color:#d8d2bf}
.dw .soc .note{font-size:12px;color:#a99d86}
.dw .soc .err{color:#ff9a5a;font-size:13px}
.dw .soc .code{display:flex;align-items:center;justify-content:space-between;background:#0005;border:1px solid #45433b;border-radius:4px;padding:8px 12px}
.dw .soc .code b{font:22px Rowdies,serif;letter-spacing:4px;color:#ffd27a;user-select:all}
.dw .soc .rej{display:flex;gap:6px}
.dw .soc .rej input{flex:1;background:#0008;border:1px solid #5b5844;border-radius:3px;color:#f1ecd8;font:inherit;font-size:14px;padding:5px 8px;text-transform:uppercase;letter-spacing:2px}
.dw .soc .mbr{display:grid;grid-template-columns:34px 1fr auto;gap:8px;align-items:center;background:#00000040;border-radius:4px;padding:5px 8px}
.dw .soc .mbr img{width:30px;height:30px;object-fit:contain}
.dw .soc .mbr small{display:block;color:#a99d86;font-size:11px}
.dw .soc .mbr .pv{width:90px;height:8px;background:#2b2b2e;border-radius:3px;overflow:hidden}
.dw .soc .mbr .pv i{display:block;height:100%;background:#e0443a}
.dw .soc .moi{outline:1px solid #b9e54b66}
.dw .soc .bas{display:flex;justify-content:flex-end;gap:6px}
.dw .soc .gris{background:linear-gradient(#5a5850,#3d3c36);border-color:#8a8676}`;

/** Ce que la scène prête à la fenêtre : l'emplacement du perso joué (-1 : pas un perso du navigateur ni du compte). */
export interface ContexteSocial { world: World; slot: number; test: boolean; fermer(): void; refaire(): void }

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Membres du groupe : les joueurs de la partie (chez l'invité, le monde est celui du serveur). */
function membres(w: World) {
  return w.players.map(p => ({ p, moi: p === w.player, cls: classeDe(w, p) }));
}

/** Onglet ouvert (gardé d'une ouverture à l'autre), et joueur à inviter dès que son groupe existe. */
let onglet: 'groupe' | 'discord' = 'groupe';
let aInviter: number | null = null;
Coop.ecouter(() => {
  if (aInviter != null && Coop.etat === 'salon' && Coop.serveur) { EnLigne.inviter(aInviter); aInviter = null; }
  else if (Coop.etat === 'hors') aInviter = null;
});

/** Chaque seconde, fenêtre ouverte : la liste des membres du groupe, et celle des joueurs en ligne toutes les 3 s. */
let tic = 0;
export function tickSocial(win: HTMLDivElement, c: ContexteSocial) {
  if (onglet === 'discord') { if (tic++ % 3 === 0) EnLigne.demanderEnLigne(); }
  else if (Coop.etat === 'salon') majMembres(win, c);
}

export function rendreSocial(win: HTMLDivElement, titre: string, c: ContexteSocial) {
  const tab = (k: string, n: string) => k ? `<span class="${onglet === k ? 'on' : ''}" data-soc-o="${k}" style="cursor:pointer">${n}</span>` : `<span class="off" title="Bientôt">${n}</span>`;
  win.innerHTML = `${titre}<div class="soc"><div class="soc-t">${tab('', 'Amis')}${tab('discord', 'Discord')}${tab('groupe', 'Groupe')}${tab('', 'Ignorés')}</div>
    ${onglet === 'discord' ? discord(c) : groupe(c)}</div>`;
  const $ = <T extends HTMLElement>(s: string) => win.querySelector<T>(s);
  win.querySelectorAll<HTMLElement>('[data-soc-o]').forEach(e => e.addEventListener('click', () => {
    onglet = e.dataset.socO as 'groupe' | 'discord';
    if (onglet === 'discord') EnLigne.demanderEnLigne();
    c.refaire();
  }));
  const compte = () => (c.slot >= 0 && Compte.jeton ? { jeton: Compte.jeton, emplacement: c.slot } : null);
  $('[data-soc-creer]')?.addEventListener('click', () => Coop.creer(true, compte()));
  const rej = () => { const v = $<HTMLInputElement>('[data-soc-code]')?.value ?? ''; if (v.trim()) Coop.rejoindre(v, compte()); };
  $('[data-soc-rejoindre]')?.addEventListener('click', rej);
  $<HTMLInputElement>('[data-soc-code]')?.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') rej(); });
  $('[data-soc-quitter]')?.addEventListener('click', () => Coop.quitter());
  $('[data-soc-copier]')?.addEventListener('click', () => { void navigator.clipboard?.writeText(Coop.code ?? '').catch(() => {}); });
  // 7A : inviter un joueur ; sans groupe, on en crée un (on part dans la Crypte) et l'invitation part dès qu'il existe
  win.querySelectorAll<HTMLElement>('[data-soc-inviter]').forEach(e => e.addEventListener('click', () => {
    const id = Number(e.dataset.socInviter);
    if (Coop.etat === 'salon' && Coop.serveur) EnLigne.inviter(id);
    else if (Coop.etat === 'hors') { aInviter = id; Coop.creer(true, compte()); }
  }));
}
/** Onglet Discord (« Social : » 1B) : les joueurs connectés avec leur perso en ligne, sans avoir à les ajouter. */
function discord(c: ContexteSocial): string {
  if (c.test || !Compte.enLigne || c.slot < 0) return `<p>Connecte-toi avec Discord et joue un perso <b>« En ligne »</b> pour voir les autres joueurs.</p>`;
  if (!EnLigne.connecte) return '<p class="note">Connexion au serveur…</p>';
  const L = EnLigne.enLigne;
  if (!L.length) return '<p>Personne d\'autre n\'est en ligne pour l\'instant.</p>';
  const lieu = (z: string) => z === '__groupe' ? 'en donjon de groupe' : GAME_DATA.zones[z]?.name ?? z;
  const peutInviter = !lirePersos()[c.slot]?.hardcore && (!Compte.infos || Compte.infos.testeur);
  return `<p class="note">${L.length} joueur${L.length > 1 ? 's' : ''} en ligne. Au Bastion des Douze, vous vous croisez.</p>
    <div style="display:flex;flex-direction:column;gap:6px;max-height:340px;overflow:auto">${L.map(j => {
      const cls = GAME_DATA.classes[j.classe] ? j.classe : 'iop';
      return `<div class="mbr"><img src="assets/accueil/c_${cls}.png" alt="">
        <div><b>${esc(j.nom)}</b><small>${GAME_DATA.classes[cls].name} · niveau ${j.niveau} · ${esc(lieu(j.zone))}</small></div>
        ${peutInviter && !j.groupe ? `<span class="btn" data-soc-inviter="${j.id}" title="L'inviter dans ton groupe">Inviter</span>` : j.groupe ? '<small>en groupe</small>' : '<span></span>'}</div>`;
    }).join('')}</div>`;
}

/** Invitation reçue (7A) : une petite carte en haut de l'écran, Rejoindre ou Non (elle s'en va seule au bout de 30 s). */
export function montrerInvitation(de: string, rejoindre: () => void) {
  document.querySelector('.invitation-groupe')?.remove();
  const d = document.createElement('div');
  d.className = 'invitation-groupe';
  d.style.cssText = 'position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:40;background:#1b1a16f2;border:1px solid #b9e54b;border-radius:6px;padding:10px 14px;display:flex;gap:10px;align-items:center;font:14px Lexend,sans-serif;color:#f4efe0;box-shadow:0 8px 30px #000a';
  d.innerHTML = `<span><b>${esc(de)}</b> t'invite dans son groupe</span>`;
  const bouton = (t: string, vert: boolean, f: () => void) => {
    const b = document.createElement('button'); b.textContent = t;
    b.style.cssText = `cursor:pointer;border-radius:3px;padding:5px 12px;font-weight:bold;color:#fff;border:1px solid ${vert ? '#b9e54b' : '#8a8676'};background:${vert ? 'linear-gradient(#6f9a2a,#4c6e17)' : 'linear-gradient(#5a5850,#3d3c36)'}`;
    b.addEventListener('click', () => { d.remove(); f(); }); b.addEventListener('pointerdown', e => e.stopPropagation());
    d.appendChild(b);
  };
  bouton('Rejoindre', true, () => { if (Coop.etat === 'salon') Coop.quitter(); rejoindre(); });
  bouton('Non', false, () => {});
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 30_000);
}

function groupe(c: ContexteSocial): string {
  if (c.test) return `<p>Dans la partie de test, le jeu à plusieurs se règle dans F1 › Monstres › Jouer à plusieurs.</p>`;
  if (!Compte.enLigne || c.slot < 0) return `<p>Pour jouer à plusieurs, <b>connecte-toi avec Discord</b> et choisis tes persos <b>« En ligne »</b> sur l'écran d'accueil : ton perso vient avec toi et garde son butin et son XP.</p>`;
  if (lirePersos()[c.slot]?.hardcore) return `<p>Les persos <b>Hardcore</b> ne jouent pas encore à plusieurs : dans le groupe, un joueur à terre se relève, ce qui n'irait pas avec leur règle.</p>`;
  if (Compte.infos && !Compte.infos.testeur) return `<p>L'essai à plusieurs est réservé aux <b>testeurs</b> du Discord pour l'instant.</p>`;
  const co = Coop;
  if (co.etat === 'connexion') return '<p class="note">Connexion au serveur…</p>';
  if (co.etat === 'salon') return `<div class="code"><span>Code du groupe</span><b>${esc(co.code ?? '')}</b><span class="btn gris" data-soc-copier title="Copier le code">Copier</span></div>
      <p class="note">Tes amis ouvrent Social › Groupe et tapent ce code (4 joueurs au plus). La partie tourne sur le serveur : chacun peut partir sans couper les autres.</p>
      <div class="mbrs" style="display:flex;flex-direction:column;gap:6px">${listeMembres(c)}</div>
      <div class="bas"><span class="btn gris" data-soc-quitter>Quitter le groupe</span></div>`;
  return `${co.erreur ? `<p class="err">${esc(co.erreur)}</p>` : ''}
    <p>Premier essai : un <b>donjon de groupe</b> dans l'arène de la Crypte de Kardorim, de 2 à 4 joueurs. Ton perso y garde son butin et son XP, et tu reviens là où tu étais en quittant.</p>
    <div class="bas" style="justify-content:flex-start"><span class="btn" data-soc-creer>Créer un groupe</span></div>
    <div class="rej"><input type="text" maxlength="5" placeholder="Code d'un ami" autocomplete="off" data-soc-code><span class="btn gris" data-soc-rejoindre>Rejoindre</span></div>`;
}

/** Membres du groupe et leur vie : redessinés seuls toutes les secondes (le reste de la fenêtre ne bouge pas, les clics tiennent). */
function listeMembres(c: ContexteSocial): string {
  const L = Coop.miroir ? membres(c.world) : [];
  if (!L.length) return '<p class="note">Arrivée dans la partie…</p>';
  return L.map(({ p, moi, cls }) => {
    const nom = p.nom || GAME_DATA.classes[cls].name, pv = Math.max(0, Math.min(1, p.hp / (p.maxHp || 1)));
    return `<div class="mbr ${moi ? 'moi' : ''}"><img src="assets/accueil/c_${cls}.png" alt="">
      <div><b>${esc(nom)}</b>${moi ? ' (toi)' : ''}<small>${GAME_DATA.classes[cls].name} · niveau ${p.level}${p.dead ? ' · à terre' : ''}</small></div>
      <div class="pv" title="${Math.ceil(p.hp)} / ${p.maxHp} PV"><i style="width:${(pv * 100).toFixed(0)}%"></i></div></div>`;
  }).join('');
}
export function majMembres(win: HTMLDivElement, c: ContexteSocial) {
  const m = win.querySelector<HTMLElement>('.soc .mbrs');
  if (m) { const h = listeMembres(c); if (m.innerHTML !== h) m.innerHTML = h; }
}
