// Chat à canaux (« Social : » 4A 4C 5A) : en bas à gauche, au-dessus du suivi de quête, comme dans Dofus 3. Onglets Tout, Groupe,
// Bastion, Privé, Infos ; Entrée pour écrire, Entrée pour envoyer, Échap pour fermer. Commandes : /w (ou /p) nom, /r, /g, /b, /t,
// /inviter nom, /aide. Sans écrire, seuls les derniers messages restent visibles un moment, puis s'effacent.
import { EnLigne, type Canal, type MessageChat } from './presence';
import { Coop } from './coop';

const ONGLETS: [Canal | 'tout', string][] = [['tout', 'Tout'], ['groupe', 'Groupe'], ['bastion', 'Bastion'], ['prive', 'Privé'], ['infos', 'Infos']];
/** Couleur de chaque canal. */
export const COULEURS: Record<Canal, string> = { tout: '#ece6d4', groupe: '#6fc6ff', bastion: '#ffcf6b', prive: '#d0a2ff', infos: '#9be070' };
const NOM_CANAL: Record<Canal, string> = { tout: '', groupe: 'Groupe', bastion: 'Bastion', prive: '', infos: '' };
/** Durée (ms) pendant laquelle un message reste visible chat fermé. */
const VISIBLE = 20_000;
// chat fermé, sans message récent : la boîte est vide et ne gêne pas les clics dans le jeu

const CSS = `
.chat-df{position:fixed;left:12px;bottom:160px;width:360px;z-index:25;font:13px/1.35 Lexend,sans-serif;color:#ece6d4;transform-origin:0 100%;transform:scale(var(--echelle,1))}
.chat-df .ch-msgs{max-height:170px;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;padding:4px 8px;border-radius:5px 5px 0 0}
.chat-df .ch-msgs div{text-shadow:0 1px 2px #000,0 0 3px #000;word-wrap:break-word}
.chat-df .ch-msgs div.vieux{display:none}
.chat-df .ch-msgs:empty{padding:0}
.chat-df .ch-msgs b{cursor:pointer}
.chat-df .ch-bas{display:none}
.chat-df.ouvert .ch-msgs,.chat-df:hover .ch-msgs{background:#0f0e0bd0;overflow-y:auto}
.chat-df.ouvert .ch-msgs div.vieux,.chat-df:hover .ch-msgs div.vieux{display:block}
.chat-df.ouvert .ch-bas,.chat-df:hover .ch-bas{display:block;background:#0f0e0bd0;border-radius:0 0 5px 5px;padding:0 6px 6px}
.chat-df .ch-t{display:flex;gap:2px;padding:4px 0}
.chat-df .ch-t span{flex:1;text-align:center;font-size:11px;padding:2px 0;border-radius:3px;background:#2a2822;color:#a9a493;cursor:pointer;position:relative}
.chat-df .ch-t span.on{background:#4c6e17;color:#fff}
.chat-df .ch-t span.neuf::after{content:'';position:absolute;top:2px;right:4px;width:6px;height:6px;border-radius:50%;background:#ffcf6b}
.chat-df input{width:100%;box-sizing:border-box;background:#1d1b16;border:1px solid #57534a;border-radius:3px;color:#f4efe0;font:13px Lexend,sans-serif;padding:4px 6px;outline:none}
.chat-df input:focus{border-color:#b9e54b}
`;

export class ChatVue {
  private root: HTMLDivElement;
  private msgs: HTMLDivElement;
  private champ: HTMLInputElement;
  private tabs: HTMLDivElement;
  private onglet: Canal | 'tout' = 'tout';
  private neufs = new Set<Canal>();
  /** Dernier joueur qui m'a chuchoté (/r). */
  private dernierPrive = '';
  private finLecture: () => void;
  private minute: number;

