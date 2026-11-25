// Met l'appli « Diablofus Gecko » en ligne sur R2 : https://assets.diablofus.com/appli/diablofus-gecko.apk
// (trop lourde pour le dépôt et GitHub Pages). Mêmes variables que tools/hebergement/envoi.mjs (R2_ACCOUNT_ID…).
//   node android-gecko/envoi.mjs
import { readFileSync } from 'node:fs';
const { R2_ACCOUNT_ID: compte, R2_ACCESS_KEY_ID: cle, R2_SECRET_ACCESS_KEY: secret, R2_BUCKET = 'diablofus-assets' } = process.env;
if (!compte || !cle || !secret) { console.error('Il manque R2_ACCOUNT_ID, R2_ACCESS_KEY_ID ou R2_SECRET_ACCESS_KEY.'); process.exit(1); }
const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
const s3 = new S3Client({ region: 'auto', endpoint: `https://${compte}.r2.cloudflarestorage.com`, credentials: { accessKeyId: cle, secretAccessKey: secret } });
const corps = readFileSync(new URL('./diablofus-gecko.apk', import.meta.url));
await s3.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: 'appli/diablofus-gecko.apk', Body: corps, ContentType: 'application/vnd.android.package-archive',
  ContentDisposition: 'attachment; filename="diablofus-gecko.apk"', CacheControl: 'no-cache' }));
console.log(`envoyée : https://assets.diablofus.com/appli/diablofus-gecko.apk (${(corps.length / 1e6).toFixed(1)} Mo)`);
