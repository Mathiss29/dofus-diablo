# Serveur multijoueur de Diablofus

Serveur Node 22 (maquette « Multi : », 2026-11-08) : coop à 2-4 joueurs, Bastion des Douze partagé, comptes Discord et
sauvegardes en ligne. Pour l'instant : `/sante`, les salons de coop sur `/ws`, et les comptes Discord avec persos en ligne
(`comptes.mjs`, base SQLite `donnees/diablofus.db`, copie chaque nuit à 4 h 30 dans `donnees/sauvegardes/`, 14 gardées),
et les parties tenues par le serveur (`partie.mjs`, maquette « Vrai multi : » 1A) : la simulation du jeu (`src/sim`) est
construite en un fichier par `construire-sim.mjs` (esbuild) dans `partie/`, à chaque mise à jour.

Il tourne sur le VPS OVH d'Idlus (VPS-3, Ubuntu 24.04), **sans toucher à Idlus** :

- utilisateur Linux `diablofus` sans mot de passe, sans sudo général, **jamais dans le groupe docker** ;
- tout dans `/home/diablofus` : `node/` (Node 22 officiel), `app/` (ce dossier), `donnees/` (base, sauvegardes) ;
- écoute sur `127.0.0.1:3100` seulement ; le monde y arrive par un **tunnel Cloudflare** (`api.diablofus.com`), donc ni le
  Caddy d'Idlus (conteneur Supabase) ni le pare-feu ne changent ;
- service systemd limité à 1 cœur et 2 Go (1 Go jusqu'au 2026-11-08), `OOMScoreAdjust=500` (c'est lui qui part en premier si la mémoire manque) ;
- mise à jour **tirée par le VPS** : toutes les 5 minutes, `diablofus-maj.timer` lance `maj.sh` (utilisateur `diablofus`),
  qui regarde `main` du dépôt public et, s'il a changé, copie `serveur/` dans `~/app` et redémarre ce seul service (sudoers
  limité à `systemctl restart diablofus` et `systemctl is-active diablofus`). Aucune clé SSH ni secret côté GitHub.

## Installation (une fois, relue par le projet Idlus)

Chaque bloc se colle tel quel (ou passe par un workflow SSH du projet Idlus). Aucun ne touche à Docker, à Caddy, à ufw
ni à `/opt/idlus`. Seul le jeton du tunnel (bloc 4) vient de Mathis.

### 1. Utilisateur et dossiers

```bash
sudo adduser --system --group --home /home/diablofus --shell /bin/bash diablofus
sudo -u diablofus mkdir -p /home/diablofus/app /home/diablofus/donnees
sudo chmod 750 /home/diablofus
```

### 2. Node 22 (archive officielle, vérifiée, dans le dossier de l'utilisateur)

```bash
sudo -u diablofus -H bash -c '
  set -e; cd ~
  B=https://nodejs.org/dist/latest-v22.x
  F=$(curl -fsSL $B/SHASUMS256.txt | grep -o "node-v22[^ ]*-linux-x64.tar.xz")
  curl -fsSLO $B/$F
  curl -fsSL $B/SHASUMS256.txt | grep " $F\$" | sha256sum -c -
  mkdir -p node && tar -xJf $F -C node --strip-components=1 && rm $F
  node/bin/node -v'
```

### 3. Service, droit de redémarrage et mise à jour automatique

Fichiers de `serveur/installation/` (relus avant de les poser) :

```bash
cd /tmp && for f in diablofus.service sudoers-diablofus diablofus-maj.service diablofus-maj.timer maj.sh; do
  curl -fsSLO https://raw.githubusercontent.com/Mathiss29/dofus-diablo/main/serveur/installation/$f; done
cat diablofus.service sudoers-diablofus diablofus-maj.service diablofus-maj.timer maj.sh   # relire
sudo install -m 644 diablofus.service diablofus-maj.service diablofus-maj.timer /etc/systemd/system/
sudo visudo -cf sudoers-diablofus && sudo install -m 440 sudoers-diablofus /etc/sudoers.d/diablofus
sudo install -D -o root -g root -m 755 maj.sh /usr/local/lib/diablofus/maj.sh
sudo systemctl daemon-reload && sudo systemctl enable diablofus && sudo systemctl enable --now diablofus-maj.timer
sudo systemctl start diablofus-maj.service && sleep 3 && sudo systemctl is-active diablofus && curl -fsS http://127.0.0.1:3100/sante
```

La dernière ligne fait la première mise à jour tout de suite : elle doit finir par `active` puis `{"ok":true,…}`.
`enable` = tout repart seul après un redémarrage de la machine. `maj.sh` appartient à root et vit hors du dossier de `diablofus` (`/usr/local/lib/diablofus/`) :
`diablofus` le lance mais ne peut ni le modifier ni le remplacer.

### 4. Tunnel Cloudflare (api.diablofus.com)

