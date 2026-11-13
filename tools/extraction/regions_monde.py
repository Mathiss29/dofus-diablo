"""Monde chargé par régions (maquette 0.6, choix 3B, 2026-11-13).

Le décor des cartes faisait 97 % de monde.json (24 Mo sur 25 pour Astrub + Amakna) et tout se lisait au lancement.
Le décor de chaque région part dans son fichier `region_<clé>.json` ({tag: [décor]}) ; monde.json garde la grille, les cases
marchables et la liste des cartes (la partie n'a besoin que de ça). Le jeu ne lit au lancement que la région où l'on est,
les voisines arrivent en arrière-plan quand on approche de leur bord (render/worldView.ts).

    python3 regions_monde.py scinder public/assets/mondes/astrub src/data/zones.json
        Range le décor de chaque carte dans le fichier de sa région (région de sa sous-zone dans zones.json, Astrub sinon).
    python3 regions_monde.py joindre public/assets/mondes/astrub
        Remet le décor dans monde.json (et efface les fichiers de région) : à faire AVANT de lancer un outil qui lit le décor
        (batiments.py, fige.py, monde_continent.py fusion, carte_monde.py, survols.py, decor_par_carte.py…), puis rescinder.
"""
import json, os, re, sys, unicodedata


def lire(p): return json.load(open(p))


def ecrire(p, d): open(p, 'w').write(json.dumps(d, ensure_ascii=False, separators=(',', ':')))


def cle(nom):
    """« Île des Wabbits » -> « ile_des_wabbits »."""
    s = unicodedata.normalize('NFKD', nom).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '_', s).strip('_')


def scinder(dossier, zones_p):
    M = lire(f'{dossier}/monde.json')
    if all('decor' not in m for m in M['maps']): sys.exit('déjà scindé')
    Z = lire(zones_p); subs = {}
    for z in Z.values():
        for k, s in ((z.get('open') or {}).get('subareas') or {}).items():
            if s.get('region'): subs[int(k)] = s['region']
    R = {}
    for m in M['maps']:
        r = cle(subs.get(m['sub'], 'Astrub'))
        R.setdefault(r, {})[m['tag']] = m.pop('decor', [])
        m['r'] = r
    for f in os.listdir(dossier):
        if f.startswith('region_') and f.endswith('.json'): os.remove(f'{dossier}/{f}')
    for r, d in R.items():
        ecrire(f'{dossier}/region_{r}.json', d)
        print(r, len(d), 'cartes', os.path.getsize(f'{dossier}/region_{r}.json') // 1024, 'Ko')
    M['regions'] = sorted(R)
    ecrire(f'{dossier}/monde.json', M)
    print('monde.json', os.path.getsize(f'{dossier}/monde.json') // 1024, 'Ko')


def joindre(dossier):
    M = lire(f'{dossier}/monde.json')
    D = {}
    for r in M.pop('regions', []):
        D.update(lire(f'{dossier}/region_{r}.json')); os.remove(f'{dossier}/region_{r}.json')
    for m in M['maps']:
        m.pop('r', None)
        if 'decor' not in m: m['decor'] = D.get(m['tag'], [])
    ecrire(f'{dossier}/monde.json', M)


if __name__ == '__main__':
    if sys.argv[1] == 'scinder': scinder(sys.argv[2], sys.argv[3])
    elif sys.argv[1] == 'joindre': joindre(sys.argv[2])