  constructor() {
    if (!document.getElementById('chat-df-css')) { const st = document.createElement('style'); st.id = 'chat-df-css'; st.textContent = CSS; document.head.appendChild(st); }
    this.root = document.createElement('div'); this.root.className = 'chat-df';
    this.root.innerHTML = '<div class="ch-msgs"></div><div class="ch-bas"><div class="ch-t"></div><input type="text" maxlength="200" placeholder="Écris ici (/aide pour les commandes)" autocomplete="off" spellcheck="false"></div>';
    this.msgs = this.root.querySelector('.ch-msgs')!; this.tabs = this.root.querySelector('.ch-t')!; this.champ = this.root.querySelector('input')!;
    // rien ne passe au jeu : ni clic, ni touche tapée dans le champ
    for (const ev of ['pointerdown', 'pointerup', 'wheel', 'contextmenu'] as const) this.root.addEventListener(ev, e => e.stopPropagation());
    this.champ.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') { this.envoyer(this.champ.value); this.champ.value = ''; this.fermer(); }
      else if (e.key === 'Escape') { this.champ.value = ''; this.fermer(); }
    });
    this.champ.addEventListener('keyup', e => e.stopPropagation());
    this.champ.addEventListener('blur', () => this.root.classList.remove('ouvert'));
    this.msgs.addEventListener('click', e => {
      const n = (e.target as HTMLElement).closest<HTMLElement>('[data-nom]')?.dataset.nom;
      if (n) this.ouvrir(`/w ${n} `);
    });
    document.body.appendChild(this.root);
    this.rendreOnglets(); this.rendre();
    this.finLecture = EnLigne.lire(m => {
      if (m.canal === 'prive' && !m.vers) this.dernierPrive = m.de;
      if (m.canal !== this.onglet && this.onglet !== 'tout') { this.neufs.add(m.canal); this.rendreOnglets(); }
      else if (this.onglet === 'tout' && m.canal === 'prive') { this.neufs.add('prive'); this.rendreOnglets(); }
      this.rendre();
    });
    this.minute = window.setInterval(() => this.vieillir(), 1000);
  }

  get ecrit() { return document.activeElement === this.champ; }
  /** Entrée : ouvre le champ (avec un début de texte, ex. « /w Lyra »). */
  ouvrir(debut = '') {
    this.root.classList.add('ouvert');
    if (debut) this.champ.value = debut;
    this.champ.focus();
  }
  fermer() { this.champ.blur(); this.root.classList.remove('ouvert'); }
  /** Bas du chat : juste au-dessus du suivi de quête (y en pixels CSS du haut du suivi). */
  placer(hautSuivi: number) {
    const b = Math.max(12, Math.round(window.innerHeight - hautSuivi + 8)) + 'px';
    if (this.root.style.bottom !== b) this.root.style.bottom = b;
  }
  destroy() { this.finLecture(); clearInterval(this.minute); this.root.remove(); }

  private rendreOnglets() {
    this.tabs.innerHTML = ONGLETS.map(([k, n]) => `<span data-o="${k}" class="${k === this.onglet ? 'on' : ''}${this.neufs.has(k as Canal) ? ' neuf' : ''}" style="${k === this.onglet ? '' : `color:${COULEURS[k as Canal]}`}">${n}</span>`).join('');
    this.tabs.querySelectorAll<HTMLElement>('[data-o]').forEach(e => e.addEventListener('click', () => {
      this.onglet = e.dataset.o as Canal; this.neufs.delete(this.onglet); this.rendreOnglets(); this.rendre();
      this.champ.focus();
    }));
  }
  private rendre() {
    const L = EnLigne.messages.filter(m => this.onglet === 'tout' || m.canal === this.onglet).slice(-60), t = performance.now();
    this.msgs.innerHTML = L.map(m => `<div class="${t - m.t > VISIBLE ? 'vieux' : ''}" data-t="${m.t}" style="color:${COULEURS[m.canal]}">${ligne(m)}</div>`).join('');
    this.msgs.scrollTop = this.msgs.scrollHeight;
  }
  private vieillir() {
    const t = performance.now();
    this.msgs.querySelectorAll<HTMLElement>('div[data-t]').forEach(d => { if (t - Number(d.dataset.t) > VISIBLE) d.classList.add('vieux'); });
  }
  private info(texte: string) { EnLigne.noter({ canal: 'infos', de: '', id: null, texte }); }

  /** Un message tapé : commande, ou message dans le canal de l'onglet ouvert. */
  private envoyer(brut: string) {
    const v = brut.trim();
    if (!v) return;
    if (!EnLigne.connecte) { this.info('Pas de connexion au serveur pour l’instant'); return; }
    const cmd = /^\/(\S+)\s*(.*)$/.exec(v);
    if (cmd) {
      const c = cmd[1].toLowerCase(), reste = cmd[2];
      const nomEt = () => { const m = /^(\S+)\s*(.*)$/.exec(reste); return m ? [m[1], m[2]] : ['', '']; };
      switch (c) {
        case 'w': case 'p': case 'mp': case 'chuchoter': { const [n, t] = nomEt(); if (n && t) EnLigne.dire('prive', t, n); else this.info('Écris /w nom message'); return; }
        case 'r': if (this.dernierPrive && reste) EnLigne.dire('prive', reste, this.dernierPrive); else this.info('Personne ne t’a encore chuchoté'); return;
        case 'g': case 'groupe': if (reste) EnLigne.dire('groupe', reste); return;
        case 'b': case 'bastion': if (reste) EnLigne.dire('bastion', reste); return;
        case 't': case 'tout': case 'a': if (reste) EnLigne.dire('tout', reste); return;
        case 'inviter': case 'invite': {
          const n = reste.trim().toLowerCase(), j = EnLigne.enLigne.find(x => x.nom.toLowerCase() === n);
          if (!j) { EnLigne.demanderEnLigne(); this.info(n ? `${reste.trim()} n’est pas dans la liste des joueurs en ligne (onglet Discord de Social)` : 'Écris /inviter nom'); return; }
          if (Coop.etat === 'salon' && Coop.serveur) EnLigne.inviter(j.id); else this.info('Crée d’abord un groupe (Social › Groupe), puis invite');
          return;
        }
        case 'aide': case 'help': case '?':
          this.info('/w nom message : chuchoter · /r : répondre · /g, /b, /t : Groupe, Bastion, Tout · /inviter nom · clic sur un nom : lui chuchoter');
          return;
        default: this.info(`Commande inconnue : /${c} (/aide pour la liste)`); return;
      }
    }
    const o = this.onglet;
    if (o === 'prive') { if (this.dernierPrive) EnLigne.dire('prive', v, this.dernierPrive); else this.info('Écris /w nom message pour chuchoter'); return; }
    EnLigne.dire(o === 'groupe' || o === 'bastion' ? o : 'tout', v);
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]!));
/** Une ligne du chat : « (Groupe) Lyra : … », « de Lyra : … », « à Brak : … », ou une info. */
function ligne(m: MessageChat): string {
  if (m.canal === 'infos') return esc(m.texte);
  const nom = (n: string) => `<b data-nom="${esc(n)}">${esc(n)}</b>`;
  if (m.canal === 'prive') return m.vers ? `à ${nom(m.vers)} : ${esc(m.texte)}` : `de ${nom(m.de)} : ${esc(m.texte)}`;
  const c = NOM_CANAL[m.canal];
  return `${c ? `(${c}) ` : ''}${nom(m.de)} : ${esc(m.texte)}`;
}
