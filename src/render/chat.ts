// Tchat en jeu (« Social : » 4A, refait par la maquette « Tchat : » du 2026-11-12, toutes les recos) :
// - 1A+1B : l'onglet Infos est le journal de la partie (butin, niveaux, quêtes, succès…), même hors ligne ;
// - 2A+2B : onglets réglables au clic droit (5 au plus), qui n'apparaissent que si leurs canaux servent ;
// - 3A+3B : bouton du canal à gauche du champ (le champ prend sa couleur), canal par défaut selon la situation ;
// - 4A : replié quand on n'écrit pas (seuls les derniers messages flottent puis s'effacent) ; Entrée ou survol : tout ;
// - 5A+5B : déplaçable (modules déverrouillés dans Réglages) et taille réglable par le coin ;
// - 6A : liens d'objets (Ctrl+clic sur un objet pendant qu'on écrit), fiche au survol ;
// - 7A-D : heure, lignes répétées « ×3 », nom à la couleur de la classe, son discret et onglet qui clignote pour un privé ;
// - 8A+8B : flèche du haut = messages déjà envoyés, Tab complète commandes et noms ; 9A+9B : réglages dans Options › Tchat.
// Commandes : /w (ou /p) nom, /r, /g, /b, /t, /inviter nom, /ami nom, /ignorer nom, /aide.
import { EnLigne, type Canal, type MessageChat } from './presence';
import { inviterJoueur, menuJoueur } from './social';
import { sauverReglages, type Reglages } from './ambiance';
import { COULEUR_CLASSE, FILTRES, LIEN, MAX_ONGLETS, ONGLETS_DEFAUT, completer, couleurRarete, deplier, ficheObjet, filtreDe, lienObjet, lireLien, nomLien, ongletsVisibles, regrouper, type Filtre } from './chatOutils';
import { MANIFESTE, Son } from './son';
import type { Item } from '../sim/items';

/** Couleur de chaque canal. */
export const COULEURS: Record<Canal, string> = { tout: '#ece6d4', groupe: '#6fc6ff', bastion: '#ffcf6b', prive: '#d0a2ff', infos: '#9be070' };
const NOM_CANAL: Record<Canal, string> = { tout: 'Tout', groupe: 'Groupe', bastion: 'Bastion', prive: 'Privé', infos: '' };
type Parle = Exclude<Canal, 'infos'>;
/** 4A : au repos, au plus ces lignes-là flottent. */
const LIGNES_REPOS = 6;

