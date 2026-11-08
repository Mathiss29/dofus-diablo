"""Particules officielles du Zaap sur l'arche du Bastion des Douze (Mathis, 2026-11-08 : « pas d'effet » sur ce Zaap).

Le Bastion recopie le dessin de l'arche du Zaap d'Astrub ([5,-18]) mais ses particules viennent de Brâkmar : on y ajoute le
tourbillon « Vortex » et les éclats du Zaap d'Astrub, décalés sur l'arche du Bastion, et l'image 4047 (Vortex) dans son atlas.
À relancer après bastion.py (qui réécrit particules.json et l'atlas), puis node tools/hebergement/envoi.mjs.

Usage : python zaap_bastion.py <particules.webp d'Astrub> <particules.webp du Bastion> [<x> <y>]
  x y = milieu de l'arche du Bastion en pixels de sa grande carte (défaut : la case zones.json bastion.open.bastion.zaap).
"""
import sys, os, json
from PIL import Image
ICI = os.path.dirname(os.path.abspath(__file__))
M = os.path.join(ICI, '../../public/assets/mondes')
IMG_A, IMG_B = sys.argv[1:3]
X, Y = (float(sys.argv[3]), float(sys.argv[4])) if len(sys.argv) > 4 else (2992.0, 2004.0)
PA = json.load(open(f'{M}/astrub/particules.json'))['5_-18']
v = next(d for d in PA if d['n'] == 'Vortex')
# les systèmes du Zaap : le tourbillon et ce qui tourne autour (à moins de 120 px), pas les rayons ni les étoiles de la place
zaap = [d for d in PA if abs(d['x'] - v['x']) < 120 and abs(d['y'] - v['y']) < 120]
dx, dy = X - v['x'], Y - v['y']
PB_f = f'{M}/bastion/particules.json'; PB = json.load(open(PB_f))
l = [d for d in PB['bastion'] if not d.get('zaap')]
for d in zaap: l.append({**d, 'x': round(d['x'] + dx, 1), 'y': round(d['y'] + dy, 1), 'zaap': 1})
PB['bastion'] = l
json.dump(PB, open(PB_f, 'w'))
# atlas : les images du Zaap qui manquent au Bastion, sous l'atlas existant
AA = json.load(open(f'{M}/astrub/particules_atlas.json')); AB_f = f'{M}/bastion/particules_atlas.json'; AB = json.load(open(AB_f))
ia, ib = Image.open(IMG_A).convert('RGBA'), Image.open(IMG_B).convert('RGBA')
manque = sorted({str(d['tx']) for d in zaap} - set(AB['frames']))
y0, x0, h = ib.height + 2, 0, 0
plus = []
for t in manque:
    f = AA['frames'][t]['frame']; plus.append((t, f, x0)); x0 += f['w'] + 2; h = max(h, f['h'])
if plus:
    out = Image.new('RGBA', (ib.width, y0 + h), (0, 0, 0, 0)); out.paste(ib, (0, 0))
    for t, f, x in plus:
        out.paste(ia.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h'])), (x, y0))
        AB['frames'][t] = {'frame': {'x': x, 'y': y0, 'w': f['w'], 'h': f['h']}}
    AB['meta']['size'] = {'w': out.width, 'h': out.height}
    out.save(f'{M}/bastion/particules.webp', 'WEBP', lossless=True)
    json.dump(AB, open(AB_f, 'w'))
print(len(zaap), 'systèmes du Zaap ajoutés ; images ajoutées :', manque)
