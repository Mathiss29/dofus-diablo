// Partie tenue par le serveur (maquette « Vrai multi : » 1A, étape 2) : le serveur fait tourner l'arène de la Crypte pour
// tout le salon. Chaque joueur est un « invité » : il envoie ses entrées, reçoit des instantanés (src/sim/miroir.ts) et
// affiche un monde miroir, exactement comme l'invité de la coop à hôte. Personne n'est avantagé, et un joueur qui part
// ne coupe plus la partie des autres.
// La simulation vient de partie/sim.mjs, construit depuis src/sim par construire-sim.mjs.
import { readFileSync } from 'node:fs';

export const PARTIE = {
  /** Pas de simulation : comme dans le navigateur (60 par seconde). */
  pas: 1 / 60,
  /** Un joueur à terre se relève près d'un allié au bout de ce temps (en attendant « relever un allié », 15C). */
  releve: 5,
  /** Arène du premier essai (maquette « Multi : » 11A). */
  arene: 'arene_crypte',
  /** Au-delà de ce retard (serveur surchargé un instant), on rattrape au plus ce nombre de pas d'un coup. */
  rattrapage: 8,
  /** Les persos du compte sont sauvés toutes les … secondes (et quand le joueur part). */
  sauvegarde: 60,
};
/** Ce que la partie garde du perso d'avant : où il était dans SON monde (la partie se passe ailleurs) et ses quêtes. */
const GARDES = ['zone', 'x', 'y', 'retour', 'havreSac', 'quetes', 'zaaps', 'zonesVues', 'cleDonjon'];
/** Monde ouvert d'Incarnam (étape 4) : la partie est son vrai monde, on garde tout sauf le Havre-Sac (la partie n'y va pas). */
const GARDES_MONDE = ['havreSac'];

let sim = null;
/** Charge la simulation construite (une seule fois) ; null si elle n'a pas été construite. */
export async function chargerSim(dossier = new URL('./partie/', import.meta.url)) {
  if (sim) return sim;
  try {
    const m = await import(new URL('sim.mjs', dossier).href);
    sim = { ...m, monde: JSON.parse(readFileSync(new URL('incarnam.json', dossier), 'utf8')) };
  } catch (e) { console.warn('simulation absente (node construire-sim.mjs) :', e.message); sim = null; }
  return sim;
}

export class Partie {
  /** @param {any} S la simulation chargée ; envoyer(num, données) parle à un joueur du salon. */
  /** sauver(compte, perso) : écrit le perso d'un compte (comptes.mjs) ; absent = rien n'est gardé. */
  /** o.donjonFini(nom, temps, membres) : fin d'un donjon (Ladder 2D), avec les persos de comptes encore là. */
  /** o.monde : Incarnam en monde ouvert, chacun avec ses quêtes, sa place et son point de retour (sinon l'arène de la Crypte). */
  constructor(S, envoyer, seed = Math.floor(Math.random() * 2 ** 31), sauver = null, o = {}) {
    this.S = S; this.envoyer = envoyer; this.seed = seed; this.sauver = sauver; this.depuisSauvegarde = 0;
    this.donjonFini = o.donjonFini ?? null;
    this.monde = !!o.monde;
    this.w = null;
    this.membres = new Map();
    this.n = 0; this.reste = 0; this.erreurs = 0;
  }
  arrivee(num) {
    const S = this.S;
    this.membres.set(num, { joueur: null, em: null, pret: false, entree: S.entreeInvite(null), pressed: null, potion: false, une: {}, mortDepuis: 0 });
  }
  depart(num) {
    const m = this.membres.get(num);
    if (m) this.sauverMembre(m);
    this.membres.delete(num);
    const q = m && this.w?.players.find(p => p.id === m.joueur);
    if (q && !this.w.retirerJoueur(q)) this.w = null;   // c'était le dernier : la partie s'arrête
  }
  get vide() { return this.membres.size === 0; }

  recu(num, d) {
    const m = this.membres.get(num);
    if (!m || !d || typeof d !== 'object') return;
    if (d.k === 'bonjour') this.poser(num, m, d);
    else if (d.k === 'entree') {
      const e = this.S.entreeInvite(d.i);
      m.entree = e;
      if (e.pressed) m.pressed = e.pressed;
      if (e.potion) m.potion = true;
      this.S.garderUneFois(m.une, e);
    } else if (d.k === 'pret') { m.pret = true; m.em?.toutRenvoyer(); }
  }

