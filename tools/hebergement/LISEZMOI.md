# Hébergement des fichiers lourds (maquette du 6 nov. 2026 : 1A 2A 3A 4A 5A 6B 7D 8A)

- Le jeu (code, interface, JSON) reste sur GitHub Pages.
- Les fichiers lourds (`.webp .png .jpg .mp3 .ogg` de `public/assets/{mondes,sprites,son,fx,cartes}`) sont servis par Cloudflare R2,
  bucket `diablofus-assets`, domaine `assets.<domaine du jeu>`.
- `src/render/assetUrl.ts` choisit l'adresse : avec `VITE_ASSETS_URL` au build, les fichiers lourds viennent de R2 ; sans, tout est local.
- `src/data/fichiers-lourds.json` donne l'empreinte de chaque fichier lourd (`?v=…`) : un joueur ne retélécharge que ce qui a changé.

## État (6 nov. 2026)

Les 2 465 fichiers lourds sont sur R2 et **ne sont plus dans git** (`.gitignore`, sans réécrire l'historique).
Le déploiement Pages construit avec `VITE_ASSETS_URL=https://assets.diablofus.com` (`.github/workflows/pages.yml`).
Copie de secours au moment de la bascule : `/mnt/project-files/assets-jeu/fichiers-lourds-735da2c.tar`.

## Clone neuf (jouer ou tester en local)

```
node tools/hebergement/envoi.mjs --recuperer   # télécharge depuis R2 les fichiers lourds absents
```
Sans ces fichiers, `npm test` et `npm run build` passent quand même ; seul le jeu lancé en local sans `VITE_ASSETS_URL` n'a pas d'images.

## Après un export (cartes, sprites, sons)

```
node tools/hebergement/envoi.mjs --essai   # ce qui partirait
node tools/hebergement/envoi.mjs           # empreintes + envoi
```
Variables d'environnement : `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (et `R2_BUCKET` si autre que `diablofus-assets`).
Le réseau de l'environnement Claude doit autoriser `<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`.

Le test `tests/hebergement.test.ts` échoue si un fichier lourd présent en local n'a pas son empreinte à jour.

## Réglages Cloudflare (une fois)

1. Bucket `diablofus-assets`, emplacement Automatic.
2. Settings → Custom Domains → `assets.<domaine>`.
3. Settings → CORS policy :
   `[{"AllowedOrigins":["https://diablofus.com","https://www.diablofus.com","https://mathiss29.github.io"],"AllowedMethods":["GET","HEAD"],"AllowedHeaders":["*"],"MaxAgeSeconds":86400}]`
4. Manage API tokens → Object Read & Write, limité au bucket.

Le chargement en CORS est déjà en place : `loader.crossOrigin` de Phaser (src/main.ts), `crossOrigin` sur l'audio (son.ts) et sur les planches dessinées dans un canevas (accueil.ts).
