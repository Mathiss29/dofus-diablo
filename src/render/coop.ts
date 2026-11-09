import { GAME_DATA } from '../sim/data';
import type { PlayerInput } from '../sim/input';
import type { SimEvent } from '../sim/events';
import type { SkillId } from '../sim/defs';
import type { World } from '../sim/world';
import { classeDe, COOP, Emetteur, entreeInvite, garderUneFois, type Instantane, type UneFois } from '../sim/miroir';
import { exporterJoueur, restaurerJoueur, type EtatJoueur } from '../sim/sauvegarde';
import { Compte } from './compte';

/** Coop à plusieurs (maquette « Multi : » 3A, 11A), premier essai dans la partie de test : un salon à code sur le serveur
 *  (api.diablofus.com), l'hôte fait tourner la partie, ses invités lui envoient leurs entrées et reçoivent des instantanés.
 *  Ce module vit plus longtemps que la scène : le salon tient quand l'hôte change de zone. */
export const URL_COOP = (import.meta.env?.VITE_COOP_URL as string | undefined) ?? 'wss://api.diablofus.com/ws';
/** Un invité mort chez l'hôte se relève à côté de lui au bout de ce temps (en attendant « relever un allié », 15C). */
const RELEVE = 5;

/** Ce que la scène prête au salon. */
export interface SceneCoop {
  world: World;
  /** Invité : aller dans la zone de l'hôte (la scène repart), ou revenir à sa propre partie (zone = null). */
  allerA(zone: string | null, position?: { x: number; y: number }, arrivee?: [string, number]): void;
  annonce(texte: string): void;
  /** Nom du perso joué (portraits du groupe). */
  nom: string;
  /** Sauve tout de suite le perso (avant d'aller dans une partie du serveur avec le perso du compte). */
  sauver(): void;
}
/** Perso du compte emmené dans une partie du serveur (« Vrai multi : » 4A) : le serveur le lit et le sauve lui-même. */
export interface PersoCompte { jeton: string; emplacement: number }
interface Invite {
  joueur: number | null; classe: string; nom: string; etat: EtatJoueur | null; em: Emetteur | null; pret: boolean;
  entree: PlayerInput; pressed: SkillId | null; potion: boolean; mortDepuis: number;
  /** Parti par une porte vers une autre zone : on ne le lui redit pas. */
  sorti?: boolean;
  /** Gestes d'un seul pas reçus depuis le dernier (parler à un PNJ, lui répondre, prendre un portail). */
  une: UneFois;
}
type Etat = 'hors' | 'connexion' | 'salon';

class Salon {
  etat: Etat = 'hors';
  hote = false;
  /** Partie tenue par le serveur (maquette « Vrai multi : » 1A) : tout le monde est invité, personne ne la fait tourner chez soi. */
  serveur = false;
  /** Perso du compte emmené dans la partie (sinon, rien n'est gardé). */
  compte: PersoCompte | null = null;
  code: string | null = null;
  erreur: string | null = null;
  private ws: WebSocket | null = null;
  private scene: SceneCoop | null = null;
  private ecouteurs = new Set<() => void>();
  // hôte
  readonly invites = new Map<number, Invite>();
  private pas = 0;
  // invité
  private recus: Instantane[] = [];
  private enAttente: { pressed: SkillId | null; potion: boolean; une: UneFois; dernier: PlayerInput | null; t: number } = { pressed: null, potion: false, une: {}, dernier: null, t: 0 };
  private dansZoneHote = false;
  /** Mon perso chez l'hôte : le miroir lui donne ce numéro dès sa création (l'affichage range ses vues par numéro). */
  private monId = 0;
  /** Après un chargement ou un retard : on ignore tout jusqu'au prochain envoi complet (les changements seuls n'auraient pas de base). */
  private attendPlein = true;

  get invite() { return this.etat === 'salon' && !this.hote; }
  /** L'invité est dans la zone de l'hôte : sa scène n'avance plus la partie, elle recopie les instantanés. */
  get miroir() { return this.invite && this.dansZoneHote; }
  get nbJoueurs() { return this.hote ? 1 + [...this.invites.values()].filter(i => i.joueur != null).length : 0; }
  ecouter(f: () => void) { this.ecouteurs.add(f); return () => this.ecouteurs.delete(f); }
  private changer() { for (const f of this.ecouteurs) f(); }

