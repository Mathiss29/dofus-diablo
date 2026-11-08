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
};

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
  constructor(S, envoyer, seed = Math.floor(Math.random() * 2 ** 31)) {
    this.S = S; this.envoyer = envoyer; this.seed = seed;
    this.w = null;
    this.membres = new Map();
    this.n = 0; this.reste = 0; this.erreurs = 0;
  }
  arrivee(num) {
    const S = this.S;
    this.membres.set(num, { joueur: null, em: null, pret: false, entree: S.entreeInvite(null), pressed: null, potion: false, mortDepuis: 0 });
  }
  depart(num) {
    const m = this.membres.get(num);
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
    } else if (d.k === 'pret') { m.pret = true; m.em?.toutRenvoyer(); }
  }

  /** Pose le perso d'un joueur dans l'arène (la partie démarre avec le premier) et l'y appelle. */
  poser(num, m, d) {
    const S = this.S;
    if (m.joueur != null) return;
    const classe = typeof d.classe === 'string' && S.GAME_DATA.classes[d.classe] ? d.classe : 'iop';
    const etat = d.etat && typeof d.etat === 'object' ? { ...d.etat, zone: '__coop', havreSac: undefined } : null;
    let q;
    if (!this.w) {
      this.w = new S.World({ data: S.GAME_DATA, zone: 'incarnam', map: new S.WorldGrid(S.monde), seed: this.seed, classId: classe, items: S.ITEMS, partieServeur: true });
      this.w.allerArene(PARTIE.arene);
      // le fondu d'entrée de l'arène : on le passe tout de suite, le joueur arrive directement dedans
      for (let i = 0; i < 300 && this.w.passage; i++) this.w.step(PARTIE.pas, S.NO_INPUT);
      this.w.drainEvents();
      q = this.w.players[0];
    } else {
      if (this.w.players.length >= 4) return;
      q = this.w.ajouterJoueur(classe);
    }
    if (etat) { try { this.w.commeJoueur(q, () => S.restaurerJoueur(this.w, etat)); } catch (e) { console.warn('partie : perso illisible', e.message); } }
    if (this.w.players[0] !== q) { const f = this.w.map.nearestFree(this.w.players[0].x + 40, this.w.players[0].y); q.x = f.x; q.y = f.y; }
    q.hp = q.maxHp;
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
        entrees[m.joueur] = { ...m.entree, pressed: m.pressed, potion: m.potion };
        m.pressed = null; m.potion = false;
      }
      const premier = w.players[0];
      const autres = { ...entrees }; delete autres[premier.id];
      try { w.step(PARTIE.pas, entrees[premier.id] ?? S.NO_INPUT, autres); this.erreurs = 0; }
      catch (e) { if (++this.erreurs > 30) throw e; console.warn('partie : pas raté', e.message); }
      const evs = w.drainEvents();
      for (const m of this.membres.values()) if (m.em) for (const e of evs) m.em.noter(e);
      this.relever(PARTIE.pas);
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
      const a = w.players.find(p => !p.dead) ?? q, f = w.map.nearestFree(a.x + 40, a.y);
      q.dead = false; q.hp = q.maxHp; q.x = f.x; q.y = f.y; q.invuln = 2; q.setAnim('idle');
      m.mortDepuis = 0;
    }
  }
  /** État du perso d'un joueur (pour le sauver sur son compte, étape suivante). */
  etatDe(num) {
    const m = this.membres.get(num), q = m && this.w?.players.find(p => p.id === m.joueur);
    return q ? this.w.commeJoueur(q, () => this.S.exporterJoueur(this.w)) : null;
  }
}
