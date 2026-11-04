# trim_pack.py in_base out_base maxW : rogne chaque cellule à son contenu et range en étagères (atlas Phaser « trimmed »)
import sys, json
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
src, out, maxW = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src + '.png').convert('RGBA'); j = json.load(open(src + '.json'))
cw, ch = j['meta']['cell']; items = []
for k, f in j['frames'].items():
    r = f['frame']; c = im.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h'])); b = c.getbbox() or (0, 0, 1, 1)
    if b[1] == 0 and b[3] - b[1] > ch * 0.9: b = None  # frame parasite plein cadre
    items.append((k, c, b))
for i, (k, c, b) in enumerate(items):  # remplace une frame parasite par la précédente
    if b is None: pk, pc, pb = items[i - 1]; items[i] = (k, pc, pb)
order = sorted(range(len(items)), key=lambda i: -(items[i][2][3] - items[i][2][1]))
x = y = rowH = 0; pos = {}
for i in order:
    k, c, b = items[i]; w, h = b[2] - b[0] + 2, b[3] - b[1] + 2
    if x + w > maxW: x = 0; y += rowH; rowH = 0
    pos[i] = (x, y); x += w; rowH = max(rowH, h)
H = y + rowH; sheet = Image.new('RGBA', (maxW, H)); frames = {}
for i, (k, c, b) in enumerate(items):
    px, py = pos[i]; sheet.paste(c.crop(b), (px + 1, py + 1))
    w, h = b[2] - b[0], b[3] - b[1]
    frames[k] = {'frame': {'x': px + 1, 'y': py + 1, 'w': w, 'h': h}, 'rotated': False, 'trimmed': True,
                 'spriteSourceSize': {'x': b[0], 'y': b[1], 'w': w, 'h': h}, 'sourceSize': {'w': cw, 'h': ch}}
sheet.save(out + '.png'); sheet.save(out + '.webp', 'WEBP', quality=88, method=6)
json.dump({'frames': frames, 'meta': {'image': out.split('/')[-1] + '.webp', 'size': {'w': maxW, 'h': H}, 'scale': '1', 'cell': [cw, ch], 'origin': j['meta']['origin']}}, open(out + '.json', 'w'))
import os; print(sheet.size, os.path.getsize(out + '.webp'))
