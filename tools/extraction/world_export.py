# world_export.py liste.json cartes_dir textures_dir outdir : exporte plusieurs cartes Dofus 3 voisines en un « monde » continu.
#  liste.json = {"x,y": [mapId, sousZone], ...} (coordonnées Dofus de chaque carte)
#  cartes_dir = dossier des map_{id}.json (MonoBehaviour des bundles mapdata_assets_world_N)
#  textures_dir = dossier des bundles mapgfx_1x_*_assets_all.bundle
# Sortie : monde.json, un sol_x_y.webp par carte, et le décor de tout le monde dans decor.json + decor_N.webp (multiatlas).
# Les cartes Dofus se raccordent bord à bord : la carte [x+1,y] commence 14 cases (1204 px) plus à droite,
# la carte [x,y+1] 40 demi-lignes (860 px) plus bas. La grille du monde est donc une grande grille 14·nx × 40·ny.
import sys, json, glob, os, warnings
warnings.filterwarnings('ignore')
import UnityPy
from PIL import Image
UnityPy.config.FALLBACK_UNITY_VERSION = "6000.3.16f1"
liste, cdir, tdir, out = sys.argv[1:5]; os.makedirs(out, exist_ok=True)
W, H, OX, OY, COLS, ROWS = 86, 43, -620, -490, 14, 40
MW, MH = COLS * W, ROWS * H // 2
sel = {tuple(map(int, k.split(','))): v for k, v in json.load(open(liste)).items()}
maps = {xy: json.load(open(f'{cdir}/map_{v[0]}.json'))['mapData'] for xy, v in sel.items()}
need = set(e['gfxId'] for md in maps.values() for k in ['backgroundElements', 'sortableElements'] for e in md[k])
imgs = {}
for b in glob.glob(f'{tdir}/mapgfx_*.bundle'):
    for o in UnityPy.load(b).objects:
        if o.type.name != 'Texture2D': continue
        d = o.read()
        if d.m_Name.isdigit() and int(d.m_Name) in need: imgs[int(d.m_Name)] = d.image.convert('RGBA')
print('textures', len(imgs), '/', len(need))
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
X0, Y0 = min(x for x, _ in sel), min(y for _, y in sel)
nx, ny = max(x for x, _ in sel) - X0 + 1, max(y for _, y in sel) - Y0 + 1
mov = ['0'] * (COLS * nx * ROWS * ny)
monde = {'grid': {'w': W, 'h': H, 'ox': OX, 'oy': OY, 'cols': COLS * nx, 'rows': ROWS * ny}, 'origin': [X0, Y0], 'maps': []}
variants = {}   # décor partagé entre les cartes : une image par (gfx, couleur, échelle) pour tout le monde
def variant(e):
    tr = e['transform']; key = (e['gfxId'], e['color']['value'], round(tr['m11'], 3), round(tr['m22'], 3))
    if key not in variants:
        im = styled(e)
        if im is None: return None
        variants[key] = ('d%d' % len(variants), im)
    return variants[key][0]
# Rectangle d'une carte = exactement une période de la grille (1204 x 860) : côté voisin, on coupe pile au raccord
# (sinon le ciel d'une carte recouvre le sol de sa voisine) ; côté vide, on garde une marge pour falaises et ciel.
x0m, y0m = OX + W // 4, OY + H // 4
x1m, y1m = x0m + MW, y0m + MH
for (x, y), md in sorted(maps.items(), key=lambda t: (t[0][1], t[0][0])):
    ix, iy = x - X0, y - Y0; dx, dy = ix * MW, iy * MH; tag = f'{x}_{y}'
    for c, cell in enumerate(md['cellsData']):
        r, k = divmod(c, COLS)
        if cell['mov']: mov[(iy * ROWS + r) * COLS * nx + ix * COLS + k] = '1'
    # sol : rogné autour de la carte (marge plus large côté vide, pour garder falaises et ciel au bord du monde)
    mg = lambda nb: 0 if nb in sel else 420
    bx0, by0 = x0m - mg((x - 1, y)), y0m - mg((x, y - 1)); bx1, by1 = x1m + mg((x + 1, y)), y1m + mg((x, y + 1))
    sol = Image.new('RGBA', (bx1 - bx0, by1 - by0))
    for e in md['backgroundElements']:
        im = styled(e)
        if im is None: continue
        tr = e['transform']; sol.alpha_composite(im, (round(tr['m31'] - bx0 - im.width / 2), round(-tr['m32'] - by0 - im.height / 2)))
    sol.save(f'{out}/sol_{tag}.webp', 'WEBP', quality=80, method=6)
    places = []
    for e in md['sortableElements']:
        name = variant(e)
        if name is None: continue
        tr = e['transform']; r, k = divmod(e['cellId'], COLS)
        places.append({'f': name, 'x': round(tr['m31'] + dx, 1), 'y': round(-tr['m32'] + dy, 1),
                       'c': (iy * ROWS + r) * COLS * nx + ix * COLS + k, 'o': e['innerCellRenderOrder']})
    monde['maps'].append({'x': x, 'y': y, 'id': sel[(x, y)][0], 'sub': sel[(x, y)][1], 'tag': tag,
                          'sol': {'x': bx0 + dx, 'y': by0 + dy, 'w': sol.width, 'h': sol.height}, 'decor': places})
    print(tag, 'sol', sol.size, 'decor', len(places))
# atlas du décor en pages de 4096 (format multiatlas de Phaser)
P = 4096; pages = []; cur = None
items = sorted(variants.values(), key=lambda v: -v[1].height)
def newpage(): return {'im': Image.new('RGBA', (P, P)), 'frames': [], 'x': 0, 'y': 0, 'rowH': 0}
cur = newpage(); pages.append(cur)
for name, im in items:
    b = im.getbbox() or (0, 0, 1, 1); w, h = b[2] - b[0] + 2, b[3] - b[1] + 2
    if cur['x'] + w > P: cur['x'] = 0; cur['y'] += cur['rowH']; cur['rowH'] = 0
    if cur['y'] + h > P: cur = newpage(); pages.append(cur)
    px, py = cur['x'], cur['y']; cur['im'].paste(im.crop(b), (px + 1, py + 1)); cur['x'] += w; cur['rowH'] = max(cur['rowH'], h)
    cur['frames'].append({'filename': name, 'frame': {'x': px + 1, 'y': py + 1, 'w': w - 2, 'h': h - 2}, 'rotated': False, 'trimmed': True,
                          'spriteSourceSize': {'x': b[0], 'y': b[1], 'w': w - 2, 'h': h - 2}, 'sourceSize': {'w': im.width, 'h': im.height}})
textures = []
for i, pg in enumerate(pages):
    hgt = pg['y'] + pg['rowH']; img = pg['im'].crop((0, 0, P, max(1, hgt)))
    img.save(f'{out}/decor_{i}.webp', 'WEBP', quality=82, method=6)
    textures.append({'image': f'decor_{i}.webp', 'format': 'RGBA8888', 'size': {'w': P, 'h': img.height}, 'scale': 1, 'frames': pg['frames']})
json.dump({'textures': textures, 'meta': {}}, open(f'{out}/decor.json', 'w'))
print('decor', len(variants), 'images,', len(pages), 'pages', [t['size']['h'] for t in textures])
monde['mov'] = ''.join(mov)
json.dump(monde, open(f'{out}/monde.json', 'w'))
