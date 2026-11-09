# Diaporama de l'accueil

Captures du jeu qui défilent dans le cadre de l'accueil (maquette « Diapo : », 2026-11-09).

- `diaporama.cjs` : le robot joue 6 scènes dans la partie de test (Iop en groupe, sort du Crâ, butin légendaire,
  Osamodas contre le Bouftou Royal, Kardorim, Havre-Sac) et enregistre `public/assets/accueil/diapo/<id>.webp`.
- Légendes : `src/data/diaporama.json`, écrites à la main (une par capture, même `id` que l'image).
- Refaire les captures : Actions › Diaporama › Run workflow (ouvre une PR), ou en local :

```
VITE_ASSETS_URL=https://assets.diablofus.com npx vite build
npx vite preview --port 4173 &
node tools/accueil/diaporama.cjs
```
