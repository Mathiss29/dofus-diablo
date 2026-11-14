// Classement des aventuriers (maquette « Ladder : », 2026-11-08) : Niveau, Hardcore, Métiers, Exploration, Donjons,
// Tombés en Hardcore et « Les premiers ». Lu par la page Ladder du site et la fenêtre du jeu (src/render/ladder.ts).
// 8A : calculé une fois par minute depuis la table persos (comptes.mjs), puis servi tel quel.
// 4B : les records de donjon ne viennent que des parties tenues par le serveur (partie.mjs), jamais du navigateur.
// 5A : un compte peut se cacher (Social › Vie privée) ; 9B : annonces sur Discord par un webhook facultatif
// (DISCORD_ANNONCES dans /etc/diablofus/discord.env, voir LISEZMOI.md).

export const CLASSEMENT = {
  /** 8A : recalcul toutes les … ms. */
  periode: 60_000,
  /** Lignes gardées par liste (le reste n'est pas classé, il reste visible dans sa fiche). */
  max: 2000,
  /** Lignes gardées par donjon et par mode. */
  maxDonjon: 100,
  /** Tombés en Hardcore affichés (les plus récents). */
  maxTombes: 100,
  /** 9A : niveaux qui gravent un « premier ». */
  paliers: [50, 100, 150, 200],
  /** 9A : niveau de métier qui grave un « premier ». */
  metier: 100,
  /** 0.6 (25A) : donjons au chrono de la semaine (lundi 0 h, heure de Paris), avec le score d'idoles. */
  hebdo: ['Labyrinthe du Dragon Cochon'],
};
/** 0.6 (18D) : meilleur = plus haut score d'idoles, puis meilleur temps à score égal. */
export const meilleur = (a, b) => (b.idoles ?? 0) - (a.idoles ?? 0) || a.temps - b.temps;
/** 0.6 (25A) : semaine d'un instant (ms), « 2026-11-09 » = son lundi, heure de Paris (décalage fixe d'hiver : une heure près). */
export function semaineDe(ms) {
  const j = Math.floor((ms + 3_600_000) / 86_400_000), lundi = j - ((j + 3) % 7);
  return new Date(lundi * 86_400_000).toISOString().slice(0, 10);
}

const ent = (v, min, max) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null; };
const texte = (v, n) => String(v ?? '').slice(0, n);
const idDe = (compte, emplacement) => `${compte}-${emplacement}`;
const lireId = s => { const m = /^(\d{1,9})-(\d)$/.exec(String(s ?? '')); return m ? { compte: Number(m[1]), emplacement: Number(m[2]) } : null; };

/**
 * @param {{ comptes: any, enLigne?: () => string[], annoncer?: (texte: string) => void, maintenant?: () => number, auto?: boolean }} o
 */
