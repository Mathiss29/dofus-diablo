"""Décor rangé par carte (chasse aux bugs 0.2a, 6 nov. 2026).

Avec PARTAGE=1, world_export.py range chaque image du décor une seule fois dans des pages communes, dans l'ordre
des cartes (ligne par ligne). À Astrub, une carte touchait ainsi ~29 pages de 2048 px, et la carte du joueur
avec ses 8 voisines ~81 pages : 1,1 Go en mémoire graphique (jusqu'à 2,3 Go) pour ~84 Mo d'images réellement
posées. Le navigateur finissait par planter.

Ce script reprend les pages d'un monde déjà exporté et donne à chaque carte SES pages, avec seulement les images
qu'elle pose (une image commune à deux cartes est copiée dans les deux). Mémoire autour du joueur : ~115 Mo en
moyenne. Les nouvelles pages prennent des numéros neufs (les anciens fichiers restent valables pour la version
du jeu en ligne jusqu'au déploiement).

À LANCER après world_export.py PARTAGE=1 (avec bords_fondu.py et decor_doublons.py), puis tools/hebergement/envoi.mjs.
    python3 tools/extraction/decor_par_carte.py public/assets/mondes/astrub
"""
import json, os, sys
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

out = sys.argv[1]
monde_path = f'{out}/monde.json'
monde = json.load(open(monde_path))
cartes = [m for m in monde['maps'] if m.get('pages')]
anciennes = sorted({p for m in cartes for p in m['pages']})
debut = max(anciennes) + 1
print(len(cartes), 'cartes,', len(anciennes), 'pages communes ; nouvelles pages à partir de', debut)

frames_de = {}   # page -> frames du json
for p in anciennes: frames_de[p] = json.load(open(f'{out}/decor_p{p}.json'))['frames']

cache: 'OrderedDict[int, Image.Image]' = OrderedDict()
def page(p):
    if p in cache: cache.move_to_end(p); return cache[p]
    im = Image.open(f'{out}/decor_p{p}.webp').convert('RGBA'); im.load()
    cache[p] = im
    while len(cache) > 48: cache.popitem(last=False)
    return im

POOL = ThreadPoolExecutor(4); EN_COURS = []
def ecrire(atlas, frames, n):
    def f():
        atlas.save(f'{out}/decor_p{n}.webp', 'WEBP', quality=82, method=6)
        json.dump({'frames': frames, 'meta': {'image': f'decor_p{n}.webp', 'size': {'w': atlas.width, 'h': atlas.height}, 'scale': '1'}},
                  open(f'{out}/decor_p{n}.json', 'w'))
    EN_COURS.append(POOL.submit(f))
    while len(EN_COURS) > 8: EN_COURS.pop(0).result()

PW, PH = 2048, 2048
suivante = debut
# ordre des cartes = ordre des pages communes : les pages lues se suivent (cache)
for m in sorted(cartes, key=lambda m: min(m['pages'])):
    noms = sorted({(d['p'], d['f']) for d in m['decor']}, key=lambda t: -frames_de[t[0]][t[1]]['frame']['h'])
    # étagères de 2048 px, nouvelle page quand la hauteur dépasse 2048
    pos = {}; pg = 0; px = py = rowH = 0
    for p, f in noms:
        fr = frames_de[p][f]['frame']; w, h = fr['w'] + 2, fr['h'] + 2
        if px + w > PW: px = 0; py += rowH; rowH = 0
        if py + h > PH: pg += 1; px = py = rowH = 0
        pos[f] = (pg, px, py, p); px += w; rowH = max(rowH, h)
    num = {}
    for g in range(pg + 1):
        items = [(f, v) for f, v in pos.items() if v[0] == g]
        hgt = max(v[2] + frames_de[v[3]][f]['frame']['h'] + 2 for f, v in items)
        atlas = Image.new('RGBA', (PW, hgt)); frames = {}
        for f, (_, ax, ay, p) in items:
            src = frames_de[p][f]; fr = src['frame']
            atlas.paste(page(p).crop((fr['x'], fr['y'], fr['x'] + fr['w'], fr['y'] + fr['h'])), (ax + 1, ay + 1))
            frames[f] = {**src, 'frame': {'x': ax + 1, 'y': ay + 1, 'w': fr['w'], 'h': fr['h']}}
        num[g] = suivante; ecrire(atlas, frames, suivante); suivante += 1
    for d in m['decor']: d['p'] = num[pos[d['f']][0]]
    m['pages'] = sorted(set(num.values()))
for e in EN_COURS: e.result()
POOL.shutdown()

json.dump(monde, open(monde_path, 'w'))
for p in anciennes:
    for ext in ('webp', 'json'):
        if os.path.exists(f'{out}/decor_p{p}.{ext}'): os.remove(f'{out}/decor_p{p}.{ext}')
pp = [len(m['pages']) for m in cartes]
print(suivante - debut, 'pages par carte ; moyenne', round(sum(pp) / len(pp), 2), 'page(s) par carte, max', max(pp))
