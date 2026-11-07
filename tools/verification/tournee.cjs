// tournee.cjs <monde> <dossier de sortie> [cartes séparées par des virgules] : le robot visite chaque carte d'un monde et la
// photographie, puis planche.py en fait des planches de 16 à valider d'un coup d'œil (choix de Mathis « Cartes : 4A », 2026-11-07).
// À lancer après chaque export de carte, le jeu servi par `npm run build && npx vite preview --port 4173`.
// Écran de 1280x720 (en 1920 le navigateur sans écran rend noir) ; ATT=ms d'attente par carte (5000 par défaut).
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [monde, out, liste] = process.argv.slice(2);
  if (!monde || !out) { console.log('usage : node tournee.cjs <monde> <sortie> [cartes]'); process.exit(1); }
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const erreurs = [];
  p.on('pageerror', e => erreurs.push(e.message));
  await p.goto(`http://localhost:4173/?test${monde === 'astrub' ? '#astrub2' : ''}`);
  await p.waitForFunction(() => window.__df && window.__df.cartes().length > 0, null, { timeout: 120000 });
  await p.addStyleTag({ content: 'body > div:not(#game) { display:none !important }' });
  const toutes = await p.evaluate(() => window.__df.cartes());
  const tags = liste ? liste.split(',') : toutes;
  await p.evaluate(() => { window.__df.scene.zoom = 0.55; });
  for (const t of tags) {
    if (!(await p.evaluate(t => window.__df.aller(t), t))) { console.log('pas de case libre :', t); continue; }
    await p.waitForTimeout(+process.env.ATT || 5000);
    await p.screenshot({ path: `${out}/${t}.jpg`, quality: 70 });
    process.stdout.write(t + ' ');
  }
  console.log(`\n${tags.length} cartes ; erreurs du jeu : ${erreurs.length}`);
  for (const e of [...new Set(erreurs)]) console.log('  ', e);
  await b.close();
})();
