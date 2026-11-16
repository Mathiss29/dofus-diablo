#!/usr/bin/env bash
# Construit l'appli Android « Diablofus Thor » sans Gradle : aapt2 + javac + d8 + apksigner (SDK Android 34).
#   ANDROID_SDK=/chemin/sdk  CLE=/chemin/cle.jks  CLE_MDP=…  ./android/construire.sh
# Sortie : public/appli/diablofus-thor.apk (servie par le site : diablofus.com/appli/diablofus-thor.apk).
# La clé de signature n'est PAS dans le dépôt (voir android/LISEZMOI.md) : sans la même clé, la Thor refuse la mise à jour.
set -euo pipefail
cd "$(dirname "$0")"
SDK=${ANDROID_SDK:?ANDROID_SDK = dossier du SDK Android}
BT=$SDK/build-tools/${BUILD_TOOLS:-35.0.0}; JAR=$SDK/platforms/android-34/android.jar
CLE=${CLE:?CLE = fichier .jks}; MDP=${CLE_MDP:?CLE_MDP = mot de passe de la clé}
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
"$BT/aapt2" compile --dir res -o "$T/res.zip"
"$BT/aapt2" link -o "$T/base.apk" -I "$JAR" --manifest AndroidManifest.xml "$T/res.zip" --java "$T/gen" --min-sdk-version 29 --target-sdk-version 34
mkdir -p "$T/classes"
javac -source 8 -target 8 -Xlint:-options -encoding UTF-8 -bootclasspath "$JAR" -classpath "$JAR" -d "$T/classes" $(find src "$T/gen" -name '*.java')
(cd "$T/classes" && jar cf ../classes.jar .)
"$BT/d8" --min-api 29 --lib "$JAR" --output "$T" "$T/classes.jar"
cp "$T/base.apk" "$T/non-signe.apk"; (cd "$T" && zip -q non-signe.apk classes.dex)
"$BT/zipalign" -f -p 4 "$T/non-signe.apk" "$T/aligne.apk"
mkdir -p ../public/appli
"$BT/apksigner" sign --ks "$CLE" --ks-pass "pass:$MDP" --out ../public/appli/diablofus-thor.apk "$T/aligne.apk"
rm -f ../public/appli/diablofus-thor.apk.idsig
"$BT/apksigner" verify ../public/appli/diablofus-thor.apk && ls -l ../public/appli/diablofus-thor.apk
