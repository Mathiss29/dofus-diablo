// Fenêtre Social façon Dofus 3 (maquette « Social : 1A+1B 2A… 7A+7B+7C … 9A ») : onglets Amis, Discord, Groupe, Ignorés.
// Onglet Groupe (jouer à plusieurs avec son perso en ligne ; la partie tourne sur le serveur, qui lit et sauve le perso du
// compte), onglet Discord (joueurs connectés, invitation), Amis (demandes, en ligne, vie privée) et Ignorés. Touche Social (P).
// Clic droit sur un joueur (listes, chat, passant du Bastion) : son menu (6A).
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
.dw .soc .gris,.dw .soc .btn.gris{background:linear-gradient(#5a5850,#3d3c36);border-color:#8a8676;color:#f1ecd8}
.dw .soc .liste{display:flex;flex-direction:column;gap:6px;max-height:300px;overflow:auto}
.dw .soc .mbr .act{display:flex;gap:4px;align-items:center}
.dw .soc .mbr .btn.mini{padding:3px 7px;font-size:11px;min-width:0}
.dw .soc .hors{opacity:.55}
.dw .soc .titre{font-size:12px;color:#a99d86;text-transform:uppercase;letter-spacing:1px;margin-top:2px}
.dw .soc label.case{display:flex;gap:8px;align-items:center;font-size:12px;color:#d8d2bf;cursor:pointer}
.dw .soc label.case input{all:revert;width:15px;height:15px;margin:0;flex:none;accent-color:#6f9a2a;cursor:pointer}
.dw .soc .rej input.nom{text-transform:none;letter-spacing:0}
.menu-joueur{position:fixed;z-index:60;background:#1b1a16f4;border:1px solid #6f6a5a;border-radius:5px;padding:4px;font:13px Lexend,sans-serif;color:#f4efe0;box-shadow:0 8px 24px #000b;min-width:170px}
.menu-joueur b{display:block;padding:4px 8px 6px;color:#ffd27a;border-bottom:1px solid #45433b;margin-bottom:3px}
.menu-joueur div{padding:5px 8px;border-radius:3px;cursor:pointer}
.menu-joueur div:hover{background:#4c6e17}`;

/** Ce que la scène prête à la fenêtre : l'emplacement du perso joué (-1 : pas un perso du navigateur ni du compte). */
export interface ContexteSocial { world: World; slot: number; test: boolean; fermer(): void; refaire(): void }

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Membres du groupe : les joueurs de la partie (chez l'invité, le monde est celui du serveur). */
function membres(w: World) {
  return w.players.map(p => ({ p, moi: p === w.player, cls: classeDe(w, p) }));
}

/** Onglet ouvert (gardé d'une ouverture à l'autre), et donjon à annoncer au groupe dès que sa partie existe. */
type Onglet = 'amis' | 'groupe' | 'discord' | 'ignores';
let onglet: Onglet = 'groupe';
let aAnnoncer = false;
const DONJON = 'Crypte de Kardorim';
Coop.ecouter(() => {
  if (aAnnoncer && Coop.etat === 'salon' && Coop.serveur && Coop.code) { EnLigne.annoncerDonjon(Coop.code, DONJON); aAnnoncer = false; }
  else if (Coop.etat === 'hors') aAnnoncer = false;
});

/** Peut-on inviter avec le perso joué ? (pas en Hardcore, testeurs seulement pendant l'essai fermé) */
function peutInviter() {
  const n = EnLigne.emplacement;
  return n >= 0 && !lirePersos()[n]?.hardcore && (!Compte.infos || Compte.infos.testeur);
}
/** Inviter un joueur (7A) : dans mon groupe, créé au besoin par le serveur ; personne ne bouge (choix de Mathis, 2026-11-08). */
export function inviterJoueur(id: number) {
  if (!peutInviter()) { EnLigne.onInfo('Tu ne peux pas encore jouer en groupe avec ce perso'); return; }
  EnLigne.inviter(id);
}
/** Menu d'un joueur (« Social : » 6A) : clic droit sur son nom ou sur son perso. */
export function menuJoueur(x: number, y: number, j: { id: number; nom: string }) {
  document.querySelector('.menu-joueur')?.remove();
  if (!document.getElementById('menu-joueur-css')) {
    const st = document.createElement('style'); st.id = 'menu-joueur-css'; st.textContent = SOCIAL_CSS.slice(SOCIAL_CSS.indexOf('.menu-joueur')); document.head.appendChild(st);
  }
  const ami = EnLigne.amis?.amis.some(a => a.id === j.id), ignore = EnLigne.amis?.ignores.some(a => a.id === j.id);
  const d = document.createElement('div'); d.className = 'menu-joueur';
  const actions: [string, () => void][] = [
    ...(peutInviter() ? [['Inviter dans le groupe', () => inviterJoueur(j.id)] as [string, () => void]] : []),
    ['Chuchoter', () => EnLigne.chuchoter(j.nom)],
    ...(ami ? [] : [['Ajouter en ami', () => EnLigne.ajouterAmi(j.id)] as [string, () => void]]),
    ignore ? ['Ne plus ignorer', () => EnLigne.retirer(j.id)] : ['Ignorer', () => EnLigne.ignorer(j.id, j.nom)],
  ];
  d.innerHTML = `<b>${esc(j.nom)}</b>` + actions.map((a, i) => `<div data-i="${i}">${a[0]}</div>`).join('');
  const fermer = () => { d.remove(); window.removeEventListener('pointerdown', dehors, true); };
  const dehors = (e: PointerEvent) => { if (!d.contains(e.target as Node)) fermer(); };
  d.querySelectorAll<HTMLElement>('[data-i]').forEach(e => e.addEventListener('click', () => { fermer(); actions[+e.dataset.i!][1](); }));
  d.addEventListener('pointerdown', e => e.stopPropagation());
  d.addEventListener('contextmenu', e => e.preventDefault());
  document.body.appendChild(d);
  d.style.left = Math.min(x, window.innerWidth - d.offsetWidth - 8) + 'px';
  d.style.top = Math.min(y, window.innerHeight - d.offsetHeight - 8) + 'px';
  setTimeout(() => window.addEventListener('pointerdown', dehors, true));
}

/** Chaque seconde, fenêtre ouverte : la liste des membres du groupe ; celle des joueurs en ligne ou des amis toutes les 3 s. */
let tic = 0;
export function tickSocial(win: HTMLDivElement, c: ContexteSocial) {
  if (onglet === 'discord') { if (tic++ % 3 === 0) EnLigne.demanderEnLigne(); }
  else if (onglet === 'amis') { if (tic++ % 3 === 0) EnLigne.demanderAmis(); }
  else if (onglet === 'groupe' && Coop.etat === 'salon') majMembres(win, c);
}
/** Nombre de demandes d'ami en attente (pastille sur le bouton Social, 5B). */
export function demandesEnAttente() { return EnLigne.amis?.recues.length ?? 0; }

export function rendreSocial(win: HTMLDivElement, titre: string, c: ContexteSocial) {
  const n = demandesEnAttente();
  const tab = (k: Onglet, t: string) => `<span class="${onglet === k ? 'on' : ''}" data-soc-o="${k}" style="cursor:pointer">${t}</span>`;
  win.innerHTML = `${titre}<div class="soc"><div class="soc-t">${tab('amis', n ? `Amis (${n})` : 'Amis')}${tab('discord', 'Discord')}${tab('groupe', 'Groupe')}${tab('ignores', 'Ignorés')}</div>
    ${onglet === 'discord' ? discord(c) : onglet === 'amis' ? amis(c) : onglet === 'ignores' ? ignores(c) : groupe(c)}</div>`;
  const $ = <T extends HTMLElement>(s: string) => win.querySelector<T>(s);
  win.querySelectorAll<HTMLElement>('[data-soc-o]').forEach(e => e.addEventListener('click', () => {
    onglet = e.dataset.socO as Onglet;
    if (onglet === 'discord') EnLigne.demanderEnLigne();
    if (onglet === 'amis' || onglet === 'ignores') EnLigne.demanderAmis();
    c.refaire();
  }));
  // amis et ignorés
  const champ = $<HTMLInputElement>('[data-soc-nom]');
  const ajouter = () => { const v = champ?.value.trim(); if (!v) return; if (onglet === 'ignores') EnLigne.ignorer(v); else EnLigne.ajouterAmi(v); champ!.value = ''; };
  champ?.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') ajouter(); });
  champ?.addEventListener('keyup', e => e.stopPropagation());
  $('[data-soc-ajouter]')?.addEventListener('click', ajouter);
  const chaque = (sel: string, f: (e: HTMLElement) => void) => win.querySelectorAll<HTMLElement>(sel).forEach(e => e.addEventListener('click', () => f(e)));
  chaque('[data-soc-exclure]', e => EnLigne.exclure(Number(e.dataset.socExclure)));
  chaque('[data-soc-chef]', e => EnLigne.passerChef(Number(e.dataset.socChef)));
  chaque('[data-soc-accepter]', e => EnLigne.ajouterAmi(Number(e.dataset.socAccepter)));
  chaque('[data-soc-retirer]', e => EnLigne.retirer(Number(e.dataset.socRetirer)));
  chaque('[data-soc-chu]', e => { c.fermer(); EnLigne.chuchoter(e.dataset.socChu!); });
  win.querySelectorAll<HTMLInputElement>('[data-soc-prive]').forEach(e => e.addEventListener('change', () => {
    const v = (k: string) => !!win.querySelector<HTMLInputElement>(`[data-soc-prive="${k}"]`)?.checked;
    EnLigne.reglerSocial(v('horsLigne'), v('inconnus'));
  }));
  // clic droit sur un joueur des listes : son menu (6A)
  win.querySelectorAll<HTMLElement>('[data-joueur]').forEach(e => e.addEventListener('contextmenu', ev => {
    ev.preventDefault(); menuJoueur(ev.clientX, ev.clientY, { id: Number(e.dataset.joueur), nom: e.dataset.nom ?? '' });
  }));
  const compte = () => (c.slot >= 0 && Compte.jeton ? { jeton: Compte.jeton, emplacement: c.slot } : null);
  $('[data-soc-creer]')?.addEventListener('click', () => EnLigne.creerGroupe());
  // le chef lance le donjon (partie tenue par le serveur) ; les autres reçoivent « Rejoindre »
  $('[data-soc-donjon]')?.addEventListener('click', () => { aAnnoncer = true; Coop.creer(true, compte()); });
  $('[data-soc-rejoindre-donjon]')?.addEventListener('click', () => { const d = EnLigne.groupe?.donjon; if (d) Coop.rejoindre(d, compte()); });
  $('[data-soc-quitter-grp]')?.addEventListener('click', () => EnLigne.quitterGroupe());
  const rej = () => { const v = $<HTMLInputElement>('[data-soc-code]')?.value ?? ''; if (v.trim()) Coop.rejoindre(v, compte()); };
  $('[data-soc-rejoindre]')?.addEventListener('click', rej);
  $<HTMLInputElement>('[data-soc-code]')?.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') rej(); });
  $('[data-soc-quitter]')?.addEventListener('click', () => Coop.quitter());
  $('[data-soc-copier]')?.addEventListener('click', () => { void navigator.clipboard?.writeText(Coop.code ?? '').catch(() => {}); });
  // 7A : inviter un joueur ; sans groupe, on en crée un (on part dans la Crypte) et l'invitation part dès qu'il existe
  chaque('[data-soc-inviter]', e => inviterJoueur(Number(e.dataset.socInviter)));
}
const lieu = (z: string) => z === '__groupe' ? 'en donjon de groupe' : GAME_DATA.zones[z]?.name ?? z;
const classe = (k: string) => (GAME_DATA.classes[k] ? k : 'iop');
const pasEnLigne = (c: ContexteSocial) => c.test || !Compte.enLigne || c.slot < 0;
/** Il y a combien de temps (« vu il y a 3 h »). */
function ilYa(t: number) {
  const m = Math.max(0, (Date.now() - t) / 60000);
  return m < 60 ? `${Math.max(1, Math.round(m))} min` : m < 48 * 60 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} jours`;
}
/** Onglet Amis (« Social : » 2A 2B 2C, 8A) : demandes reçues, amis en ligne puis hors ligne, demandes envoyées, vie privée. */
function amis(c: ContexteSocial): string {
  if (pasEnLigne(c)) return `<p>Connecte-toi avec Discord et joue un perso <b>« En ligne »</b> pour avoir des amis.</p>`;
  const A = EnLigne.amis;
  if (!EnLigne.connecte || !A) return '<p class="note">Connexion au serveur…</p>';
  const inv = peutInviter();
  const enLigne = A.amis.filter(a => a.perso).sort((a, b) => a.perso!.nom.localeCompare(b.perso!.nom));
  const hors = A.amis.filter(a => !a.perso).sort((a, b) => b.vu - a.vu);
  const ligne = (a: typeof A.amis[number]) => {
    const p = a.perso;
    if (!p) return `<div class="mbr hors"><img src="assets/accueil/c_iop.png" alt="" style="filter:grayscale(1)">
      <div><b>${esc(a.discord)}</b><small>Hors ligne · vu il y a ${ilYa(a.vu)}</small></div>
      <div class="act"><span class="btn mini gris" data-soc-retirer="${a.id}" title="Retirer de mes amis">✕</span></div></div>`;
    const cl = classe(p.classe);
    return `<div class="mbr" data-joueur="${a.id}" data-nom="${esc(p.nom)}"><img src="assets/accueil/c_${cl}.png" alt="">
      <div><b>${esc(p.nom)}</b> <small style="display:inline">(${esc(a.discord)})</small><small>${GAME_DATA.classes[cl].name} · niveau ${p.niveau} · ${esc(lieu(p.zone))}${p.avecMoi ? ' · dans ton groupe' : ''}</small></div>
      <div class="act">${inv && !p.groupe ? `<span class="btn mini" data-soc-inviter="${a.id}">Inviter</span>` : ''}<span class="btn mini gris" data-soc-chu="${esc(p.nom)}" title="Chuchoter">✉</span><span class="btn mini gris" data-soc-retirer="${a.id}" title="Retirer de mes amis">✕</span></div></div>`;
  };
  return `<div class="rej"><input type="text" class="nom" maxlength="40" placeholder="Nom d'un perso ou pseudo Discord" autocomplete="off" data-soc-nom><span class="btn" data-soc-ajouter>Ajouter</span></div>
    ${A.recues.length ? `<div class="titre">Demandes reçues</div><div class="liste">${A.recues.map(d => `<div class="mbr" data-joueur="${d.id}" data-nom="${esc(d.nom)}"><img src="assets/accueil/c_iop.png" alt="" style="opacity:.6">
      <div><b>${esc(d.nom)}</b><small>veut être ton ami</small></div>
      <div class="act"><span class="btn mini" data-soc-accepter="${d.id}">Accepter</span><span class="btn mini gris" data-soc-retirer="${d.id}">Refuser</span></div></div>`).join('')}</div>` : ''}
    <div class="titre">Amis (${enLigne.length} en ligne sur ${A.amis.length})</div>
    ${A.amis.length ? `<div class="liste">${enLigne.map(ligne).join('')}${hors.map(ligne).join('')}</div>` : '<p class="note">Ajoute un ami par le nom de son perso, ou clic droit sur un joueur › Ajouter en ami. Il doit accepter.</p>'}
    ${A.envoyees.length ? `<div class="titre">Demandes envoyées</div><div class="liste">${A.envoyees.map(d => `<div class="mbr"><span></span><div><b>${esc(d.nom)}</b><small>en attente</small></div>
      <div class="act"><span class="btn mini gris" data-soc-retirer="${d.id}">Annuler</span></div></div>`).join('')}</div>` : ''}
    <label class="case"><input type="checkbox" data-soc-prive="horsLigne" ${A.horsLigne ? 'checked' : ''}> Apparaître hors ligne (ni dans l'onglet Discord, ni chez mes amis)</label>
    <label class="case"><input type="checkbox" data-soc-prive="inconnus" ${A.inconnus ? 'checked' : ''}> Refuser les invitations de ceux qui ne sont pas mes amis</label>
    <p class="note">Ceux qui ne sont pas tes amis ne voient que le nom de ton perso, jamais ton pseudo Discord.</p>`;
}
/** Onglet Ignorés (2D) : leurs messages et invitations n'arrivent plus. */
function ignores(c: ContexteSocial): string {
  if (pasEnLigne(c)) return `<p>Connecte-toi avec Discord et joue un perso <b>« En ligne »</b> pour gérer ta liste.</p>`;
  const A = EnLigne.amis;
  if (!EnLigne.connecte || !A) return '<p class="note">Connexion au serveur…</p>';
  return `<div class="rej"><input type="text" class="nom" maxlength="40" placeholder="Nom d'un perso à ignorer" autocomplete="off" data-soc-nom><span class="btn" data-soc-ajouter>Ignorer</span></div>
    <p class="note">Les joueurs ignorés ne peuvent plus t'écrire, t'inviter ni te demander en ami.</p>
    ${A.ignores.length ? `<div class="liste">${A.ignores.map(d => `<div class="mbr"><span></span><div><b>${esc(d.nom)}</b></div>
      <div class="act"><span class="btn mini gris" data-soc-retirer="${d.id}">Ne plus ignorer</span></div></div>`).join('')}</div>` : '<p>Personne pour l\'instant.</p>'}`;
}
/** Onglet Discord (« Social : » 1B) : les joueurs connectés avec leur perso en ligne, sans avoir à les ajouter. */
function discord(c: ContexteSocial): string {
  if (pasEnLigne(c)) return `<p>Connecte-toi avec Discord et joue un perso <b>« En ligne »</b> pour voir les autres joueurs.</p>`;
  if (!EnLigne.connecte) return '<p class="note">Connexion au serveur…</p>';
  const L = EnLigne.enLigne;
  if (!L.length) return '<p>Personne d\'autre n\'est en ligne pour l\'instant.</p>';
  const inv = peutInviter();
  return `<p class="note">${L.length} joueur${L.length > 1 ? 's' : ''} en ligne. Au Bastion des Douze, vous vous croisez.</p>
    <div style="display:flex;flex-direction:column;gap:6px;max-height:340px;overflow:auto">${L.map(j => {
      const cls = GAME_DATA.classes[j.classe] ? j.classe : 'iop';
      return `<div class="mbr" data-joueur="${j.id}" data-nom="${esc(j.nom)}"><img src="assets/accueil/c_${cls}.png" alt="">
        <div><b>${esc(j.nom)}</b>${j.ami ? ' <small style="display:inline;color:#b9e54b">ami</small>' : ''}<small>${GAME_DATA.classes[cls].name} · niveau ${j.niveau} · ${esc(lieu(j.zone))}</small></div>
        ${inv && !j.groupe ? `<span class="btn" data-soc-inviter="${j.id}" title="L'inviter dans ton groupe">Inviter</span>` : j.groupe ? '<small>en groupe</small>' : '<span></span>'}</div>`;
    }).join('')}</div>`;
}

/** Invitation reçue (7A) ou donjon lancé par le chef : une petite carte en haut de l'écran, Rejoindre ou Non (elle s'en va
 *  seule au bout de 30 s). */
export function montrerInvitation(de: string, texte: string, rejoindre: () => void, refuser: () => void = () => {}) {
  document.querySelector('.invitation-groupe')?.remove();
  const d = document.createElement('div');
  d.className = 'invitation-groupe';
  d.style.cssText = 'position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:40;background:#1b1a16f2;border:1px solid #b9e54b;border-radius:6px;padding:10px 14px;display:flex;gap:10px;align-items:center;font:14px Lexend,sans-serif;color:#f4efe0;box-shadow:0 8px 30px #000a';
  d.innerHTML = `<span><b>${esc(de)}</b> ${esc(texte)}</span>`;
  const bouton = (t: string, vert: boolean, f: () => void) => {
    const b = document.createElement('button'); b.textContent = t;
    b.style.cssText = `cursor:pointer;border-radius:3px;padding:5px 12px;font-weight:bold;color:#fff;border:1px solid ${vert ? '#b9e54b' : '#8a8676'};background:${vert ? 'linear-gradient(#6f9a2a,#4c6e17)' : 'linear-gradient(#5a5850,#3d3c36)'}`;
    b.addEventListener('click', () => { d.remove(); f(); }); b.addEventListener('pointerdown', e => e.stopPropagation());
    d.appendChild(b);
  };
  bouton('Rejoindre', true, rejoindre);
  bouton('Non', false, refuser);
  document.body.appendChild(d);
  setTimeout(() => { if (d.isConnected) { d.remove(); refuser(); } }, 30_000);
}

function groupe(c: ContexteSocial): string {
  if (c.test) return `<p>Dans la partie de test, le jeu à plusieurs se règle dans F1 › Monstres › Jouer à plusieurs.</p>`;
  if (!Compte.enLigne || c.slot < 0) return `<p>Pour jouer à plusieurs, <b>connecte-toi avec Discord</b> et choisis tes persos <b>« En ligne »</b> sur l'écran d'accueil : ton perso vient avec toi et garde son butin et son XP.</p>`;
  if (lirePersos()[c.slot]?.hardcore) return `<p>Les persos <b>Hardcore</b> ne jouent pas encore à plusieurs : dans le groupe, un joueur à terre se relève, ce qui n'irait pas avec leur règle.</p>`;
  if (Compte.infos && !Compte.infos.testeur) return `<p>L'essai à plusieurs est réservé aux <b>testeurs</b> du Discord pour l'instant.</p>`;
  const co = Coop, G = EnLigne.groupe;
  if (co.etat === 'connexion') return '<p class="note">Connexion au serveur…</p>';
  // dans le donjon de groupe (partie tenue par le serveur) : la vie de chacun, et la sortie
  if (co.etat === 'salon') return `<p><b>Donjon de groupe</b> · ${DONJON}. La partie tourne sur le serveur : chacun peut partir sans couper les autres.</p>
      <div class="mbrs" style="display:flex;flex-direction:column;gap:6px">${listeMembres(c)}</div>
      <div class="code"><span>Code du donjon</span><b>${esc(co.code ?? '')}</b><span class="btn gris" data-soc-copier title="Copier le code">Copier</span></div>
      <div class="bas"><span class="btn gris" data-soc-quitter>Quitter le donjon</span></div>`;
  if (!EnLigne.connecte) return '<p class="note">Connexion au serveur…</p>';
  const err = co.erreur ? `<p class="err">${esc(co.erreur)}</p>` : '';
  if (!G) return `${err}<p>Crée un groupe puis invite tes amis (onglets <b>Discord</b> ou <b>Amis</b>, ou clic droit sur un joueur) : <b>chacun reste où il est</b>. Le chef lance ensuite le donjon, les autres le rejoignent.</p>
    <div class="bas" style="justify-content:flex-start"><span class="btn" data-soc-creer>Créer un groupe</span></div>
    <div class="titre">Rejoindre un donjon avec son code</div>
    <div class="rej"><input type="text" maxlength="5" placeholder="Code" autocomplete="off" data-soc-code><span class="btn gris" data-soc-rejoindre>Rejoindre</span></div>`;
  const chef = EnLigne.chef;
  const L = G.membres.map(m => {
    const cl = classe(m.classe ?? 'iop'), moi = m.id === EnLigne.moi;
    return `<div class="mbr ${moi ? 'moi' : ''} ${m.enLigne ? '' : 'hors'}" ${moi ? '' : `data-joueur="${m.id}" data-nom="${esc(m.nom)}"`}><img src="assets/accueil/c_${cl}.png" alt="">
      <div><b>${m.id === G.chef ? '♛ ' : ''}${esc(m.nom)}</b>${moi ? ' (toi)' : ''}<small>${m.enLigne ? `${GAME_DATA.classes[cl].name} · niveau ${m.niveau} · ${esc(lieu(m.zone ?? ''))}` : 'déconnecté'}</small></div>
      <div class="act">${chef && !moi ? `<span class="btn mini gris" data-soc-chef="${m.id}" title="Lui passer la couronne de chef">♛</span><span class="btn mini gris" data-soc-exclure="${m.id}" title="L'exclure du groupe">✕</span>` : ''}</div></div>`;
  }).join('');
  const donjon = chef
    ? `<span class="btn" data-soc-donjon title="${DONJON} : tout le groupe reçoit « Rejoindre »">Lancer la Crypte</span>`
    : G.donjon ? `<span class="btn" data-soc-rejoindre-donjon>Rejoindre le donjon du chef</span>` : '';
  return `${err}<div class="liste">${L}</div>
    <p class="note">${G.membres.length} / 4 · invite avec les onglets Discord ou Amis, ou clic droit sur un joueur. ${chef ? 'Tu es le chef : tu lances le donjon.' : 'Le chef lance le donjon, tu reçois « Rejoindre ».'}</p>
    <div class="bas">${donjon}<span class="btn gris" data-soc-quitter-grp>Quitter le groupe</span></div>`;
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
