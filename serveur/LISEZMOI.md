# Serveur multijoueur de Diablofus

Serveur Node 22 (maquette « Multi : », 2026-11-08) : coop à 2-4 joueurs, Bastion des Douze partagé, comptes Discord et
sauvegardes en ligne. Pour l'instant : `/sante` et un WebSocket d'essai sur `/ws` (ping).

Il tourne sur le VPS OVH d'Idlus (VPS-3, Ubuntu 24.04), **sans toucher à Idlus** :

- utilisateur Linux `diablofus` sans mot de passe, sans sudo général, **jamais dans le groupe docker** ;
- tout dans `/home/diablofus` : `node/` (Node 22 officiel), `app/` (ce dossier), `donnees/` (base, sauvegardes) ;
- écoute sur `127.0.0.1:3100` seulement ; le monde y arrive par un **tunnel Cloudflare** (`api.diablofus.com`), donc ni le
  Caddy d'Idlus (conteneur Supabase) ni le pare-feu ne changent ;
- service systemd limité à 1 cœur et 1 Go, `OOMScoreAdjust=500` (c'est lui qui part en premier si la mémoire manque) ;
- mise à jour par le workflow GitHub `Serveur` (`.github/workflows/serveur.yml`) : rsync dans `~/app`, puis redémarrage de
  ce seul service (sudoers limité à `systemctl restart diablofus` et `systemctl is-active diablofus`).

## Installation (une fois, par Mathis en SSH, après relecture par le projet Idlus)

Chaque bloc se colle tel quel. Aucun ne touche à Docker, à Caddy, à ufw ni à `/opt/idlus`.

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

### 3. Service, limites et droit de redémarrage

Les trois fichiers sont dans `serveur/installation/` du dépôt (relus avant de les poser) :

```bash
cd /tmp && curl -fsSLO https://raw.githubusercontent.com/Mathiss29/dofus-diablo/main/serveur/installation/diablofus.service \
  && curl -fsSLO https://raw.githubusercontent.com/Mathiss29/dofus-diablo/main/serveur/installation/sudoers-diablofus
cat diablofus.service sudoers-diablofus          # relire
sudo install -m 644 diablofus.service /etc/systemd/system/diablofus.service
sudo visudo -cf sudoers-diablofus && sudo install -m 440 sudoers-diablofus /etc/sudoers.d/diablofus
sudo systemctl daemon-reload && sudo systemctl enable diablofus
```

Le service ne démarre qu'au premier déploiement (il n'y a pas encore de code dans `~/app`). `enable` = il repart seul
après un redémarrage de la machine.

### 4. Clé de déploiement pour GitHub

```bash
sudo -u diablofus -H bash -c '
  set -e; mkdir -p ~/.ssh && chmod 700 ~/.ssh
  ssh-keygen -t ed25519 -N "" -C deploiement-github -f ~/.ssh/deploiement -q
  (printf "restrict "; cat ~/.ssh/deploiement.pub) >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
  cat ~/.ssh/deploiement'
cat /etc/ssh/ssh_host_ed25519_key.pub | cut -d" " -f1,2
```

Dans GitHub, dépôt `dofus-diablo` › Settings › Secrets and variables › Actions › New repository secret :

| Secret | Valeur |
|---|---|
| `VPS_HOTE` | `159.173.129.109` |
| `VPS_CLE` | tout le bloc `-----BEGIN OPENSSH PRIVATE KEY----- … END …-----` affiché par la 1re commande |
| `VPS_EMPREINTE` | la ligne `ssh-ed25519 AAAA…` affichée par la 2e commande |

Puis effacer la clé privée du VPS (elle n'est plus utile qu'à GitHub) :

```bash
sudo -u diablofus rm /home/diablofus/.ssh/deploiement /home/diablofus/.ssh/deploiement.pub
```

`restrict` : cette clé ne peut ni ouvrir de terminal ni faire de tunnel, seulement lancer des commandes en tant que
`diablofus`.

### 5. Tunnel Cloudflare (api.diablofus.com)

Installer `cloudflared` depuis le dépôt officiel de Cloudflare :

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install -y cloudflared
```

Dans le tableau de bord Cloudflare : Zero Trust › Networks › Tunnels › Create a tunnel › Cloudflared, nom `diablofus`.
Cloudflare affiche une commande `sudo cloudflared service install <jeton>` : la lancer sur le VPS (le jeton ne se partage
pas). Puis, dans le tunnel, onglet Public Hostname : sous-domaine `api`, domaine `diablofus.com`, service `HTTP`,
URL `localhost:3100`.

Limites du tunnel (même logique que le service) :

```bash
cd /tmp && curl -fsSLO https://raw.githubusercontent.com/Mathiss29/dofus-diablo/main/serveur/installation/cloudflared-limites.conf
sudo install -D -m 644 cloudflared-limites.conf /etc/systemd/system/cloudflared.service.d/limites.conf
sudo systemctl daemon-reload && sudo systemctl restart cloudflared
```

### 6. Premier déploiement

GitHub › Actions › Serveur › Run workflow. À la fin, `https://api.diablofus.com/sante` répond `{"ok":true,…}`.

## Plus tard

- Sauvegarde de la base SQLite à **4 h 30** (celle d'Idlus est à 4 h), avec les comptes.
- Désinstaller : `sudo systemctl disable --now diablofus cloudflared`, supprimer les fichiers posés ci-dessus et
  `sudo deluser --remove-home diablofus`.
