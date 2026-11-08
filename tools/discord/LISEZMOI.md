# Robot Discord de Diablofus

Repris du système du projet idlus : le jeton du robot est un secret GitHub, et GitHub Actions lance `discord_bot.mjs` quelques secondes, sans serveur allumé en permanence. Claude ne voit jamais le jeton.

## Ce qu'il fait tout seul
Après chaque déploiement de diablofus.com (workflow « Pages », job `discord`) :
1. **Plan des salons** : applique `serveur.json` (inactif tant que `"actif": false`).
2. **Carnet du jour** : la carte du carnet le plus récent de `src/data/journal.json` (titre, résumé, rubriques, capture, lien) est
   - publiée dans `#journal` une fois par jour avec la mention du rôle `Diablofus`, puis réécrite à chaque déploiement du même jour ;
   - (facultatif) publiée dans un forum si `DISCORD_FORUM` le nomme : un post par jour, dont le premier message est réécrit. Le forum `#carnets` a été retiré le 2026-11-07 (maquette « Salons » 8C).
   Les lignes de la partie de test (`CACHE_DISCORD` dans `journal.mjs` : « partie de test », « #test », « Osamodas ») ne vont pas sur Discord ; la première ligne des Nouveautés (l'annonce du jour) reste toujours en tête. Retirer un motif de `CACHE_DISCORD` quand le contenu sort pour tout le monde.
   Les noms sont cherchés sans les émojis (« 📜・journal » = journal), d'abord dans la catégorie du jeu. Un gros carnet montre les lignes les plus récentes puis « … et N autres » (limite Discord de 6 000 caractères).

Sans le secret `DISCORD_BOT_TOKEN`, le job ne fait rien et reste vert.

## Plan des salons (`serveur.json`)
- Périmètre : les salons sans catégorie (généraux du studio) et les catégories du plan. Toute catégorie dont le nom contient « Idlus » est refusée.
- Salon avec `id` : renommé, changé de sujet ou déplacé selon le plan. Sans `id` : créé. Types : `texte`, `forum`, `annonces`, `vocal`.
- Un salon du périmètre absent du plan est **supprimé** (sauf `"supprimer": false`). Les fils ne sont jamais supprimés.
- `lectureSeule: true` : @everyone ne peut ni écrire ni ouvrir de fil (les administrateurs et le robot, si).
- Forums : `etiquettes` (`nom`, `emoji`, `modo` = posée seulement par la modération), ajoutées si elles manquent ; `reaction` = réaction par défaut des posts.
- `texte` ↔ `annonces` change sur place ; un autre changement de type demande de retirer l'`id` (nouveau salon).
- Un salon texte qui a des messages n'est jamais supprimé : il devient `🗄・ancien-…`, en lecture seule, rangé en bas.
- Ordre : les salons de chaque catégorie sont remis dans l'ordre du fichier.
- `accueil` : le message de `commencer-ici.md` est publié et épinglé dans ce salon, puis réécrit quand le fichier change (`{#nom}` devient le lien du salon).
- Pour démarrer : action `liste`, copier le « plan actuel » affiché dans `serveur.json`, le modifier, mettre `"actif": true`. L'action `plan` avec « Essai » coché montre les changements sans rien faire.

## Mise en place (une fois, par Mathis)
1. https://discord.com/developers/applications → « New Application » (« Diablofus »), icône dans General Information, onglet Bot → « Reset Token », copier le jeton.
2. OAuth2 → URL Generator : cocher `bot` puis `Administrator` (ou au moins : Gérer les salons, Gérer les rôles, Voir les salons, Envoyer des messages, Envoyer dans les fils, Intégrer des liens, Lire l'historique). Ouvrir le lien et inviter le robot sur Ombrelune Studio.
3. Dépôt GitHub → Settings → Secrets and variables → Actions → New repository secret : `DISCORD_BOT_TOKEN`.
4. Les salons forum demandent un serveur en mode Communauté. Le rôle `Diablofus` se crée dans Discord ; les membres le prennent eux-mêmes via « Salons et rôles » (Onboarding).

## À la main
Onglet Actions → « Discord » → Run workflow. « Essai » est coché par défaut : rien n'est envoyé, le journal montre ce qui serait fait.
- `liste` : catégories et salons du serveur, puis le plan actuel au format `serveur.json`.
- `plan` : applique `serveur.json`.
- `journal` : publie ou réécrit le carnet (champ `date` pour un ancien carnet).
- `categorie` : renomme la catégorie du jeu (`ancien` = un morceau du nom actuel).
- `annonce` : publie `texte` dans `salon`, cherché d'abord dans la catégorie du jeu.
- `sondage` : sondage natif Discord décrit dans `sondages/<nom>.json` (champ `sondage`, `classes` par défaut), en trois étapes (champ `etape`) :
  - `lancer` : crée les émojis du serveur manquants (`dfus_<classe>`, symboles officiels de `sondages/symboles/`), le fil de discussion, puis publie le message (mention `@everyone` ou un rôle) et les sondages (10 réponses et 55 caractères par réponse au plus, plusieurs choix). Ne republie pas un sondage déjà là.
  - `finale` : quand les sondages sont finis, publie les `finale.nombre` classes en tête dans un dernier sondage.
  - `resultat` : publie le classement de la finale (ou des sondages s'il n'y a pas de finale).
  `forcer` publie la finale ou le résultat sans attendre la fin du vote. Avec « Essai », `finale` et `resultat` lisent les votes et affichent ce qui serait publié.
