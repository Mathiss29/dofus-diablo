// Passage de relais d'Idlus vers Diablofus (Mathis 2026-11-25, maquette « Relais vers Diablofus » : 2A 3A+B 4A 5C).
// Un joueur d'Idlus obtient dans Idlus un code personnel « IDLUS-XXXX-XXXX-XXXX » (page Diablofus d'Idlus). Il le colle dans
// Options › Compte › Code cadeau. Ce module demande au serveur d'Idlus (fonction publique veteran_lookup, supabase/relais.sql
// du dépôt idlus/idlus.github.io) le palier de ce code : 1 Bronze, 2 Argent, 3 Or, et le Défi d'adieu réussi ou non.
// Un code ne sert qu'à un compte Diablofus, et un compte ne prend qu'un code. Le même code peut être entré de nouveau : il
// donne ce qui manque quand le palier a monté dans Idlus (Ogrines une seule fois par palier).
// Le jeu remet titre, ornement et auréole au compte à chaque connexion (etat dans /moi, world.recevoirIdlus).
// Aucune donnée personnelle venue d'Idlus : seulement le palier et le défi.

/** Ogrines de chaque palier (3B) : Bronze, Argent, Or. Cumulées : un Or reçoit 2 500 Ogrines. */
export const OGRINES_PALIER = [300, 700, 1500];
export const IDLUS_URL = 'https://159-173-129-109.sslip.io';
export const estCodeIdlus = brut => /^IDLUS-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(String(brut ?? '').trim().toUpperCase());
/** Ogrines dues pour passer du palier `avant` au palier `apres`. */
export const ogrinesDues = (avant, apres) => OGRINES_PALIER.slice(Math.max(0, avant), Math.max(0, Math.min(3, apres))).reduce((a, b) => a + b, 0);

/**
 * @param {{ db: import('node:sqlite').DatabaseSync, ogrines: { solde: (c: number) => number, bouger: (c: number, n: number, r: string) => boolean },
 *   maintenant?: () => number, fetch?: typeof fetch, env?: Record<string, string | undefined> }} o
 */
export function creerIdlus({ db, ogrines, maintenant = Date.now, fetch: f = fetch, env = process.env }) {
  db.exec(`CREATE TABLE IF NOT EXISTS idlus_veterans (compte INTEGER PRIMARY KEY REFERENCES comptes(id) ON DELETE CASCADE, code TEXT UNIQUE NOT NULL,
    palier INTEGER NOT NULL DEFAULT 0, adieu INTEGER NOT NULL DEFAULT 0, quand INTEGER NOT NULL, maj INTEGER NOT NULL);`);
  const q = {
    duCompte: db.prepare('SELECT * FROM idlus_veterans WHERE compte = ?'),
    duCode: db.prepare('SELECT * FROM idlus_veterans WHERE code = ?'),
    ajouter: db.prepare('INSERT INTO idlus_veterans (compte, code, palier, adieu, quand, maj) VALUES (?, ?, ?, ?, ?, ?)'),
    maj: db.prepare('UPDATE idlus_veterans SET palier = ?, adieu = ?, maj = ? WHERE compte = ?'),
    stats: db.prepare('SELECT count(*) AS codes, sum(palier = 1) AS bronze, sum(palier = 2) AS argent, sum(palier = 3) AS ors, sum(adieu) AS adieu FROM idlus_veterans'),
  };
  const url = env.IDLUS_URL || IDLUS_URL;
  // Clé « anon » d'Idlus : publique par nature (le jeu Idlus l'a en clair), lue une fois sur /cle-publique.
  let cle = env.IDLUS_CLE || null;
  async function lireCle() {
    if (cle) return cle;
    const r = await f(`${url}/cle-publique`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error('clé');
    cle = (await r.text()).trim();
    return cle;
  }
  /** Palier d'un code chez Idlus : { palier, adieu } ou null (code inconnu). Lance une erreur si Idlus ne répond pas. */
  async function demander(code) {
    const k = await lireCle();
    const r = await f(`${url}/rest/v1/rpc/veteran_lookup`, { method: 'POST', signal: AbortSignal.timeout(8000),
      headers: { apikey: k, authorization: `Bearer ${k}`, 'content-type': 'application/json' }, body: JSON.stringify({ p_code: code }) });
    if (!r.ok) throw new Error(`idlus ${r.status}`);
    const d = await r.json();
    if (!d || typeof d !== 'object') return null;
    return { palier: Math.max(0, Math.min(3, Math.floor(+d.palier || 0))), adieu: !!d.adieu };
  }
  /** Le joueur entre son code. Rend { ogrines, objets: [], solde, idlus } ou { erreur }. */
  async function utiliser(compte, brut) {
    const code = String(brut ?? '').trim().toUpperCase();
    if (!estCodeIdlus(code)) return { erreur: 'inconnu' };
    const moi = q.duCompte.get(compte), lui = q.duCode.get(code);
    if (lui && lui.compte !== compte) return { erreur: 'idlusPris' };
    if (moi && moi.code !== code) return { erreur: 'idlusAutre' };
    let v;
    try { v = await demander(code); } catch { return { erreur: 'idlusHorsLigne' }; }
    if (!v) return { erreur: 'inconnu' };
    const avant = moi ? moi.palier : 0, palier = Math.max(avant, v.palier), adieu = (moi?.adieu ? 1 : 0) || (v.adieu ? 1 : 0);
    if (moi && palier === avant && adieu === moi.adieu) return { erreur: 'idlusRien', idlus: { palier, adieu: !!adieu } };
    const dues = ogrinesDues(avant, palier), t = maintenant();
    db.exec('BEGIN IMMEDIATE');
    try {
      if (moi) q.maj.run(palier, adieu, t, compte); else q.ajouter.run(compte, code, palier, adieu, t, t);
      if (dues > 0 && !ogrines.bouger(compte, dues, `Vétéran d'Idlus : palier ${palier}`)) throw new Error('ogrines');
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); if (String(e?.message).includes('UNIQUE')) return { erreur: 'idlusPris' }; throw e; }
    return { ogrines: dues, objets: [], solde: ogrines.solde(compte), idlus: { palier, adieu: !!adieu } };
  }
  /** Ce que le jeu remet au compte (titre, ornement, auréole) : { palier, adieu } ou null. */
  const etat = compte => { const r = q.duCompte.get(compte); return r ? { palier: r.palier, adieu: !!r.adieu } : null; };
  const stats = () => { const s = q.stats.get(); return { codes: s.codes, bronze: s.bronze ?? 0, argent: s.argent ?? 0, or: s.ors ?? 0, adieu: s.adieu ?? 0 }; };
  return { utiliser, etat, stats, demander };
}
