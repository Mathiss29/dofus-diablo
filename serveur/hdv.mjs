// Hôtel de Vente (ligne « HDV : 1D 2A+2B+2C+2D 3A-3E 4A+4B+4C 5A-5D 6A+6B 7C 8 9A », Mathis 2026-11-15).
// Les règles (ce qui se vend, taxe, lots, annonces au plus, gestes sur le perso) sont dans la simulation (src/sim/hdv.ts, lue dans
// partie/sim.mjs) ; ici : les annonces, les ventes, les colis (kamas d'une vente, objet revenu) et les signatures du serveur.
// - Perso dans une partie du serveur (monde de groupe, donjon) : le serveur fait le geste lui-même dans la partie.
// - Perso en solo sur le PC (2A) : le serveur accepte ou refuse, le jeu fait le geste et sauve aussitôt.
// 4A : un équipement ne se vend que s'il porte la signature du serveur (posée quand il apparaît dans une partie du serveur) ;
// une signature n'a qu'un propriétaire à la fois (un objet recopié dans une sauvegarde trafiquée ne se vend pas deux fois).
// 4C : en solo, les ressources (et les âmes, 25 unités chacune) mises en vente sont limitées par jour et par compte.
// « En ligne : » 3B + « Arène : » 17A : l'échange d'âmes passe par l'HDV (une âme capturée quitte le carnet du vendeur).
import { createHmac, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const JOUR = 86_400_000;
const jourParis = t => new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });

/** Secret des signatures : HDV_SECRET, sinon un fichier du dossier des données, créé au premier lancement. */
function secret(dossier, env) {
  if (env.HDV_SECRET) return env.HDV_SECRET;
  if (!dossier) return randomBytes(32).toString('hex');
  const f = join(dossier, 'hdv.secret');
  if (!existsSync(f)) writeFileSync(f, randomBytes(32).toString('hex'), { mode: 0o600 });
  return readFileSync(f, 'utf8').trim();
}

/** 4A : signature des objets apparus dans une partie du serveur, avec le secret ; aussi dans les fils des parties (fil.mjs). */
export function creerSigneur(cle) {
  const mac = (n, it) => createHmac('sha256', cle).update(`${n}|${it.id}|${it.rarity}|${it.legendary?.id ?? ''}|${it.legendary2?.id ?? ''}`).digest('hex').slice(0, 24);
  return {
    /** Signe un objet (une seule fois). */
    signer(it) { if (it && typeof it === 'object' && !it.srv) { const n = randomBytes(6).toString('hex'); it.srv = `${n}.${mac(n, it)}`; } return it; },
    /** Signature valable de cet objet (son nonce), ou null. */
    signature(it) {
      const m = /^([0-9a-f]{12})\.([0-9a-f]{24})$/.exec(typeof it?.srv === 'string' ? it.srv : '');
      return m && m[2] === mac(m[1], it) ? m[1] : null;
    },
  };
}

/**
 * @param {{ db: import('node:sqlite').DatabaseSync, connecte: (req: any) => any, lireCorps: (req: any) => Promise<any>,
 *   persoStocke: (compte: number, emplacement: number) => { perso: any, maj: number } | null, rangAbo?: (compte: number) => number,
 *   dossier?: string, env?: Record<string, string|undefined>, maintenant?: () => number, catalogue?: () => Promise<any> }} o
 */
