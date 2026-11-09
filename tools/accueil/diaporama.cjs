// Diaporama de l'accueil (maquette « Diapo : » 1B 2A-2E 3A 4A 6A 9A) : le robot joue 6 petites scènes dans la partie de test
// et prend une capture serrée de chacune, en WebP, dans public/assets/accueil/diapo/<id>.webp. Les légendes sont écrites
// à la main dans src/data/diaporama.json (5B). À lancer après `npx vite build` + `npx vite preview --port 4173` (LISEZMOI).
const { chromium } = require('playwright');
const { writeFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

const SORTIE = join(__dirname, '../../public/assets/accueil/diapo');
const ADRESSE = process.env.ADRESSE ?? 'http://localhost:4173/?test#test';
const TOUCHES = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'];

(async () => {
  mkdirSync(SORTIE, { recursive: true });
  const b = await chromium.launch({ args: ['--disable-web-security'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.route('https://assets.diablofus.com/**', async r => { try { const res = await r.fetch(); await r.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } }); } catch { /* page fermée */ } });
  const pret = () => p.waitForFunction(() => window.__df && window.__df.scene.world?.player && document.getElementById('chargement')?.hidden, null, { timeout: 180000 });
  const cmd = (...c) => p.evaluate(c => window.__df.scene.cmdTest.push(...c), c);
  const pause = ms => p.waitForTimeout(ms);
  /** Relance la partie de test (autre classe ou autre zone) puis applique ces ordres. */
  const relancer = async (f, arg, apres) => {
    await p.evaluate(([f, arg, apres]) => { const a = window.__df.scene.actionsTest(); f === 'zone' ? a.zone(arg, apres) : a[f](arg); }, [f, arg, apres]);
    await pause(3000); await pret(); await pause(2500);
  };
  /** Décale le perso (loin de la tour et des haies des Champs d'Astrub, qui le cachaient). */
  const deplacer = (dx, dy) => p.evaluate(([dx, dy]) => { const q = window.__df.scene.world.player; q.stopMove?.(); q.x += dx; q.y += dy; }, [dx, dy]);
  const joueur = () => p.evaluate(() => { const q = window.__df.scene.world.player; return { x: q.x, y: q.y }; });
  /** Joue n coups : vise le monstre le plus proche, sort suivant, clic dessus. */
  const combattre = async (n, sorts = TOUCHES) => {
    for (let k = 0; k < n; k++) {
      const m = await p.evaluate(() => {
        const w = window.__df.scene.world, q = w.player; let best = null, d = 1e18;
        for (const e of w.monsters ?? []) { if (e.hp <= 0) continue; const dd = (e.x - q.x) ** 2 + (e.y - q.y) ** 2; if (dd < d) { d = dd; best = e; } }
        return best ? window.__df.ecran(best.x, best.y) : null;
      });
      if (m) { const r = await p.evaluate(() => devicePixelRatio); await p.mouse.move(m.x / r, m.y / r - 20); await p.keyboard.press(sorts[k % sorts.length]); await p.mouse.click(m.x / r, m.y / r - 20); }
      await pause(600);
    }
  };
  /** Capture serrée autour du perso (cadrage 6A : sans l'interface), réduite en 760 x 428, en WebP. haut = part au-dessus du perso. */
  const capture = async (id, { largeur = 760, haut = 0.6, centre = false, point = null } = {}) => {
    const e = await p.evaluate(pt => { const q = pt ?? window.__df.scene.world.player; return window.__df.ecran(q.x, q.y); }, point);
    const r = await p.evaluate(() => devicePixelRatio), H = Math.round(largeur * 9 / 16);
    // centre : cadré au milieu de l'écran, pour garder entière la barre de vie du boss en haut
    const x = centre ? (1600 - largeur) / 2 : Math.max(0, Math.min(1600 - largeur, e.x / r - largeur / 2)), y = Math.max(0, Math.min(900 - H, e.y / r - H * haut));
    const png = await p.screenshot({ clip: { x, y, width: largeur, height: H } });
    const webp = await p.evaluate(async b64 => {
      const im = new Image(); im.src = `data:image/png;base64,${b64}`; await im.decode();
      const c = document.createElement('canvas'); c.width = 760; c.height = 428;
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, 760, 428);
      return c.toDataURL('image/webp', 0.8).split(',')[1];
    }, png.toString('base64'));
    writeFileSync(join(SORTIE, `${id}.webp`), Buffer.from(webp, 'base64'));
    console.log(`  ✓ ${id}`);
  };
  /** Un objet de cette rareté, tiré par le panneau de test puis posé au sol à côté du perso (2C). */
  const butinAuSol = async rarete => {
    await cmd({ k: 'tenue', rarete }); await pause(800);
    return p.evaluate(() => {
      const w = window.__df.scene.world, q = w.player, x = q.x + 150, y = q.y + 10;
      ['chapeau', 'cape', 'amulette'].forEach((slot, i) => {
        const it = q.equipment[slot]; if (!it) return;
        delete q.equipment[slot];
        w.drops.push({ item: it, uid: w.nextId++, x: x + [0, 90, 20][i], y: y + [0, -50, 80][i], t: 1 }); // t = 1 : déjà « sorti » (sinon l'objet grandit encore)
      });
      delete q.equipment.familier; // sinon le familier rapporte tout de suite le butin
      q.recompute?.();
      return { x: x + 30, y: y + 10 };
    });
  };

  await p.goto(ADRESSE); await pret(); await pause(2000);
  await cmd({ k: 'reglage', cle: 'invincible', on: true }, { k: 'reglage', cle: 'recharges', on: true });

  // 1. Iop au milieu d'un groupe, Champs d'Astrub (2A)
  await relancer('classe', 'iop');
  await relancer('zone', 'champs-astrub', [{ k: 'niveau', n: 30, auto: true }, { k: 'tenue', rarete: 'epique' }, { k: 'reglage', cle: 'invincible', on: true }, { k: 'reglage', cle: 'recharges', on: true }]);
  await pause(4000); await deplacer(-260, -60); await pause(800);
  let q = await joueur();
  await cmd({ k: 'monstre', type: 'bouftou', n: 7, rang: 'normal', x: q.x + 90, y: q.y + 30, mannequin: false });
  await pause(1500); await combattre(5); await capture('1-groupe');

  // 2. Crâ et un gros sort (2D), Champs d'Astrub
  await relancer('classe', 'cra'); await deplacer(-260, -60); await pause(1000);
  q = await joueur();
  await cmd({ k: 'monstre', type: 'bouftou', n: 5, rang: 'normal', x: q.x + 220, y: q.y + 20, mannequin: false });
  await pause(1500); await combattre(5, ['Digit2', 'Digit3', 'Digit1', 'Digit4']); await capture('2-sort');

  // 3. Butin légendaire au sol (2C)
  const sol = await butinAuSol('legendaire'); await pause(1500); await capture('3-butin', { point: sol });

  // 4. Osamodas et sa meute contre le Bouftou Royal (2B), Cour du Bouftou Royal
  await relancer('classe', 'osamodas');
  await relancer('zone', 'astrub', [{ k: 'niveau', n: 40, auto: true }, { k: 'tenue', rarete: 'legendaire' }, { k: 'reglage', cle: 'invincible', on: true }, { k: 'reglage', cle: 'recharges', on: true }, { k: 'aller', tag: 'arene_cour', nom: 'Cour du Bouftou Royal' }]);
  await pause(5000);
  q = await joueur();
  await cmd({ k: 'monstre', type: 'royal', n: 1, rang: 'boss', x: q.x + 70, y: q.y + 10, mannequin: false }, { k: 'monstre', type: 'bouftou', n: 4, rang: 'normal', x: q.x + 100, y: q.y - 30, mannequin: false });
  await pause(1500); await combattre(6); await capture('4-boss', { largeur: 880, haut: 0.85, centre: true });

  // 5. Iop face à Kardorim, Crypte d'Incarnam (2B, 1B)
  await relancer('classe', 'iop');
  await relancer('zone', 'incarnam', [{ k: 'niveau', n: 20, auto: true }, { k: 'tenue', rarete: 'epique' }, { k: 'reglage', cle: 'invincible', on: true }, { k: 'reglage', cle: 'recharges', on: true }, { k: 'aller', tag: 'arene_crypte', nom: 'Crypte de Kardorim' }]);
  await pause(5000);
  q = await joueur();
  await cmd({ k: 'monstre', type: 'kardorim', n: 1, rang: 'boss', x: q.x + 140, y: q.y, mannequin: false });
  await pause(1500); await combattre(6); await capture('5-crypte', { largeur: 880, haut: 0.85, centre: true });

  // 6. Le Havre-Sac (2E)
  await relancer('classe', 'cra');
  await relancer('zone', 'havresac', []);
  await pause(4000); await capture('6-havresac', { largeur: 960, haut: 0.55 });

  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