  /** Pose le perso d'un joueur dans l'arène (la partie démarre avec le premier) et l'y appelle. */
  poser(num, m, d) {
    const S = this.S;
    if (m.joueur != null) return;
    // perso du compte (d.compte, posé par index.mjs après avoir vérifié le jeton) : c'est lui qui compte, pas ce qu'envoie le jeu
    if (d.compte) { m.compte = d.compte; m.arrivee = Date.now(); }
    const source = d.compte ? d.compte.perso : d;
    const classe = typeof source.classe === 'string' && S.GAME_DATA.classes[source.classe] ? source.classe : 'iop';
    const brut = source.etat && typeof source.etat === 'object' ? source.etat : null;
    // monde ouvert : sa vraie place s'il était à Incarnam ; sinon (et dans l'arène) il arrive à côté des autres
    const chezLui = this.monde && brut?.zone === 'incarnam';
    const etat = brut ? { ...brut, zone: chezLui ? 'incarnam' : '__coop', havreSac: undefined } : null;
    const quetes = this.monde ? { reprise: brut?.quetes && typeof brut.quetes === 'object' ? brut.quetes : { enCours: [], finies: [], etapesFinies: [], suivie: null, decouvertes: [], vaincus: [], objets: {} } } : undefined;
    let q;
    if (!this.w) {
      this.w = new S.World({ data: S.GAME_DATA, zone: 'incarnam', map: new S.WorldGrid(S.monde), seed: this.seed, classId: classe, items: S.ITEMS, partieServeur: true,
        ...(this.monde ? { quetes: S.QUETES, reprise: quetes.reprise, zonesVues: Array.isArray(brut?.zonesVues) ? brut.zonesVues : [] } : {}) });
      if (!this.monde) {
        this.w.allerArene(PARTIE.arene);
        // le fondu d'entrée de l'arène : on le passe tout de suite, le joueur arrive directement dedans
        for (let i = 0; i < 300 && this.w.passage; i++) this.w.step(PARTIE.pas, S.NO_INPUT);
      }
      this.w.drainEvents();
      q = this.w.players[0];
    } else {
      if (this.w.players.length >= 4) return;
      q = this.w.ajouterJoueur(classe, quetes);
    }
    if (etat) { try { this.w.commeJoueur(q, () => S.restaurerJoueur(this.w, etat)); } catch (e) { console.warn('partie : perso illisible', e.message); } }
    if (this.w.players[0] !== q && !chezLui) { const f = this.w.map.nearestFree(this.w.players[0].x + 40, this.w.players[0].y); q.x = f.x; q.y = f.y; }
    q.hp = q.maxHp;
    q.nom = typeof source.nom === 'string' ? source.nom.slice(0, 20) : '';
    m.joueur = q.id; m.em = new S.Emetteur(q.id); m.pret = false;
    this.envoyer(num, { k: 'zone', zone: this.w.opts.zone, x: q.x, y: q.y, id: q.id });
  }

