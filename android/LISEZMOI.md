# Appli Android « Diablofus Thor »

Maquette « Confort 2 : » 1A (2026-11-16). Une petite appli qui ouvre **le jeu sur l'écran du haut** et **l'écran du bas
(diablofus.com/#compagnon) sur le second écran** de l'AYN Thor, sans Chrome :

- les deux pages viennent du site : l'appli n'a besoin d'une nouvelle version que si son code Java change ;
- même profil pour les deux pages : sauvegarde, `BroadcastChannel` et stockage partagés, comme deux onglets ;
- plein écran, écran toujours allumé ;
- la manette est lue par l'appli (`Manette.java`) et passée aux pages par `window.DiablofusAppli.manette()` : toucher
  l'écran du bas ne coupe jamais la manette du jeu (`src/render/manette.ts`, `padNatif`) ;
- `DiablofusAppli.vibrer(fort, faible, ms)` : vibreur de la console ; `luminosite(f)` : l'écran du bas qui s'assombrit ;
- plantage : la trace est gardée (`Journal.java`) et montrée au lancement suivant avec un bouton Copier ; ce lancement-là
  se fait sans l'écran du bas (mode sûr). L'écran du bas s'ouvre une fois la fenêtre du jeu posée (`onResume`).
- retour Android = Échap dans la page ; liens hors du jeu (sauf Discord pour la connexion) = navigateur.

Téléchargement : https://diablofus.com/appli/diablofus-thor.apk (Options › Manette, ou l'onglet liaison de l'écran du bas).

## Construire

Sans Gradle, avec le SDK Android (plateforme 34, build-tools 35) et Java 17+ :

```
ANDROID_SDK=/chemin/sdk CLE=cle-diablofus.jks CLE_MDP=… ./android/construire.sh
```

Le fichier signé va dans `public/appli/diablofus-thor.apk` (dans le dépôt, 70 Ko). Monter `android:versionCode` dans
`AndroidManifest.xml` à chaque nouvelle version.

**Clé de signature** : pas dans le dépôt (public). Elle est dans le dossier du projet Claude,
`console-thor/appli/cle-diablofus.jks` (mot de passe à côté). Sans la même clé, Android refuse d'installer la mise à jour
par-dessus l'ancienne (il faudrait désinstaller, et la sauvegarde locale de l'appli partirait avec).

Le d8 des build-tools 34 plante sur les classes internes compilées par Java 21 : garder les build-tools 35 ou plus.
