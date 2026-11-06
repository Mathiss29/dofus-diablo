# trim_pack.py in_base out_base maxW [maxH] : rogne chaque cellule à son contenu et range en étagères (atlas Phaser « trimmed », multiatlas si maxH)
import sys, json
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
src, out, maxW = sys.argv[1], sys.argv[2], int(sys.argv[3])
items = []
for one in src.split(','):   # plusieurs rendus bruts possibles (séparés par des virgules), même cellule
  im = Image.open(one + '.png').convert('RGBA'); j = json.load(open(one + '.json'))
  cw, ch = j['meta']['cell']
  for k, f in j['frames'].items():
    r = f['frame']; c = im.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h'])); b = c.getbbox() or (0, 0, 1, 1)
    if b[1] == 0 and b[3] - b[1] > ch * 0.9: b = None  # frame parasite plein cadre
    items.append((k, c, b))
for i, (k, c, b) in enumerate(items):  # remplace une frame parasite par la précédente
    if b is None: pk, pc, pb = items[i - 1]; items[i] = (k, pc, pb)
order = sorted(range(len(items)), key=lambda i: -(items[i][2][3] - items[i][2][1]))
# maxH (optionnel) : pages de maxW x maxH au plus -> JSON « multiatlas » Phaser (textures[]), images <out>.webp, <out>-1.webp...
maxH = int(sys.argv[4]) if len(sys.argv) > 4 else 0
x = y = rowH = 0; page = 0; pos = {}
for i in order:
    k, c, b = items[i]; w, h = b[2] - b[0] + 2, b[3] - b[1] + 2
    if x + w > maxW: x = 0; y += rowH; rowH = 0
    if maxH and y + h > maxH: x = 0; y = 0; rowH = 0; page += 1
    pos[i] = (page, x, y); x += w; rowH = max(rowH, h)
pages = []
for pg in range(page + 1):
    H = max(pos[i][2] + items[i][2][3] - items[i][2][1] + 2 for i in pos if pos[i][0] == pg)
    pages.append({'sheet': Image.new('RGBA', (maxW, H)), 'frames': {}})
for i, (k, c, b) in enumerate(items):
    pg, px, py = pos[i]; P = pages[pg]; P['sheet'].paste(c.crop(b), (px + 1, py + 1))
    w, h = b[2] - b[0], b[3] - b[1]
    P['frames'][k] = {'frame': {'x': px + 1, 'y': py + 1, 'w': w, 'h': h}, 'rotated': False, 'trimmed': True,
                      'spriteSourceSize': {'x': b[0], 'y': b[1], 'w': w, 'h': h}, 'sourceSize': {'w': cw, 'h': ch}}
import os
name = out.split('/')[-1]; meta = {'scale': '1', 'cell': [cw, ch], 'origin': j['meta']['origin']}
import hashlib, io
FMT = os.environ.get('FORMAT', 'WEBP').lower()
for pg, P in enumerate(pages):
    # FORMAT=AVIF pour les planches de monstres, PNJ et persos (choix « AVIF : 1A » du 6 nov. 2026), WebP pour le reste
    buf = io.BytesIO()
    if FMT == 'avif': P['sheet'].save(buf, 'AVIF', quality=int(os.environ.get('QUALITY', 50)), speed=6)
    else: P['sheet'].save(buf, 'WEBP', quality=int(os.environ.get('QUALITY', 88)), method=6)
    # multiatlas : nom avec l'empreinte du contenu, pour que le navigateur ne garde pas une ancienne page en cache
    tag = ('.' + hashlib.md5(buf.getvalue()).hexdigest()[:8]) if maxH else ''
    P['image'] = name + ('' if pg == 0 else f'-{pg}') + tag + '.' + FMT
    open(os.path.join(os.path.dirname(out), P['image']), 'wb').write(buf.getvalue())
if not maxH:
    P = pages[0]; P['sheet'].save(out + '.png')
    json.dump({'frames': P['frames'], 'meta': {'image': P['image'], 'size': {'w': maxW, 'h': P['sheet'].height}, **meta}}, open(out + '.json', 'w'))
else:
    json.dump({'textures': [{'image': P['image'], 'format': 'RGBA8888', 'size': {'w': maxW, 'h': P['sheet'].height}, 'scale': 1,
                             # meta recopié dans chaque page : Phaser ne garde que les clés des pages (texture.customData)
                             'meta': meta, 'frames': [{'filename': k, **f} for k, f in P['frames'].items()]} for P in pages], 'meta': meta}, open(out + '.json', 'w'))
print(len(pages), 'page(s)', [P['sheet'].size for P in pages])