  // ——— connexion ———
  /** monde : partie du serveur en monde ouvert (Incarnam, étape 4) au lieu de l'arène de la Crypte. */
  /** arene : tag du donjon en vagues tenu par le serveur (la Crypte par défaut). */
  creer(serveur = false, compte: PersoCompte | null = null, monde = false, arene: string | null = null) {
    this.compte = compte; this.arene = serveur && !monde ? arene : null;
    this.connecter(serveur ? { k: 'creer', serveur: true, ...(monde ? { monde: true } : {}), ...(this.arene ? { arene: this.arene } : {}) } : { k: 'creer' });
  }
  /** Donjon lancé par ce joueur (affichage), null sinon. */
  arene: string | null = null;
  rejoindre(code: string, compte: PersoCompte | null = null) { if (code.trim()) { this.compte = compte; this.connecter({ k: 'rejoindre', code: code.trim().toUpperCase() }); } }
  /** vers : l'invité a pris une porte vers une autre zone, il y part seul (sinon, retour à sa propre partie). */
  quitter(vers?: { zone: string; arrivee?: [string, number] }) {
    const etaitInvite = this.miroir, compte = !!this.compte;
    this.ws?.close(); this.ws = null;
    this.fermer();
    if (etaitInvite) this.revenir(compte, vers);
  }
  /** Retour à sa propre partie ; avec le perso du compte, on relit d'abord ce que le serveur en a sauvé (butin, XP). */
  private revenir(compte: boolean, vers?: { zone: string; arrivee?: [string, number] }) {
    const s = this.scene, aller = (x: SceneCoop | null) => (vers ? x?.allerA(vers.zone, undefined, vers.arrivee) : x?.allerA(null));
    if (!compte) { aller(s); return; }
    void Compte.charger().finally(() => aller(this.scene ?? s));
  }
  private fermer() {
    if (this.hote && this.scene) for (const i of this.invites.values()) this.retirer(i);
    this.etat = 'hors'; this.hote = false; this.serveur = false; this.compte = null; this.code = null; this.invites.clear(); this.recus = []; this.dansZoneHote = false;
    this.changer();
  }
  private connecter(premier: object) {
    this.ws?.close();
    this.etat = 'connexion'; this.erreur = null; this.changer();
    let ws: WebSocket;
    try { ws = new WebSocket(URL_COOP); } catch { this.erreur = 'Serveur injoignable'; this.fermer(); return; }
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify(premier));
    ws.onmessage = ev => { if (this.ws === ws) { try { this.message(JSON.parse(String(ev.data))); } catch (e) { console.warn('coop', e); } } };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      const miroir = this.miroir, compte = !!this.compte;
      this.ws = null;
      if (this.etat !== 'hors') { this.erreur ??= 'Connexion perdue'; this.scene?.annonce('Coop : connexion perdue'); }
      this.fermer();
      if (miroir) this.revenir(compte);
    };
  }
  private envoyer(d: unknown, a?: number) { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ k: 'envoi', ...(a != null ? { a } : {}), d })); }

  private message(m: { k: string; [k: string]: unknown }) {
    switch (m.k) {
      case 'salon':
        this.etat = 'salon'; this.hote = !!m.hote; this.serveur = !!m.serveur; this.code = String(m.code);
        if (!this.hote && this.scene) void this.bonjour(this.scene);
        this.changer();
        break;
      case 'refus':
        this.erreur = m.raison === 'code' ? 'Aucun salon avec ce code' : m.raison === 'complet' ? 'Salon complet (4 joueurs)'
          : m.raison === 'indisponible' ? 'La partie sur le serveur n’est pas encore installée'
          : m.raison === 'perso' ? 'Ton perso en ligne est introuvable : reconnecte-toi avec Discord'
          : m.raison === 'testeur' ? 'L’essai à plusieurs est réservé aux testeurs'
          : m.raison === 'deja' ? 'Ce perso joue déjà dans un groupe'
          : m.raison === 'donjon' ? 'Ce donjon n’est pas encore sur le serveur'
          : m.raison === 'hardcore' ? 'Les persos Hardcore ne jouent pas encore à plusieurs' : 'Serveur plein, réessaie';
        this.ws?.close(); this.ws = null; this.fermer();
        break;
      case 'arrivee':
        this.invites.set(Number(m.id), { joueur: null, classe: 'iop', nom: '', etat: null, em: null, pret: false, entree: entreeInvite(null), pressed: null, potion: false, mortDepuis: 0, une: {} });
        this.changer();
        break;
      case 'depart': {
        const i = this.invites.get(Number(m.id));
        if (i) { this.retirer(i); this.invites.delete(Number(m.id)); this.scene?.annonce('Un joueur a quitté le salon'); this.changer(); }
        break;
      }
      case 'fin': {
        const miroir = this.miroir, compte = !!this.compte;
        this.erreur = m.raison === 'erreur' ? 'La partie s’est arrêtée sur le serveur' : 'L’hôte a fermé le salon';
        this.ws?.close(); this.ws = null; this.fermer();
        this.scene?.annonce(`Coop : ${this.erreur?.toLowerCase()}`);
        if (miroir) this.revenir(compte);
        break;
      }
      case 'recu': this.recu(Number(m.de), m.d as { k: string; [k: string]: unknown }); break;
    }
  }
  /** Invité : se présente à l'hôte (ou au serveur). Avec le perso du compte, on le sauve et l'envoie d'abord : le serveur le relit. */
  private async bonjour(s: SceneCoop) {
    const w = s.world, nom = s.nom;
    if (this.compte) {
      const c = this.compte;
      s.sauver();
      await Compte.toutEnvoyer();
      this.envoyer({ k: 'bonjour', jeton: c.jeton, emplacement: c.emplacement, nom });
      return;
    }
    this.envoyer({ k: 'bonjour', classe: classeDe(w, w.player), etat: exporterJoueur(w), nom });
  }
  private recu(de: number, d: { k: string; [k: string]: unknown }) {
    if (!d || typeof d !== 'object') return;
    if (this.hote) {
      const i = this.invites.get(de);
      if (!i) return;
      if (d.k === 'bonjour') {
        i.classe = typeof d.classe === 'string' && GAME_DATA.classes[d.classe] ? d.classe : 'iop';
        i.nom = typeof d.nom === 'string' ? d.nom.slice(0, 20) : '';
        i.etat = d.etat && typeof d.etat === 'object' ? d.etat as EtatJoueur : null;
        this.poser(i);
        this.scene?.annonce('Un joueur a rejoint le salon');
        this.changer();
      } else if (d.k === 'entree') {
        const e = entreeInvite(d.i as Partial<PlayerInput>);
        i.entree = e;
        if (e.pressed) i.pressed = e.pressed;
        if (e.potion) i.potion = true;
        garderUneFois(i.une, e);
      } else if (d.k === 'pret') { i.pret = true; i.em?.toutRenvoyer(); }
      return;
    }
    if (d.k === 'sortie') {
      const v = d.vers as { zone?: unknown; arrivee?: unknown } | undefined;
      const vers = v && typeof v.zone === 'string' && GAME_DATA.zones[v.zone]
        ? { zone: v.zone, ...(Array.isArray(v.arrivee) && typeof v.arrivee[0] === 'string' ? { arrivee: [v.arrivee[0], Number(v.arrivee[1]) || 0] as [string, number] } : {}) } : undefined;
      this.scene?.annonce(vers ? `Tu pars seul vers ${GAME_DATA.zones[vers.zone].name}` : 'Tu quittes le groupe par le portail');
      this.quitter(vers); return;
    }
    if (d.k === 'zone' && typeof d.zone === 'string' && GAME_DATA.zones[d.zone]) {
      this.dansZoneHote = true; this.recus = []; this.monId = Number(d.id) || 0;
      this.scene?.allerA(d.zone, { x: Number(d.x), y: Number(d.y) });
    } else if (d.k === 'instantane' && this.dansZoneHote) {
      if (this.attendPlein && !d.plein) return;
      this.attendPlein = false;
      this.recus.push(d as unknown as Instantane);
      // trop de retard (onglet caché, chargement) : on repart d'un envoi complet
      if (this.recus.length > 90) this.redemander();
    }
  }

  // ——— la scène ———
  /** La scène vient d'être créée : l'hôte y repose ses invités (et les y appelle), l'invité attend les instantanés. */
  attacher(s: SceneCoop) {
    this.scene = s;
    if (this.hote) for (const i of this.invites.values()) { i.joueur = null; i.em = null; i.pret = false; if (i.etat) this.poser(i); }
    if (this.miroir) { if (this.monId) (s.world.players[0] as { id: number }).id = this.monId; this.redemander(); }
  }
  /** Invité : quelque chose s'est mal passé dans le miroir, l'hôte renvoie tout (au plus une fois par seconde). */
  toutRedemander() { const t = performance.now(); if (t - this.dernierePanne > 1000) { this.dernierePanne = t; this.redemander(); } }
  private dernierePanne = -1e9;
  private redemander() { this.recus = []; this.attendPlein = true; this.envoyer({ k: 'pret' }); }
  /** La scène s'en va (changement de zone) : l'hôte garde l'état de ses invités pour les reposer dans la suivante. */
  detacher(w: World) {
    if (this.scene?.world !== w) return;
    if (this.hote) for (const i of this.invites.values()) {
      const q = w.players.find(p => p.id === i.joueur);
      if (q) { const avant = i.etat?.quetes; i.etat = w.commeJoueur(q, () => exporterJoueur(w)); if (!i.etat.quetes && avant) i.etat.quetes = avant; }   // une arène n'a pas de quêtes : on garde les siennes
    }
    this.scene = null;
  }

  // ——— hôte ———
  /** Pose le perso d'un invité à côté de l'hôte et l'appelle dans cette zone. */
  private poser(i: Invite) {
    const w = this.scene?.world;
    if (!w || i.joueur != null) return;
    const id = [...this.invites.entries()].find(([, x]) => x === i)?.[0];
    if (id == null || w.players.length >= 4) return;
    // monde ouvert (monde partagé) : il garde ses quêtes, tenues ici et recopiées chez lui
    const q = w.ajouterJoueur(i.classe, w.zone.open && w.opts.quetes && i.etat?.quetes ? { reprise: i.etat.quetes } : undefined);
    if (i.etat) { const e = { ...i.etat, zone: '__coop', havreSac: undefined }; try { w.commeJoueur(q, () => restaurerJoueur(w, e)); } catch (err) { console.warn('coop', err); } }
    q.hp = q.maxHp; q.nom = i.nom;
    i.joueur = q.id; i.em = new Emetteur(q.id); i.pret = false;
    this.envoyer({ k: 'zone', zone: w.opts.zone, x: q.x, y: q.y, id: q.id }, id);
  }
  private retirer(i: Invite) {
    const w = this.scene?.world, q = w?.players.find(p => p.id === i.joueur);
    if (w && q) w.retirerJoueur(q);
    i.joueur = null;
  }
  /** Entrées des invités pour le prochain pas (un sort ou une potion ne servent qu'une fois). */
  entrees(): Record<number, PlayerInput> {
    const r: Record<number, PlayerInput> = {};
    if (!this.hote) return r;
    for (const i of this.invites.values()) if (i.joueur != null) {
      r[i.joueur] = { ...i.entree, pressed: i.pressed, potion: i.potion, talk: null, reponse: null, versPortail: null, ...i.une };
      i.pressed = null; i.potion = false; i.une = {};
    }
    return r;
  }
  noter(e: SimEvent) { if (this.hote) for (const i of this.invites.values()) i.em?.noter(e); }
  /** Après chaque pas : invités morts relevés, puis un instantané tous les COOP.tous pas. */
  apresPas(w: World, dt: number) {
    if (!this.hote || !this.invites.size) return;
    for (const [id, i] of this.invites) {
      const q = w.players.find(p => p.id === i.joueur);
      if (!q) continue;
      // ses événements à lui (butin, bandeaux, quêtes) ; une porte vers une autre zone : il y part seul, le groupe reste ici
      for (const e of w.evenementsDe(q)) {
        if (e.k === 'changeZone') { if (!i.sorti) { i.sorti = true; this.envoyer({ k: 'sortie', vers: { zone: e.zone, arrivee: e.arrivee } }, id); } }
        else i.em?.noterPerso(e);
      }
      if (!q.dead) { i.mortDepuis = 0; continue; }
      if ((i.mortDepuis += dt) < RELEVE) continue;
      const f = w.map.nearestFree(w.players[0].x + 40, w.players[0].y);
      q.dead = false; q.hp = q.maxHp; q.x = f.x; q.y = f.y; q.invuln = 2; q.setAnim('idle');
      i.mortDepuis = 0;
    }
    if (++this.pas % COOP.tous) return;
    for (const [id, i] of this.invites) if (i.pret && i.em) this.envoyer({ k: 'instantane', ...i.em.instantane(w) }, id);
  }

  // ——— invité ———
  /** Entrées de l'invité, envoyées à l'hôte 30 fois par seconde au plus (un sort lancé entre deux envois n'est pas perdu). */
  entree(i: PlayerInput, now: number) {
    const a = this.enAttente;
    if (i.pressed) a.pressed = i.pressed;
    if (i.potion) a.potion = true;
    garderUneFois(a.une, i);
    a.dernier = i;
    if (now - a.t < 1000 / 30) return;
    a.t = now;
    this.envoyer({ k: 'entree', i: { move: i.move, aim: i.aim, holdAttack: i.holdAttack, dest: i.dest ?? null, pickup: i.pickup ?? null, target: i.target ?? null,
      castOn: i.castOn ?? null, approach: !!i.approach, meute: i.meute ?? null, pressed: a.pressed, potion: a.potion, ...a.une } });
    a.pressed = null; a.potion = false; a.une = {};
  }
  /** Instantanés arrivés depuis la dernière image, dans l'ordre. */
  prendre(): Instantane[] { const r = this.recus; this.recus = []; return r; }
}

export const Coop = new Salon();
