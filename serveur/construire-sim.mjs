// Construit la simulation du jeu pour le serveur (maquette « Vrai multi : » 1A) : src/sim/serveur.ts → partie/sim.mjs (un seul
// fichier, esbuild), et copie les mondes d'Incarnam et d'Astrub (leurs arènes de donjon en font partie) dans partie/<zone>.json.
// Usage : node construire-sim.mjs [racine du dépôt]   (par défaut le dossier parent ; sur le VPS, maj.sh donne ~/depot)
import { build } from 'esbuild';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const racine = resolve(process.argv[2] ?? join(import.meta.dirname, '..'));
const sortie = join(import.meta.dirname, 'partie');
mkdirSync(sortie, { recursive: true });
await build({
  entryPoints: [join(racine, 'src/sim/serveur.ts')], bundle: true, platform: 'node', format: 'esm', target: 'node22',
  outfile: join(sortie, 'sim.mjs'), logLevel: 'warning', legalComments: 'none',
});
// les mondes dont le serveur tient les donjons : Incarnam (la Crypte) et Astrub (ses quatre donjons), s'il est là
for (const z of ['incarnam', 'astrub']) {
  const src = join(racine, `public/assets/mondes/${z}/monde.json`);
  if (existsSync(src)) copyFileSync(src, join(sortie, `${z}.json`));
  else if (z === 'incarnam') throw new Error(`${src} absent`);
  else console.warn(`${z} absent : ses donjons ne seront pas tenus par le serveur`);
}
console.log(`simulation construite depuis ${racine}`);
