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
  /** Chat : longueur d'un message, et au plus … messages par tranche de … ms. */
  longueurChat: 200,
  rafaleChat: 5,
  fenetreChat: 5000,
  /** Groupe (« Social : » 7A-7C) : 4 joueurs au plus ; un joueur déconnecté garde sa place … ms ; une invitation vaut … ms. */
  tailleGroupe: 4,
  graceGroupe: 60_000,
  dureeInvitation: 120_000,
};
const CANAUX = new Set(['tout', 'groupe', 'bastion', 'prive']);
/** Texte d'un message de chat : une ligne, sans caractères de contrôle. */
const propre = t => (typeof t === 'string' ? t.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, PRESENCE.longueurChat) : '');

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
  const so = comptes?.social;
  // ——— groupes (« Social : » 7A 7B, choix de Mathis 2026-11-08 : on se groupe sans bouger, le chef lance ensuite le donjon) ———
  /** gid → { id, chef, membres: compte[], invites: Map<compte, t>, donjon: code de la partie lancée | null } */
  const groupes = new Map();
  /** compte → gid ; compte → moment où il s'est déconnecté (il garde sa place un moment). */
  const groupeDe = new Map(), partis = new Map();
  let prochainGroupe = 1;
  const socketDe = c => { for (const [t, o] of joueurs) if (o.compte === c) return t; return null; };
  /** Ce que chaque membre reçoit : le chef, et pour chacun son perso (s'il est connecté), sa zone. */
  function envoyerGroupe(g) {
    const membres = g.membres.map(c => {
      const t = socketDe(c), o = t && joueurs.get(t);
      return o ? { id: c, nom: o.profil.nom, classe: o.profil.classe, niveau: o.profil.niveau, zone: o.zone, enLigne: true } : { id: c, nom: g.noms.get(c) ?? '?', enLigne: false };
    });
    for (const c of g.membres) { const t = socketDe(c); if (t) envoyer(t, { k: 'groupe', id: g.id, chef: g.chef, membres, donjon: g.donjon }); }
  }
  function quitterGroupe(c, pourquoi = '') {
    const g = groupes.get(groupeDe.get(c));
    groupeDe.delete(c); partis.delete(c);
    const t = socketDe(c); if (t) envoyer(t, { k: 'groupe', id: null });
    if (!g) return;
    const nom = g.noms.get(c) ?? '';
    g.membres = g.membres.filter(x => x !== c);
    if (g.membres.length < 2 && !g.invites.size || !g.membres.length) {   // seul : le groupe se dissout
      for (const x of g.membres) { groupeDe.delete(x); const u = socketDe(x); if (u) { envoyer(u, { k: 'groupe', id: null }); if (pourquoi !== 'seul') info(u, 'Le groupe est dissous'); } }
      groupes.delete(g.id); return;
    }
    if (g.chef === c) g.chef = g.membres[0];
    for (const x of g.membres) { const u = socketDe(x); if (u) info(u, pourquoi === 'exclu' ? `${nom} a été exclu du groupe` : `${nom} a quitté le groupe`); }
    envoyerGroupe(g);
  }
  function creerGroupe(j) {
    const g = { id: prochainGroupe++, chef: j.compte, membres: [j.compte], invites: new Map(), donjon: null, noms: new Map([[j.compte, j.profil.nom]]) };
    groupes.set(g.id, g); groupeDe.set(j.compte, g.id);
    return g;
  }
  const info = (s, texte) => envoyer(s, { k: 'info', texte });
  /** La liste d'amis d'un joueur (« Social : » 2B) : qui est en ligne, avec quel perso, où ; demandes ; ignorés ; réglages. */
  function envoyerAmis(s, j) {
    if (!so) return;
    const L = so.liens(j.compte), ici = parCompte();
    j.horsLigne = L.horsLigne; j.inconnus = L.inconnus;
    const amis = L.amis.map(a => {
      const o = ici.has(a.id) ? joueurs.get(ici.get(a.id)) : null, la = o && !o.horsLigne;
      return { id: a.id, discord: a.discord, vu: a.vu, ...(la ? { perso: { nom: o.profil.nom, classe: o.profil.classe, niveau: o.profil.niveau, zone: o.zone, groupe: groupeDe.has(o.compte), avecMoi: groupeDe.has(o.compte) && groupeDe.get(o.compte) === groupeDe.get(j.compte) } } : {}) };
    });
    envoyer(s, { k: 'amis', amis, recues: L.recues, envoyees: L.envoyees, ignores: L.ignores, horsLigne: L.horsLigne, inconnus: L.inconnus });
  }
  const amisDe = c => (so ? so.liens(c).amis.map(a => a.id) : []);
  /** Un joueur nommé (nom de perso d'un joueur en ligne, sinon pseudo Discord ou nom de perso du compte). */
  function trouver(nom) {
    const n = String(nom ?? '').trim().toLowerCase();
    if (!n) return null;
    for (const [t, o] of joueurs) if (o.profil.nom.toLowerCase() === n) return { id: o.compte, nom: o.profil.nom, s: t };
    const c = so?.chercher(n);
    return c ? { id: c.id, nom: c.nom, s: parCompte().get(c.id) ?? null } : null;
  }

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
        dits: avant?.dits ?? [], horsLigne: false, inconnus: false,
      });
      const j = joueurs.get(s);
      if (so) { const L = so.liens(c.compte); j.horsLigne = L.horsLigne; j.inconnus = L.inconnus; }
      // ses amis en ligne sont prévenus de son arrivée (5A), sauf s'il apparaît hors ligne
      if (!avant && !j.horsLigne) {
        const ici = parCompte();
        for (const a of amisDe(c.compte)) { const t = ici.get(a); if (t) { info(t, `${j.profil.nom} est en ligne`); envoyerAmis(t, joueurs.get(t)); } }
      }
      // profil changé (niveau, apparence, objets) : les voisins le recevront de nouveau
      for (const j of joueurs.values()) j.vus.delete(c.compte);
      envoyer(s, { k: 'presence', ok: true, id: c.compte });
      partis.delete(c.compte);
      const gg = groupes.get(groupeDe.get(c.compte)); if (gg) { gg.noms.set(c.compte, j.profil.nom); envoyerGroupe(gg); }
      return true;
    }
    const j = joueurs.get(s);
    if (!j) return ['pos', 'enligne', 'inviter', 'groupe', 'dire', 'amis', 'ami+', 'ami-', 'ignorer', 'reglagesSociaux', 'grpCreer', 'grpOui', 'grpNon', 'grpQuitter', 'grpExclure', 'grpChef', 'grpDonjon'].includes(m.k);
    if (m.k === 'pos') {
      if (typeof m.zone === 'string') j.zone = m.zone.slice(0, 40);
      j.x = fini(m.x); j.y = fini(m.y); j.f = fini(m.f);
      j.a = m.a === 'walk' || m.a === 'run' ? m.a : 'idle';
      return true;
    }
    if (m.k === 'groupe') { j.salon = typeof m.code === 'string' ? m.code.slice(0, 8) : null; return true; }
    // onglet Discord (1B) : tous les joueurs connectés avec leur perso en ligne
    if (m.k === 'enligne') {
      const amis = new Set(amisDe(j.compte));
      const l = [...joueurs.values()].filter(x => x !== j && !x.horsLigne && !so?.ignore(j.compte, x.compte)).slice(0, 200)
        .map(x => ({ id: x.compte, nom: x.profil.nom, classe: x.profil.classe, niveau: x.profil.niveau, zone: x.zone, groupe: groupeDe.has(x.compte), ami: amis.has(x.compte) }));
      envoyer(s, { k: 'enligne', l });
      return true;
    }
    // invitation dans son groupe (7A) : l'invité reçoit le code et choisit
    if (m.k === 'inviter') {
      const t = Date.now(), cible = parCompte().get(m.id);
      if (!cible || cible === s || t - j.invite < PRESENCE.ecartInvitation) return true;
      j.invite = t;
      const o = joueurs.get(cible);
      let g = groupes.get(groupeDe.get(j.compte));
      if (g?.membres.includes(o.compte)) return info(s, `${o.profil.nom} est déjà dans ton groupe`), true;
      if (g && g.membres.length >= PRESENCE.tailleGroupe) return info(s, 'Ton groupe est complet (4 joueurs)'), true;
      if (so?.ignore(o.compte, j.compte)) return info(s, `Invitation envoyée à ${o.profil.nom}`), true;   // il m'ignore : rien ne lui arrive
      if (o.inconnus && !so?.amis(o.compte, j.compte)) return info(s, `${o.profil.nom} n’accepte que les invitations de ses amis`), true;
      g ??= creerGroupe(j);
      g.invites.set(o.compte, t);
      envoyer(cible, { k: 'invitation', de: j.profil.nom, groupe: g.id });
      info(s, `Invitation envoyée à ${o.profil.nom}`);
      envoyerGroupe(g);
      return true;
    }
    if (m.k === 'grpCreer') { if (!groupeDe.has(j.compte)) envoyerGroupe(creerGroupe(j)); return true; }
    if (m.k === 'grpOui') {
      const g = groupes.get(m.groupe), t = Date.now(), inv = g?.invites.get(j.compte);
      if (!g || inv == null || t - inv > PRESENCE.dureeInvitation) return info(s, 'Cette invitation n’est plus valable'), true;
      if (g.membres.length >= PRESENCE.tailleGroupe) return info(s, 'Ce groupe est complet'), true;
      if (groupeDe.has(j.compte) && groupeDe.get(j.compte) !== g.id) quitterGroupe(j.compte);
      g.invites.delete(j.compte);
      if (!g.membres.includes(j.compte)) g.membres.push(j.compte);
      g.noms.set(j.compte, j.profil.nom); groupeDe.set(j.compte, g.id);
      for (const x of g.membres) { const u = socketDe(x); if (u && x !== j.compte) info(u, `${j.profil.nom} a rejoint le groupe`); }
      envoyerGroupe(g);
      return true;
    }
    if (m.k === 'grpNon') {
      const g = groupes.get(m.groupe);
      if (g?.invites.delete(j.compte)) { const u = socketDe(g.chef); if (u) info(u, `${j.profil.nom} a décliné l’invitation`); if (g.membres.length < 2 && !g.invites.size) quitterGroupe(g.chef, 'seul'); }
      return true;
    }
    if (m.k === 'grpQuitter') { quitterGroupe(j.compte); return true; }
    const g = groupes.get(groupeDe.get(j.compte));
    if (m.k === 'grpExclure' || m.k === 'grpChef' || m.k === 'grpDonjon') {
      if (!g || g.chef !== j.compte) return info(s, 'Seul le chef du groupe peut faire ça'), true;
      if (m.k === 'grpExclure') { if (g.membres.includes(m.id) && m.id !== j.compte) { const u = socketDe(m.id); if (u) info(u, 'Tu as été exclu du groupe'); quitterGroupe(m.id, 'exclu'); } }
      else if (m.k === 'grpChef') { if (g.membres.includes(m.id)) { g.chef = m.id; envoyerGroupe(g); } }
      else {
        // le chef lance un donjon (partie tenue par le serveur) : les autres reçoivent son code et choisissent
        g.donjon = typeof m.code === 'string' ? m.code.slice(0, 8) : null;
        if (g.donjon) for (const x of g.membres) { const u = socketDe(x); if (u && x !== j.compte) envoyer(u, { k: 'donjon', de: j.profil.nom, code: g.donjon, lieu: String(m.lieu ?? '').slice(0, 40) }); }
        envoyerGroupe(g);
      }
      return true;
    }
    // chat (« Social : » 4A 4C) : Tout (tous les joueurs en ligne), Groupe, Bastion (ceux qui y sont), Privé (un joueur, par le nom de son perso)
    if (m.k === 'dire') {
      const texte = propre(m.texte), canal = CANAUX.has(m.canal) ? m.canal : 'tout', t = Date.now();
      if (!texte) return true;
      j.dits = j.dits.filter(d => t - d < PRESENCE.fenetreChat);
      if (j.dits.length >= PRESENCE.rafaleChat) return envoyer(s, { k: 'info', texte: 'Doucement : attends un peu avant d’écrire de nouveau' }), true;
      j.dits.push(t);
      const msg = { k: 'chat', canal, id: j.compte, de: j.profil.nom, texte };
      if (canal === 'prive') {
        const nom = String(m.a ?? '').trim().toLowerCase();
        const cible = [...joueurs].find(([, o]) => o.profil.nom.toLowerCase() === nom);
        if (!cible) return envoyer(s, { k: 'info', texte: `Personne nommé ${String(m.a ?? '').slice(0, 20)} n’est en ligne` }), true;
        if (cible[0] !== s && !so?.ignore(cible[1].compte, j.compte)) envoyer(cible[0], msg);
        envoyer(s, { ...msg, vers: cible[1].profil.nom });
        return true;
      }
      const gid = groupeDe.get(j.compte);
      if (canal === 'groupe' && gid == null) return envoyer(s, { k: 'info', texte: 'Tu n’es pas dans un groupe' }), true;
      if (canal === 'bastion' && j.zone !== PRESENCE.partagee) return envoyer(s, { k: 'info', texte: 'Le canal Bastion, c’est pour ceux qui sont au Bastion des Douze' }), true;
      for (const [t2, o] of joueurs) {
        if ((canal === 'groupe' ? groupeDe.get(o.compte) === gid : canal === 'bastion' ? o.zone === PRESENCE.partagee : true) && !so?.ignore(o.compte, j.compte)) envoyer(t2, msg);
      }
      return true;
    }
    // amis et ignorés (« Social : » 2A-2D, 8A)
    if (!so) return ['amis', 'ami+', 'ami-', 'ignorer', 'reglagesSociaux'].includes(m.k);
    if (m.k === 'amis') { envoyerAmis(s, j); return true; }
    if (m.k === 'ami+') {
      const c = Number.isInteger(m.id) ? { id: m.id, nom: joueurs.get(parCompte().get(m.id))?.profil.nom ?? '', s: parCompte().get(m.id) ?? null } : trouver(m.nom);
      if (!c || !c.nom && !c.s) { info(s, `Personne ne s’appelle ${String(m.nom ?? '').slice(0, 20)}`); return true; }
      const nom = c.nom || joueurs.get(c.s)?.profil.nom || '';
      const r = so.demander(j.compte, c.id, j.profil.nom, nom);
      if (r === 'soi') info(s, 'C’est toi !');
      else if (r === 'plein') info(s, 'Ta liste d’amis est pleine');
      else if (r === 'ami') {
        info(s, `${nom} et toi êtes amis`);
        if (c.s && !so.ignore(c.id, j.compte)) { info(c.s, `${j.profil.nom} et toi êtes amis`); envoyerAmis(c.s, joueurs.get(c.s)); }
      } else {
        info(s, `Demande d’ami envoyée à ${nom}`);
        if (c.s && !so.ignore(c.id, j.compte)) { info(c.s, `${j.profil.nom} veut être ton ami (Social › Amis)`); envoyerAmis(c.s, joueurs.get(c.s)); }
      }
      envoyerAmis(s, j);
      return true;
    }
    if (m.k === 'ami-') {
      if (Number.isInteger(m.id)) { so.retirer(j.compte, m.id); const t = parCompte().get(m.id); if (t) envoyerAmis(t, joueurs.get(t)); }
      envoyerAmis(s, j);
      return true;
    }
    if (m.k === 'ignorer') {
      const c = Number.isInteger(m.id) ? { id: m.id, nom: String(m.nom ?? joueurs.get(parCompte().get(m.id))?.profil.nom ?? '') } : trouver(m.nom);
      if (!c) { info(s, `Personne ne s’appelle ${String(m.nom ?? '').slice(0, 20)}`); return true; }
      if (so.ignorer(j.compte, c.id, c.nom)) info(s, `${c.nom} est ignoré : ses messages et invitations ne t’arrivent plus`);
      const t = parCompte().get(c.id); if (t) envoyerAmis(t, joueurs.get(t));
      envoyerAmis(s, j);
      return true;
    }
    if (m.k === 'reglagesSociaux') { so.regler(j.compte, !!m.horsLigne, !!m.inconnus); envoyerAmis(s, j); return true; }
    return false;
  }
  function quitter(s) {
    const j = joueurs.get(s);
    joueurs.delete(s);
    // déconnecté : il garde sa place dans le groupe un moment (rechargement de la page, coupure)
    if (j && groupeDe.has(j.compte) && !socketDe(j.compte)) { partis.set(j.compte, Date.now()); envoyerGroupe(groupes.get(groupeDe.get(j.compte))); }
  }

  /** 10 fois par seconde : chacun reçoit les joueurs du Bastion les plus proches (positions), et leur profil la première fois. */
  let tours = 0;
  function tour() {
    // une fois par seconde : groupes (zones de chacun ; places des déconnectés depuis trop longtemps rendues)
    if (++tours % PRESENCE.frequence === 0) {
      const t = Date.now();
      for (const [c, d] of partis) if (t - d > PRESENCE.graceGroupe) quitterGroupe(c);
      for (const g of groupes.values()) {
        for (const [c, d] of g.invites) if (t - d > PRESENCE.dureeInvitation) g.invites.delete(c);
        envoyerGroupe(g);
      }
    }
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
  return { recu, quitter, tour, groupes: () => groupes.size, fermer: () => clearInterval(minuterie), nombre: () => joueurs.size,
    /** Ladder 7B : persos en ligne (« compte-emplacement »), sauf ceux qui apparaissent hors ligne. */
    enLigne: () => [...joueurs.values()].filter(j => !j.horsLigne).map(j => `${j.compte}-${j.emplacement}`) };
}