export function creerHdv({ db, connecte, lireCorps, persoStocke, rangAbo = () => 0, dossier, env = process.env, maintenant = Date.now,
  catalogue = () => import(new URL('./partie/sim.mjs', import.meta.url).href) }) {
  db.exec(`CREATE TABLE IF NOT EXISTS hdv_annonces (id INTEGER PRIMARY KEY, compte INTEGER NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
      emplacement INTEGER NOT NULL, vendeur TEXT NOT NULL, cle TEXT NOT NULL, type TEXT NOT NULL, cat TEXT NOT NULL, niveau INTEGER NOT NULL,
      rarete TEXT NOT NULL, nom TEXT NOT NULL, objet TEXT NOT NULL, n INTEGER NOT NULL, prix INTEGER NOT NULL, depot INTEGER NOT NULL,
      expire INTEGER NOT NULL, signe TEXT);
    CREATE INDEX IF NOT EXISTS hdv_annonces_cle ON hdv_annonces (cle);
    CREATE INDEX IF NOT EXISTS hdv_annonces_type ON hdv_annonces (type, cat);
    CREATE INDEX IF NOT EXISTS hdv_annonces_compte ON hdv_annonces (compte, emplacement);
    CREATE TABLE IF NOT EXISTS hdv_ventes (cle TEXT NOT NULL, nom TEXT NOT NULL, n INTEGER NOT NULL, prix INTEGER NOT NULL, quand INTEGER NOT NULL,
      vendeur INTEGER, acheteur INTEGER);
    CREATE INDEX IF NOT EXISTS hdv_ventes_cle ON hdv_ventes (cle, quand);
    CREATE TABLE IF NOT EXISTS hdv_colis (id INTEGER PRIMARY KEY, compte INTEGER NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
      kamas INTEGER NOT NULL DEFAULT 0, objet TEXT, texte TEXT NOT NULL, quand INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS hdv_signes (signe TEXT PRIMARY KEY, compte INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS hdv_quota (compte INTEGER NOT NULL, jour TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (compte, jour));
    CREATE TABLE IF NOT EXISTS hdv_depenses (compte INTEGER NOT NULL, emplacement INTEGER NOT NULL, kamas INTEGER NOT NULL, quand INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS hdv_recus (compte INTEGER NOT NULL, emplacement INTEGER NOT NULL, kamas INTEGER NOT NULL, quand INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS hdv_favoris (compte INTEGER NOT NULL REFERENCES comptes(id) ON DELETE CASCADE, cle TEXT NOT NULL, nom TEXT NOT NULL,
      seuil INTEGER, PRIMARY KEY (compte, cle));`);
  const q = {
    annonce: db.prepare('SELECT * FROM hdv_annonces WHERE id = ?'),
    mesAnnonces: db.prepare('SELECT * FROM hdv_annonces WHERE compte = ? AND emplacement = ? ORDER BY depot DESC'),
    nbAnnonces: db.prepare('SELECT COUNT(*) AS n FROM hdv_annonces WHERE compte = ? AND emplacement = ?'),
    signeEnVente: db.prepare('SELECT 1 FROM hdv_annonces WHERE signe = ?'),
    poser: db.prepare(`INSERT INTO hdv_annonces (compte, emplacement, vendeur, cle, type, cat, niveau, rarete, nom, objet, n, prix, depot, expire, signe)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    oter: db.prepare('DELETE FROM hdv_annonces WHERE id = ?'),
    expirees: db.prepare('SELECT * FROM hdv_annonces WHERE expire <= ?'),
    vente: db.prepare('INSERT INTO hdv_ventes (cle, nom, n, prix, quand, vendeur, acheteur) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    moyenne: db.prepare('SELECT SUM(prix) AS p, SUM(n) AS n FROM hdv_ventes WHERE cle = ? AND quand > ?'),
    courbe: db.prepare('SELECT quand, prix, n FROM hdv_ventes WHERE cle = ? AND quand > ? ORDER BY quand'),
    mesVentes: db.prepare('SELECT cle, nom, n, prix, quand FROM hdv_ventes WHERE vendeur = ? ORDER BY quand DESC LIMIT 30'),
    mesAchats: db.prepare('SELECT cle, nom, n, prix, quand FROM hdv_ventes WHERE acheteur = ? ORDER BY quand DESC LIMIT 30'),
    colis: db.prepare('SELECT * FROM hdv_colis WHERE compte = ? ORDER BY id'),
    nbColis: db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(kamas), 0) AS kamas FROM hdv_colis WHERE compte = ?'),
    ajouterColis: db.prepare('INSERT INTO hdv_colis (compte, kamas, objet, texte, quand) VALUES (?, ?, ?, ?, ?)'),
    oterColis: db.prepare('DELETE FROM hdv_colis WHERE id = ?'),
    recu: db.prepare('INSERT INTO hdv_recus (compte, emplacement, kamas, quand) VALUES (?, ?, ?, ?)'),
    recus: db.prepare('SELECT COALESCE(SUM(kamas), 0) AS k FROM hdv_recus WHERE compte = ? AND emplacement = ? AND quand > ?'),
    vieuxRecus: db.prepare('DELETE FROM hdv_recus WHERE quand < ?'),
    signe: db.prepare('SELECT compte FROM hdv_signes WHERE signe = ?'),
    signer: db.prepare('INSERT INTO hdv_signes (signe, compte) VALUES (?, ?) ON CONFLICT (signe) DO UPDATE SET compte = excluded.compte'),
    quota: db.prepare('SELECT n FROM hdv_quota WHERE compte = ? AND jour = ?'),
    noterQuota: db.prepare('INSERT INTO hdv_quota (compte, jour, n) VALUES (?, ?, ?) ON CONFLICT (compte, jour) DO UPDATE SET n = n + excluded.n'),
    depenses: db.prepare('SELECT COALESCE(SUM(kamas), 0) AS k FROM hdv_depenses WHERE compte = ? AND emplacement = ? AND quand > ?'),
    depenser: db.prepare('INSERT INTO hdv_depenses (compte, emplacement, kamas, quand) VALUES (?, ?, ?, ?)'),
    vieillesDepenses: db.prepare('DELETE FROM hdv_depenses WHERE quand < ?'),
    favoris: db.prepare('SELECT cle, nom, seuil FROM hdv_favoris WHERE compte = ?'),
    favori: db.prepare('INSERT INTO hdv_favoris (compte, cle, nom, seuil) VALUES (?, ?, ?, ?) ON CONFLICT (compte, cle) DO UPDATE SET nom = excluded.nom, seuil = excluded.seuil'),
    oterFavori: db.prepare('DELETE FROM hdv_favoris WHERE compte = ? AND cle = ?'),
    moinsCher: db.prepare('SELECT MIN(CAST(prix AS REAL) / n) AS u FROM hdv_annonces WHERE cle = ?'),
  };
  const cle = secret(dossier, env);
  const { signer, signature } = creerSigneur(cle);
  /** Partie du serveur où ce perso joue en ce moment : posé par index.mjs. Rend { appliquer(op) } (geste nommé, src/sim/hdv.ts opHdv,
   *  rejoué pour ce joueur, résultat direct ou promesse quand la partie tourne dans un autre fil), ou null. */
  let partieDe = () => null;

  const json = (res, code, corps) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(corps)); };
  const emplacement = x => { const n = Number(x); return Number.isInteger(n) && n >= 0 && n < 16 ? n : null; };
  const vueAnnonce = (a, moi) => ({ id: a.id, cle: a.cle, type: a.type, cat: a.cat, niveau: a.niveau, rarete: a.rarete, nom: a.nom, objet: JSON.parse(a.objet),
    n: a.n, prix: a.prix, vendeur: a.vendeur, expire: a.expire, ...(moi != null ? { moi: a.compte === moi } : {}) });
  function moyenne(c) {
    const r = q.moyenne.get(c, maintenant() - 7 * JOUR);
    return r?.n ? Math.round(r.p / r.n * 100) / 100 : null;
  }
  /** 5B : annonces de plus de 7 jours : l'objet revient (colis, puis coffre du compte). Au plus toutes les 10 s. */
  let dernierTri = 0;
  function expirer() {
    const t = maintenant();
    if (t - dernierTri < 10_000) return;
    dernierTri = t;
    for (const a of q.expirees.all(t)) {
      q.oter.run(a.id);
      q.ajouterColis.run(a.compte, 0, a.objet, `${a.nom}${a.n > 1 ? ` ×${a.n}` : ''} : annonce finie, revenue dans ton coffre`, t);
    }
    q.vieillesDepenses.run(t - 2 * JOUR);
  }

  /** Mise en vente. */
  async function vendre(c, b) {
    const S = await catalogue(), i = emplacement(b.emplacement), st = i == null ? null : persoStocke(c.id, i);
    if (!st) return { erreur: 'perso' };
    let o = S.relireObjetHdv(b.objet);
    const prix = Math.floor(Number(b.prix));
    if (!o) return { erreur: 'objet' };
    if (!Number.isInteger(prix) || prix < 1 || prix > S.HDV.prixMax) return { erreur: 'prix' };
    expirer();
    if (q.nbAnnonces.get(c.id, i).n >= S.annoncesMax(rangAbo(c.id))) return { erreur: 'annonces' };
    const P = partieDe(c.id, i);
    // dans une partie du serveur : l'objet de la partie fait foi, pas celui qu'envoie le jeu
    if (P && o.k === 'objet') {
      const vrai = await P.appliquer({ op: 'objet', uid: o.item.uid });
      if (!vrai) return { erreur: 'absent' };
      o = { k: 'objet', item: vrai };
    }
    const refus = S.refusHdv(o, S.ITEMS);
    if (refus) return { erreur: refus };
    let signe = null;
    if (o.k === 'objet') {
      signe = signature(o.item);
      if (!signe) return { erreur: 'signature' };
      const proprio = q.signe.get(signe)?.compte;
      if ((proprio != null && proprio !== c.id) || q.signeEnVente.get(signe)) return { erreur: 'signature' };
    }
    const jour = jourParis(maintenant());
    const unites = o.k === 'ressource' ? o.n : o.k === 'ame' ? S.QUOTA_AME : 0;
    if (unites && !P && (q.quota.get(c.id, jour)?.n ?? 0) + unites > S.HDV.soloJour) return { erreur: 'quota', reste: Math.max(0, S.HDV.soloJour - (q.quota.get(c.id, jour)?.n ?? 0)) };
    const taxe = S.taxeHdv(prix);
    if (P) {
      const r = await P.appliquer({ op: 'vendre', objet: o, taxe });
      if (!r || r.erreur) return { erreur: r?.erreur ?? 'absent' };
      o = r.objet;
    }
    const objet = o.k === 'objet' ? { k: 'objet', item: { ...o.item, uid: 0 } } : o;
    const t = maintenant(), vendeur = String(st.perso?.nom ?? '').slice(0, 20) || 'Aventurier';
    const r = q.poser.run(c.id, i, vendeur, S.cleHdv(objet), S.typeVente(objet, S.ITEMS), S.categorieHdv(objet, S.ITEMS), S.niveauHdv(objet, S.ITEMS),
      S.rareteHdv(objet), S.nomHdv(objet, S.ITEMS, S.APPARATS), JSON.stringify(objet), S.quantiteHdv(objet), prix, t, t + S.HDV.jours * JOUR, signe);
    if (signe) q.signer.run(signe, c.id);
    if (unites && !P) q.noterQuota.run(c.id, jour, unites);
    return { ok: true, id: Number(r.lastInsertRowid), taxe, applique: !!P };
  }

  /** Achat d'une annonce entière (un lot). */
  async function acheter(c, b) {
    const S = await catalogue(), i = emplacement(b.emplacement), st = i == null ? null : persoStocke(c.id, i);
    if (!st) return { erreur: 'perso' };
    expirer();
    const a = q.annonce.get(Math.floor(Number(b.id)) || 0);
    if (!a) return { erreur: 'vendu' };
    if (a.compte === c.id) return { erreur: 'soi' };
    if (b.prix != null && Number(b.prix) !== a.prix) return { erreur: 'prixChange', prix: a.prix };
    const objet = JSON.parse(a.objet), P = partieDe(c.id, i);
    if (P) {
      const ko = await P.appliquer({ op: 'acheter', objet, prix: a.prix });
      if (ko) return { erreur: ko };
    } else {
      // kamas du perso sauvé (le jeu sauve juste avant), moins les achats faits depuis
      const kamas = Number(st.perso?.etat?.kamas) || 0, deja = q.depenses.get(c.id, i, st.maj).k;
      if (kamas - deja < a.prix) return { erreur: 'kamas' };
      q.depenser.run(c.id, i, a.prix, maintenant());
    }
    const t = maintenant();
    q.oter.run(a.id);
    q.vente.run(a.cle, a.nom, a.n, a.prix, t, a.compte, c.id);
    q.ajouterColis.run(a.compte, a.prix, null, `${a.nom}${a.n > 1 ? ` ×${a.n}` : ''} vendu ${a.prix.toLocaleString('fr-FR')} kamas`, t);
    if (a.signe) q.signer.run(a.signe, c.id);
    return { ok: true, objet, prix: a.prix, applique: !!P };
  }

  /** Retire une de ses annonces : l'objet revient tout de suite (la taxe est perdue, 5A). */
  async function retirer(c, b) {
    const S = await catalogue(), i = emplacement(b.emplacement);
    const a = q.annonce.get(Math.floor(Number(b.id)) || 0);
    if (!a || a.compte !== c.id || i == null || !persoStocke(c.id, i)) return { erreur: 'annonce' };
    q.oter.run(a.id);
    const objet = JSON.parse(a.objet), P = partieDe(c.id, i);
    if (P && await P.appliquer({ op: 'donner', objet })) {
      q.ajouterColis.run(c.id, 0, a.objet, `${a.nom} : annonce retirée, revenue dans ton coffre`, maintenant());
      return { ok: true, colis: true };
    }
    return { ok: true, objet, applique: !!P };
  }

  /** 6B + 5B : kamas des ventes et objets revenus. En partie : posés par le serveur (les objets qui ne tiennent pas attendent) ;
   *  en solo : rendus au jeu, qui les pose (objets dans le coffre du compte d'abord). */
  async function encaisser(c, b) {
    const S = await catalogue(), i = emplacement(b.emplacement);
    if (i == null || !persoStocke(c.id, i)) return { erreur: 'perso' };
    expirer();
    const P = partieDe(c.id, i), L = q.colis.all(c.id), r = { kamas: 0, objets: [], textes: [], applique: !!P };
    for (const x of L) {
      const objet = x.objet ? JSON.parse(x.objet) : null;
      if (P) {
        const ok = await P.appliquer({ op: 'colis', objet, kamas: x.kamas });
        if (!ok) continue;
      } else if (objet) r.objets.push(objet);
      r.kamas += x.kamas; r.textes.push(x.texte); q.oterColis.run(x.id);
    }
    // « En ligne : » 2C : kamas rendus au jeu en solo, comptés quand le serveur vérifie la sauvegarde suivante
    if (!P && r.kamas > 0) { q.recu.run(c.id, i, r.kamas, maintenant()); q.vieuxRecus.run(maintenant() - 30 * 86400_000); }
    return r;
  }

  async function route(req, res, url) {
    const p = url.pathname, m = req.method;
    if (p !== '/hdv' && !p.startsWith('/hdv/')) return false;
    const c = connecte(req);
    if (!c) return json(res, 401, { erreur: 'connexion' }), true;
    try {
      const sp = url.searchParams;
      if (m === 'GET' && p === '/hdv/offres') {
        expirer();
        const w = [], v = [];
        const liste = k => String(sp.get(k) ?? '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 30);
        if (sp.get('type')) { w.push('type = ?'); v.push(String(sp.get('type'))); }
        if (liste('cat').length) { w.push(`cat IN (${liste('cat').map(() => '?').join(',')})`); v.push(...liste('cat')); }
        if (liste('rarete').length) { w.push(`rarete IN (${liste('rarete').map(() => '?').join(',')})`); v.push(...liste('rarete')); }
        if (sp.get('cle')) { w.push('cle = ?'); v.push(String(sp.get('cle'))); }
        if (sp.get('q')) { w.push('nom LIKE ?'); v.push(`%${String(sp.get('q')).slice(0, 40).replace(/[%_]/g, '')}%`); }
        if (sp.get('min')) { w.push('niveau >= ?'); v.push(Number(sp.get('min')) || 0); }
        if (sp.get('max')) { w.push('niveau <= ?'); v.push(Number(sp.get('max')) || 999); }
        const page = Math.max(0, Math.floor(Number(sp.get('page')) || 0));
        const L = db.prepare(`SELECT * FROM hdv_annonces ${w.length ? `WHERE ${w.join(' AND ')}` : ''} ORDER BY CAST(prix AS REAL) / n, id LIMIT 61 OFFSET ?`).all(...v, page * 60);
        const moyennes = {};
        for (const a of L) if (!(a.cle in moyennes)) moyennes[a.cle] = moyenne(a.cle);
        return json(res, 200, { offres: L.slice(0, 60).map(a => vueAnnonce(a, c.id)), suite: L.length > 60, moyennes }), true;
      }
      if (m === 'GET' && p === '/hdv/prix') {
        const k = String(sp.get('cle') ?? '').slice(0, 40), jours = {};
        for (const r of q.courbe.all(k, maintenant() - 7 * JOUR)) { const j = jours[jourParis(r.quand)] ??= { p: 0, n: 0 }; j.p += r.prix; j.n += r.n; }
        return json(res, 200, { cle: k, moyenne: moyenne(k), courbe: Object.entries(jours).map(([jour, j]) => ({ jour, moyenne: Math.round(j.p / j.n * 100) / 100, n: j.n })) }), true;
      }
      if (m === 'GET' && p === '/hdv/moi') {
        expirer();
        const S = await catalogue(), i = emplacement(sp.get('emplacement')), col = q.nbColis.get(c.id);
        const favoris = q.favoris.all(c.id).map(f => { const u = q.moinsCher.get(f.cle)?.u ?? null; return { ...f, min: u, alerte: f.seuil != null && u != null && u <= f.seuil }; });
        return json(res, 200, {
          annonces: i == null ? [] : q.mesAnnonces.all(c.id, i).map(a => vueAnnonce(a)), max: S.annoncesMax(rangAbo(c.id)),
          colis: col.n, kamas: col.kamas, ventes: q.mesVentes.all(c.id), achats: q.mesAchats.all(c.id), favoris,
          quota: S.HDV.soloJour - (q.quota.get(c.id, jourParis(maintenant()))?.n ?? 0),
        }), true;
      }
      if (m !== 'POST') return json(res, 405, { erreur: 'methode' }), true;
      const b = await lireCorps(req);
      const repondre = r => json(res, r.erreur ? 400 : 200, r);
      if (p === '/hdv/vendre') return repondre(await vendre(c, b)), true;
      if (p === '/hdv/acheter') return repondre(await acheter(c, b)), true;
      if (p === '/hdv/retirer') return repondre(await retirer(c, b)), true;
      if (p === '/hdv/encaisser') return repondre(await encaisser(c, b)), true;
      if (p === '/hdv/favori') {
        const k = String(b.cle ?? '').slice(0, 40);
        if (!/^[oram]:[\w:]+$/.test(k)) return json(res, 400, { erreur: 'cle' }), true;
        if (b.retirer) q.oterFavori.run(c.id, k);
        else { const s = Number(b.seuil); q.favori.run(c.id, k, String(b.nom ?? '').slice(0, 60), Number.isFinite(s) && s > 0 ? Math.floor(s) : null); }
        return json(res, 200, { ok: true }), true;
      }
      return json(res, 404, { erreur: 'route' }), true;
    } catch (err) {
      if (err.code === 400 || err.code === 413) return json(res, err.code, { erreur: 'json' }), true;
      console.warn('hdv :', err.message);
      return json(res, 503, { erreur: 'serveur' }), true;
    }
  }
  /** « En ligne : » 2C : kamas des ventes encaissés en solo par ce perso depuis cet instant (ms). */
  const kamasRecus = (compte, emplacement, depuis) => q.recus.get(compte, emplacement, depuis).k;
  return { route, signer, signature, cleSignature: cle, vendre, acheter, retirer, encaisser, kamasRecus, set partieDe(f) { partieDe = f ?? (() => null); }, get partieDe() { return partieDe; } };
}
