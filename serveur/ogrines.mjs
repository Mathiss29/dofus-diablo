// Ogrines et codes cadeaux (ligne « Apparats : » 10A+10B, 11A+11B+11D, 12A ; Mathis 2026-11-12).
// Les Ogrines vivent sur le compte Discord, tenues par le serveur (12A) : jamais dans la sauvegarde du navigateur, jamais à
// acheter avec de l'argent. On en gagne par des codes cadeaux (10A) et des événements (10B : un admin en donne à un joueur).
// Codes : créés par un admin (rôle ROLES_ADMIN) depuis le jeu ou par la commande /code du robot Discord (11B) ; un code peut
// aussi donner des objets (11D : ids d'objets ou d'apparats, remis au perso par le jeu).
// Commande Discord : le serveur répond aux « interactions » de Discord (POST /discord/interactions), signées par la clé
// publique de l'application (DISCORD_CLE_PUBLIQUE, onglet General Information du portail développeur).
import { createPublicKey, randomBytes, verify } from 'node:crypto';

export const OGRINES = {
  /** Un code : au plus tant d'Ogrines, d'utilisations, de jours, d'objets. */
  maxOgrines: 100_000, maxUtilisations: 100_000, maxJours: 365, maxObjets: 10,
  /** Essais de code par compte et par heure (contre ceux qui tentent des codes au hasard). */
  essais: 20,
};
const LETTRES = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // sans 0/O ni 1/I
export const nouveauCode = () => `DIABLO-${[0, 1].map(() => Array.from(randomBytes(4), b => LETTRES[b % LETTRES.length]).join('')).join('-')}`;
const normal = c => String(c ?? '').trim().toUpperCase().replace(/\s+/g, '');
const objetsValides = l => Array.isArray(l) ? l.filter(x => typeof x === 'string' && /^\d{1,7}$/.test(x)).slice(0, OGRINES.maxObjets) : [];

/**
 * @param {{ db: import('node:sqlite').DatabaseSync, connecte: (req: any) => any, admin: (c: any) => boolean, lireCorps: (req: any) => Promise<any>,
 *   env?: Record<string, string|undefined>, maintenant?: () => number, adminDiscord?: (roles: string[]) => boolean }} o
 */
