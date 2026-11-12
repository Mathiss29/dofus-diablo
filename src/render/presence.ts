// Présence en ligne (serveur/presence.mjs) : le jeu annonce le perso en ligne joué, sa zone et, au Bastion des Douze, sa
// position. En retour : les autres joueurs du Bastion (des passants : chacun garde sa propre ville), la liste des joueurs
// connectés (onglet Discord de la fenêtre Social) et les invitations dans un groupe.
import { URL_COOP, Coop } from './coop';
import { Compte } from './compte';
import type { Apparence } from './squelette';

export interface Profil { id: number; nom: string; classe: string; sexe: 'm' | 'f'; niveau: number; apparence: Apparence | null; objets: string[]; titre?: string; ornement?: number }
/** Un joueur du Bastion vu ici : sa position reçue (tx, ty) et celle affichée (x, y), qui la rejoint en douceur. */
export interface Passant { id: number; profil: Profil | null; x: number; y: number; tx: number; ty: number; f: number; a: string; vu: number; age: number }
export type Canal = 'tout' | 'groupe' | 'bastion' | 'prive' | 'infos';
/** Un message du chat (« Social : » 4A) : reçu du serveur, ou une info du jeu (canal Infos). */
export interface MessageChat {
  canal: Canal; de: string; id: number | null; texte: string; vers?: string;
  /** t : performance.now() (effacement) ; heure : Date.now() (« Tchat : » 7A). */
  t: number; heure: number;
  /** « Tchat : » 1A : ligne de butin du journal (onglet Infos : butin) ; 7C : classe de celui qui parle. */
  sorte?: 'butin'; classe?: string;
}
export interface JoueurEnLigne { id: number; nom: string; classe: string; niveau: number; zone: string; groupe: boolean; ami?: boolean }
/** Mon groupe (« Social : » 7A 7B), tenu par le serveur de présence : on se groupe sans bouger. */
export interface Groupe {
  id: number; chef: number; donjon: string | null;
  membres: { id: number; nom: string; enLigne: boolean; classe?: string; niveau?: number; zone?: string }[];
}
/** Amis et ignorés (« Social : » 2A-2D, 8A), tenus par le serveur. */
export interface Amis {
  amis: { id: number; discord: string; vu: number; perso?: { nom: string; classe: string; niveau: number; zone: string; groupe: boolean; avecMoi: boolean } }[];
  recues: { id: number; nom: string }[]; envoyees: { id: number; nom: string }[]; ignores: { id: number; nom: string }[];
  horsLigne: boolean; inconnus: boolean;
}

class Presence {
  /** Joueurs du Bastion autour de soi. */
  readonly passants = new Map<number, Passant>();
  private profils = new Map<number, Profil>();
  enLigne: JoueurEnLigne[] = [];
  amis: Amis | null = null;
  groupe: Groupe | null = null;
  /** Le chef du groupe a lancé un donjon (code de la partie du serveur). */
  onDonjon: (de: string, code: string, lieu: string) => void = () => {};
  /** Mon numéro de compte côté serveur (null : pas annoncé). */
  moi: number | null = null;
  private ws: WebSocket | null = null;
  private voulu: { emplacement: number; zone: string; x: number; y: number; objets: string[]; titre: string; ornement: number } | null = null;
  private relance = 0;
  private dernier = { t: 0, zone: '', x: 0, y: 0, a: '' };
  private ecouteurs = new Set<() => void>();
  /** Invitation reçue (« Social : » 7A) et petits messages du serveur. */
  onInvitation: (de: string, groupe: number) => void = () => {};
  onInfo: (texte: string) => void = () => {};
  /** Le chat : les derniers messages, et qui les écoute (fenêtre de chat, bulles). */
  readonly messages: MessageChat[] = [];
  private lecteurs = new Set<(m: MessageChat) => void>();

