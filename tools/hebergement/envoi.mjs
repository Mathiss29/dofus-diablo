// Fichiers lourds du jeu -> Cloudflare R2 (maquette Hébergement, 6 nov. 2026). Voir LISEZMOI.md.
//   node tools/hebergement/envoi.mjs --empreintes   recalcule src/data/fichiers-lourds.json depuis public/assets (rien n'est envoyé)
//   node tools/hebergement/envoi.mjs                 idem, puis envoie sur R2 les fichiers nouveaux ou modifiés
//   node tools/hebergement/envoi.mjs --essai         montre ce qui serait envoyé
// Variables : R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET (défaut diablofus-assets).
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const RACINE = new URL('../../', import.meta.url).pathname;
const ASSETS = join(RACINE, 'public/assets');
const SORTIE = join(RACINE, 'src/data/fichiers-lourds.json');
// Même règle que src/render/assetUrl.ts (LOURD)
const LOURD = /^(?:mondes|sprites|son|fx|cartes)\/.+\.(?:webp|avif|png|jpg|mp3|ogg)$/;
const TYPES = { webp: 'image/webp', avif: 'image/avif', png: 'image/png', jpg: 'image/jpeg', mp3: 'audio/mpeg', ogg: 'audio/ogg' };
const args = new Set(process.argv.slice(2));

function* fichiers(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* fichiers(p); else yield p;
  }
}

// 1. Empreintes des fichiers présents. Ceux qui ne sont plus en local (déjà envoyés, absents du dépôt) gardent leur empreinte.
const ancien = existsSync(SORTIE) ? JSON.parse(readFileSync(SORTIE, 'utf8')) : {};
const md5 = {}, empreintes = { ...ancien };
for (const p of fichiers(ASSETS)) {
  const r = relative(ASSETS, p).split('\\').join('/');
  if (!LOURD.test(r)) continue;
  md5[r] = createHash('md5').update(readFileSync(p)).digest('hex');
  empreintes[r] = md5[r].slice(0, 10);
}
const tri = Object.fromEntries(Object.entries(empreintes).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(SORTIE, JSON.stringify(tri, null, 0).replace(/","/g, '",\n"') + '\n');
console.log(`${Object.keys(md5).length} fichiers lourds en local, ${Object.keys(tri).length} dans ${relative(RACINE, SORTIE)}`);
if (args.has('--empreintes')) process.exit(0);

// 2. Envoi de ce qui manque ou a changé (l'ETag de R2 est le MD5 pour un envoi en un morceau).
const { S3Client, ListObjectsV2Command, PutObjectCommand } = await import('@aws-sdk/client-s3');
const { R2_ACCOUNT_ID: compte, R2_ACCESS_KEY_ID: cle, R2_SECRET_ACCESS_KEY: secret } = process.env;
const BUCKET = process.env.R2_BUCKET || 'diablofus-assets';
if (!compte || !cle || !secret) { console.error('Il manque R2_ACCOUNT_ID, R2_ACCESS_KEY_ID ou R2_SECRET_ACCESS_KEY (voir LISEZMOI.md).'); process.exit(1); }
const s3 = new S3Client({ region: 'auto', endpoint: `https://${compte}.r2.cloudflarestorage.com`, credentials: { accessKeyId: cle, secretAccessKey: secret } });

const distant = new Map();
let jeton;
do {
  const r = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: jeton }));
  for (const o of r.Contents ?? []) distant.set(o.Key, (o.ETag ?? '').replaceAll('"', ''));
  jeton = r.IsTruncated ? r.NextContinuationToken : undefined;
} while (jeton);

const aEnvoyer = Object.keys(md5).filter(k => distant.get(k) !== md5[k]);
const octets = aEnvoyer.reduce((s, k) => s + statSync(join(ASSETS, k)).size, 0);
console.log(`${distant.size} fichiers déjà sur R2 ; ${aEnvoyer.length} à envoyer (${(octets / 1e6).toFixed(1)} Mo)`);
if (args.has('--essai')) { for (const k of aEnvoyer.slice(0, 30)) console.log('  ' + k); process.exit(0); }

let fait = 0, i = 0;
async function ouvrier() {
  while (i < aEnvoyer.length) {
    const k = aEnvoyer[i++];
    for (let essai = 1; ; essai++) {
      try {
        await s3.send(new PutObjectCommand({
          Bucket: BUCKET, Key: k, Body: readFileSync(join(ASSETS, k)),
          ContentType: TYPES[k.split('.').pop()] ?? 'application/octet-stream',
          // l'adresse porte l'empreinte (?v=…) : un jour de cache suffit pour les rares adresses sans empreinte (pages de multi-atlas)
          CacheControl: 'public, max-age=86400',
        }));
        break;
      } catch (e) {
        if (essai >= 4) throw e;
        await new Promise(r => setTimeout(r, 2000 * essai));
      }
    }
    if (++fait % 100 === 0 || fait === aEnvoyer.length) console.log(`  ${fait}/${aEnvoyer.length}`);
  }
}
await Promise.all(Array.from({ length: 8 }, ouvrier));
console.log('Envoi terminé.');
