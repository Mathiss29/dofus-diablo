#!/bin/bash
# /home/diablofus/maj.sh : mise à jour du serveur Diablofus depuis le dépôt public (lancée toutes les 5 min par diablofus-maj.timer).
# Le VPS va chercher le code lui-même : aucune clé ni aucun secret à donner à GitHub.
set -euo pipefail
cd /home/diablofus
if [ ! -d depot/.git ]; then
  git clone -q --depth 1 --filter=blob:none --sparse https://github.com/Mathiss29/dofus-diablo.git depot
  git -C depot sparse-checkout set serveur
fi
git -C depot fetch -q --depth 1 origin main
NOUVEAU=$(git -C depot rev-parse FETCH_HEAD)
[ "$NOUVEAU" = "$(cat app/VERSION 2>/dev/null || true)" ] && exit 0
git -C depot reset -q --hard FETCH_HEAD
rsync -a --delete --exclude node_modules --exclude '*.test.mjs' depot/serveur/ app/
(cd app && PATH=/home/diablofus/node/bin:$PATH npm ci --omit=dev --no-audit --no-fund --loglevel=error)
echo "$NOUVEAU" > app/VERSION
sudo /usr/bin/systemctl restart diablofus
echo "Diablofus mis à jour : $NOUVEAU"