  /** Avance la partie du temps écoulé (en secondes), par pas fixes ; envoie un instantané tous les COOP.tous pas. */
  avancer(dt) {
    const w = this.w, S = this.S;
    if (!w) return;
    this.reste = Math.min(this.reste + dt, PARTIE.pas * PARTIE.rattrapage);
    while (this.reste >= PARTIE.pas) {
      this.reste -= PARTIE.pas;
      const entrees = {};
      for (const m of this.membres.values()) if (m.joueur != null) {
        entrees[m.joueur] = { ...m.entree, pressed: m.pressed, potion: m.potion, talk: null, reponse: null, versPortail: null, ...m.une };
        m.pressed = null; m.potion = false; m.une = {};
      }
      const premier = w.players[0];
      const autres = { ...entrees }; delete autres[premier.id];
      try { w.step(PARTIE.pas, entrees[premier.id] ?? S.NO_INPUT, autres); this.erreurs = 0; }
      catch (e) { if (++this.erreurs > 30) throw e; console.warn('partie : pas raté', e.message); }
      const evs = w.drainEvents();
      // portail de sortie : ce joueur quitte la partie (son jeu ferme la connexion, il est alors sauvé et retiré)
      for (const e of evs) if (e.k === 'sortieArene') for (const [num, m] of this.membres) if (m.joueur === e.joueur && !m.sorti) { m.sorti = true; this.envoyer(num, { k: 'sortie' }); }
      for (const [num, m] of this.membres) {
        if (!m.em) continue;
        for (const e of evs) m.em.noter(e);
        // ses événements à lui (butin, bandeaux, quêtes) ; une porte vers une autre zone : il y part seul, la partie continue
        const q = w.players.find(p => p.id === m.joueur);
        if (!q) continue;
        const siens = q === w.players[0] ? evs.filter(e => S.EVENEMENTS_PERSONNELS.has(e.k)) : w.evenementsDe(q);
        for (const e of siens) {
          if (e.k !== 'changeZone') m.em.noterPerso(e);
          else if (!m.sorti) { m.sorti = true; this.envoyer(num, { k: 'sortie', vers: { zone: e.zone, arrivee: e.arrivee } }); }
        }
      }
      // Ladder 2D + 4B : chrono du donjon, compté seulement ici (partie tenue par le serveur)
      for (const e of evs) if (e.k === 'areneFin' && this.donjonFini) {
        const L = [...this.membres.values()].filter(m => m.compte && m.joueur != null)
          .map(m => ({ compte: m.compte.compte, emplacement: m.compte.emplacement, nom: m.compte.perso.nom, classe: m.compte.perso.classe }));
        try { this.donjonFini(e.nom, e.temps, L); } catch (err) { console.warn('partie : record raté', err.message); }
      }
      this.relever(PARTIE.pas);
      if ((this.depuisSauvegarde += PARTIE.pas) >= PARTIE.sauvegarde) { this.depuisSauvegarde = 0; for (const m of this.membres.values()) this.sauverMembre(m); }
      if (++this.n % S.COOP.tous) continue;
      for (const [num, m] of this.membres) if (m.pret && m.em) this.envoyer(num, { k: 'instantane', ...m.em.instantane(w) });
    }
  }
  relever(dt) {
    const w = this.w;
    for (const m of this.membres.values()) {
      const q = w.players.find(p => p.id === m.joueur);
      if (!q) continue;
      if (!q.dead) { m.mortDepuis = 0; continue; }
      if ((m.mortDepuis += dt) < PARTIE.releve) continue;
      if (this.monde && !w.arene) { w.commeJoueur(q, () => w.respawnPlayer()); m.mortDepuis = 0; continue; }
      const a = w.players.find(p => !p.dead) ?? q, f = w.map.nearestFree(a.x + 40, a.y);
      q.dead = false; q.hp = q.maxHp; q.x = f.x; q.y = f.y; q.invuln = 2; q.setAnim('idle');
      m.mortDepuis = 0;
    }
  }
  /** Sauve le perso d'un membre venu avec son compte : son état dans la partie, mais sa place et ses quêtes d'avant. */
  sauverMembre(m) {
    if (!m.compte || !this.sauver || !this.w) return;
    const q = this.w.players.find(p => p.id === m.joueur);
    if (!q) return;
    try {
      const avant = m.compte.perso, etat = this.w.commeJoueur(q, () => this.S.exporterJoueur(this.w));
      for (const k of this.monde ? GARDES_MONDE : GARDES) { if (avant.etat && k in avant.etat) etat[k] = avant.etat[k]; else delete etat[k]; }
      const t = Date.now(), temps = (avant.temps ?? 0) + Math.round((t - m.arrivee) / 1000);
      m.arrivee = t;
      m.compte.perso = { ...avant, etat, temps };
      this.sauver(m.compte, m.compte.perso);
    } catch (e) { console.warn('partie : sauvegarde ratée', e.message); }
  }
  /** Sauve tout le monde (serveur qui s'arrête). */
  sauverTout() { for (const m of this.membres.values()) this.sauverMembre(m); }
  /** État du perso d'un joueur. */
  etatDe(num) {
    const m = this.membres.get(num), q = m && this.w?.players.find(p => p.id === m.joueur);
    return q ? this.w.commeJoueur(q, () => this.S.exporterJoueur(this.w)) : null;
  }
}
