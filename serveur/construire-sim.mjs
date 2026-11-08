// Construit la simulation du jeu pour le serveur (maquette « Vrai multi : » 1A) : src/sim/serveur.ts → partie/sim.mjs (un seul
// fichier, esbuild), et copie le monde d'Incarnam (l'arène de la Crypte en fait partie) dans partie/incarnam.json.
// Usage : node construire-sim.mjs [racine du dépôt]   (par défaut le dossier parent ; sur le VPS, maj.sh donne ~/depot)
import { build } from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const racine = resolve(process.argv[2] ?? join(import.meta.dirname, '..'));
const sortie = join(import.meta.dirname, 'partie');
mkdirSync(sortie, { recursive: true });
await build({
  entryPoints: [join(racine, 'src/sim/serveur.ts')], bundle: true, platform: 'node', format: 'esm', target: 'node22',
  outfile: join(sortie, 'sim.mjs'), logLevel: 'warning', legalComments: 'none',
});
copyFileSync(join(racine, 'public/assets/mondes/incarnam/monde.json'), join(sortie, 'incarnam.json'));
console.log(`simulation construite depuis ${racine}`);