export function creerOgrines({ db, connecte, admin, lireCorps, env = process.env, maintenant = Date.now, adminDiscord = () => false }) {
  db.exec(`CREATE TABLE IF NOT EXISTS ogrines (compte INTEGER PRIMARY KEY REFERENCES comptes(id) ON DELETE CASCADE, solde INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS ogrines_journal (compte INTEGER NOT NULL REFERENCES comptes(id) ON DELETE CASCADE, n INTEGER NOT NULL, raison TEXT NOT NULL, quand INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS codes (code TEXT PRIMARY KEY, ogrines INTEGER NOT NULL, objets TEXT NOT NULL DEFAULT '[]', max INTEGER NOT NULL,
      utilises INTEGER NOT NULL DEFAULT 0, expire INTEGER NOT NULL, cree INTEGER NOT NULL, par TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS codes_pris (code TEXT NOT NULL REFERENCES codes(code) ON DELETE CASCADE, compte INTEGER NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
      quand INTEGER NOT NULL, PRIMARY KEY (code, compte));`);
  const q = {
    solde: db.prepare('SELECT solde FROM ogrines WHERE compte = ?'),
    crediter: db.prepare('INSERT INTO ogrines (compte, solde) VALUES (?, ?) ON CONFLICT (compte) DO UPDATE SET solde = solde + excluded.solde'),
    debiter: db.prepare('UPDATE ogrines SET solde = solde - ? WHERE compte = ? AND solde >= ?'),
    journal: db.prepare('INSERT INTO ogrines_journal (compte, n, raison, quand) VALUES (?, ?, ?, ?)'),
    code: db.prepare('SELECT * FROM codes WHERE code = ?'),
    creer: db.prepare('INSERT INTO codes (code, ogrines, objets, max, expire, cree, par, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
    pris: db.prepare('SELECT 1 FROM codes_pris WHERE code = ? AND compte = ?'),
    prendre: db.prepare('INSERT INTO codes_pris (code, compte, quand) VALUES (?, ?, ?)'),
    utiliser: db.prepare('UPDATE codes SET utilises = utilises + 1 WHERE code = ? AND utilises < max'),
    codes: db.prepare('SELECT code, ogrines, objets, max, utilises, expire, cree, par, note FROM codes ORDER BY cree DESC LIMIT 50'),
    parDiscord: db.prepare('SELECT id, nom FROM comptes WHERE discord = ?'),
  };
  const json = (res, code, corps) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(corps)); };

  const solde = compte => q.solde.get(compte)?.solde ?? 0;
  /** Ajoute (ou retire, n < 0) des Ogrines ; false si le solde ne suffit pas. */
  function bouger(compte, n, raison) {
    if (!Number.isInteger(n) || n === 0) return false;
    if (n > 0) q.crediter.run(compte, n);
    else if (q.debiter.run(-n, compte, -n).changes === 0) return false;
    q.journal.run(compte, n, String(raison).slice(0, 80), maintenant());
    return true;
  }
  /** Crée un code ; rend le code ou une raison de refus. */
  function creerCode({ ogrines = 0, objets = [], max = 1, jours = 7, code, par = '', note = '' }) {
    const n = Math.floor(Number(ogrines) || 0), m = Math.floor(Number(max) || 0), j = Number(jours) || 0, l = objetsValides(objets);
    if (n < 0 || n > OGRINES.maxOgrines || (n === 0 && !l.length)) return { erreur: 'ogrines' };
    if (m < 1 || m > OGRINES.maxUtilisations) return { erreur: 'utilisations' };
    if (j <= 0 || j > OGRINES.maxJours) return { erreur: 'jours' };
    const c = code ? normal(code) : nouveauCode();
    if (!/^[A-Z0-9-]{4,32}$/.test(c)) return { erreur: 'code' };
    if (q.code.get(c)) return { erreur: 'existe' };
    q.creer.run(c, n, JSON.stringify(l), m, maintenant() + j * 86400e3, maintenant(), String(par).slice(0, 40), String(note).slice(0, 80));
    return { code: c, ogrines: n, objets: l, max: m, jours: j };
  }
  /** 11A : un joueur entre un code. Rend { ogrines, objets, solde } ou { erreur }. */
  const essais = new Map();
  function utiliser(compte, brut) {
    const h = Math.floor(maintenant() / 3600e3), k = `${compte}|${h}`, e = essais.get(k) ?? 0;
    if (e >= OGRINES.essais) return { erreur: 'essais' };
    if (essais.size > 50_000) essais.clear();
    essais.set(k, e + 1);
    const c = q.code.get(normal(brut));
    if (!c) return { erreur: 'inconnu' };
    if (c.expire <= maintenant()) return { erreur: 'expire' };
    if (q.pris.get(c.code, compte)) return { erreur: 'deja' };
    db.exec('BEGIN');
    try {
      if (q.utiliser.run(c.code).changes === 0) { db.exec('ROLLBACK'); return { erreur: 'epuise' }; }
      q.prendre.run(c.code, compte, maintenant());
      if (c.ogrines > 0) bouger(compte, c.ogrines, `code ${c.code}`);
      db.exec('COMMIT');
    } catch (err) { db.exec('ROLLBACK'); throw err; }
    return { ogrines: c.ogrines, objets: JSON.parse(c.objets), solde: solde(compte) };
  }

  // ——— robot Discord (11B) : /code et /ogrines, réservés aux rôles admin ———
  let cle = null;
  try {
    const hex = env.DISCORD_CLE_PUBLIQUE;
    if (hex && /^[0-9a-f]{64}$/i.test(hex)) cle = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(hex, 'hex')]), format: 'der', type: 'spki' });
  } catch { cle = null; }
  const lireBrut = req => new Promise((ok, ko) => {
    const m = []; let n = 0;
    req.on('data', c => { n += c.length; if (n <= 64 * 1024) m.push(c); });
    req.on('end', () => ok(Buffer.concat(m)));
    req.on('error', ko);
  });
  const option = (d, nom) => d.options?.find(o => o.name === nom)?.value;
  function commande(i) {
    const roles = i.member?.roles ?? [], d = i.data ?? {}, par = i.member?.user?.username ?? '';
    const prive = contenu => ({ type: 4, data: { content: contenu, flags: 64 } });
    if (!adminDiscord(roles)) return prive('Réservé aux admins de Diablofus.');
    if (d.name === 'code') {
      const objets = String(option(d, 'objets') ?? '').split(/[\s,]+/).filter(Boolean);
      const r = creerCode({ ogrines: option(d, 'ogrines') ?? 0, max: option(d, 'utilisations') ?? 1, jours: option(d, 'jours') ?? 7, objets, code: option(d, 'nom'), par, note: option(d, 'note') ?? '' });
      if (r.erreur) return prive(`Code refusé (${r.erreur}).`);
      return prive(`Code **${r.code}** : ${r.ogrines} Ogrines${r.objets.length ? ` + objets ${r.objets.join(', ')}` : ''}, ${r.max} utilisation${r.max > 1 ? 's' : ''}, ${r.jours} jour${r.jours > 1 ? 's' : ''}. À entrer dans Diablofus : Options › Compte › Code cadeau.`);
    }
    if (d.name === 'ogrines') {
      const joueur = String(option(d, 'joueur') ?? ''), n = Math.floor(Number(option(d, 'nombre')) || 0), c = q.parDiscord.get(joueur);
      if (!c) return prive('Ce joueur ne s\'est jamais connecté à Diablofus avec Discord.');
      if (!n || Math.abs(n) > OGRINES.maxOgrines || !bouger(c.id, n, `Discord : ${String(option(d, 'raison') ?? 'événement').slice(0, 60)} (${par})`)) return prive('Refusé (nombre, ou solde trop bas pour retirer).');
      return prive(`${n > 0 ? '+' : ''}${n} Ogrines pour ${c.nom} : solde ${solde(c.id)}.`);
    }
    return prive('Commande inconnue.');
  }

  async function route(req, res, url) {
    const p = url.pathname, m = req.method;
    if (p === '/discord/interactions' && m === 'POST') {
      const brut = await lireBrut(req), sig = String(req.headers['x-signature-ed25519'] ?? ''), t = String(req.headers['x-signature-timestamp'] ?? '');
      let ok = false;
      try { ok = !!cle && /^[0-9a-f]{128}$/i.test(sig) && verify(null, Buffer.concat([Buffer.from(t), brut]), cle, Buffer.from(sig, 'hex')); } catch { ok = false; }
      if (!ok) return json(res, 401, { erreur: 'signature' }), true;
      let i; try { i = JSON.parse(brut.toString('utf8')); } catch { return json(res, 400, {}), true; }
      if (i.type === 1) return json(res, 200, { type: 1 }), true;   // PING de Discord
      if (i.type === 2) return json(res, 200, commande(i)), true;
      return json(res, 400, {}), true;
    }
    if (p !== '/ogrines' && p !== '/codes' && p !== '/codes/utiliser') return false;
    const c = connecte(req);
    if (!c) return json(res, 401, { erreur: 'connexion' }), true;
    try {
      if (m === 'GET' && p === '/ogrines') return json(res, 200, { solde: solde(c.id) }), true;
      if (m === 'POST' && p === '/codes/utiliser') {
        const b = await lireCorps(req), r = utiliser(c.id, b.code);
        return json(res, r.erreur ? (r.erreur === 'essais' ? 429 : 400) : 200, r), true;
      }
      if (p === '/codes') {
        if (!admin(c)) return json(res, 403, { erreur: 'admin' }), true;
        if (m === 'GET') return json(res, 200, { codes: q.codes.all().map(x => ({ ...x, objets: JSON.parse(x.objets) })) }), true;
        if (m === 'POST') { const r = creerCode({ ...(await lireCorps(req)), par: c.nom }); return json(res, r.erreur ? 400 : 200, r), true; }
      }
      return json(res, 405, { erreur: 'methode' }), true;
    } catch (err) {
      return json(res, err.code === 400 ? 400 : 500, { erreur: err.code === 400 ? 'json' : 'serveur' }), true;
    }
  }
  /** Commandes Discord à enregistrer (tools/discord/discord_bot.mjs, action « commandes »). */
  return { route, solde, bouger, creerCode, utiliser, discordPret: !!cle };
}

