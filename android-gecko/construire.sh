#!/usr/bin/env bash
# Construit l'appli « Diablofus Gecko » (le jeu avec son propre moteur, GeckoView) pour la Thor (arm64-v8a), signée.
#   ANDROID_HOME=/chemin/sdk  CLE=/chemin/cle-diablofus.jks  CLE_MDP=…  ./android-gecko/construire.sh
# Sortie : android-gecko/diablofus-gecko.apk (~100 Mo, pas dans git) ; à envoyer sur R2 avec ./android-gecko/envoi.mjs.
# Essai dans l'émulateur d'un PC : ajouter ABI=x86_64.
set -euo pipefail
cd "$(dirname "$0")"
: "${ANDROID_HOME:?ANDROID_HOME = dossier du SDK Android}" "${CLE:?CLE = fichier .jks}" "${CLE_MDP:?CLE_MDP = mot de passe de la clé}"
G=${GRADLE:-gradle}
"$G" --no-daemon -q assembleRelease -Pabi="${ABI:-arm64-v8a}"
cp app/build/outputs/apk/release/app-release.apk diablofus-gecko.apk
ls -l diablofus-gecko.apk
