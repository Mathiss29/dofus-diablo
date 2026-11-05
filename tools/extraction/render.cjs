const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [,, sceneP, texP, outP, animsCsv, flip, scale] = process.argv;
  const b = await chromium.launch(); const pg = await b.newPage();
  pg.on('pageerror', e => console.log('ERR', e.message));
  await pg.goto('file://' + __dirname + '/render.html');
  const scene = JSON.parse(fs.readFileSync(sceneP)); const texs = {};
  const paths = new Set(scene.meshes.map(m => m.tex).filter(Boolean)); if (!paths.size) paths.add(texP);
  for (const p of paths) texs[p] = 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
  for (const m of scene.meshes) if (!m.tex) m.tex = texP;
  await pg.evaluate(async ([s, t]) => setup(s, t), [scene, texs]);
  if (process.env.CONTACT) { const u = await pg.evaluate(([a, f, s, c]) => contact(a, s, f, c), [animsCsv.split(','), flip === '1', +scale, +process.env.CONTACT]);
    fs.writeFileSync(outP + '.png', Buffer.from(u.split(',')[1], 'base64')); await b.close(); return; }
  let r;
  if (process.env.BOX) {
    const specs = animsCsv.split(',').map(t => { const [name, max, out] = t.split(':'); return { name, max: max ? +max : 0, out: out || name }; });
    // BOX=auto : boîte = union des bornes des animations demandées (effets de sorts)
    const box = process.env.BOX === 'auto'
      ? await pg.evaluate(([sp, f]) => { let b = [1e9, 1e9, -1e9, -1e9]; for (const x of sp) { const c = bounds(x.name, f); b = [Math.min(b[0], c[0]), Math.min(b[1], c[1]), Math.max(b[2], c[2]), Math.max(b[3], c[3])]; } return [b[0] - 4, b[1] - 4, b[2] + 4, b[3] + 4]; }, [specs, flip === '1'])
      : process.env.BOX.split(',').map(Number);
    r = await pg.evaluate(([sp, f, s, bx]) => sheetFixed(sp, s, f, bx, 4096), [specs, flip === '1', +scale, box]);
  } else r = await pg.evaluate(([a, f, s]) => sheet(a, s, f, 4), [animsCsv.split(','), flip === '1', +scale]);
  fs.writeFileSync(outP + '.png', Buffer.from(r.url.split(',')[1], 'base64'));
  fs.writeFileSync(outP + '.json', JSON.stringify({ frames: r.frames, meta: { image: require('path').basename(outP) + '.png', size: {}, scale: '1', cell: r.cell, origin: r.origin } }, null, 1));
  console.log('cell', r.cell, 'origin', r.origin);
  await b.close();
})();
