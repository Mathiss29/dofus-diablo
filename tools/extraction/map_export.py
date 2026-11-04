# map_export.py map.json outdir : exporte une carte Dofus 3 pour le jeu
#  - sol.webp : tous les éléments de fond fusionnés en une image
#  - decor.webp + decor.json : atlas Phaser des éléments triables (arbres, maisons...) + placements
#  - carte.json : grille 14x40 (cases marchables), placements du décor, repères
import sys, json, glob, os, warnings
warnings.filterwarnings('ignore')
import UnityPy
from PIL import Image
UnityPy.config.FALLBACK_UNITY_VERSION = "6000.3.16f1"
mp, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
W, H, OX, OY = 86, 43, -620, -490          # grille Dofus (unités de la carte), origine calée sur les cases bloquantes
t = json.load(open(mp)); md = t['mapData']
need = set(e['gfxId'] for k in ['backgroundElements', 'sortableElements'] for e in md[k])
imgs = {}
for b in glob.glob('/mnt/user-data/uploads/Content/Map/Textures/1x/mapgfx_*.bundle'):
    for o in UnityPy.load(b).objects:
        if o.type.name != 'Texture2D': continue
        d = o.read()
        if d.m_Name.isdigit() and int(d.m_Name) in need: imgs[int(d.m_Name)] = d.image.convert('RGBA')
def styled(e):
    im = imgs.get(e['gfxId']); tr = e['transform']
    if im is None: return None
    sx, sy = tr['m11'], tr['m22']
    if sx < 0: im = im.transpose(Image.FLIP_LEFT_RIGHT)
    if sy < 0: im = im.transpose(Image.FLIP_TOP_BOTTOM)
    w, h = im.size; nw, nh = max(1, round(w * abs(sx))), max(1, round(h * abs(sy)))
    if (nw, nh) != (w, h): im = im.resize((nw, nh), Image.BILINEAR)
    v = e['color']['value']; a, r, g, b = (v >> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255
    if (r, g, b, a) != (255, 255, 255, 255):
        ch = im.split(); f = [r / 128, g / 128, b / 128]
        ch = [c.point(lambda q, k=k: min(255, int(q * k))) for c, k in zip(ch[:3], f)] + [ch[3].point(lambda q: q * a // 255)]
        im = Image.merge('RGBA', ch)
    return im
# --- sol
bg = [(styled(e), e['transform']) for e in md['backgroundElements']]
bg = [(im, tr) for im, tr in bg if im is not None]
x0 = min(tr['m31'] - im.width / 2 for im, tr in bg); y0 = min(-tr['m32'] - im.height / 2 for im, tr in bg)
x1 = max(tr['m31'] + im.width / 2 for im, tr in bg); y1 = max(-tr['m32'] + im.height / 2 for im, tr in bg)
sol = Image.new('RGBA', (int(x1 - x0) + 2, int(y1 - y0) + 2))
for im, tr in bg: sol.alpha_composite(im, (round(tr['m31'] - x0 - im.width / 2), round(-tr['m32'] - y0 - im.height / 2)))
bb = sol.getbbox(); sol = sol.crop(bb); solX, solY = x0 + bb[0], y0 + bb[1]
sol.save(out + '/sol.webp', 'WEBP', quality=82, method=6)
# --- décor triable : une image par (gfx, couleur, échelle)
variants = {}; places = []
for e in md['sortableElements']:
    tr = e['transform']; key = (e['gfxId'], e['color']['value'], round(tr['m11'], 3), round(tr['m22'], 3))
    if key not in variants:
        im = styled(e)
        if im is None: continue
        variants[key] = ('d%d' % len(variants), im)
    name, im = variants[key]
    places.append({'f': name, 'x': round(tr['m31'], 1), 'y': round(-tr['m32'], 1), 'c': e['cellId'], 'o': e['innerCellRenderOrder']})
items = sorted(variants.values(), key=lambda v: -v[1].height)
maxW = 2048; x = y = rowH = 0; pos = {}
for name, im in items:
    b = im.getbbox() or (0, 0, 1, 1); w, h = b[2] - b[0] + 2, b[3] - b[1] + 2
    if x + w > maxW: x = 0; y += rowH; rowH = 0
    pos[name] = (x, y, b); x += w; rowH = max(rowH, h)
atlas = Image.new('RGBA', (maxW, y + rowH)); frames = {}
for name, im in items:
    px, py, b = pos[name]; atlas.paste(im.crop(b), (px + 1, py + 1)); w, h = b[2] - b[0], b[3] - b[1]
    frames[name] = {'frame': {'x': px + 1, 'y': py + 1, 'w': w, 'h': h}, 'rotated': False, 'trimmed': True,
                    'spriteSourceSize': {'x': b[0], 'y': b[1], 'w': w, 'h': h}, 'sourceSize': {'w': im.width, 'h': im.height}}
atlas.save(out + '/decor.webp', 'WEBP', quality=85, method=6)
json.dump({'frames': frames, 'meta': {'image': 'decor.webp', 'size': {'w': maxW, 'h': atlas.height}, 'scale': '1'}}, open(out + '/decor.json', 'w'))
carte = {'id': int(t['m_Name'].split('_')[1]), 'grid': {'w': W, 'h': H, 'ox': OX, 'oy': OY},
         'mov': ''.join('1' if c['mov'] else '0' for c in md['cellsData']),
         'sol': {'x': round(solX, 1), 'y': round(solY, 1), 'w': sol.width, 'h': sol.height}, 'decor': places}
json.dump(carte, open(out + '/carte.json', 'w'))
print('sol', sol.size, os.path.getsize(out + '/sol.webp'), 'decor', atlas.size, len(variants), os.path.getsize(out + '/decor.webp'), 'places', len(places))
