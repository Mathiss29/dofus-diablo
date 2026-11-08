// plantages.cjs : chasse aux plantages et aux gels (Mathis, 2026-11-08, après deux gels en coop). Le robot joue vraiment :
// sorts et clics au hasard dans l'arène de la Crypte, changement de zone (la scène repart), puis la coop à deux navigateurs
// (salon, invité, changement de zone de l'hôte, départ de l'invité), avec chaque classe. Toute erreur de la page, toute
// erreur en console ou une image qui ne bouge plus fait échouer la chasse (code de sortie 1).
// Jeu servi par `npx vite preview --port 4173`, construit avec VITE_ASSETS_URL=https://assets.diablofus.com et
// VITE_COOP_URL=ws://localhost:3100/ws, serveur lancé à côté (`cd serveur && node index.mjs`). Lancé à chaque PR (ci.yml).
// SORTIE=dossier : captures des écrans au moment d'un problème. RAPIDE=1 : moins de temps de jeu par étape.
// CAS=seul:iop, CAS=coop:0 (0 à 3) ou CAS=serveur (partie tenue par le serveur) : une seule étape (la CI lance les 9 en même temps).
const { chromium } = require('playwright');
const fs = require('fs');
const SORTIE = process.env.SORTIE ?? 'plantages';
const JEU = Number(process.env.RAPIDE ? 5 : 12);   // secondes de jeu par étape
const CLASSES = ['iop', 'cra', 'osamodas', 'sacrieur'];
const TOUCHES = ['&', 'é', '"', "'", '(', '-'];
const problemes = [];
const CAS = process.env.CAS;   // vide = tout
const garder = id => !CAS || CAS === id;

