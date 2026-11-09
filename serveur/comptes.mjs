// Comptes Discord et persos en ligne (maquette « Vrai multi : » 3A, 4A, 5A, 11B ; 2026-11-08).
// Connexion : bouton « Se connecter avec Discord » → /connexion → Discord → /connexion/retour → le jeu reçoit un jeton
// dans l'adresse (#connexion=…), qu'il garde dans le navigateur et envoie ensuite (Authorization: Bearer).
// Base SQLite (node:sqlite, intégré à Node 22) dans DONNEES, copie chaque nuit à 4 h 30 (après celle d'Idlus, 4 h).
// Secrets (posés sur le VPS par le projet Idlus, jamais dans le dépôt) : DISCORD_ID, DISCORD_SECRET dans /etc/diablofus/discord.env.
// Facultatif : DISCORD_SERVEUR (id du serveur Discord), ROLES_TESTEUR et ROLES_ADMIN (ids de rôles, séparés par des virgules).
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const COMPTES = {
  emplacements: 3,
  /** Taille maximale d'un perso envoyé (le gros, c'est l'inventaire et le codex). */
  tailleMax: 2 * 1024 * 1024,
  /** Durée d'un jeton de connexion. */
  jeton: 90 * 86400e3,
  /** Copies de la base gardées (une par nuit). */
  copies: 14,
};
const DISCORD = 'https://discord.com';

/** Empreinte d'un jeton : la base ne garde jamais le jeton lui-même. */
const empreinte = j => createHash('sha256').update(j).digest('hex');
const liste = s => new Set(String(s ?? '').split(',').map(x => x.trim()).filter(Boolean));

/** Étapes comptées du parcours d'un nouveau venu, dans l'ordre. */
export const PARCOURS = ['accueil', 'creation', 'perso', 'tuto'];
/** Arrivée en jeu (maquette « Arrivée : » 7A) : temps entre « Jouer » et le monde affiché, rangé par tranche (secondes). */
export const TRANCHES_ARRIVEE = [[2, '<2 s'], [4, '2-4 s'], [6, '4-6 s'], [10, '6-10 s'], [Infinity, '10 s et +']];

/**
 * @param {{ dossier: string, env?: Record<string,string|undefined>, origines: Set<string>, fetch?: typeof fetch, maintenant?: () => number }} o
 */