  constructor() {
    // le groupe joué (partie du serveur) : le serveur s'en sert pour les invitations
    Coop.ecouter(() => this.envoyer({ k: 'groupe', code: Coop.etat === 'salon' && Coop.serveur ? Coop.code : null }));
  }
  ecouter(f: () => void) { this.ecouteurs.add(f); return () => this.ecouteurs.delete(f); }
  lire(f: (m: MessageChat) => void) { this.lecteurs.add(f); return () => { this.lecteurs.delete(f); }; }
  /** Ajoute un message au chat (reçu, ou info du jeu dans le canal Infos). */
  noter(m: Omit<MessageChat, 't' | 'heure'>) {
    const n = { ...m, t: performance.now(), heure: Date.now() };
    this.messages.push(n); if (this.messages.length > 200) this.messages.shift();
    for (const f of this.lecteurs) f(n);
  }
  /** « Tchat : » 1A : une ligne du journal de la partie (onglet Infos), même hors ligne. */
  journal(texte: string, sorte?: 'butin') { this.noter({ canal: 'infos', de: '', id: null, texte, ...(sorte ? { sorte } : {}) }); }
  /** Envoie un message (canal Privé : a = nom du perso). */
  dire(canal: Exclude<Canal, 'infos'>, texte: string, a?: string) { this.envoyer({ k: 'dire', canal, texte, ...(a ? { a } : {}) }); }
  private changer() { for (const f of this.ecouteurs) f(); }
  /** Emplacement du perso en ligne joué (-1 : aucun). */
  get emplacement() { return this.voulu?.emplacement ?? -1; }
  /** Ouvre le chat prêt à chuchoter à ce joueur (branché par la fenêtre de chat). */
  chuchoter: (nom: string) => void = () => {};
  get connecte() { return this.moi != null && this.ws?.readyState === WebSocket.OPEN; }

