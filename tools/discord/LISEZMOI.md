# Robot Discord de Diablofus

Repris du système du projet idlus : le jeton du robot est un secret GitHub, et un workflow lancé à la main exécute `discord_bot.mjs`. Claude ne voit jamais le jeton.

## Mise en place (une fois, par Mathis)
1. https://discord.com/developers/applications → « New Application » (« Diablofus »), onglet Bot → « Reset Token », copier le jeton.
2. OAuth2 → URL Generator : cocher `bot`, puis les droits « Envoyer des messages », « Joindre des fichiers », « Lire l'historique », « Gérer les salons » (pour renommer la catégorie). Ouvrir le lien et inviter le robot sur Ombrelune Studio.
3. Dépôt GitHub → Settings → Secrets and variables → Actions → New repository secret : `DISCORD_BOT_TOKEN`.

## Utilisation
Onglet Actions → « Discord » → Run workflow. « Essai » est coché par défaut : rien n'est envoyé, le journal montre ce qui serait fait.
- `liste` : catégories et salons du serveur.
- `categorie` : renomme la catégorie du jeu (`ancien` = un morceau du nom actuel).
- `annonce` : publie `texte` dans `salon`, cherché d'abord dans la catégorie du jeu.

Le workflow doit être sur `main` pour apparaître dans l'onglet Actions.
