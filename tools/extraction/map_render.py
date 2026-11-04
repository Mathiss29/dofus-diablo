# map_render.py map.json out.png [bundles...] : reconstitue une carte Dofus 3 (sol + décor) en une image
import sys, json, glob, warnings
warnings.filterwarnings('ignore')
import UnityPy
from PIL import Image
UnityPy.config.FALLBACK_UNITY_VERSION = "6000.3.16f1"
mp, out = sys.argv[1], sys.argv[2]
bundles = sys.argv[3:] or glob.glob('/mnt/user-data/uploads/Content/Map/Textures/1x/mapgfx_*.bundle')
t = json.load(open(mp)); md = t['mapData']
need = set(e['gfxId'] for k in ['backgroundElements', 'sortableElements', 'foregroundElements'] for e in md[k])
imgs = {}
for b in bundles:
    env = UnityPy.load(b)
    for o in env.objects:
        if o.type.name != 'Texture2D': continue
        name = o.peek_name() if hasattr(o, 'peek_name') else None
        if name is not None and (not name.isdigit() or int(name) not in need): continue
        d = o.read()
        if d.m_Name.isdigit() and int(d.m_Name) in need: imgs[int(d.m_Name)] = d.image.convert('RGBA')
print('textures', len(imgs), '/', len(need), file=sys.stderr)
def col(v):
    a = (v >> 24) & 255; r = (v >> 16) & 255; g = (v >> 8) & 255; b = v & 255
    return r, g, b, a
els = [('bg', e) for e in md['backgroundElements']]
els += [('so', e) for e in sorted(md['sortableElements'], key=lambda e: (e['cellId'], e['innerCellRenderOrder']))]
els += [('fg', e) for e in md['foregroundElements']]
# boîte englobante
pts = []
for kind, e in els:
    im = imgs.get(e['gfxId']); tr = e['transform']
    if im is None: continue
    w, h = im.size
    for cx, cy in [(-w/2, -h/2), (w/2, -h/2), (-w/2, h/2), (w/2, h/2)]:
        X = cx * tr['m11'] + cy * tr['m21'] + tr['m31']; Y = cx * tr['m12'] + cy * tr['m22'] + tr['m32']
        pts.append((X, -Y))
x0 = min(p[0] for p in pts); y0 = min(p[1] for p in pts); x1 = max(p[0] for p in pts); y1 = max(p[1] for p in pts)
print('bbox', x0, y0, x1, y1, file=sys.stderr)
W, H = int(x1 - x0) + 2, int(y1 - y0) + 2
canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
from PIL import ImageChops
MODE = sys.argv and __import__('os').environ.get('COLOR', 'mul')
for kind, e in els:
    im = imgs.get(e['gfxId']); tr = e['transform']
    if im is None: continue
    if kind == 'fg' and __import__('os').environ.get('NOFG'): continue
    sx, sy = tr['m11'], tr['m22']
    if abs(tr['m12']) > 1e-3 or abs(tr['m21']) > 1e-3:
        # rotation / cisaillement : transformation affine complète
        import numpy as np
    w, h = im.size
    img = im
    if sx < 0: img = img.transpose(Image.FLIP_LEFT_RIGHT)
    if sy < 0: img = img.transpose(Image.FLIP_TOP_BOTTOM)
    nw, nh = max(1, round(w * abs(sx))), max(1, round(h * abs(sy)))
    if (nw, nh) != (w, h): img = img.resize((nw, nh), Image.BILINEAR)
    r, g, b, a = col(e['color']['value'])
    if MODE == 'mul' and (r, g, b, a) != (255, 255, 255, 255):
        # couleur : multiplication, 0x80 = neutre
        ch = img.split(); f = [r / 128, g / 128, b / 128]
        ch = [c.point(lambda v, k=k: min(255, int(v * k))) for c, k in zip(ch[:3], f)] + [ch[3].point(lambda v: v * a // 255)]
        img = Image.merge('RGBA', ch)
    cx, cy = tr['m31'] - x0, -tr['m32'] - y0
    canvas.alpha_composite(img, (round(cx - nw / 2), round(cy - nh / 2)))
canvas.save(out); print('size', W, H, file=sys.stderr)
