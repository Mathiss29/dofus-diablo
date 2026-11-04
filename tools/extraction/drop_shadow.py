# drop_shadow.py scene.json [tex.png] : repère les morceaux « ombre au sol » (noirs semi-transparents)
# et les vide, pour que le jeu dessine sa propre ombre (les 4 quarts d'ombre Dofus laissaient une croix).
import sys, json
from PIL import Image, ImageDraw
sc = json.load(open(sys.argv[1])); deftex = sys.argv[2] if len(sys.argv) > 2 else None
cache = {}; n = 0
for i, m in enumerate(sc['meshes']):
    p = m.get('tex') or deftex
    if not p or not m['t']: continue
    if p not in cache: cache[p] = Image.open(p).convert('RGBA')
    im = cache[p]; W, H = im.size
    mask = Image.new('L', im.size); d = ImageDraw.Draw(mask)
    for k in range(0, len(m['t']), 3):
        pts = [(m['v'][j][2] * W, (1 - m['v'][j][3]) * H) for j in m['t'][k:k + 3]]
        d.polygon(pts, fill=255)
    bb = mask.getbbox()
    if not bb: continue
    px = [q for q, mm in zip(im.crop(bb).getdata(), mask.crop(bb).getdata()) if mm and q[3] > 8]
    if len(px) < 30: continue
    a = sum(q[3] for q in px) / len(px); lum = sum(q[0] + q[1] + q[2] for q in px) / len(px) / 3
    if lum < 40 and a < 200:
        m['t'] = []; n += 1; print('ombre', i, round(a), round(lum), len(px))
json.dump(sc, open(sys.argv[1], 'w')); print('retirés', n)
