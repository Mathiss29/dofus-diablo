# Appli Android « Diablofus Gecko » (le jeu avec son propre moteur)

Même rôle que l'appli « Diablofus Thor » (`android/`) : le jeu sur l'écran du haut, l'écran du bas
(diablofus.com/#compagnon) sur le second écran, manette lue par l'appli, vibreur, luminosité, journal des plantages.
La différence : le moteur web est **GeckoView** (le moteur de Firefox), **livré dans l'appli**. La Thor fait tourner
l'appli WebView avec « Android System WebView » 109 (début 2023), qu'on ne peut pas mettre à jour, et qui ferme la page
quand la mémoire de la carte graphique monte. Ici, le moteur est récent et la page vit dans son propre processus : si
Android la tue, l'appli la relance au lieu de se fermer.

- Paquet `com.ombrelune.diablofus.gecko` : s'installe **à côté** de l'appli WebView (pour comparer). Le moteur est
  différent, donc la sauvegarde locale ne passe pas d'une appli à l'autre : se connecter avec Discord (mode En ligne),
  ou exporter puis charger la sauvegarde.
- `window.DiablofusAppli` : GeckoView n'a pas d'`addJavascriptInterface`. Une extension intégrée (`assets/pont/`) pose
  l'objet dans la page ; l'appli lui pousse l'état de la manette à chaque mouvement (`Moteur.manette()`), et la page le lit
  sans attendre (`manette()`), comme avant. `moteur()` vaut `'gecko'`. Les erreurs de la page vont dans le journal.
- Appli 4 (« Fluidité Thor : », 2026-11-25) : réglages du moteur posés au lancement (`Moteur.reglages()` : assez de
  processus pour que le jeu et l'écran du bas aient chacun le leur, horloge des pages non arrondie), pas d'attente du
  double toucher, priorité au processus du jeu, fréquence de l'écran du haut choisie par le jeu
  (`DiablofusAppli.frequence(hz)`, 0 = la plus haute), et `DiablofusAppli.ecran()` pour le rapport (fréquences, processus).
- Sons sans toucher l'écran : l'appli accorde la lecture automatique (`Page.Permissions`).
- Charger une sauvegarde : le sélecteur de fichiers d'Android (`Principale.choisirFichier`).

## Construire

Gradle (AGP 8.13), SDK Android avec la plateforme 36, Java 17+ :

```
ANDROID_HOME=/chemin/sdk CLE=cle-diablofus.jks CLE_MDP=… ./android-gecko/construire.sh
node android-gecko/envoi.mjs     # en ligne : https://assets.diablofus.com/appli/diablofus-gecko.apk
```

Monter `versionCode` (app/build.gradle) et `Principale.VERSION` à chaque nouvelle version. Même clé de signature que
l'appli WebView (voir android/LISEZMOI.md). L'APK fait ~100 Mo (le moteur), il n'est pas dans git.

GeckoView 161 demande androidx.core 1.19 (compileSdk 37, AGP 9.1) : la vérification des métadonnées AAR est coupée dans
app/build.gradle, l'appli n'utilise aucune API récente. Pour l'émulateur d'un PC : `ABI=x86_64`.
