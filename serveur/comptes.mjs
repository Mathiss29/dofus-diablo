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
      donnees TEXT NOT NULL, maj INTEGER NOT NULL, PRIMARY KEY (compte, sorte));`);
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

  /** Répond aux adresses des comptes ; renvoie false si l'adresse n'est pas la sienne. */
  async function route(req, res, url) {
    const p = url.pathname, m = req.method;
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
    if (!['/moi', '/deconnexion', '/import'].includes(p) && !p.startsWith('/persos/') && !p.startsWith('/coffres/')) return false;
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

  return { route, copieNocturne, pret, stats: () => q.nb.get(), fermer: () => { clearInterval(minuterie); db.close(); } };
}