export function creerComptes({ dossier, env = process.env, origines, fetch: f = fetch, maintenant = Date.now }) {
  mkdirSync(dossier, { recursive: true });
  const db = new DatabaseSync(join(dossier, 'diablofus.db'));
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS comptes (id INTEGER PRIMARY KEY, discord TEXT UNIQUE NOT NULL, nom TEXT NOT NULL, avatar TEXT,
      roles TEXT NOT NULL DEFAULT '[]', importe INTEGER NOT NULL DEFAULT 0, cree INTEGER NOT NULL, vu INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS jetons (empreinte TEXT PRIMARY KEY, compte INTEGER NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
      cree INTEGER NOT NULL, expire INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS persos (compte INTEGER NOT NULL REFERENCES comptes(id) ON DELETE CASCADE, emplacement INTEGER NOT NULL,
      donnees TEXT NOT NULL, maj INTEGER NOT NULL, PRIMARY KEY (compte, emplacement));
    CREATE TABLE IF NOT EXISTS coffres (compte INTEGER NOT NULL REFERENCES comptes(id) ON DELETE CASCADE, sorte TEXT NOT NULL,
      donnees TEXT NOT NULL, maj INTEGER NOT NULL, PRIMARY KEY (compte, sorte));
    CREATE TABLE IF NOT EXISTS liens (de INTEGER NOT NULL REFERENCES comptes(id) ON DELETE CASCADE, vers INTEGER NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
      sorte TEXT NOT NULL, nom TEXT NOT NULL DEFAULT '', nom_de TEXT NOT NULL DEFAULT '', depuis INTEGER NOT NULL, PRIMARY KEY (de, vers));
    CREATE TABLE IF NOT EXISTS social (compte INTEGER PRIMARY KEY REFERENCES comptes(id) ON DELETE CASCADE, hors_ligne INTEGER NOT NULL DEFAULT 0,
      inconnus INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS parcours (jour TEXT NOT NULL, etape TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (jour, etape));
    CREATE TABLE IF NOT EXISTS arrivees (jour TEXT NOT NULL, tranche TEXT NOT NULL, n INTEGER NOT NULL, ms INTEGER NOT NULL, PRIMARY KEY (jour, tranche));`);
  const q = {
    compteDiscord: db.prepare('SELECT * FROM comptes WHERE discord = ?'),
    nouveau: db.prepare('INSERT INTO comptes (discord, nom, avatar, roles, cree, vu) VALUES (?, ?, ?, ?, ?, ?)'),
    majCompte: db.prepare('UPDATE comptes SET nom = ?, avatar = ?, roles = ?, vu = ? WHERE id = ?'),
    jeton: db.prepare('INSERT INTO jetons (empreinte, compte, cree, expire) VALUES (?, ?, ?, ?)'),
    session: db.prepare('SELECT c.* FROM jetons j JOIN comptes c ON c.id = j.compte WHERE j.empreinte = ? AND j.expire > ?'),
    sortir: db.prepare('DELETE FROM jetons WHERE empreinte = ?'),
    vieux: db.prepare('DELETE FROM jetons WHERE expire <= ?'),
    persos: db.prepare('SELECT emplacement, donnees, maj FROM persos WHERE compte = ?'),
    perso: db.prepare('SELECT maj FROM persos WHERE compte = ? AND emplacement = ?'),
    ecrire: db.prepare('INSERT INTO persos (compte, emplacement, donnees, maj) VALUES (?, ?, ?, ?) ON CONFLICT (compte, emplacement) DO UPDATE SET donnees = excluded.donnees, maj = excluded.maj'),
    effacer: db.prepare('DELETE FROM persos WHERE compte = ? AND emplacement = ?'),
    coffres: db.prepare('SELECT sorte, donnees FROM coffres WHERE compte = ?'),
    coffre: db.prepare('INSERT INTO coffres (compte, sorte, donnees, maj) VALUES (?, ?, ?, ?) ON CONFLICT (compte, sorte) DO UPDATE SET donnees = excluded.donnees, maj = excluded.maj'),
    importe: db.prepare('UPDATE comptes SET importe = 1 WHERE id = ? AND importe = 0'),
    liens: db.prepare('SELECT l.vers, l.sorte, l.nom, l.depuis, c.nom AS discord, c.vu FROM liens l JOIN comptes c ON c.id = l.vers WHERE l.de = ?'),
    versMoi: db.prepare("SELECT l.de, l.nom_de AS nom, l.depuis FROM liens l WHERE l.vers = ? AND l.sorte = 'demande'"),
    lien: db.prepare('SELECT sorte FROM liens WHERE de = ? AND vers = ?'),
    lier: db.prepare('INSERT INTO liens (de, vers, sorte, nom, nom_de, depuis) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (de, vers) DO UPDATE SET sorte = excluded.sorte, nom = excluded.nom, nom_de = excluded.nom_de, depuis = excluded.depuis'),
    delier: db.prepare('DELETE FROM liens WHERE de = ? AND vers = ?'),
    parDiscord: db.prepare('SELECT id, nom FROM comptes WHERE lower(nom) = lower(?)'),
    parPerso: db.prepare("SELECT compte AS id, json_extract(donnees, '$.nom') AS nom FROM persos WHERE lower(json_extract(donnees, '$.nom')) = lower(?)"),
    reglagesSociaux: db.prepare('SELECT hors_ligne, inconnus FROM social WHERE compte = ?'),
    regler: db.prepare('INSERT INTO social (compte, hors_ligne, inconnus) VALUES (?, ?, ?) ON CONFLICT (compte) DO UPDATE SET hors_ligne = excluded.hors_ligne, inconnus = excluded.inconnus'),
    parcours: db.prepare('INSERT INTO parcours (jour, etape, n) VALUES (?, ?, 1) ON CONFLICT (jour, etape) DO UPDATE SET n = n + 1'),
    lireParcours: db.prepare('SELECT jour, etape, n FROM parcours WHERE jour >= ? ORDER BY jour'),
    arrivee: db.prepare('INSERT INTO arrivees (jour, tranche, n, ms) VALUES (?, ?, 1, ?) ON CONFLICT (jour, tranche) DO UPDATE SET n = n + 1, ms = ms + excluded.ms'),
    lireArrivees: db.prepare('SELECT jour, tranche, n, ms FROM arrivees WHERE jour >= ? ORDER BY jour'),
    nb: db.prepare('SELECT (SELECT COUNT(*) FROM comptes) AS inscrits, (SELECT COUNT(*) FROM persos) AS persos'),
  };
  const testeurs = liste(env.ROLES_TESTEUR), admins = liste(env.ROLES_ADMIN);
  const pret = !!(env.DISCORD_ID && env.DISCORD_SECRET);
  const publique = (env.ADRESSE_PUBLIQUE ?? 'https://api.diablofus.com').replace(/\/$/, '');
  const retourDiscord = `${publique}/connexion/retour`;
  /** Connexions en cours (state OAuth2 → adresse du jeu où revenir), 10 minutes au plus. */
  const etats = new Map();

  const json = (res, code, corps) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(corps)); };
  const vers = (res, url) => { res.writeHead(302, { location: url, 'cache-control': 'no-store' }); res.end(); };
  /** Adresse du jeu où revenir : seulement un site autorisé (pas de redirection ouverte). */
  const retourValide = r => { try { const u = new URL(r); return origines.has(u.origin) ? `${u.origin}${u.pathname}` : null; } catch { return null; } };
  const lireCorps = req => new Promise((ok, ko) => {
    const morceaux = []; let n = 0;
    // trop gros : on lit la suite sans la garder, puis on répond 413 (couper la connexion empêcherait le jeu de lire la réponse)
    req.on('data', c => { n += c.length; if (n <= COMPTES.tailleMax) morceaux.push(c); });
    req.on('end', () => {
      if (n > COMPTES.tailleMax) return ko(Object.assign(new Error('trop gros'), { code: 413 }));
      try { ok(n ? JSON.parse(Buffer.concat(morceaux).toString('utf8')) : {}); } catch { ko(Object.assign(new Error('json'), { code: 400 })); }
    });
    req.on('error', ko);
  });
  const vue = c => {
    const roles = JSON.parse(c.roles);
    return {
      nom: c.nom, avatar: c.avatar ? `https://cdn.discordapp.com/avatars/${c.discord}/${c.avatar}.png?size=64` : null,
      // 10A : essai fermé au rôle « testeur » ; sans rôles configurés, tout le monde est testeur
      testeur: !testeurs.size || roles.some(r => testeurs.has(r)) || roles.some(r => admins.has(r)),
      admin: roles.some(r => admins.has(r)), importe: !!c.importe,
    };
  };
  function connecte(req) {
    const a = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.authorization ?? '');
    return a ? q.session.get(empreinte(a[1]), maintenant()) ?? null : null;
  }
  const emplacement = s => { const n = Number(s); return Number.isInteger(n) && n >= 0 && n < COMPTES.emplacements ? n : null; };

  /** Connexion Discord : échange le code, lit le joueur (et ses rôles sur le serveur Discord du jeu), crée le compte au besoin. */
  async function discord(code) {
    const t = await f(`${DISCORD}/api/oauth2/token`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: env.DISCORD_ID, client_secret: env.DISCORD_SECRET, grant_type: 'authorization_code', code, redirect_uri: retourDiscord }),
    });
    if (!t.ok) throw new Error(`jeton Discord ${t.status}`);
    const { access_token } = await t.json();
    const auth = { authorization: `Bearer ${access_token}` };
    const u = await f(`${DISCORD}/api/users/@me`, { headers: auth });
    if (!u.ok) throw new Error(`profil Discord ${u.status}`);
    const moi = await u.json();
    let roles = [];
    if (env.DISCORD_SERVEUR) {
      const m = await f(`${DISCORD}/api/users/@me/guilds/${env.DISCORD_SERVEUR}/member`, { headers: auth });
      if (m.ok) roles = (await m.json()).roles ?? [];
    }
    const nom = String(moi.global_name || moi.username || 'Aventurier').slice(0, 32), t0 = maintenant();
    const c = q.compteDiscord.get(String(moi.id));
    if (c) q.majCompte.run(nom, moi.avatar ?? null, JSON.stringify(roles), t0, c.id);
    else q.nouveau.run(String(moi.id), nom, moi.avatar ?? null, JSON.stringify(roles), t0, t0);
    const id = q.compteDiscord.get(String(moi.id)).id;
    const jeton = randomBytes(32).toString('hex');
    q.jeton.run(empreinte(jeton), id, t0, t0 + COMPTES.jeton);
    return jeton;
  }

  /** Parcours des nouveaux venus (maquette « Accueil : », idée C) : compteurs anonymes par jour, sans compte ni adresse
   *  gardée. Une même adresse IP ne compte qu'une fois par étape et par jour (vérifié en mémoire, jamais écrit). */
  const vusParcours = new Set();
  let jourParcours = '';
  function noterParcours(req, etape) {
    if (!PARCOURS.includes(etape)) return false;
    const jour = new Date(maintenant()).toISOString().slice(0, 10);
    if (jour !== jourParcours) { jourParcours = jour; vusParcours.clear(); }
    const ip = String(req.headers['cf-connecting-ip'] ?? req.socket?.remoteAddress ?? '');
    const k = `${ip}|${etape}`;
    if (vusParcours.has(k) || vusParcours.size > 200_000) return true;
    vusParcours.add(k); q.parcours.run(jour, etape);
    return true;
  }

  /** Arrivées en jeu : au plus 30 par adresse IP et par jour (vérifié en mémoire, jamais écrit). */
  const arriveesIp = new Map();
  function noterArrivee(req, brut) {
    const ms = Number(brut);
    if (!Number.isFinite(ms) || ms <= 0 || ms >= 600_000) return false;
    const jour = new Date(maintenant()).toISOString().slice(0, 10);
    if (jour !== jourParcours) { jourParcours = jour; vusParcours.clear(); arriveesIp.clear(); }
    const ip = String(req.headers['cf-connecting-ip'] ?? req.socket?.remoteAddress ?? '');
    const n = arriveesIp.get(ip) ?? 0;
    if (n >= 30 || arriveesIp.size > 200_000) return true;
    arriveesIp.set(ip, n + 1);
    const tranche = TRANCHES_ARRIVEE.find(([s]) => ms < s * 1000)[1];
    q.arrivee.run(jour, tranche, Math.round(ms));
    return true;
  }

  /** Répond aux adresses des comptes ; renvoie false si l'adresse n'est pas la sienne. */
  async function route(req, res, url) {
    const p = url.pathname, m = req.method;
    if (p === '/parcours') {
      if (m === 'POST') {
        const a = url.searchParams.get('arrivee');
        return json(res, (a !== null ? noterArrivee(req, a) : noterParcours(req, url.searchParams.get('etape') ?? '')) ? 200 : 400, {}), true;
      }
      if (m === 'GET') {
        const depuis = new Date(maintenant() - 30 * 86400e3).toISOString().slice(0, 10), jours = {}, arrivees = {};
        for (const r of q.lireParcours.all(depuis)) (jours[r.jour] ??= {})[r.etape] = r.n;
        // arrivée en jeu par jour : nombre, moyenne en secondes, et nombre par tranche
        for (const r of q.lireArrivees.all(depuis)) {
          const j = arrivees[r.jour] ??= { n: 0, ms: 0, tranches: {} };
          j.n += r.n; j.ms += r.ms; j.tranches[r.tranche] = r.n;
        }
        for (const j of Object.values(arrivees)) { j.moyenne = Math.round(j.ms / j.n / 100) / 10; delete j.ms; }
        return json(res, 200, { etapes: PARCOURS, jours, arrivees }), true;
      }
    }
    if (m === 'GET' && p === '/connexion') {
      const retour = retourValide(url.searchParams.get('retour'));
      if (!retour) return json(res, 400, { erreur: 'retour' }), true;
      if (!pret) return vers(res, `${retour}#connexion-erreur=indisponible`), true;
      const etat = randomBytes(16).toString('hex'), t0 = maintenant();
      for (const [k, v] of etats) if (t0 - v.t > 600e3) etats.delete(k);
      if (etats.size > 5000) return vers(res, `${retour}#connexion-erreur=occupe`), true;
      etats.set(etat, { retour, t: t0 });
      const scope = env.DISCORD_SERVEUR ? 'identify guilds.members.read' : 'identify';
      vers(res, `${DISCORD}/oauth2/authorize?${new URLSearchParams({ client_id: env.DISCORD_ID, response_type: 'code', redirect_uri: retourDiscord, scope, state: etat, prompt: 'none' })}`);
      return true;
    }
    if (m === 'GET' && p === '/connexion/retour') {
      const e = etats.get(url.searchParams.get('state') ?? '');
      if (!e || maintenant() - e.t > 600e3) return json(res, 400, { erreur: 'connexion expirée, recommence depuis le jeu' }), true;
      etats.delete(url.searchParams.get('state'));
      const code = url.searchParams.get('code');
      if (!code) return vers(res, `${e.retour}#connexion-erreur=refus`), true;
      try { vers(res, `${e.retour}#connexion=${await discord(code)}`); }
      catch (err) { console.warn('connexion Discord :', err.message); vers(res, `${e.retour}#connexion-erreur=discord`); }
      return true;
    }
    if (!['/moi', '/deconnexion', '/import'].includes(p) && !p.startsWith('/persos/') && !p.startsWith('/coffres/') && !p.startsWith('/tombes/')) return false;
    const c = connecte(req);
    if (!c) return json(res, 401, { erreur: 'connexion' }), true;
    try {
      if (m === 'GET' && p === '/moi') {
        const persos = Array(COMPTES.emplacements).fill(null);
        for (const r of q.persos.all(c.id)) if (r.emplacement < COMPTES.emplacements) persos[r.emplacement] = { perso: JSON.parse(r.donnees), maj: r.maj };
        const coffres = {};
        for (const r of q.coffres.all(c.id)) coffres[r.sorte] = JSON.parse(r.donnees);
        return json(res, 200, { compte: vue(c), persos, coffres }), true;
      }
      // coffre partagé du compte (0.3, 12A+12D) : un pour les persos normaux, un pour les Hardcore
      if (p.startsWith('/coffres/')) {
        const sorte = p.slice('/coffres/'.length);
        if (m !== 'PUT' || !['normal', 'hardcore'].includes(sorte)) return json(res, 404, { erreur: 'coffre' }), true;
        const b = await lireCorps(req);
        if (!b.coffre || typeof b.coffre !== 'object') return json(res, 400, { erreur: 'coffre' }), true;
        q.coffre.run(c.id, sorte, JSON.stringify(b.coffre), maintenant());
        return json(res, 200, { ok: true }), true;
      }
      // Ladder 3B : un perso Hardcore est mort ; le classement garde sa ligne (« Tombés »), puis le perso est effacé
      if (p.startsWith('/tombes/')) {
        const i = emplacement(p.slice('/tombes/'.length));
        if (m !== 'POST' || i == null) return json(res, 404, { erreur: 'emplacement' }), true;
        const b = await lireCorps(req), r = q.persos.all(c.id).find(x => x.emplacement === i);
        if (r) { try { api.surTombe?.(c.id, JSON.parse(r.donnees), b && typeof b === 'object' ? b : {}); } catch (err) { console.warn('tombe :', err.message); } q.effacer.run(c.id, i); }
        return json(res, 200, { ok: true }), true;
      }
      if (m === 'POST' && p === '/deconnexion') { q.sortir.run(empreinte(req.headers.authorization.slice(7))); return json(res, 200, { ok: true }), true; }
      const n = p === '/import' ? null : emplacement(p.slice('/persos/'.length));
      if (p !== '/import' && n == null) return json(res, 404, { erreur: 'emplacement' }), true;
      if (m === 'DELETE' && n != null) { q.effacer.run(c.id, n); return json(res, 200, { ok: true }), true; }
      if (m === 'PUT' || (m === 'POST' && p === '/import')) {
        const b = await lireCorps(req);
        const ici = p === '/import' ? emplacement(b.emplacement) : n;
        if (ici == null || !b.perso || typeof b.perso !== 'object' || typeof b.perso.nom !== 'string' || typeof b.perso.classe !== 'string') return json(res, 400, { erreur: 'perso' }), true;
        const maj = Number(b.maj) || maintenant();
        const avant = q.perso.get(c.id, ici);
        // 4A : un seul perso du navigateur peut venir en ligne, et seulement dans un emplacement libre
        if (p === '/import') {
          if (avant) return json(res, 409, { erreur: 'occupe' }), true;
          if (q.importe.run(c.id).changes === 0) return json(res, 403, { erreur: 'deja-importe' }), true;
        } else if (avant && avant.maj > maj) return json(res, 409, { erreur: 'plus-recent', maj: avant.maj }), true;   // un autre PC a sauvé plus tard
        q.ecrire.run(c.id, ici, JSON.stringify(b.perso), maj);
        return json(res, 200, { ok: true, maj }), true;
      }
      return json(res, 405, { erreur: 'methode' }), true;
    } catch (err) {
      return json(res, err.code === 413 ? 413 : err.code === 400 ? 400 : 500, { erreur: err.code === 413 ? 'trop gros' : err.code === 400 ? 'json' : 'serveur' }), true;
    }
  }

  /** 5A : copie de la base chaque nuit à 4 h 30 (heure de Paris), les COMPTES.copies dernières gardées. */
  function copieNocturne(date = new Date(maintenant())) {
    const dir = join(dossier, 'sauvegardes'); mkdirSync(dir, { recursive: true });
    const jour = date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
    const cible = join(dir, `diablofus-${jour}.db`);
    rmSync(cible, { force: true });
    db.exec(`VACUUM INTO '${cible.replaceAll("'", "''")}'`);
    q.vieux.run(maintenant());
    for (const v of readdirSync(dir).filter(x => /^diablofus-\d{4}-\d\d-\d\d\.db$/.test(x)).sort().reverse().slice(COMPTES.copies)) rmSync(join(dir, v), { force: true });
    return cible;
  }
  let derniere = '';
  const minuterie = setInterval(() => {
    const d = new Date(maintenant()), h = d.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
    const jour = d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
    if (h === '04:30' && derniere !== jour) { derniere = jour; try { console.log('copie de la base :', copieNocturne(d)); } catch (err) { console.warn('copie de la base :', err.message); } }
  }, 30_000);
  minuterie.unref();

  // ——— parties tenues par le serveur (maquette « Vrai multi : » 1A, 4A) : le serveur lit le perso du compte et le sauve lui-même ———
  /** Perso d'un emplacement pour une partie : null si le jeton ne vaut rien ou si l'emplacement est vide. */
  function persoPartie(jeton, n) {
    const i = emplacement(n);
    if (typeof jeton !== 'string' || !/^[0-9a-f]{64}$/.test(jeton) || i == null) return null;
    const c = q.session.get(empreinte(jeton), maintenant());
    const r = c && q.persos.all(c.id).find(x => x.emplacement === i);
    if (!r) return null;
    try { return { compte: c.id, emplacement: i, perso: JSON.parse(r.donnees), testeur: vue(c).testeur }; } catch { return null; }
  }
  /** Sauve le perso joué dans une partie, daté de maintenant : une copie plus ancienne envoyée par le jeu sera refusée (409). */
  function sauverPartie(compte, n, perso) {
    if (!q.perso.get(compte, n)) return false;   // supprimé entre-temps : on ne le recrée pas
    const maj = maintenant();
    q.ecrire.run(compte, n, JSON.stringify({ ...perso, maj }), maj);
    return true;
  }

  /** Compte d'un jeton (présence au Bastion, chat) : null si le jeton ne vaut rien. */
  function compteDuJeton(jeton) {
    if (typeof jeton !== 'string' || !/^[0-9a-f]{64}$/.test(jeton)) return null;
    const c = q.session.get(empreinte(jeton), maintenant());
    return c ? { id: c.id, nom: c.nom, testeur: vue(c).testeur, admin: vue(c).admin } : null;
  }

  // ——— amis et ignorés (« Social : » 2A-2D, 8A) : liens d'un compte vers un autre ———
  const AMIS_MAX = 200;
  const social = {
    /** Ce que le compte a lié : amis (avec le pseudo Discord : un ami peut le voir), demandes envoyées et reçues, ignorés, réglages. */
    liens(moi) {
      const L = q.liens.all(moi), r = q.reglagesSociaux.get(moi);
      return {
        amis: L.filter(l => l.sorte === 'ami').map(l => ({ id: l.vers, discord: l.discord, vu: l.vu, depuis: l.depuis })),
        envoyees: L.filter(l => l.sorte === 'demande').map(l => ({ id: l.vers, nom: l.nom })),
        recues: q.versMoi.all(moi).filter(d => q.lien.get(moi, d.de)?.sorte !== 'ignore').map(d => ({ id: d.de, nom: d.nom })),
        ignores: L.filter(l => l.sorte === 'ignore').map(l => ({ id: l.vers, nom: l.nom })),
        horsLigne: !!r?.hors_ligne, inconnus: !!r?.inconnus,
      };
    },
    sorte: (de, vers) => q.lien.get(de, vers)?.sorte ?? null,
    amis: (a, b) => q.lien.get(a, b)?.sorte === 'ami',
    ignore: (de, vers) => q.lien.get(de, vers)?.sorte === 'ignore',
    /** Un compte par son pseudo Discord ou le nom d'un de ses persos (le premier trouvé). */
    chercher(nom) {
      const n = String(nom ?? '').trim().slice(0, 40);
      if (!n) return null;
      const d = q.parDiscord.get(n); if (d) return { id: d.id, nom: n };
      const p = q.parPerso.get(n); return p ? { id: p.id, nom: String(p.nom) } : null;
    },
    /** Demande d'ami (2A) : s'il m'avait déjà demandé, nous voilà amis. Rend 'ami', 'demande', ou une raison de refus. */
    demander(moi, vers, monNom, sonNom) {
      if (moi === vers) return 'soi';
      if (q.liens.all(moi).filter(l => l.sorte === 'ami').length >= AMIS_MAX) return 'plein';
      const t = maintenant(), lui = q.lien.get(vers, moi)?.sorte;
      if (lui === 'ignore') return 'demande';   // il m'ignore : rien ne lui arrive, je ne le sais pas
      if (lui === 'demande' || lui === 'ami') { q.lier.run(moi, vers, 'ami', sonNom, monNom, t); q.lier.run(vers, moi, 'ami', monNom, sonNom, t); return 'ami'; }
      if (q.lien.get(moi, vers)?.sorte === 'ami') return 'ami';
      q.lier.run(moi, vers, 'demande', sonNom, monNom, t);
      return 'demande';
    },
    /** Retire un ami, une demande (envoyée ou reçue) ou un ignoré. */
    retirer(moi, vers) {
      const a = q.lien.get(moi, vers)?.sorte, b = q.lien.get(vers, moi)?.sorte;
      if (a === 'ami' || a === 'demande' || a === 'ignore') q.delier.run(moi, vers);
      if (b === 'ami' || b === 'demande') q.delier.run(vers, moi);
    },
    /** Ignorer (2D) : plus d'amitié ni de demande entre nous, ses messages et invitations ne m'arrivent plus. */
    ignorer(moi, vers, nom) {
      if (moi === vers) return false;
      if (q.lien.get(vers, moi)?.sorte !== 'ignore') q.delier.run(vers, moi);
      q.lier.run(moi, vers, 'ignore', String(nom).slice(0, 40), '', maintenant());
      return true;
    },
    regler(moi, horsLigne, inconnus) { q.regler.run(moi, horsLigne ? 1 : 0, inconnus ? 1 : 0); },
  };

  const api = { route, copieNocturne, pret, persoPartie, sauverPartie, compteDuJeton, social, stats: () => q.nb.get(), fermer: () => { clearInterval(minuterie); db.close(); },
    /** Pour le classement (classement.mjs) : la base, le compte d'une requête, le corps JSON d'une requête. */
    db, connecte, lireCorps,
    /** Ladder 3B : appelé avec (compte, perso, stèle) quand un perso Hardcore meurt, avant qu'il soit effacé. */
    surTombe: null };
  return api;
}
