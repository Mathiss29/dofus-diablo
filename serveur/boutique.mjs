// Boutique Ogrines et abonnements (ligne « Apparats : » 9A+9B+9C+9E+9G 13A 14A+14B+14C 15A 16A+16D 17 ; Mathis 2026-11-12).
// Le catalogue, les prix du jour (promotion de la semaine, articles de fête) et les paliers viennent de la simulation
// (src/sim/boutiqueOgrines.ts, dans partie/sim.mjs) : le serveur décide du prix, débite les Ogrines (ogrines.mjs) et garde
// les achats du compte ; le jeu remet les apparats et les styles achetés à chaque perso.
// Jamais de puissance à vendre ; les Ogrines ne s'achètent pas avec de l'argent.

const JOUR = 86_400_000;
/** Date du jour à Paris (AAAA-MM-JJ), comme le jeu. */
const jourParis = t => new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });

/**
 * @param {{ db: import('node:sqlite').DatabaseSync, connecte: (req: any) => any, lireCorps: (req: any) => Promise<any>,
 *   ogrines: { solde: (c: number) => number, bouger: (c: number, n: number, r: string) => boolean }, maintenant?: () => number,
 *   catalogue?: () => Promise<any> }} o
 */
export function creerBoutique({ db, connecte, lireCorps, ogrines, maintenant = Date.now, catalogue = () => import(new URL('./partie/sim.mjs', import.meta.url).href) }) {
  db.exec(`CREATE TABLE IF NOT EXISTS achats (compte INTEGER NOT NULL REFERENCES comptes(id) ON DELETE CASCADE, article TEXT NOT NULL, prix INTEGER NOT NULL,
      quand INTEGER NOT NULL, PRIMARY KEY (compte, article));
    CREATE TABLE IF NOT EXISTS services (compte INTEGER NOT NULL REFERENCES comptes(id) ON DELETE CASCADE, service TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (compte, service));
    CREATE TABLE IF NOT EXISTS abonnements (compte INTEGER PRIMARY KEY REFERENCES comptes(id) ON DELETE CASCADE, palier TEXT, fin INTEGER NOT NULL DEFAULT 0,
      essai INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS apparats_du_mois (compte INTEGER NOT NULL REFERENCES comptes(id) ON DELETE CASCADE, mois TEXT NOT NULL, apparat TEXT NOT NULL,
      PRIMARY KEY (compte, mois));`);
  const q = {
    achats: db.prepare('SELECT article FROM achats WHERE compte = ?'),
    achat: db.prepare('SELECT 1 FROM achats WHERE compte = ? AND article = ?'),
    acheter: db.prepare('INSERT INTO achats (compte, article, prix, quand) VALUES (?, ?, ?, ?)'),
    services: db.prepare('SELECT service, n FROM services WHERE compte = ? AND n > 0'),
    ajouterService: db.prepare('INSERT INTO services (compte, service, n) VALUES (?, ?, 1) ON CONFLICT (compte, service) DO UPDATE SET n = n + 1'),
    prendreService: db.prepare('UPDATE services SET n = n - 1 WHERE compte = ? AND service = ? AND n > 0'),
    abo: db.prepare('SELECT palier, fin, essai FROM abonnements WHERE compte = ?'),
    regler: db.prepare(`INSERT INTO abonnements (compte, palier, fin, essai) VALUES (?, ?, ?, ?)
      ON CONFLICT (compte) DO UPDATE SET palier = excluded.palier, fin = excluded.fin, essai = max(essai, excluded.essai)`),
    mois: db.prepare('SELECT apparat FROM apparats_du_mois WHERE compte = ?'),
    moisPris: db.prepare('SELECT 1 FROM apparats_du_mois WHERE compte = ? AND mois = ?'),
    prendreMois: db.prepare('INSERT INTO apparats_du_mois (compte, mois, apparat) VALUES (?, ?, ?)'),
  };
  const json = (res, code, corps) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(corps)); };
  /** Abonnement en cours (ou null s'il a pris fin). */
  const abonnement = compte => { const a = q.abo.get(compte); return a?.palier && a.fin > maintenant() ? { palier: a.palier, fin: a.fin } : null; };
  /** Tout ce que le jeu doit savoir du compte (/moi et /boutique). */
  function etat(compte) {
    const a = q.abo.get(compte);
    return {
      solde: ogrines.solde(compte), achats: q.achats.all(compte).map(x => x.article), apparats: q.mois.all(compte).map(x => x.apparat),
      services: Object.fromEntries(q.services.all(compte).map(x => [x.service, x.n])), abonnement: abonnement(compte), essai: !!a?.essai,
    };
  }
  /** Paie et enregistre, tout ou rien. */
  function payer(compte, prix, raison, f) {
    db.exec('BEGIN IMMEDIATE');
    try {
      if (!ogrines.bouger(compte, -prix, raison)) { db.exec('ROLLBACK'); return false; }
      f(); db.exec('COMMIT'); return true;
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }

  async function acheter(compte, article, prixVu) {
    const S = await catalogue(), A = S.BOUTIQUE_OGRINES.articles[article], prix = S.prixOgrines(article, jourParis(maintenant()));
    if (!A) return { erreur: 'inconnu' };
    if (prix == null) return { erreur: 'pasEnVente' };
    if (prixVu != null && Number(prixVu) !== prix) return { erreur: 'prix', prix };
    if (A.cat !== 'service' && q.achat.get(compte, article)) return { erreur: 'deja' };
    const ok = payer(compte, prix, `boutique : ${article}`, () => {
      if (A.cat === 'service') q.ajouterService.run(compte, A.service);
      else q.acheter.run(compte, article, prix, maintenant());
    });
    return ok ? etat(compte) : { erreur: 'solde' };
  }
  /** 16A : un palier pour 30 jours ; le même palier prolonge, un palier plus haut remplace (les jours restants sont repris
   *  au prorata), un palier plus bas attend la fin de l'abonnement en cours. */
  async function abonner(compte, palier) {
    const S = await catalogue(), P = S.BOUTIQUE_OGRINES.abonnement, d = P.paliers[palier];
    if (!d) return { erreur: 'inconnu' };
    const t = maintenant(), a = abonnement(compte), duree = P.jours * JOUR, ra = S.rangAbo(a?.palier), r = S.rangAbo(palier);
    if (a && r < ra) return { erreur: 'plusBas' };
    let prix = d.prix, fin = t + duree;
    if (a && r === ra) fin = a.fin + duree;
    else if (a) prix = Math.max(0, d.prix - Math.floor(P.paliers[a.palier].prix * (a.fin - t) / duree));
    const ok = payer(compte, prix, `abonnement : ${palier}`, () => q.regler.run(compte, palier, fin, q.abo.get(compte)?.essai ?? 0));
    return ok ? etat(compte) : { erreur: 'solde' };
  }
  /** 16D : 7 jours offerts, une fois par compte, sans abonnement en cours. */
  async function essayer(compte) {
    const S = await catalogue(), E = S.BOUTIQUE_OGRINES.abonnement.essai;
    if (q.abo.get(compte)?.essai) return { erreur: 'deja' };
    if (abonnement(compte)) return { erreur: 'actif' };
    q.regler.run(compte, E.palier, maintenant() + E.jours * JOUR, 1);
    return etat(compte);
  }
  /** 17B : Héros et Légende prennent l'apparat exclusif du mois, une fois par mois, gardé pour toujours. */
  async function apparatDuMois(compte) {
    const S = await catalogue(), a = abonnement(compte), mois = jourParis(maintenant()).slice(0, 7);
    if (S.rangAbo(a?.palier) < 2) return { erreur: 'palier' };
    if (q.moisPris.get(compte, mois)) return { erreur: 'deja' };
    const id = S.apparatDuMois(mois);
    q.prendreMois.run(compte, mois, id);
    return { ...etat(compte), apparat: id };
  }

  async function route(req, res, url) {
    const p = url.pathname, m = req.method;
    if (!p.startsWith('/boutique')) return false;
    const c = connecte(req);
    if (!c) return json(res, 401, { erreur: 'connexion' }), true;
    try {
      const repondre = r => json(res, r.erreur ? (r.erreur === 'solde' ? 402 : 400) : 200, r);
      if (m === 'GET' && p === '/boutique') return json(res, 200, etat(c.id)), true;
      if (m !== 'POST') return json(res, 405, { erreur: 'methode' }), true;
      const b = await lireCorps(req);
      if (p === '/boutique/acheter') return repondre(await acheter(c.id, String(b.article ?? ''), b.prix)), true;
      if (p === '/boutique/abonnement') return repondre(await abonner(c.id, String(b.palier ?? ''))), true;
      if (p === '/boutique/essai') return repondre(await essayer(c.id)), true;
      if (p === '/boutique/mois') return repondre(await apparatDuMois(c.id)), true;
      if (p === '/boutique/service') {   // 9C : une potion utilisée (le changement lui-même part avec le perso)
        const ok = q.prendreService.run(c.id, String(b.service ?? '')).changes > 0;
        return repondre(ok ? etat(c.id) : { erreur: 'aucun' }), true;
      }
      return json(res, 404, { erreur: 'route' }), true;
    } catch (err) {
      if (err.code === 400) return json(res, 400, { erreur: 'json' }), true;
      console.warn('boutique :', err.message);
      return json(res, 503, { erreur: 'catalogue' }), true;
    }
  }
  return { route, etat, abonnement, acheter, abonner, essayer, apparatDuMois };
}