**Mathis, dans le tableau de bord Cloudflare** : Zero Trust › Networks › Tunnels › Create a tunnel › Cloudflared, nom
`diablofus`. Onglet Public Hostname : sous-domaine `api`, domaine `diablofus.com`, service `HTTP`, URL `127.0.0.1:3100`
(pas `localhost`, qui peut partir sur `::1` en IPv6 où le serveur n'écoute pas). Cloudflare affiche une commande
`cloudflared service install <jeton>` : le **jeton** (la longue suite après `install`) ne se colle que sur le VPS (ou dans
un secret GitHub du projet Idlus si c'est son workflow qui lance la commande), jamais dans une discussion.

**Sur le VPS** :

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo NEEDRESTART_MODE=l apt-get install -y cloudflared   # l : liste seulement ; si une liste de services à redémarrer s'affiche quand même, répondre non
sudo cloudflared service install "$JETON"                                       # JETON = le jeton du tunnel
cd /tmp && curl -fsSLO https://raw.githubusercontent.com/Mathiss29/dofus-diablo/main/serveur/installation/cloudflared-limites.conf
sudo install -D -m 644 cloudflared-limites.conf /etc/systemd/system/cloudflared.service.d/limites.conf
sudo systemctl daemon-reload && sudo systemctl restart cloudflared
```

### 5. Vérification

`https://api.diablofus.com/sante` répond `{"ok":true,…}`. Journal des mises à jour : `journalctl -u diablofus-maj -n 20`.

## Bon à savoir

- Cloudflare coupe un WebSocket muet depuis 100 s : le serveur envoie un ping toutes les 30 s (`index.mjs`).

- 2026-11-08 : `maj.sh` récupère aussi la simulation du jeu (`src/sim`, `src/data`, le monde d'Incarnam ; aucune image) et
  la construit (`construire-sim.mjs`) pour les parties tenues par le serveur. Remplacer `maj.sh` (commit indiqué par Mathis) :

```bash
cd /tmp && curl -fsSLO https://raw.githubusercontent.com/Mathiss29/dofus-diablo/$COMMIT/serveur/installation/maj.sh
cat maj.sh   # relire
sudo install -D -o root -g root -m 755 maj.sh /usr/local/lib/diablofus/maj.sh
sudo systemctl start diablofus-maj.service && journalctl -u diablofus-maj -n 5 --no-pager && curl -fsS http://127.0.0.1:3100/sante
```

  La dernière ligne doit montrer `"parties":0` ; la première construction prend quelques secondes (esbuild).

## Comptes Discord (maquette « Vrai multi : » 11B)

**Mathis, dans le portail Discord** (https://discord.com/developers/applications, appli du robot) : OAuth2 › Redirects ›
ajouter `https://api.diablofus.com/connexion/retour`, enregistrer. Noter le **Client ID** (public) et faire « Reset Secret »
pour le **Client Secret** : le secret ne passe jamais dans une discussion, il va directement au projet Idlus (secret GitHub
`DIABLOFUS_DISCORD_SECRET`, comme le jeton du tunnel). Facultatif : l'id du serveur Discord (clic droit › Copier l'identifiant
du serveur, mode développeur) et les ids des rôles testeur / admin (essai fermé 10A, outils de test en ligne 4D).

**Sur le VPS** (`DISCORD_SECRET` = le secret ; les autres valeurs ne sont pas secrètes) :

```bash
sudo install -d -m 700 /etc/diablofus
printf 'DISCORD_ID=%s\nDISCORD_SECRET=%s\nDISCORD_SERVEUR=%s\nROLES_TESTEUR=%s\nROLES_ADMIN=%s\n' \
  "$DISCORD_ID" "$DISCORD_SECRET" "${DISCORD_SERVEUR:-}" "${ROLES_TESTEUR:-}" "${ROLES_ADMIN:-}" | sudo tee /etc/diablofus/discord.env >/dev/null
sudo chmod 600 /etc/diablofus/discord.env
cd /tmp && curl -fsSLO https://raw.githubusercontent.com/Mathiss29/dofus-diablo/main/serveur/installation/diablofus.service
sudo install -m 644 diablofus.service /etc/systemd/system/ && sudo systemctl daemon-reload
sudo systemctl restart diablofus && sleep 2 && curl -fsS http://127.0.0.1:3100/sante
```

`/sante` doit répondre `"connexion":true`. Le fichier appartient à root (600) : systemd le lit avant de lancer le service,
l'utilisateur `diablofus` ne peut pas le lire directement. Sans ce fichier, tout le reste marche et le bouton de connexion
du jeu dit simplement « connexion indisponible ».

## Plus tard

- Copie de la base aussi sur R2 (5B), avec une clé R2 limitée à un seul dossier.
- Désinstaller : `sudo systemctl disable --now diablofus diablofus-maj.timer cloudflared`, supprimer les fichiers posés ci-dessus (dont `/usr/local/lib/diablofus/`) et
  `sudo deluser --remove-home diablofus`.

## Changements déjà installés

- 2026-11-08 : `maj.sh` passe de `/home/diablofus/` à `/usr/local/lib/diablofus/` (remarque du projet Idlus) :

```bash
cd /tmp && for f in diablofus-maj.service maj.sh; do
  curl -fsSLO https://raw.githubusercontent.com/Mathiss29/dofus-diablo/main/serveur/installation/$f; done
sudo install -D -o root -g root -m 755 maj.sh /usr/local/lib/diablofus/maj.sh
sudo install -m 644 diablofus-maj.service /etc/systemd/system/ && sudo systemctl daemon-reload
sudo rm /home/diablofus/maj.sh && sudo systemctl start diablofus-maj.service && systemctl status diablofus-maj.service --no-pager | head -5
```

- 2026-11-08 : mémoire du service portée de 1 Go à 2 Go (marge pour faire tourner les parties sur le serveur ; `OOMScoreAdjust=500` inchangé, c'est toujours nous qui partons en premier) :

```bash
cd /tmp && curl -fsSLO https://raw.githubusercontent.com/Mathiss29/dofus-diablo/main/serveur/installation/diablofus.service
sudo install -m 644 diablofus.service /etc/systemd/system/ && sudo systemctl daemon-reload
sudo systemctl restart diablofus && systemctl show diablofus -p MemoryMax && curl -fsS http://127.0.0.1:3100/sante
```
