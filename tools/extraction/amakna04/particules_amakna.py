"""Particules des cartes d'Amakna (« 0.4 suite : 7A + 13B », 2026-11-10) : arches des Zaaps, poussière, brume, pluie…

particules.py n'avait pas été lancé pour l'export d'Amakna. On le lance à part, puis ce script range ses systèmes dans le monde
d'Astrub (repère du continent) et fusionne les deux atlas d'images (une image par gfxId, la plus grande gardée).
  python3 tools/extraction/particules.py tools/extraction/amakna04/liste.json <map_*.json> <png des particules> <sortie>
  python3 tools/extraction/amakna04/particules_amakna.py <sortie> [liste.json, par défaut celle d'Amakna]
Repère : particules.py et world_export.py posent la carte (x, y) à (x - X0) * 1204 du bord de leur export, grille ox = -620, oy = -490.
"""
import json, os, sys
from PIL import Image
ICI = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(ICI, '..', '..', '..', 'public/assets/mondes/astrub')
src = sys.argv[1]
MW, MH, MC, MR = 1204, 860, 14, 40
M = json.load(open(f'{D}/monde.json')); g = M['grid']; X0c, Y0c = M['origin']; cols = g['cols']
L = json.load(open(sys.argv[2] if len(sys.argv) > 2 else f'{ICI}/liste.json')); xs = [tuple(map(int, k.split(','))) for k in L]
X0p, Y0p = min(x for x, _ in xs), min(y for _, y in xs); NX = max(x for x, _ in xs) - X0p + 1
DX, DY = g['ox'] + 620 + (X0p - X0c) * MW, g['oy'] + 490 + (Y0p - Y0c) * MH
amk = {m['tag'] for m in M['maps'] if m.get('essai') or m.get('v06')}   # cartes en essai (0.4) ou de la 0.6
P = json.load(open(f'{D}/particules.json')); N = json.load(open(f'{src}/particules.json'))
n = 0
for t, l in N.items():
    if t not in amk or t in P: continue
    for e in l:
        e['x'] = round(e['x'] + DX, 1); e['y'] = round(e['y'] + DY, 1)
        if e.get('c', -1) >= 0:
            r, k = divmod(e['c'], MC * NX); ry, rr = divmod(r, MR); kx, kk = divmod(k, MC)
            e['c'] = ((ry + Y0p - Y0c) * MR + rr) * cols + (kx + X0p - X0c) * MC + kk
    P[t] = l; n += len(l)
# atlas : toutes les images des deux, la plus grande d'un même gfxId
ims = {}
for d in (D, src):
    A = json.load(open(f'{d}/particules_atlas.json')); im = Image.open(f'{d}/particules.webp').convert('RGBA')
    for k, f in A['frames'].items():
        fr = f['frame']; c = im.crop((fr['x'], fr['y'], fr['x'] + fr['w'], fr['y'] + fr['h']))
        if k not in ims or c.width * c.height > ims[k].width * ims[k].height: ims[k] = c
maxW, pos, x, y, rowH = 1024, {}, 1, 1, 0
for k in sorted(ims, key=lambda k: -ims[k].height):
    w, h = ims[k].size
    if x + w + 1 > maxW: x, y, rowH = 1, y + rowH + 2, 0
    pos[k] = (x, y); x += w + 2; rowH = max(rowH, h)
atlas = Image.new('RGBA', (maxW, y + rowH + 2))
frames = {}
for k, (px, py) in pos.items():
    atlas.paste(ims[k], (px, py)); frames[k] = {'frame': {'x': px, 'y': py, 'w': ims[k].width, 'h': ims[k].height}}
atlas.save(f'{D}/particules.webp', 'WEBP', quality=90, method=6)
json.dump({'frames': frames, 'meta': {'image': 'particules.webp', 'size': {'w': atlas.width, 'h': atlas.height}}}, open(f'{D}/particules_atlas.json', 'w'))
json.dump(P, open(f'{D}/particules.json', 'w'), separators=(',', ':'))
print(n, 'systèmes ajoutés ;', len(frames), 'images, atlas', atlas.size)