  /** La scène a un perso en ligne : on l'annonce (ou on met à jour son profil : niveau, objets portés). */
  annoncer(emplacement: number, zone: string, x: number, y: number, objets: string[], deco: { titre?: string; ornement?: number } = {}) {
    this.voulu = { emplacement, zone, x, y, objets, titre: deco.titre ?? '', ornement: deco.ornement ?? 0 };
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) { this.presenter(); return; }
    this.connecter();
  }
  /** Plus de perso en ligne joué (accueil, déconnexion). */
  arreter() {
    this.voulu = null; clearTimeout(this.relance);
    const ws = this.ws; this.ws = null; ws?.close();
    this.moi = null; this.passants.clear(); this.enLigne = []; this.amis = null; this.groupe = null; this.changer();
  }
  private connecter() {
    let ws: WebSocket;
    try { ws = new WebSocket(URL_COOP); } catch { return; }
    this.ws = ws;
    ws.onopen = () => this.presenter();
    ws.onmessage = ev => { if (this.ws === ws) { try { this.message(JSON.parse(String(ev.data))); } catch (e) { console.warn('présence', e); } } };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null; this.moi = null; this.passants.clear(); this.changer();
      // coupure : on revient tout seul tant que la scène veut être en ligne
      if (this.voulu) this.relance = window.setTimeout(() => { if (this.voulu && !this.ws) this.connecter(); }, 5000);
    };
  }
  private presenter() {
    const v = this.voulu, j = Compte.jeton;
    if (!v || !j) return;
    this.envoyer({ k: 'presence', jeton: j, emplacement: v.emplacement, zone: v.zone, x: v.x, y: v.y, objets: v.objets, titre: v.titre, ornement: v.ornement });
    if (Coop.etat === 'salon' && Coop.serveur) this.envoyer({ k: 'groupe', code: Coop.code });
  }
  private envoyer(m: object) { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m)); }

  /** Position du perso, au plus 10 fois par seconde (tout de suite quand la zone change). */
  position(zone: string, x: number, y: number, f: number, a: string, now: number) {
    if (this.voulu) { this.voulu.zone = zone; this.voulu.x = x; this.voulu.y = y; }
    const d = this.dernier, change = zone !== d.zone;
    if (change) this.passants.clear();
    if (!this.connecte || (!change && now - d.t < 100) || (!change && x === d.x && y === d.y && a === d.a && now - d.t < 2000)) return;
    Object.assign(d, { t: now, zone, x, y, a });
    this.envoyer({ k: 'pos', zone, x: Math.round(x), y: Math.round(y), f: +f.toFixed(2), a });
  }
  demanderEnLigne() { this.envoyer({ k: 'enligne' }); }
  demanderAmis() { this.envoyer({ k: 'amis' }); }
  /** Demande d'ami par nom (perso ou pseudo Discord), ou accepter celle d'un joueur (id). */
  ajouterAmi(qui: string | number) { this.envoyer(typeof qui === 'number' ? { k: 'ami+', id: qui } : { k: 'ami+', nom: qui }); }
  /** Retire un ami, refuse ou annule une demande, ne plus ignorer. */
  retirer(id: number) { this.envoyer({ k: 'ami-', id }); }
  ignorer(qui: string | number, nom?: string) { this.envoyer(typeof qui === 'number' ? { k: 'ignorer', id: qui, ...(nom ? { nom } : {}) } : { k: 'ignorer', nom: qui }); }
  reglerSocial(horsLigne: boolean, inconnus: boolean) { this.envoyer({ k: 'reglagesSociaux', horsLigne, inconnus }); }
  inviter(id: number) { this.envoyer({ k: 'inviter', id }); }
  creerGroupe() { this.envoyer({ k: 'grpCreer' }); }
  repondreGroupe(groupe: number, oui: boolean) { this.envoyer({ k: oui ? 'grpOui' : 'grpNon', groupe }); }
  quitterGroupe() { this.envoyer({ k: 'grpQuitter' }); }
  exclure(id: number) { this.envoyer({ k: 'grpExclure', id }); }
  passerChef(id: number) { this.envoyer({ k: 'grpChef', id }); }
  /** Chef : le donjon est lancé (code de la partie), les autres reçoivent « Rejoindre ». */
  annoncerDonjon(code: string | null, lieu = '') { this.envoyer({ k: 'grpDonjon', code, lieu }); }
  get chef() { return !!this.groupe && this.groupe.chef === this.moi; }

  private message(m: { k: string; [k: string]: unknown }) {
    if (m.k === 'presence') {
      this.moi = m.ok ? Number(m.id) : null;
      if (m.ok) this.demanderAmis();   // demandes d'ami en attente : pastille sur le bouton Social (5B)
      if (!m.ok && m.raison === 'ailleurs') { this.voulu = null; this.onInfo('Ton compte joue maintenant sur un autre onglet'); }
      this.changer();
    } else if (m.k === 'autres') {
      for (const p of (m.profils as Profil[] | undefined) ?? []) this.profils.set(p.id, p);
      const vus = new Set<number>(), t = performance.now();
      for (const [id, x, y, f, a] of m.l as [number, number, number, number, string][]) {
        vus.add(id);
        const p = this.passants.get(id);
        if (p) { p.tx = x; p.ty = y; p.f = f; p.a = a; p.vu = t; p.profil ??= this.profils.get(id) ?? null; }
        else this.passants.set(id, { id, profil: this.profils.get(id) ?? null, x, y, tx: x, ty: y, f, a, vu: t, age: 0 });
      }
      for (const id of [...this.passants.keys()]) if (!vus.has(id)) this.passants.delete(id);
    } else if (m.k === 'enligne') { this.enLigne = m.l as JoueurEnLigne[]; this.changer(); }
    else if (m.k === 'amis') { this.amis = m as unknown as Amis; this.changer(); }
    else if (m.k === 'groupe') {
      const avant = JSON.stringify(this.groupe);
      this.groupe = m.id == null ? null : m as unknown as Groupe;
      if (JSON.stringify(this.groupe) !== avant) this.changer();
    }
    else if (m.k === 'donjon') { this.onDonjon(String(m.de), String(m.code), String(m.lieu ?? '')); this.noter({ canal: 'infos', de: '', id: null, texte: `${String(m.de)} part en donjon : rejoins-le` }); }
    else if (m.k === 'invitation') { this.onInvitation(String(m.de), Number(m.groupe)); this.noter({ canal: 'infos', de: '', id: null, texte: `${String(m.de)} t'invite dans son groupe` }); }
    else if (m.k === 'info') { this.onInfo(String(m.texte)); this.noter({ canal: 'infos', de: '', id: null, texte: String(m.texte) }); }
    else if (m.k === 'chat') {
      const c = String(m.canal);
      this.noter({ canal: (['tout', 'groupe', 'bastion', 'prive'].includes(c) ? c : 'tout') as Canal, de: String(m.de), id: Number(m.id), texte: String(m.texte), ...(m.vers ? { vers: String(m.vers) } : {}), ...(m.classe ? { classe: String(m.classe) } : {}) });
    }
  }

  /** À chaque image : les passants rejoignent leur dernière position reçue (10 envois par seconde, lissés). */
  avancer(dt: number) {
    const k = 1 - Math.exp(-dt * 12);
    for (const p of this.passants.values()) {
      p.age += dt;
      const dx = p.tx - p.x, dy = p.ty - p.y;
      if (Math.hypot(dx, dy) > 400) { p.x = p.tx; p.y = p.ty; } else { p.x += dx * k; p.y += dy * k; }
    }
  }
}

export const EnLigne = new Presence();
