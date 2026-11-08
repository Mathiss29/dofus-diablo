// Présence en ligne et Bastion partagé (maquette « Vrai multi : » étape 3, « Social : » 1B 2B 7A) : chaque joueur connecté avec
// son perso en ligne s'annonce ici. Le serveur sait qui est là (onglet Discord de la fenêtre Social, invitations) et relaie
// les positions des joueurs du Bastion entre eux. Chacun garde sa propre ville (PNJ, forge, boutiques instantanés) :
// les autres n'y sont que des passants, sans combat ni collision.

export const PRESENCE = {
  /** Envois des positions par seconde, vers les joueurs du Bastion. */
  frequence: 10,
  /** Zone où l'on voit les autres. */
  partagee: 'bastion',
  /** Joueurs envoyés au plus à chacun (les plus proches). */
  voisins: 24,
  /** Invitations : au plus une toutes les … ms par joueur. */
  ecartInvitation: 3000,
};

const ent = (x, a, b) => (Number.isInteger(x) && x >= a && x <= b ? x : null);
const fini = x => (typeof x === 'number' && Number.isFinite(x) ? x : 0);

/** Ce qu'on montre d'un perso (8B : le pseudo du perso, jamais le pseudo Discord). Lu sur le compte, pas envoyé par le jeu. */
function profilDe(perso, objets) {
  const e = perso.etat ?? {};
  const app = perso.apparence && typeof perso.apparence === 'object' ? perso.apparence : null;
  return {
    nom: String(perso.nom ?? '').slice(0, 20), classe: String(perso.classe ?? 'iop').slice(0, 20), sexe: perso.sexe === 'f' ? 'f' : 'm',
    niveau: ent(e.level, 1, 200) ?? 1, apparence: app,
    objets: Array.isArray(objets) ? objets.filter(o => typeof o === 'string' && o.length <= 16).slice(0, 6) : [],
  };
}

export function creerPresence({ comptes, envoyer }) {
  /** ws → { compte, emplacement, profil, zone, x, y, f, a, vus:Set, invite:number, salon:string|null } */
  const joueurs = new Map();
  const parCompte = () => { const m = new Map(); for (const [s, j] of joueurs) m.set(j.compte, s); return m; };

  /** Un message de présence ; vrai s'il était pour ce module. */
  function recu(s, m) {
    if (m.k === 'presence') {
      const c = comptes?.persoPartie(m.jeton, m.emplacement);
      if (!c) { envoyer(s, { k: 'presence', ok: false }); return true; }
      // le même compte ne s'affiche qu'une fois : l'ancienne connexion s'efface
      for (const [t, j] of joueurs) if (j.compte === c.compte && t !== s) { joueurs.delete(t); envoyer(t, { k: 'presence', ok: false, raison: 'ailleurs' }); }
      const avant = joueurs.get(s);
      joueurs.set(s, {
        compte: c.compte, emplacement: c.emplacement, profil: profilDe(c.perso, m.objets), zone: typeof m.zone === 'string' ? m.zone.slice(0, 40) : '',
        x: fini(m.x), y: fini(m.y), f: fini(m.f), a: 'idle', vus: avant?.vus ?? new Set(), invite: avant?.invite ?? 0, salon: avant?.salon ?? null,
      });
      // profil changé (niveau, apparence, objets) : les voisins le recevront de nouveau
      for (const j of joueurs.values()) j.vus.delete(c.compte);
      envoyer(s, { k: 'presence', ok: true, id: c.compte });
      return true;
    }
    const j = joueurs.get(s);
    if (!j) return m.k === 'pos' || m.k === 'enligne' || m.k === 'inviter' || m.k === 'groupe';
    if (m.k === 'pos') {
      if (typeof m.zone === 'string') j.zone = m.zone.slice(0, 40);
      j.x = fini(m.x); j.y = fini(m.y); j.f = fini(m.f);
      j.a = m.a === 'walk' || m.a === 'run' ? m.a : 'idle';
      return true;
    }
    if (m.k === 'groupe') { j.salon = typeof m.code === 'string' ? m.code.slice(0, 8) : null; return true; }
    // onglet Discord (1B) : tous les joueurs connectés avec leur perso en ligne
    if (m.k === 'enligne') {
      const l = [...joueurs.values()].filter(x => x !== j).slice(0, 200)
        .map(x => ({ id: x.compte, nom: x.profil.nom, classe: x.profil.classe, niveau: x.profil.niveau, zone: x.zone, groupe: !!x.salon }));
      envoyer(s, { k: 'enligne', l });
      return true;
    }
    // invitation dans son groupe (7A) : l'invité reçoit le code et choisit
    if (m.k === 'inviter') {
      const t = Date.now(), cible = parCompte().get(m.id);
      if (!j.salon) return envoyer(s, { k: 'info', texte: 'Crée d’abord un groupe' }), true;
      if (!cible || t - j.invite < PRESENCE.ecartInvitation) return true;
      j.invite = t;
      envoyer(cible, { k: 'invitation', de: j.profil.nom, code: j.salon });
      envoyer(s, { k: 'info', texte: `Invitation envoyée à ${joueurs.get(cible).profil.nom}` });
      return true;
    }
    return false;
  }
  function quitter(s) { joueurs.delete(s); }

  /** 10 fois par seconde : chacun reçoit les joueurs du Bastion les plus proches (positions), et leur profil la première fois. */
  function tour() {
    const ici = [...joueurs].filter(([, j]) => j.zone === PRESENCE.partagee);
    for (const [s, j] of ici) {
      const autres = ici.filter(([t]) => t !== s).map(([, o]) => o)
        .sort((a, b) => Math.hypot(a.x - j.x, a.y - j.y) - Math.hypot(b.x - j.x, b.y - j.y)).slice(0, PRESENCE.voisins);
      const neufs = autres.filter(o => !j.vus.has(o.compte));
      for (const o of neufs) j.vus.add(o.compte);
      envoyer(s, { k: 'autres', l: autres.map(o => [o.compte, Math.round(o.x), Math.round(o.y), +o.f.toFixed(2), o.a]),
        ...(neufs.length ? { profils: neufs.map(o => ({ id: o.compte, ...o.profil })) } : {}) });
    }
  }
  const minuterie = setInterval(tour, 1000 / PRESENCE.frequence);
  minuterie.unref();
  return { recu, quitter, tour, fermer: () => clearInterval(minuterie), nombre: () => joueurs.size };
}