(async () => {
  fs.mkdirSync(SORTIE, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const ouvrir = async nom => {
    const c = await b.newContext({ viewport: { width: 1280, height: 720 } });
    const p = await c.newPage();
    p.nom = nom;
    await p.route('https://assets.diablofus.com/**', async r => {
      try { const res = await r.fetch(); await r.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } }); } catch { /* page fermée */ }
    });
    p.on('pageerror', e => probleme(p, `erreur : ${e.message} | ${(e.stack ?? '').split('\n').slice(1, 4).join(' | ')}`));
    p.on('console', m => { if (m.type() === 'error' && !/GL Driver|Failed to load resource|favicon/.test(m.text())) probleme(p, `console : ${m.text().slice(0, 400)}`); });
    await p.goto('http://localhost:4173/?test#test');
    await pret(p);
    return p;
  };
  const pret = p => p.waitForFunction(() => window.__df && window.__df.cartes().length > 0 && window.__df.scene.world, null, { timeout: 120000 });
  let etape = '';
  const probleme = (p, texte) => {
    problemes.push(`[${etape}] ${p.nom} ${texte}`);
    console.log(`  ✗ ${p.nom} ${texte}`);
    p.screenshot({ path: `${SORTIE}/${problemes.length}-${p.nom}.png` }).catch(() => {});
  };
  /** Le jeu tourne encore : les images avancent, et la partie aussi (chez l'invité, le temps vient de l'hôte). */
  const vivant = async (p, partie = true) => {
    const lire = () => p.evaluate(() => ({ f: window.__df.scene.game.loop.frame, t: window.__df.scene.world.time })).catch(() => null);
    const a = await lire(); await p.waitForTimeout(2500); const z = await lire();
    if (!a || !z) return probleme(p, 'page bloquée (ne répond plus)');
    if (z.f <= a.f) probleme(p, `gel : l'image ne bouge plus (${a.f} → ${z.f})`);
    else if (partie && z.t <= a.t) probleme(p, `gel : la partie n'avance plus (temps ${a.t.toFixed(1)} → ${z.t.toFixed(1)})`);
  };
  const commande = (p, c) => p.evaluate(c => window.__df.scene.cmdTest.push(c), c);
  const relancer = async (p, f, arg) => { await p.evaluate(([f, arg]) => window.__df.scene.actionsTest()[f](arg), [f, arg]); await p.waitForTimeout(3000); await pret(p); await p.waitForTimeout(2000); };
  const crypte = async p => { await commande(p, { k: 'aller', tag: 'arene_crypte', nom: 'Crypte de Kardorim' }); await p.waitForTimeout(4000); };
  /** Joue n secondes : clics au sol et sur les monstres, sorts 1 à 6 ; l'hôte de test ne meurt pas (on veut des plantages, pas des morts). */
  const jouer = async (pages, n) => {
    for (let k = 0; k < n * 2; k++) {
      for (const [i, p] of pages.entries()) {
        await p.mouse.click(480 + ((k + i) * 97) % 320, 240 + ((k + i) * 53) % 260).catch(() => {});
        await p.keyboard.press(TOUCHES[(k + i * 2) % 6]).catch(() => {});
        if (i === 0) await p.evaluate(() => { const q = window.__df.scene.world.players[0]; q.hp = Math.max(q.hp, q.maxHp / 2); }).catch(() => {});
      }
      await pages[0].waitForTimeout(500);
    }
  };
  // F1 › Monstres ; si la scène repart pendant ce temps (instantané du serveur, fin d'arène), le panneau est recréé : on recommence
  const ouvrirMonstres = async p => {
    await p.keyboard.press('F1');
    for (let i = 0; ; i++) {
      try { await p.click('#ptest [data-o="monstres"]', { timeout: i < 2 ? 10000 : 30000 }); return; } catch (e) {
        if (i >= 2) throw e;
        await p.waitForTimeout(2000);
        if (!(await p.isVisible('#ptest [data-o="monstres"]'))) await p.keyboard.press('F1');
      }
    }
  };

  // 1. Seul, chaque classe : combat dans l'arène, puis la scène repart (changement de zone)
  const h = await ouvrir('hote');
  await commande(h, { k: 'niveau', n: 40, auto: true });
  for (const c of CLASSES.filter(c => garder(`seul:${c}`))) {
    etape = `seul ${c}`; console.log(etape);
    await relancer(h, 'classe', c);
    await crypte(h);
    await jouer([h], JEU);
    await vivant(h);
    // la scène repart (comme un changement de zone) puis on recombat : les dessins gardés d'une scène à l'autre cassent ici
    await relancer(h, 'zone', 'incarnam');
    await crypte(h);
    await jouer([h], JEU);
    await vivant(h);
  }

  // 2. Coop à deux, chaque classe en invité (et une autre en hôte)
  const paires = CLASSES.map((c, k) => k).filter(k => garder(`coop:${k}`));
  const inv = paires.length ? await ouvrir('invite') : null;
  if (inv) await commande(inv, { k: 'niveau', n: 40, auto: true });
  for (const k of paires) {
    const c = CLASSES[k];
    const ch = CLASSES[(k + 1) % CLASSES.length];
    etape = `coop ${ch} hôte, ${c} invité`; console.log(etape);
    await relancer(h, 'classe', ch);
    await relancer(inv, 'classe', c);
    await crypte(h);
    await ouvrirMonstres(h); await h.click('[data-coop-creer]');
    await h.waitForSelector('.coop b', { timeout: 15000 });
    const code = (await h.textContent('.coop b')).trim();
    await h.keyboard.press('F1');
    await ouvrirMonstres(inv); await inv.fill('#pt-coop', code); await inv.click('[data-coop-rejoindre]');
    await inv.waitForTimeout(4000); await pret(inv); await inv.waitForTimeout(3000);
    const dedans = await inv.evaluate(() => window.__df.scene.world.players.length);
    if (dedans < 2) probleme(inv, `n'a pas rejoint le salon (${dedans} joueur)`);
    await jouer([h, inv], JEU);
    await vivant(h); await vivant(inv);
    // la scène de l'hôte repart (changement de zone) : ses invités le suivent, puis on recombat
    await relancer(h, 'zone', 'incarnam');
    await crypte(h);
    await inv.waitForTimeout(5000); await pret(inv);
    await jouer([h, inv], JEU);
    await vivant(h); await vivant(inv);
    // l'invité quitte : il retrouve sa partie ; l'hôte ferme le salon
    await ouvrirMonstres(inv); await inv.click('[data-coop-quitter]').catch(() => probleme(inv, 'bouton « Quitter le salon » introuvable'));
    await inv.waitForTimeout(4000); await pret(inv);
    await vivant(inv);
    await ouvrirMonstres(h); await h.click('[data-coop-quitter]').catch(() => {}); await h.keyboard.press('F1');
  }

  // 3. Partie tenue par le serveur (maquette « Vrai multi : » 1A) : les deux sont invités ; le premier part, l'autre continue
  if (garder('serveur')) {
    etape = 'partie sur le serveur'; console.log(etape);
    const j1 = h, j2 = inv ?? await ouvrir('invite');
    await relancer(j1, 'classe', 'iop'); await relancer(j2, 'classe', 'cra');
    await ouvrirMonstres(j1); await j1.click('[data-coop-serveur]');
    // le serveur appelle le joueur dans son arène : la scène repart, on rouvre le panneau pour lire le code
    await j1.waitForTimeout(5000); await pret(j1); await j1.waitForTimeout(1000);
    await ouvrirMonstres(j1);
    const code = (await j1.textContent('.coop b', { timeout: 15000 })).trim();
    await j1.keyboard.press('F1');
    await ouvrirMonstres(j2); await j2.fill('#pt-coop', code); await j2.click('[data-coop-rejoindre]');
    for (const p of [j1, j2]) { await p.waitForTimeout(4000); await pret(p); }
    await j2.waitForTimeout(3000);
    for (const p of [j1, j2]) {
      const n = await p.evaluate(() => window.__df.scene.world.players.length);
      if (n < 2) probleme(p, `ne voit pas l'autre joueur dans la partie du serveur (${n} joueur)`);
    }
    await jouer([j1, j2], JEU);
    await vivant(j1); await vivant(j2);
    // le premier joueur part : la partie continue pour l'autre
    await ouvrirMonstres(j1); await j1.click('[data-coop-quitter]').catch(() => probleme(j1, 'bouton « Quitter le salon » introuvable'));
    await j1.waitForTimeout(4000); await pret(j1);
    await jouer([j2], JEU);
    await vivant(j2); await vivant(j1);
    await ouvrirMonstres(j2); await j2.click('[data-coop-quitter]').catch(() => {}); await j2.waitForTimeout(4000); await pret(j2);
    await vivant(j2);
  }

  await b.close();
  fs.writeFileSync(`${SORTIE}/resultat.txt`, problemes.length ? problemes.join('\n') : 'aucun problème');
  console.log(problemes.length ? `\n${problemes.length} problème(s) :\n${problemes.join('\n')}` : '\nAucun plantage ni gel.');
  process.exit(problemes.length ? 1 : 0);
})().catch(e => { console.error('le robot lui-même a planté :', e); process.exit(2); });