export function creerClassement({ comptes, enLigne = () => [], annoncer = () => {}, maintenant = Date.now, auto = true }) {
  const db = comptes.db;
  db.exec(`CREATE TABLE IF NOT EXISTS tombes (id INTEGER PRIMARY KEY, compte INTEGER NOT NULL, nom TEXT NOT NULL, classe TEXT NOT NULL, sexe TEXT NOT NULL,
      niveau INTEGER NOT NULL, temps INTEGER NOT NULL, lieu TEXT NOT NULL, tueur TEXT NOT NULL, quand INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS premiers (cle TEXT PRIMARY KEY, perso TEXT NOT NULL, nom TEXT NOT NULL, classe TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', quand INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS records (donjon TEXT NOT NULL, mode TEXT NOT NULL, compte INTEGER NOT NULL, emplacement INTEGER NOT NULL,
      temps REAL NOT NULL, equipe TEXT NOT NULL, quand INTEGER NOT NULL, PRIMARY KEY (donjon, mode, compte, emplacement));
    CREATE TABLE IF NOT EXISTS semaines (semaine TEXT NOT NULL, donjon TEXT NOT NULL, mode TEXT NOT NULL, compte INTEGER NOT NULL, emplacement INTEGER NOT NULL,
      temps REAL NOT NULL, idoles INTEGER NOT NULL, equipe TEXT NOT NULL, quand INTEGER NOT NULL, PRIMARY KEY (semaine, donjon, mode, compte, emplacement));
    CREATE TABLE IF NOT EXISTS classement_kv (cle TEXT PRIMARY KEY, valeur TEXT NOT NULL);`);
  // 0.6 (18D) : score d'idoles du record
  try { db.exec('ALTER TABLE records ADD COLUMN idoles INTEGER NOT NULL DEFAULT 0'); } catch { /* colonne déjà là */ }
  // 5A : case « Me cacher du classement », dans la table des réglages sociaux
  try { db.exec('ALTER TABLE social ADD COLUMN cache INTEGER NOT NULL DEFAULT 0'); } catch { /* colonne déjà là */ }
  const q = {
    persos: db.prepare(`SELECT p.compte, p.emplacement, json_extract(p.donnees, '$.nom') AS nom, json_extract(p.donnees, '$.classe') AS classe,
        json_extract(p.donnees, '$.sexe') AS sexe, json_extract(p.donnees, '$.apparence') AS apparence, json_extract(p.donnees, '$.hardcore') AS hc,
        json_extract(p.donnees, '$.test') AS test, json_extract(p.donnees, '$.temps') AS temps, json_extract(p.donnees, '$.lieu') AS lieu,
        json_array_length(json_extract(p.donnees, '$.zones')) AS zones, json_array_length(json_extract(p.donnees, '$.etat.zaaps')) AS zaaps,
        json_array_length(json_extract(p.donnees, '$.etat.dofus')) AS dofus,
        json_extract(p.donnees, '$.etat.level') AS niveau, json_extract(p.donnees, '$.etat.quetes.points') AS succes, json_extract(p.donnees, '$.etat.xp') AS xp, json_extract(p.donnees, '$.etat.metiers') AS metiers
      FROM persos p LEFT JOIN social s ON s.compte = p.compte WHERE coalesce(s.cache, 0) = 0`),
    donnees: db.prepare(`SELECT p.donnees FROM persos p LEFT JOIN social s ON s.compte = p.compte WHERE p.compte = ? AND p.emplacement = ? AND coalesce(s.cache, 0) = 0`),
    records: db.prepare(`SELECT r.* FROM records r LEFT JOIN social s ON s.compte = r.compte WHERE coalesce(s.cache, 0) = 0 ORDER BY r.donjon, r.mode, r.idoles DESC, r.temps`),
    record: db.prepare('SELECT temps, idoles FROM records WHERE donjon = ? AND mode = ? AND compte = ? AND emplacement = ?'),
    noter: db.prepare(`INSERT INTO records (donjon, mode, compte, emplacement, temps, equipe, quand, idoles) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (donjon, mode, compte, emplacement) DO UPDATE SET temps = excluded.temps, equipe = excluded.equipe, quand = excluded.quand, idoles = excluded.idoles`),
    semaine: db.prepare(`SELECT r.* FROM semaines r LEFT JOIN social s ON s.compte = r.compte WHERE coalesce(s.cache, 0) = 0 AND r.semaine = ? ORDER BY r.donjon, r.mode, r.idoles DESC, r.temps`),
    recordSemaine: db.prepare('SELECT temps, idoles FROM semaines WHERE semaine = ? AND donjon = ? AND mode = ? AND compte = ? AND emplacement = ?'),
    noterSemaine: db.prepare(`INSERT INTO semaines (semaine, donjon, mode, compte, emplacement, temps, idoles, equipe, quand) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (semaine, donjon, mode, compte, emplacement) DO UPDATE SET temps = excluded.temps, idoles = excluded.idoles, equipe = excluded.equipe, quand = excluded.quand`),
    tombes: db.prepare(`SELECT t.nom, t.classe, t.sexe, t.niveau, t.temps, t.lieu, t.tueur, t.quand FROM tombes t LEFT JOIN social s ON s.compte = t.compte
      WHERE coalesce(s.cache, 0) = 0 ORDER BY t.quand DESC LIMIT ${CLASSEMENT.maxTombes}`),
    tomber: db.prepare('INSERT INTO tombes (compte, nom, classe, sexe, niveau, temps, lieu, tueur, quand) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    premiers: db.prepare('SELECT cle, perso, nom, classe, detail, quand FROM premiers ORDER BY quand'),
    premier: db.prepare('INSERT INTO premiers (cle, perso, nom, classe, detail, quand) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (cle) DO NOTHING'),
    kv: db.prepare('SELECT valeur FROM classement_kv WHERE cle = ?'),
    ecrireKv: db.prepare('INSERT INTO classement_kv (cle, valeur) VALUES (?, ?) ON CONFLICT (cle) DO UPDATE SET valeur = excluded.valeur'),
    cache: db.prepare('SELECT cache FROM social WHERE compte = ?'),
    cacher: db.prepare('INSERT INTO social (compte, cache) VALUES (?, ?) ON CONFLICT (compte) DO UPDATE SET cache = excluded.cache'),
  };

  const json = v => { try { return v == null ? null : JSON.parse(v); } catch { return null; } };
  /** Ce qu'une ligne du classement montre d'un perso (7A) : pas d'inventaire, pas de pseudo Discord (7D refusé). */
  function ligne(r) {
    const app = json(r.apparence), met = json(r.metiers) ?? {};
    const metiers = {};
    for (const [k, v] of Object.entries(met)) {
      const lv = ent(v?.level, 1, 200), xp = ent(v?.xp, 0, 1e12);
      if (/^[a-z_]{2,20}$/.test(k) && lv != null && (lv > 1 || xp > 0)) metiers[k] = [lv, xp ?? 0];
    }
    return {
      id: idDe(r.compte, r.emplacement), c: r.compte, nom: texte(r.nom, 20), classe: texte(r.classe, 20), sexe: r.sexe === 'f' ? 'f' : 'm',
      app: app && typeof app === 'object' ? { tete: ent(app.tete, 0, 99) ?? 0, couleurs: Array.isArray(app.couleurs) ? app.couleurs.slice(0, 6).map(x => ent(x, 0, 0xffffff) ?? 0) : [] } : null,
      hc: !!r.hc, niveau: ent(r.niveau, 1, 200) ?? 1, xp: ent(r.xp, 0, 1e13) ?? 0, temps: ent(r.temps, 0, 1e9) ?? 0, lieu: texte(r.lieu, 40),
      zones: ent(r.zones, 0, 10000) ?? 0, zaaps: ent(r.zaaps, 0, 1000) ?? 0, dofus: ent(r.dofus, 0, 100) ?? 0, metiers,
      succes: ent(r.succes, 0, 1e6) ?? 0,
    };
  }

  let cacheJson = '{}', cache = null, minuterie = null;
  const parNiveau = (a, b) => b.niveau - a.niveau || b.xp - a.xp || a.nom.localeCompare(b.nom);
  /** Grave un « premier » (9A) s'il ne l'est pas encore ; annonce sur Discord (9B). */
  function graver(cle, p, detail, annonce) {
    if (q.premier.run(cle, p.id, p.nom, p.classe, detail, maintenant()).changes) annoncer(annonce);
  }

  /** 8A : recalcule tout (une fois par minute). */
  function calculer() {
    const persos = q.persos.all().filter(r => typeof r.nom === 'string' && typeof r.classe === 'string' && !r.test).map(ligne);
    const P = {};
    for (const p of persos) P[p.id] = p;
    const ids = l => l.slice(0, CLASSEMENT.max).map(p => p.id);
    const niveau = [...persos].sort(parNiveau);
    const listes = {
      niveau: ids(niveau),
      hardcore: ids(niveau.filter(p => p.hc)),
      exploration: ids([...persos].filter(p => p.zones > 0).sort((a, b) => b.zones - a.zones || b.zaaps - a.zaaps || parNiveau(a, b))),
      metiers: {},
      // menu des succès 10B : points de succès du compte, une ligne par compte (son perso le plus haut)
      succes: ids((() => { const m = new Map(); for (const p of [...persos].sort(parNiveau)) if (p.succes > 0 && !m.has(p.c)) m.set(p.c, p); return [...m.values()]; })()
        .sort((a, b) => b.succes - a.succes || parNiveau(a, b))),
    };
    const metiers = new Set(persos.flatMap(p => Object.keys(p.metiers)));
    for (const m of [...metiers].sort()) listes.metiers[m] = ids(persos.filter(p => p.metiers[m]).sort((a, b) => b.metiers[m][0] - a.metiers[m][0] || b.metiers[m][1] - a.metiers[m][1] || parNiveau(a, b)));
    // 2D : un meilleur chrono par perso, par donjon et par mode (solo / groupe)
    const donjons = {};
    for (const r of q.records.all()) {
      const d = (donjons[r.donjon] ??= { solo: [], groupe: [] }), l = d[r.mode === 'groupe' ? 'groupe' : 'solo'];
      if (l.length < CLASSEMENT.maxDonjon) l.push({ id: idDe(r.compte, r.emplacement), temps: Math.round(r.temps * 10) / 10, idoles: r.idoles ?? 0, equipe: json(r.equipe) ?? [], quand: r.quand });
    }
    // 0.6 (25A) : le chrono de la semaine (Labyrinthe), remis à zéro chaque lundi ; le gagnant de la semaine passée est annoncé
    const cleSemaine = semaineDe(maintenant()), hebdo = { semaine: cleSemaine, donjons: {} };
    for (const r of q.semaine.all(cleSemaine)) {
      const d = (hebdo.donjons[r.donjon] ??= { solo: [], groupe: [] }), l = d[r.mode === 'groupe' ? 'groupe' : 'solo'];
      if (l.length < CLASSEMENT.maxDonjon) l.push({ id: idDe(r.compte, r.emplacement), temps: Math.round(r.temps * 10) / 10, idoles: r.idoles, equipe: json(r.equipe) ?? [], quand: r.quand });
    }
    const semAvant = q.kv.get('semaine')?.valeur;
    if (semAvant !== cleSemaine) {
      q.ecrireKv.run('semaine', cleSemaine);
      if (semAvant) for (const nom of CLASSEMENT.hebdo) {
        const g = q.semaine.all(semAvant).find(r => r.donjon === nom);
        if (g) annoncer(`🏆 ${(json(g.equipe) ?? []).map(m => `**${texte(m.nom, 20)}**`).join(', ')} remporte **${nom}** de la semaine (${Math.floor(g.temps / 60)} min ${String(Math.round(g.temps % 60)).padStart(2, '0')} s, idoles ${g.idoles}) !`);
      }
    }
    // 9A : les premiers (niveaux, Dofus, métier 100) ; le premier dans l'ordre du classement s'il y en a plusieurs d'un coup
    for (const n of CLASSEMENT.paliers) { const p = niveau.find(x => x.niveau >= n); if (p) graver(`niveau_${n}`, p, '', `🏛️ **${p.nom}** est le premier aventurier à atteindre le **niveau ${n}** !`); }
    const d = [...persos].filter(p => p.dofus > 0).sort(parNiveau)[0];
    if (d) graver('dofus', d, '', `🥚 **${d.nom}** est le premier à obtenir un **Dofus** !`);
    for (const m of metiers) {
      const p = persos.filter(x => x.metiers[m]?.[0] >= CLASSEMENT.metier).sort((a, b) => b.metiers[m][1] - a.metiers[m][1])[0];
      if (p) graver(`metier_${m}`, p, m, `⚒️ **${p.nom}** est le premier à monter le métier **${m}** au niveau ${CLASSEMENT.metier} !`);
    }
    // 9B : nouveau premier du classement Niveau (pas au tout premier calcul)
    const tete = niveau[0], avant = q.kv.get('tete_niveau')?.valeur;
    if (tete && tete.id !== avant) {
      q.ecrireKv.run('tete_niveau', tete.id);
      if (avant) annoncer(`👑 **${tete.nom}** prend la **1re place** du classement Niveau (niveau ${tete.niveau}) !`);
    }
    const premiers = q.premiers.all().map(r => ({ cle: r.cle, id: r.perso, nom: r.nom, classe: r.classe, detail: r.detail, quand: r.quand }));
    cache = { maj: maintenant(), total: persos.length, persos: P, listes, donjons, hebdo, tombes: q.tombes.all(), premiers };
    cacheJson = JSON.stringify(cache);
    return cache;
  }
  function demarrer() {
    if (minuterie || !auto) return;
    try { calculer(); } catch (e) { console.warn('classement :', e.message); }
    minuterie = setInterval(() => { try { calculer(); } catch (e) { console.warn('classement :', e.message); } }, CLASSEMENT.periode);
    minuterie.unref?.();
  }
  demarrer();

  /** Place d'un perso dans chaque liste (fiche, 7C). */
  function rangs(id) {
    const c = cache ?? calculer(), r = {};
    const pos = l => { const i = l.indexOf(id); return i < 0 ? null : i + 1; };
    r.niveau = pos(c.listes.niveau); r.hardcore = pos(c.listes.hardcore); r.exploration = pos(c.listes.exploration); r.succes = pos(c.listes.succes ?? []);
    r.metiers = {};
    for (const [m, l] of Object.entries(c.listes.metiers)) { const n = pos(l); if (n) r.metiers[m] = n; }
    r.donjons = {};
    for (const [d, v] of Object.entries(c.donjons)) for (const mode of ['solo', 'groupe']) { const i = v[mode].findIndex(x => x.id === id); if (i >= 0) r.donjons[`${d}|${mode}`] = i + 1; }
    return r;
  }
  /** Fiche d'un perso (7C) : sa ligne, son équipement porté, ses Dofus, ses places. null s'il est caché ou n'existe pas. */
  function fiche(id) {
    const k = lireId(id);
    const r = k && q.donnees.get(k.compte, k.emplacement);
    if (!r) return null;
    const p = json(r.donnees);
    if (!p || p.test) return null;
    const e = p.etat ?? {};
    const L = ligne({ ...k, nom: p.nom, classe: p.classe, sexe: p.sexe, apparence: JSON.stringify(p.apparence ?? null), hc: p.hardcore, temps: p.temps, lieu: p.lieu,
      zones: Array.isArray(p.zones) ? p.zones.length : 0, zaaps: Array.isArray(e.zaaps) ? e.zaaps.length : 0, dofus: Array.isArray(e.dofus) ? e.dofus.length : 0,
      niveau: e.level, xp: e.xp, metiers: JSON.stringify(e.metiers ?? {}), succes: e.quetes?.points });
    const equipement = {};
    for (const [s, it] of Object.entries(e.equipment ?? {})) if (it && typeof it === 'object' && typeof it.id === 'string') equipement[s] = it;
    return { ...L, equipement, dofusPortes: Array.isArray(e.dofusPortes) ? e.dofusPortes.filter(x => typeof x === 'string') : [], apparat: e.apparat ?? null, rangs: rangs(L.id) };
  }

  /** 2D + 4B : fin d'un donjon dans une partie du serveur. membres = persos de comptes présents à la fin.
   *  0.6 (18D) : idoles = score d'idoles du groupe (plafonné en donjon) ; un record le bat s'il a plus d'idoles, ou autant et un meilleur temps. */
  function noterDonjon(donjon, temps, membres, idoles = 0) {
    const t = Number(temps), nom = texte(donjon, 40), id = ent(idoles, 0, 1000) ?? 0;
    if (!nom || !Number.isFinite(t) || t <= 0 || !membres.length) return;
    const mode = membres.length > 1 ? 'groupe' : 'solo', equipe = JSON.stringify(membres.map(m => ({ nom: texte(m.nom, 20), classe: texte(m.classe, 20) })));
    const nouveau = { temps: t, idoles: id }, sem = semaineDe(maintenant()), hebdo = CLASSEMENT.hebdo.includes(nom);
    for (const m of membres) {
      const avant = q.record.get(nom, mode, m.compte, m.emplacement);
      if (!avant || meilleur(nouveau, avant) < 0) q.noter.run(nom, mode, m.compte, m.emplacement, t, equipe, maintenant(), id);
      const avantS = hebdo && q.recordSemaine.get(sem, nom, mode, m.compte, m.emplacement);
      if (hebdo && (!avantS || meilleur(nouveau, avantS) < 0)) q.noterSemaine.run(sem, nom, mode, m.compte, m.emplacement, t, id, equipe, maintenant());
    }
    const noms = membres.map(m => `**${texte(m.nom, 20)}**`).join(', ');
    const m0 = membres[0];
    graver(`donjon_${nom}`, { id: idDe(m0.compte, m0.emplacement), nom: membres.map(m => texte(m.nom, 20)).join(', '), classe: texte(m0.classe, 20) }, nom,
      `⚔️ ${noms} ${membres.length > 1 ? 'sont les premiers' : 'est le premier'} à venir à bout de **${nom}** (${Math.floor(t / 60)} min ${String(Math.round(t % 60)).padStart(2, '0')} s) !`);
  }
  /** 3B : un perso Hardcore est mort ; la ligne reste dans « Tombés en Hardcore ». */
  function tomber(compte, perso, stele = {}) {
    if (!perso?.hardcore || perso.test) return false;
    const e = perso.etat ?? {};
    q.tomber.run(compte, texte(perso.nom, 20), texte(perso.classe, 20), perso.sexe === 'f' ? 'f' : 'm', ent(stele.niveau ?? e.level, 1, 200) ?? 1,
      ent(perso.temps, 0, 1e9) ?? 0, texte(stele.lieu ?? perso.lieu, 40), texte(stele.tueur, 40) || 'Inconnu', maintenant());
    return true;
  }

  const ecrire = (res, code, corps, brut = false) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(brut ? corps : JSON.stringify(corps)); };
  /** Adresses du classement (lecture libre, 1A : visible sans être connecté) ; false si l'adresse n'est pas la sienne. */
  async function route(req, res, url) {
    const p = url.pathname, m = req.method;
    if (m === 'GET' && p === '/classement') {
      if (!cache) calculer();
      const la = new Set(enLigne());
      return ecrire(res, 200, `${cacheJson.slice(0, -1)},"enLigne":${JSON.stringify(Object.keys(cache.persos).filter(i => la.has(i)))}}`, true), true;
    }
    if (m === 'GET' && p.startsWith('/classement/fiche/')) {
      const f = fiche(decodeURIComponent(p.slice('/classement/fiche/'.length)));
      return f ? ecrire(res, 200, { ...f, enLigne: enLigne().includes(f.id) }) : ecrire(res, 404, { erreur: 'perso' }), true;
    }
    if (p === '/classement/moi') {
      const c = comptes.connecte(req);
      if (!c) return ecrire(res, 401, { erreur: 'connexion' }), true;
      if (m === 'PUT') {
        const b = await comptes.lireCorps(req).catch(() => ({}));
        q.cacher.run(c.id, b.cache ? 1 : 0);
        if (cache) calculer();
        return ecrire(res, 200, { ok: true, cache: !!b.cache }), true;
      }
      const amis = comptes.social.liens(c.id).amis.map(a => a.id);
      const miens = Array.from({ length: 3 }, (_, i) => idDe(c.id, i));
      return ecrire(res, 200, { compte: c.id, miens, amis, cache: !!q.cache.get(c.id)?.cache }), true;
    }
    return false;
  }

  return { calculer, route, fiche, rangs, noterDonjon, tomber, get dernier() { return cache; }, fermer: () => clearInterval(minuterie) };
}

/** 9B : annonces dans le salon #annonces par un webhook Discord (facultatif), au plus une toutes les 2 s. */
export function annonceurDiscord(url, f = fetch) {
  if (!url || !/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(url)) return () => {};
  const file = []; let occupe = false;
  const suite = async () => {
    if (occupe || !file.length) return;
    occupe = true;
    const content = file.shift();
    try { await f(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content, allowed_mentions: { parse: [] } }) }); }
    catch (e) { console.warn('annonce Discord :', e.message); }
    setTimeout(() => { occupe = false; suite(); }, 2000).unref?.();
  };
  return t => { if (file.length < 20) file.push(String(t).slice(0, 1900)); suite(); };
}
