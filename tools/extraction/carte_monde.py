"""Carte du monde (touche M, choix 18A de la maquette 0.2) : une image réduite d'un monde exporté par world_export.py.

Usage : python carte_monde.py <public/assets/mondes/<monde>> [échelle, 0.1 par défaut]
Pose chaque sol puis le décor (lumières de sol d'abord, puis du haut vers le bas, comme en jeu), à l'échelle donnée,
et écrit carte.webp ainsi que monde.json['carte'] = {x, y, k} (coin haut-gauche en coordonnées des cartes, échelle).
"""
import sys, os, json
from PIL import Image

D = sys.argv[1]; K = float(sys.argv[2]) if len(sys.argv) > 2 else 0.1
monde = json.load(open(f'{D}/monde.json'))
import re
maps = [m for m in monde['maps'] if not m.get('inside') and re.fullmatch(r'-?\d+_-?\d+', m['tag'])]   # ni intérieurs ni mines
x0 = min(m['sol']['x'] for m in maps); y0 = min(m['sol']['y'] for m in maps)
x1 = max(m['sol']['x'] + m['sol']['w'] for m in maps); y1 = max(m['sol']['y'] + m['sol']['h'] for m in maps)
W, H = int((x1 - x0) * K) + 1, int((y1 - y0) * K) + 1
carte = Image.new('RGBA', (W, H), (0, 0, 0, 0))

from collections import OrderedDict
_atlas = OrderedDict()   # pages de décor gardées en mémoire : les 12 dernières (Astrub + Amakna = ~2 000 pages de 16 Mo)
def atlas(name):
    if name not in _atlas:
        p = f'{D}/{name}.json'
        _atlas[name] = (Image.open(f'{D}/{name}.webp').convert('RGBA'), json.load(open(p))['frames']) if os.path.exists(p) else None
        while len(_atlas) > 12: _atlas.popitem(last=False)
    _atlas.move_to_end(name)
    return _atlas[name]

def pose(im, x, y):
    """Colle im (déjà réduite) avec son coin haut-gauche en (x, y) coordonnées des cartes."""
    carte.alpha_composite(im, (int((x - x0) * K), int((y - y0) * K))) if x >= x0 and y >= y0 else carte.paste(im, (int((x - x0) * K), int((y - y0) * K)), im)

for m in sorted(maps, key=lambda m: (m['y'], m['x'])):
    s = m['sol']
    p = f"{D}/sol_{m['tag']}.webp"
    if os.path.exists(p):
        im = Image.open(p).convert('RGBA')
        w = int((s['x'] + s['w'] - x0) * K) - int((s['x'] - x0) * K) + 1; h = int((s['y'] + s['h'] - y0) * K) - int((s['y'] - y0) * K) + 1   # +1 : pas de joint
        pose(im.resize((w, h), Image.BILINEAR), s['x'], s['y'])

decor = []
for m in maps:
    for d in m['decor']:
        if d.get('b') or d.get('h'): continue   # lumières additives, débords (vus seulement depuis leur carte) : pas sur la carte
        decor.append((0 if d['c'] < 0 else 1, d['y'], d.get('o', 0), m, d))
for _, _, _, m, d in sorted(decor, key=lambda t: t[:3]):
    a = atlas(f"decor_p{d['p']}" if 'p' in d else f"decor_{m['tag']}")
    if not a or d['f'] not in a[1]: continue
    img, frames = a; f = frames[d['f']]; fr, ss, src = f['frame'], f['spriteSourceSize'], f['sourceSize']
    z = d.get('z', 1) * K
    w, h = int(fr['w'] * z), int(fr['h'] * z)
    if w < 1 or h < 1: continue
    crop = img.crop((fr['x'], fr['y'], fr['x'] + fr['w'], fr['y'] + fr['h'])).resize((w, h), Image.BILINEAR)
    # (x, y) = centre de l'image entière (origine 0,5 en jeu) ; le cadre rogné commence à spriteSourceSize
    left = d['x'] - src['w'] * d.get('z', 1) / 2 + ss['x'] * d.get('z', 1)
    top = d['y'] - src['h'] * d.get('z', 1) / 2 + ss['y'] * d.get('z', 1)
    pose(crop, left, top)

carte.save(f'{D}/carte.webp', 'WEBP', quality=80, method=6)
monde['carte'] = {'x': x0, 'y': y0, 'k': K}
json.dump(monde, open(f'{D}/monde.json', 'w'))
print('carte', W, 'x', H, os.path.getsize(f'{D}/carte.webp') // 1024, 'Ko')