/** Les commandes /code et /ogrines du robot (enregistrées par tools/discord/discord_bot.mjs, action « commandes »). */
export const COMMANDES_DISCORD = [
  { name: 'code', description: 'Créer un code cadeau Diablofus (Ogrines et objets)', default_member_permissions: '8', options: [
    { type: 4, name: 'ogrines', description: 'Ogrines données', required: true, min_value: 0, max_value: OGRINES.maxOgrines },
    { type: 4, name: 'utilisations', description: 'Nombre de joueurs qui peuvent l\'utiliser (1 par défaut)', min_value: 1, max_value: OGRINES.maxUtilisations },
    { type: 4, name: 'jours', description: 'Jours de validité (7 par défaut)', min_value: 1, max_value: OGRINES.maxJours },
    { type: 3, name: 'objets', description: 'Ids d\'objets ou d\'apparats à donner, séparés par des virgules' },
    { type: 3, name: 'nom', description: 'Code choisi (sinon tiré au hasard)' },
    { type: 3, name: 'note', description: 'Pour s\'en souvenir (live, concours…)' },
  ] },
  { name: 'ogrines', description: 'Donner (ou retirer) des Ogrines à un joueur (événement, concours)', default_member_permissions: '8', options: [
    { type: 6, name: 'joueur', description: 'Le joueur', required: true },
    { type: 4, name: 'nombre', description: 'Ogrines (négatif pour retirer)', required: true },
    { type: 3, name: 'raison', description: 'Événement, concours…' },
  ] },
];
