"""Ajoute les régions de la 0.7 à la carte du monde (carte.webp) sans redessiner tout le continent (comme sufokia061/carte061.py).

Usage : python3 carte061.py <public/assets/mondes/astrub>   (après regions_monde.py scinder ; carte.webp repris sur assets.diablofus.com)
Dessine les cartes de regions07/liste.json comme carte_monde.py (sol puis décor, à l'échelle 0,1 réduite à celle de carte.webp),
agrandit l'image si les îles dépassent son bord, met à jour monde.json['carte'], puis relancer plan_carte.py et envoi.mjs.
"""
import json, os, sys
from PIL import Image
D = sys.argv[1].rstrip('/'); ICI = os.path.dirname(os.path.abspath(__file__))
monde = json.load(open(f'{D}/monde.json')); C = monde['carte']; K = C['k']; K2 = 0.1
tags = {k.replace(',', '_') for k in json.load(open(f'{ICI}/liste.json'))}
decors = {}
for r in {m.get('r') for m in monde['maps'] if m['tag'] in tags}: decors.update(json.load(open(f'{D}/region_{r}.json')))
maps = [m for m in monde['maps'] if m['tag'] in tags]
ancienne = Image.open(f'{D}/carte.webp').convert('RGBA')
x0 = min([C['x']] + [m['sol']['x'] for m in maps]); y0 = min([C['y']] + [m['sol']['y'] for m in maps])
x1 = max([C['x'] + ancienne.width / K] + [m['sol']['x'] + m['sol']['w'] for m in maps])
y1 = max([C['y'] + ancienne.height / K] + [m['sol']['y'] + m['sol']['h'] for m in maps])
W, H = max(ancienne.width, int((x1 - x0) * K)), max(ancienne.height, int((y1 - y0) * K))
carte = Image.new('RGBA', (W, H), (0, 0, 0, 0)); carte.paste(ancienne, (round((C['x'] - x0) * K), round((C['y'] - y0) * K)))
# la baie seule, à 0,1
bx0 = min(m['sol']['x'] for m in maps); by0 = min(m['sol']['y'] for m in maps)
bx1 = max(m['sol']['x'] + m['sol']['w'] for m in maps); by1 = max(m['sol']['y'] + m['sol']['h'] for m in maps)
baie = Image.new('RGBA', (int((bx1 - bx0) * K2) + 1, int((by1 - by0) * K2) + 1), (0, 0, 0, 0))
def pose(im, x, y): baie.alpha_composite(im, (max(0, int((x - bx0) * K2)), max(0, int((y - by0) * K2)))) if x >= bx0 and y >= by0 else baie.paste(im, (int((x - bx0) * K2), int((y - by0) * K2)), im)
for m in sorted(maps, key=lambda m: (m['y'], m['x'])):
    s = m['sol']; p = f"{D}/sol_{m['tag']}.webp"
    if os.path.exists(p):
        w = int((s['x'] + s['w'] - bx0) * K2) - int((s['x'] - bx0) * K2) + 1; h = int((s['y'] + s['h'] - by0) * K2) - int((s['y'] - by0) * K2) + 1
        pose(Image.open(p).convert('RGBA').resize((w, h), Image.BILINEAR), s['x'], s['y'])
decor = [(0 if d['c'] < 0 else 1, d['y'], d.get('o', 0), m, d) for m in maps for d in decors.get(m['tag'], []) if not (d.get('b') or d.get('h'))]
cle = lambda m, d: f"decor_p{d['p']}" if 'p' in d else f"decor_{m['tag']}"
par_page = {}
for i, (_, _, _, m, d) in enumerate(decor): par_page.setdefault(cle(m, d), []).append(i)
petits = {}
for page, idx in par_page.items():
    if not os.path.exists(f'{D}/{page}.json') or not os.path.exists(f'{D}/{page}.webp'): print('page absente', page); continue
    img = Image.open(f'{D}/{page}.webp').convert('RGBA'); frames = json.load(open(f'{D}/{page}.json'))['frames']
    for i in idx:
        d = decor[i][4]
        if d['f'] not in frames: continue
        f = frames[d['f']]; fr, ss, src = f['frame'], f['spriteSourceSize'], f['sourceSize']; z = d.get('z', 1)
        w, h = int(fr['w'] * z * K2), int(fr['h'] * z * K2)
        if w < 1 or h < 1: continue
        crop = img.crop((fr['x'], fr['y'], fr['x'] + fr['w'], fr['y'] + fr['h'])).resize((w, h), Image.BILINEAR)
        petits[i] = (crop, d['x'] - src['w'] * z / 2 + ss['x'] * z, d['y'] - src['h'] * z / 2 + ss['y'] * z)
for i in sorted(petits, key=lambda i: decor[i][:3]): pose(*petits[i])
baie = baie.resize((max(1, round(baie.width * K / K2)), max(1, round(baie.height * K / K2))), Image.LANCZOS)
carte.alpha_composite(baie, (round((bx0 - x0) * K), round((by0 - y0) * K)))
carte.save(f'{D}/carte.webp', 'WEBP', quality=80, method=6)
monde['carte'] = {'x': x0, 'y': y0, 'k': K}
open(f'{D}/monde.json', 'w').write(json.dumps(monde, ensure_ascii=False, separators=(',', ':')))
print('carte', W, 'x', H, '(avant', ancienne.size, ')', len(maps), 'cartes de la 0.7')
