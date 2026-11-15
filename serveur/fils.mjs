// Un fil Node par cœur (« En ligne : » 7B, Mathis 2026-11-15) : côté fil principal. Chaque partie tenue par le serveur tourne dans
// un fil (fil.mjs) ; ici, une PartieDistante lui ressemble pour index.mjs (arrivee, depart, recu, membres, positionDe,
// joueurDuCompte, sauverTout) et lui transmet tout par messages. Sans FILS (0), index.mjs garde les parties dans son propre fil.
import { Worker } from 'node:worker_threads';

/**
 * @param {{ n: number, cle?: string, recevoir: (code: string, num: number, texte: string) => void, sauver: (compte: number, emplacement: number, perso: any) => void,
 *   donjonFini: (nom: string, temps: number, L: any[], idoles: number) => void, arret: (code: string) => void, memoire?: number }} o
 */
export function creerFils({ n, cle, recevoir, sauver, donjonFini, arret, memoire = 700 }) {
  const attente = new Map();
  let suivant = 1;
  const fils = Array.from({ length: n }, () => {
    const w = new Worker(new URL('./fil.mjs', import.meta.url), { workerData: { cle }, resourceLimits: { maxOldGenerationSizeMb: memoire } });
    const f = { w, parties: new Map() };
    w.on('message', m => {
      if (m.t === 'env') recevoir(m.code, m.num, m.texte);
      else if (m.t === 'sauver') sauver(m.compte, m.emplacement, m.perso);
      else if (m.t === 'donjonFini') donjonFini(m.nom, m.temps, m.L, m.idoles);
      else if (m.t === 'positions') { const p = f.parties.get(m.code); if (p) p.positions = m.L; }
      else if (m.t === 'arret') { f.parties.delete(m.code); arret(m.code); }
      else if (m.t === 'reponse') { const r = attente.get(m.id); attente.delete(m.id); r?.(m.v); }
    });
    // un fil qui tombe : ses parties s'arrêtent (les joueurs reviennent en solo, « En ligne : » 9A)
    w.on('error', e => console.warn('fil des parties tombé :', e.message));
    w.on('exit', () => { for (const code of [...f.parties.keys()]) { f.parties.delete(code); arret(code); } fils.splice(fils.indexOf(f), 1); });
    return f;
  });
  const demander = (f, m) => new Promise(ok => { const id = suivant++; attente.set(id, ok); f.w.postMessage({ ...m, id }); });

  class PartieDistante {
    constructor(f, code, S, o) {
      this.f = f; this.code = code; this.distante = true;
      this.monde = !!o.monde;
      this.zoneMonde = this.monde ? (typeof o.monde === 'string' && S.mondes[o.monde] ? o.monde : 'incarnam') : null;
      this.membres = new Map();
      /** [compte, emplacement, x, y] de chaque perso du compte, envoyé par le fil une fois par seconde. */
      this.positions = [];
    }
    poster(m) { this.f.w.postMessage({ ...m, code: this.code }); }
    arrivee(num) { this.membres.set(num, {}); this.poster({ t: 'arrivee', num }); }
    depart(num) { this.membres.delete(num); this.poster({ t: 'depart', num }); }
    recu(num, d) {
      if (d && typeof d === 'object' && d.k === 'bonjour' && d.compte) { const m = this.membres.get(num); if (m) m.compte = d.compte; }
      this.poster({ t: 'recu', num, d });
    }
    get vide() { return this.membres.size === 0; }
    avancer() { /* le fil s'en charge */ }
    positionDe(compte) { const p = this.positions.find(x => x[0] === compte); return p ? { x: p[2], y: p[3] } : null; }
    joueurDuCompte(compte, emplacement) {
      if (![...this.membres.values()].some(m => m.compte?.compte === compte && m.compte.emplacement === emplacement)) return null;
      return { appliquer: op => demander(this.f, { t: 'hdv', code: this.code, compte, emplacement, op }) };
    }
    sauverTout() { return demander(this.f, { t: 'sauverTout', code: this.code }); }
    fermer() { this.f.parties.delete(this.code); return demander(this.f, { t: 'fermer', code: this.code }); }
  }

  return {
    get n() { return fils.length; },
    /** Nouvelle partie dans le fil qui en a le moins. */
    creer(code, S, seed, o) {
      const f = fils.reduce((a, b) => (b.parties.size < a.parties.size ? b : a));
      const p = new PartieDistante(f, code, S, o);
      f.parties.set(code, p);
      f.w.postMessage({ t: 'creer', code, seed, o });
      return p;
    },
    async fermer() { await Promise.all(fils.map(f => f.w.terminate())); },
  };
}