const CSS = `
.chat-df{position:fixed;left:12px;bottom:160px;width:360px;z-index:25;font:13px/1.35 Lexend,sans-serif;color:#ece6d4;transform-origin:0 100%;transform:scale(var(--echelle,1))}
.chat-df .ch-msgs{max-height:170px;overflow:hidden;display:flex;flex-direction:column;padding:4px 8px;border-radius:5px 5px 0 0}
.chat-df .ch-msgs>div{text-shadow:0 1px 2px #000,0 0 3px #000;word-wrap:break-word}
.chat-df .ch-msgs>div:first-child{margin-top:auto}
.chat-df .ch-msgs>div.vieux{display:none}
.chat-df .ch-msgs:empty{padding:0}
.chat-df .ch-msgs b[data-nom]{cursor:pointer}
.chat-df .ch-h{color:#8d8775;font-size:.85em;margin-right:4px}
.chat-df .ch-x{color:#8d8775;font-size:.85em;margin-left:4px}
.chat-df .ch-lien{background:#0006;border-radius:3px;padding:0 3px;cursor:help;text-decoration:underline dotted}
.chat-df .ch-bas{display:none;padding:0 6px 6px;border-radius:0 0 5px 5px}
.chat-df .ch-rond{display:flex;align-items:center;gap:6px;margin:4px 0 0 2px;font-size:11px;color:#a9a493;cursor:pointer;width:max-content}
.chat-df .ch-rond i{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#0f0e0bcc;border:1px solid #57534a;position:relative;font-style:normal;font-size:12px}
.chat-df .ch-rond i.neuf::after{content:'';position:absolute;top:-2px;right:-2px;width:8px;height:8px;border-radius:50%;background:#d0a2ff}
.chat-df.ouvert .ch-rond,.chat-df:hover .ch-rond{display:none}
.chat-df.ouvert .ch-bas,.chat-df:hover .ch-bas{display:block;background:var(--fond)}
.chat-df.ouvert .ch-msgs,.chat-df:hover .ch-msgs{background:var(--fond);overflow-y:auto}
.chat-df.ouvert .ch-msgs>div.vieux,.chat-df:hover .ch-msgs>div.vieux{display:block}
.chat-df .ch-t{display:flex;gap:2px;padding:4px 0}
.chat-df .ch-t span{flex:1;text-align:center;font-size:11px;padding:2px 4px;border-radius:3px;background:#2a2822;color:#a9a493;cursor:pointer;position:relative;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chat-df .ch-t span.on{background:#4c6e17;color:#fff}
.chat-df .ch-t span.neuf::after{content:'';position:absolute;top:2px;right:3px;width:6px;height:6px;border-radius:50%;background:#ffcf6b}
.chat-df .ch-t span.clignote{animation:chClig 1s ease-in-out 3}
.chat-df .ch-t span.plus{flex:0 0 auto;background:none}
@keyframes chClig{50%{background:#7a4fb0;color:#fff}}
.chat-df .ch-l{display:flex;gap:4px}
.chat-df .ch-canal{display:flex;align-items:center;gap:5px;background:#2a2822;border:1px solid #57534a;border-radius:3px;padding:0 7px;font-size:11px;cursor:pointer;white-space:nowrap;max-width:130px;overflow:hidden}
.chat-df .ch-canal i{width:8px;height:8px;border-radius:50%;flex:none}
.chat-df input{flex:1;min-width:0;box-sizing:border-box;background:#1d1b16;border:1px solid #57534a;border-radius:3px;color:#f4efe0;font:inherit;padding:4px 6px;outline:none}
.chat-df input:focus{border-color:var(--canal,#b9e54b);color:var(--canal,#f4efe0)}
.chat-df .ch-coin{position:absolute;right:-3px;top:-3px;width:14px;height:14px;cursor:nesw-resize;display:none;border-top:2px solid #a9a493;border-right:2px solid #a9a493;border-radius:0 4px 0 0}
.chat-df.ouvert .ch-coin,.chat-df:hover .ch-coin{display:block}
.chat-df.libre{outline:2px dashed #ffcf6b;outline-offset:4px;cursor:move}
.chat-df.libre::before{content:'Tchat';position:absolute;left:0;top:-24px;font-size:12px;color:#fff;text-shadow:0 1px 2px #000}
.chat-df.libre .ch-bas{display:block;background:var(--fond)}
.ch-menu{position:fixed;z-index:40;background:#1b1914f5;border:1px solid #6b6650;border-radius:5px;padding:6px 8px;font:12px/1.5 Lexend,sans-serif;color:#ece6d4;box-shadow:0 6px 18px #000a;min-width:170px}
.ch-menu .t{color:#e0b45a;margin-bottom:3px}
.ch-menu label,.ch-menu .it{display:flex;align-items:center;gap:6px;cursor:pointer;padding:1px 2px;border-radius:3px}
.ch-menu .it:hover,.ch-menu label:hover{background:#ffffff14}
.ch-menu .it i{width:8px;height:8px;border-radius:50%}
.ch-menu .bt{display:flex;gap:10px;margin-top:5px;color:#a9a493}
.ch-menu .bt span{cursor:pointer}.ch-menu .bt span:hover{color:#fff}
.ch-menu input[type=text]{width:100%;box-sizing:border-box;background:#0008;border:1px solid #5b5844;border-radius:3px;color:#f1ecd8;font:inherit;padding:2px 5px;margin-bottom:3px}
.ch-fiche{position:fixed;z-index:41;background:#1b1914f5;border:1px solid #6b6650;border-radius:5px;padding:7px 9px;font:12px/1.45 Lexend,sans-serif;color:#ece6d4;box-shadow:0 6px 18px #000a;max-width:260px;pointer-events:none}
`;

export interface ContexteChat {
  reglages: Reglages;
  /** Le perso est en ligne (sinon : journal seul, 1B). */
  enLigne: boolean;
  auBastion: () => boolean;
}

export class ChatVue {
  private root: HTMLDivElement;
  private msgs: HTMLDivElement;
  private champ: HTMLInputElement;
  private tabs: HTMLDivElement;
  private canalBt: HTMLSpanElement;
  private rond: HTMLDivElement;
  private menu: HTMLDivElement | null = null;
  private fiche: HTMLDivElement;
  private onglet = 0;
  private neufs = new Set<number>();
  /** 3A : canal où l'on parle ; 3B : le canal par défaut d'où il vient (s'il change, le canal suit). */
  private canal: Parle = 'tout';
  private canalDefaut: Parle | null = null;
  /** Dernier joueur qui m'a chuchoté (/r), et à qui je chuchote dans le canal Privé. */
  private dernierPrive = '';
  private cible = '';
  private priveNonLu = false;
  /** 8A : messages déjà envoyés (flèche du haut). */
  private historique: string[] = [];
  private hIdx = -1;
  /** 6A : liens posés pendant la saisie (« [Nom] » → lien complet). */
  private poses = new Map<string, string>();
  private finLecture: () => void;
  private finEcoute: () => void;
  private minute: number;
  private glisse: { x: number; y: number; ox: number; oy: number; w?: number; h?: number } | null = null;
  private base = 160;

  constructor(private ctx: ContexteChat) {
    if (!document.getElementById('chat-df-css')) { const st = document.createElement('style'); st.id = 'chat-df-css'; st.textContent = CSS; document.head.appendChild(st); }
    else document.getElementById('chat-df-css')!.textContent = CSS;
    this.root = document.createElement('div'); this.root.className = 'chat-df';
    this.root.innerHTML = '<div class="ch-msgs"></div><div class="ch-rond"><i>💬</i><span></span></div><div class="ch-bas"><div class="ch-t"></div><div class="ch-l"><span class="ch-canal"></span><input type="text" maxlength="200" autocomplete="off" spellcheck="false"></div></div><div class="ch-coin" title="Taille du tchat"></div>';
    this.msgs = this.root.querySelector('.ch-msgs')!; this.tabs = this.root.querySelector('.ch-t')!; this.champ = this.root.querySelector('input')!;
    this.canalBt = this.root.querySelector('.ch-canal')!; this.rond = this.root.querySelector('.ch-rond')!;
    this.fiche = document.createElement('div'); this.fiche.className = 'ch-fiche'; this.fiche.style.display = 'none'; document.body.appendChild(this.fiche);
    // rien ne passe au jeu : ni clic, ni touche tapée dans le champ
    for (const ev of ['pointerdown', 'pointerup', 'wheel', 'contextmenu'] as const) this.root.addEventListener(ev, e => e.stopPropagation());
    this.champ.addEventListener('keydown', e => this.touche(e));
    this.champ.addEventListener('keyup', e => e.stopPropagation());
    this.champ.addEventListener('blur', () => { this.root.classList.remove('ouvert'); this.rendreRond(); });
    this.champ.addEventListener('focus', () => this.root.classList.add('ouvert'));
    this.rond.addEventListener('click', () => this.ouvrir());
    this.canalBt.addEventListener('click', e => { e.stopPropagation(); this.menuCanal(); });
    this.msgs.addEventListener('click', e => {
      const n = (e.target as HTMLElement).closest<HTMLElement>('[data-nom]')?.dataset.nom;
      if (n && this.ctx.enLigne) this.ouvrir(`/w ${n} `);
    });
    // clic droit sur un nom : le menu du joueur (Social 6A)
    this.msgs.addEventListener('contextmenu', e => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-nom]'), id = Number(b?.dataset.id);
      if (!b || !id || id === EnLigne.moi) return;
      e.preventDefault(); menuJoueur(e.clientX, e.clientY, { id, nom: b.dataset.nom! });
    });
    // 6A : fiche de l'objet lié au survol
    this.msgs.addEventListener('mousemove', e => {
      const l = (e.target as HTMLElement).closest<HTMLElement>('[data-lien]'), o = l && lireLien(...(JSON.parse(l.dataset.lien!) as [string, string, string, string]));
      if (!o) { this.fiche.style.display = 'none'; return; }
      this.fiche.innerHTML = ficheObjet(o); this.fiche.style.display = 'block';
      const r = this.fiche.getBoundingClientRect();
      this.fiche.style.left = `${Math.min(window.innerWidth - r.width - 8, e.clientX + 14)}px`; this.fiche.style.top = `${Math.max(8, e.clientY - r.height - 10)}px`;
    });
    this.msgs.addEventListener('mouseleave', () => { this.fiche.style.display = 'none'; });
    // 5A : déplacer (modules déverrouillés) ; 5B : taille par le coin
    this.root.addEventListener('pointerdown', e => {
      const coin = (e.target as HTMLElement).classList.contains('ch-coin');
      if (!coin && (this.ctx.reglages.verrou !== false || (e.target as HTMLElement).closest('input,.ch-t,.ch-canal'))) return;
      e.preventDefault();
      const o = this.ctx.reglages.modules?.chat ?? [0, 0], [w, h] = this.taille();
      this.glisse = { x: e.clientX, y: e.clientY, ox: o[0], oy: o[1], ...(coin ? { w, h } : {}) };
      this.root.setPointerCapture(e.pointerId);
    });
    this.root.addEventListener('pointermove', e => {
      const g = this.glisse, R = this.ctx.reglages; if (!g) return;
      const k = this.echelle(), dx = (e.clientX - g.x) / k, dy = (e.clientY - g.y) / k;
      if (g.w != null && g.h != null) R.chatTaille = [Math.round(Math.min(720, Math.max(260, g.w + dx))), Math.round(Math.min(520, Math.max(70, g.h - dy)))];
      else R.modules = { ...R.modules, chat: [Math.round(g.ox + dx * k), Math.round(g.oy + dy * k)] };
      this.appliquer();
    });
    const lacher = () => { if (!this.glisse) return; this.glisse = null; sauverReglages(this.ctx.reglages); };
    this.root.addEventListener('pointerup', lacher); this.root.addEventListener('pointercancel', lacher);
    EnLigne.chuchoter = nom => this.ouvrir(`/w ${nom} `);
    document.body.appendChild(this.root);
    this.finLecture = EnLigne.lire(m => this.recu(m));
    this.finEcoute = EnLigne.ecouter(() => { this.rendreOnglets(); this.rendreCanal(); });
    this.minute = window.setInterval(() => this.vieillir(), 1000);
    this.appliquer();
  }

  get ecrit() { return document.activeElement === this.champ; }
  /** Entrée : ouvre le champ (avec un début de texte, ex. « /w Lyra »). */
  ouvrir(debut = '') {
    this.root.classList.add('ouvert');
    const w = /^\/w (\S+) $/.exec(debut);
    if (w) { this.cible = w[1]; this.canal = 'prive'; this.rendreCanal(); }
    else { if (debut) this.champ.value = debut; this.canalSituation(); }
    this.priveNonLu = false; this.rendreRond();
    this.champ.focus();
    this.rendre();
  }
  fermer() { this.champ.blur(); this.root.classList.remove('ouvert'); this.fermerMenu(); this.hIdx = -1; }
  /** Bas du chat : juste au-dessus du suivi de quête (y en pixels CSS du haut du suivi), décalé si on l'a déplacé (5A). */
  placer(hautSuivi: number) {
    this.base = Math.max(12, Math.round(window.innerHeight - hautSuivi + 8));
    const [dx, dy] = this.ctx.reglages.modules?.chat ?? [0, 0];
    const b = `${Math.max(0, this.base - dy)}px`, l = `${Math.max(0, 12 + dx)}px`;
    if (this.root.style.bottom !== b) this.root.style.bottom = b;
    if (this.root.style.left !== l) this.root.style.left = l;
    const libre = this.ctx.reglages.verrou === false;
    if (this.root.classList.contains('libre') !== libre) this.root.classList.toggle('libre', libre);
  }
  /** 6A : Ctrl+clic sur un objet pendant qu'on écrit : son lien entre dans le champ. Vrai si le tchat l'a pris. */
  insererObjet(it: Item, nom: string): boolean {
    if (!this.ecrit || !this.ctx.enLigne) return false;
    const n = nomLien({ nom });
    this.poses.set(n, lienObjet(it));
    const c = this.champ, a = c.selectionStart ?? c.value.length, avant = c.value.slice(0, a), apres = c.value.slice(a);
    const t = `${avant}${avant && !avant.endsWith(' ') ? ' ' : ''}${n} `;
    c.value = (t + apres).slice(0, 200); c.focus(); c.setSelectionRange(t.length, t.length);
    return true;
  }
  /** 9A, 5B : réglages du tchat (taille, fond, texte) ; appelé quand les Options changent. */
  appliquer() {
    const R = this.ctx.reglages, [w, h] = this.taille();
    this.root.style.width = `${w}px`;
    this.msgs.style.maxHeight = `${h}px`;
    this.root.style.fontSize = `${Math.round(13 * (R.chatTexte || 1) * 10) / 10}px`;
    this.root.style.setProperty('--fond', `rgba(15,14,11,${Math.min(1, Math.max(0, R.chatFond ?? 0.82))})`);
    if (!R.chatOnglets?.length) R.chatOnglets = ONGLETS_DEFAUT.map(o => ({ ...o, f: [...o.f] }));
    if (this.onglet >= R.chatOnglets.length) this.onglet = 0;
    this.champ.placeholder = this.ctx.enLigne ? 'Entrée pour écrire · /aide · Ctrl+clic sur un objet' : 'Hors ligne : ici, le journal de ta partie';
    this.canalBt.style.display = this.ctx.enLigne ? '' : 'none';
    this.rendreOnglets(); this.rendreCanal(); this.rendre();
  }
  destroy() {
    EnLigne.chuchoter = () => {}; this.finLecture(); this.finEcoute(); clearInterval(this.minute);
    this.fermerMenu(); this.fiche.remove(); this.root.remove();
  }

  private taille(): [number, number] { const t = this.ctx.reglages.chatTaille; return t?.length === 2 ? [t[0], t[1]] : [360, 170]; }
  private echelle() { return Number(getComputedStyle(document.documentElement).getPropertyValue('--echelle')) || 1; }
  private get onglets() { return this.ctx.reglages.chatOnglets?.length ? this.ctx.reglages.chatOnglets : ONGLETS_DEFAUT; }
  /** 9B : canaux coupés dans les réglages. */
  private recoit(m: MessageChat) {
    const R = this.ctx.reglages;
    return !(m.canal === 'tout' && R.chatTout === false) && !(m.canal === 'bastion' && R.chatBastion === false);
  }
  private montre(m: MessageChat, i = this.onglet) { return this.recoit(m) && (this.onglets[i]?.f ?? []).includes(filtreDe(m)); }

  private recu(m: MessageChat) {
    if (!this.recoit(m)) return;
    if (m.canal === 'prive' && !m.vers) {
      this.dernierPrive = m.de;
      // 7D : son discret, onglet qui clignote, pastille sur la bulle
      Son.jouer(MANIFESTE.ui.objectif, 'interface', { vol: 0.45, vitesse: 1.5, cle: 'chatPrive', ecart: 0.8 });
      if (!this.ecrit) this.priveNonLu = true;
    }
    if (!this.montre(m)) {
      this.onglets.forEach((_, i) => { if (i !== this.onglet && this.montre(m, i)) this.neufs.add(i); });
    }
    this.rendreOnglets();
    if (m.canal === 'prive' && !m.vers) this.tabs.querySelectorAll<HTMLElement>('[data-o]').forEach(e => { if (this.onglets[+e.dataset.o!]?.f.includes('prive')) { e.classList.remove('clignote'); void e.offsetWidth; e.classList.add('clignote'); } });
    this.rendreRond(); this.rendre();
  }

  /** 2B : les canaux utiles en ce moment. */
  private actifs(): Set<Filtre> {
    const a = new Set<Filtre>(['infos', 'butin']);
    if (!this.ctx.enLigne) return a;
    if (EnLigne.connecte) a.add('tout');
    if (EnLigne.groupe) a.add('groupe');
    if (this.ctx.auBastion()) a.add('bastion');
    if (EnLigne.messages.some(m => m.canal === 'prive') || this.cible) a.add('prive');
    for (const m of EnLigne.messages) if (m.canal !== 'infos') a.add(m.canal);
    return a;
  }
  private rendreOnglets() {
    const O = this.onglets, vis = ongletsVisibles(O, this.actifs(), this.onglet);
    const seul = vis.length <= 1 && !this.ctx.enLigne;
    this.tabs.style.display = seul ? 'none' : '';
    const coul = (i: number) => { const f = O[i].f; return f.length === 1 ? COULEURS[(f[0] === 'butin' ? 'infos' : f[0]) as Canal] : ''; };
    this.tabs.innerHTML = vis.map(i => `<span data-o="${i}" class="${i === this.onglet ? 'on' : ''}${this.neufs.has(i) ? ' neuf' : ''}" style="${i === this.onglet || !coul(i) ? '' : `color:${coul(i)}`}" title="Clic droit : régler l'onglet">${esc(O[i].nom)}</span>`).join('')
      + (O.length < MAX_ONGLETS ? '<span class="plus" data-plus title="Ajouter un onglet">+</span>' : '');
    this.tabs.querySelectorAll<HTMLElement>('[data-o]').forEach(e => {
      e.addEventListener('click', () => { this.onglet = +e.dataset.o!; this.neufs.delete(this.onglet); this.rendreOnglets(); this.rendre(); if (this.root.classList.contains('ouvert')) this.champ.focus(); });
      e.addEventListener('contextmenu', ev => { ev.preventDefault(); this.menuOnglet(+e.dataset.o!, ev.clientX, ev.clientY); });
    });
    this.tabs.querySelector<HTMLElement>('[data-plus]')?.addEventListener('click', ev => {
      const R = this.ctx.reglages; R.chatOnglets = [...O, { nom: 'Onglet', f: ['tout'] }]; sauverReglages(R);
      this.onglet = R.chatOnglets.length - 1; this.rendreOnglets(); this.rendre(); this.menuOnglet(this.onglet, ev.clientX, ev.clientY);
    });
  }

  /** 2A : clic droit sur un onglet : ce qu'il montre, son nom, le supprimer. */
  private menuOnglet(i: number, x: number, y: number) {
    this.fermerMenu();
    const R = this.ctx.reglages, O = R.chatOnglets = this.onglets.map(o => ({ nom: o.nom, f: [...o.f] })), o = O[i];
    const m = this.menu = document.createElement('div'); m.className = 'ch-menu';
    m.innerHTML = `<div class="t">Onglet « ${esc(o.nom)} »</div><input type="text" maxlength="14" value="${esc(o.nom)}" title="Nom de l'onglet">`
      + FILTRES.map(([k, n]) => `<label><input type="checkbox" data-f="${k}" ${o.f.includes(k) ? 'checked' : ''}>${n}</label>`).join('')
      + `<div class="bt">${O.length > 1 ? '<span data-suppr>Supprimer</span>' : ''}<span data-defaut>Onglets par défaut</span><span data-ok>OK</span></div>`;
    for (const ev of ['pointerdown', 'pointerup', 'wheel', 'contextmenu', 'keydown', 'keyup'] as const) m.addEventListener(ev, e => e.stopPropagation());
    const sauver = () => { sauverReglages(R); this.rendreOnglets(); this.rendre(); };
    m.querySelector<HTMLInputElement>('input[type=text]')!.addEventListener('input', e => { o.nom = (e.target as HTMLInputElement).value.trim() || 'Onglet'; sauver(); });
    m.querySelectorAll<HTMLInputElement>('[data-f]').forEach(c => c.addEventListener('change', () => {
      const f = c.dataset.f as Filtre; o.f = c.checked ? [...new Set([...o.f, f])] : o.f.filter(x => x !== f); sauver();
    }));
    m.querySelector('[data-suppr]')?.addEventListener('click', () => { O.splice(i, 1); this.onglet = 0; this.neufs.clear(); sauver(); this.fermerMenu(); });
    m.querySelector('[data-defaut]')!.addEventListener('click', () => { R.chatOnglets = ONGLETS_DEFAUT.map(x => ({ nom: x.nom, f: [...x.f] })); this.onglet = 0; this.neufs.clear(); sauver(); this.fermerMenu(); });
    m.querySelector('[data-ok]')!.addEventListener('click', () => this.fermerMenu());
    this.poserMenu(m, x, y);
  }
  /** 3A : liste des canaux où l'on peut parler. */
  private menuCanal() {
    this.fermerMenu();
    const m = this.menu = document.createElement('div'); m.className = 'ch-menu';
    m.innerHTML = '<div class="t">Parler dans</div>' + this.canauxDispo().map(c => `<div class="it" data-c="${c}"><i style="background:${COULEURS[c]}"></i>${this.nomCanal(c)}</div>`).join('');
    for (const ev of ['pointerdown', 'pointerup', 'wheel', 'contextmenu'] as const) m.addEventListener(ev, e => e.stopPropagation());
    m.querySelectorAll<HTMLElement>('[data-c]').forEach(e => e.addEventListener('mousedown', ev => {
      ev.preventDefault(); this.canal = e.dataset.c as Parle; this.rendreCanal(); this.fermerMenu(); this.champ.focus();
    }));
    const r = this.canalBt.getBoundingClientRect();
    this.poserMenu(m, r.left, r.top, true);
  }
  private poserMenu(m: HTMLDivElement, x: number, y: number, auDessus = false) {
    document.body.appendChild(m);
    const r = m.getBoundingClientRect();
    m.style.left = `${Math.min(window.innerWidth - r.width - 6, x)}px`;
    m.style.top = `${Math.max(6, auDessus ? y - r.height - 4 : Math.min(window.innerHeight - r.height - 6, y))}px`;
    const loin = (e: PointerEvent) => { if (!m.contains(e.target as Node)) { this.fermerMenu(); window.removeEventListener('pointerdown', loin, true); } };
    setTimeout(() => window.addEventListener('pointerdown', loin, true), 0);
  }
  private fermerMenu() { this.menu?.remove(); this.menu = null; }

  private canauxDispo(): Parle[] {
    const l: Parle[] = [];
    if (EnLigne.groupe) l.push('groupe');
    if (this.ctx.auBastion()) l.push('bastion');
    l.push('tout');
    if (this.cible || this.dernierPrive) l.push('prive');
    return l;
  }
  private nomCanal(c: Parle) { return c === 'prive' ? `Privé : ${this.cible || this.dernierPrive}` : NOM_CANAL[c]; }
  /** 3B : Groupe si l'on est en groupe, Bastion au Bastion, sinon Tout ; un choix à la main tient tant que la situation ne change pas. */
  private canalSituation() {
    const d: Parle = EnLigne.groupe ? 'groupe' : this.ctx.auBastion() ? 'bastion' : 'tout';
    if (d !== this.canalDefaut || !this.canauxDispo().includes(this.canal)) { this.canal = d; this.canalDefaut = d; }
    this.rendreCanal();
  }
  private rendreCanal() {
    if (!this.canauxDispo().includes(this.canal)) this.canal = EnLigne.groupe ? 'groupe' : this.ctx.auBastion() ? 'bastion' : 'tout';
    const c = COULEURS[this.canal];
    this.canalBt.innerHTML = `<i style="background:${c}"></i>${esc(this.nomCanal(this.canal))} ▾`;
    this.root.style.setProperty('--canal', c);
  }
  private rendreRond() {
    this.rond.querySelector('i')!.classList.toggle('neuf', this.priveNonLu);
    this.rond.querySelector('span')!.textContent = this.priveNonLu ? 'Message privé non lu' : '';
  }

  private rendre() {
    const R = this.ctx.reglages, ouvert = this.root.classList.contains('ouvert');
    const L = regrouper(EnLigne.messages.filter(m => this.montre(m))).slice(-80), t = performance.now(), eff = this.effacement();
    const heure = (h: number) => { const d = new Date(h); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
    this.msgs.innerHTML = L.map(({ m, n }, i) => {
      const vieux = i < L.length - LIGNES_REPOS || (eff > 0 && t - m.t > eff);
      return `<div class="${vieux ? 'vieux' : ''}" data-t="${m.t}" data-i="${i}" style="color:${COULEURS[m.canal]}">${R.chatHeure !== false ? `<span class="ch-h">${heure(m.heure)}</span>` : ''}${ligne(m)}${n > 1 ? `<span class="ch-x">×${n}</span>` : ''}</div>`;
    }).join('');
    if (ouvert || this.root.matches(':hover')) this.msgs.scrollTop = this.msgs.scrollHeight;
  }
  private effacement() { const s = Number(this.ctx.reglages.chatEffacement ?? 20); return Number.isFinite(s) && s > 0 ? s * 1000 : 0; }
  private vieillir() {
    const t = performance.now(), eff = this.effacement(); if (!eff) return;
    this.msgs.querySelectorAll<HTMLElement>('div[data-t]').forEach(d => { if (t - Number(d.dataset.t) > eff) d.classList.add('vieux'); });
  }
  private info(texte: string) { EnLigne.noter({ canal: 'infos', de: '', id: null, texte }); }

  private touche(e: KeyboardEvent) {
    e.stopPropagation();
    const c = this.champ;
    if (e.key === 'Enter') { const v = c.value; this.envoyer(v); if (v.trim()) { this.historique.push(v); if (this.historique.length > 30) this.historique.shift(); } c.value = ''; this.poses.clear(); this.fermer(); }
    else if (e.key === 'Escape') { c.value = ''; this.poses.clear(); this.fermer(); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      // 8A : messages déjà envoyés
      const H = this.historique; if (!H.length) return;
      e.preventDefault();
      this.hIdx = e.key === 'ArrowUp' ? (this.hIdx < 0 ? H.length - 1 : Math.max(0, this.hIdx - 1)) : this.hIdx < 0 ? -1 : this.hIdx + 1;
      if (this.hIdx >= H.length) this.hIdx = -1;
      c.value = this.hIdx < 0 ? '' : H[this.hIdx];
    } else if (e.key === 'Tab') {
      // 8B : commandes et noms des joueurs
      e.preventDefault();
      const noms = [...EnLigne.enLigne.map(j => j.nom), ...(EnLigne.amis?.amis.map(a => a.perso?.nom ?? '') ?? []), ...(EnLigne.groupe?.membres.map(m => m.nom) ?? []), ...EnLigne.messages.map(m => m.de)].filter(Boolean);
      const r = completer(c.value.slice(0, c.selectionStart ?? c.value.length), noms);
      if (r) { const apres = c.value.slice(c.selectionStart ?? c.value.length); c.value = r + apres; c.setSelectionRange(r.length, r.length); }
    }
  }

  /** Un message tapé : commande, ou message dans le canal choisi (bouton à gauche du champ). */
  private envoyer(brut: string) {
    const v = deplier(brut.trim(), this.poses);
    if (!v) return;
    const cmd = /^\/(\S+)\s*(.*)$/.exec(v);
    const aide = '/w nom message : chuchoter · /r : répondre · /g, /b, /t : Groupe, Bastion, Tout · /inviter nom · /ami nom · /ignorer nom · Tab : compléter · ↑ : derniers messages · Ctrl+clic sur un objet : le montrer · clic droit sur un onglet : le régler';
    if (cmd && ['aide', 'help', '?'].includes(cmd[1].toLowerCase())) { this.info(aide); return; }
    if (!this.ctx.enLigne) { this.info('Hors ligne : le tchat ne montre que le journal de ta partie (persos En ligne pour parler)'); return; }
    if (!EnLigne.connecte) { this.info('Pas de connexion au serveur pour l’instant'); return; }
    if (cmd) {
      const c = cmd[1].toLowerCase(), reste = cmd[2];
      const nomEt = () => { const m = /^(\S+)\s*(.*)$/.exec(reste); return m ? [m[1], m[2]] : ['', '']; };
      switch (c) {
        case 'w': case 'p': case 'mp': case 'chuchoter': { const [n, t] = nomEt(); if (n && t) { this.cible = n; this.canal = 'prive'; EnLigne.dire('prive', t, n); this.rendreCanal(); } else this.info('Écris /w nom message'); return; }
        case 'r': if (this.dernierPrive && reste) { this.cible = this.dernierPrive; EnLigne.dire('prive', reste, this.dernierPrive); } else this.info('Personne ne t’a encore chuchoté'); return;
        case 'g': case 'groupe': if (reste) EnLigne.dire('groupe', reste); return;
        case 'b': case 'bastion': if (reste) EnLigne.dire('bastion', reste); return;
        case 't': case 'tout': case 'a': if (reste) EnLigne.dire('tout', reste); return;
        case 'inviter': case 'invite': {
          const n = reste.trim().toLowerCase(), j = EnLigne.enLigne.find(x => x.nom.toLowerCase() === n);
          if (!j) { EnLigne.demanderEnLigne(); this.info(n ? `${reste.trim()} n’est pas dans la liste des joueurs en ligne (onglet Discord de Social)` : 'Écris /inviter nom'); return; }
          inviterJoueur(j.id);
          return;
        }
        case 'ami': if (reste.trim()) EnLigne.ajouterAmi(reste.trim()); else this.info('Écris /ami nom'); return;
        case 'ignorer': if (reste.trim()) EnLigne.ignorer(reste.trim()); else this.info('Écris /ignorer nom'); return;
        default: this.info(`Commande inconnue : /${c} (/aide pour la liste)`); return;
      }
    }
    if (this.canal === 'prive') {
      const a = this.cible || this.dernierPrive;
      if (a) EnLigne.dire('prive', v, a); else this.info('Écris /w nom message pour chuchoter');
      return;
    }
    EnLigne.dire(this.canal, v);
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]!));
/** Texte d'un message : échappé, liens d'objets en couleur de rareté (6A). */
function texte(t: string): string {
  return esc(t).replace(LIEN, (_tout, id: string, r: string, st: string, l: string) => {
    const o = lireLien(id, r, st, l);
    return o ? `<span class="ch-lien" style="color:${couleurRarete(o.rarete)}" data-lien="${esc(JSON.stringify([id, r, st, l]))}">${esc(nomLien(o))}</span>` : '[objet]';
  });
}
/** Une ligne du chat : « (Groupe) Lyra : … », « de Lyra : … », « à Brak : … », ou une info. */
function ligne(m: MessageChat): string {
  if (m.canal === 'infos') return texte(m.texte);
  const nom = (n: string, id = m.id, cl = m.classe) => `<b data-nom="${esc(n)}" data-id="${id ?? ''}"${cl && COULEUR_CLASSE[cl] ? ` style="color:${COULEUR_CLASSE[cl]}"` : ''}>${esc(n)}</b>`;
  if (m.canal === 'prive') return m.vers ? `à ${nom(m.vers, 0, undefined)} : ${texte(m.texte)}` : `de ${nom(m.de)} : ${texte(m.texte)}`;
  const c = m.canal === 'tout' ? '' : NOM_CANAL[m.canal];
  return `${c ? `(${c}) ` : ''}${nom(m.de)} : ${texte(m.texte)}`;
}
