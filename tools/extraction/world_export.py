# world_export.py liste.json cartes_dir textures_dir outdir : exporte plusieurs cartes Dofus 3 voisines en un « monde » continu.
#  liste.json = {"x,y": [mapId, sousZone], ...} (coordonnées Dofus de chaque carte)
#    un intérieur (maison, mine…) : {"x,y": [mapId, sousZone, {"tag": nom, "inside": 1}]}, x,y = sa place dans la grille (interieurs.py)
#  cartes_dir = dossier des map_{id}.json (MonoBehaviour des bundles mapdata_assets_world_N)
#  textures_dir = dossier des bundles mapgfx_1x_*_assets_all.bundle
#  CACHE=fichier.pkl (option) : garde les textures lues pour relancer vite
# Sortie : monde.json, et par carte sol_x_y.webp (+ fond_x_y.webp) + decor_x_y.webp/json (chargés par le jeu seulement près du joueur), ciel.webp.
# Les cartes Dofus se raccordent bord à bord : la carte [x+1,y] commence 14 cases (1204 px) plus à droite,
# la carte [x,y+1] 40 demi-lignes (860 px) plus bas. La grille du monde est donc une grande grille 14·nx × 40·ny.
import sys, json, glob, os, warnings
warnings.filterwarnings('ignore')
import UnityPy
from PIL import Image, ImageStat
UnityPy.config.FALLBACK_UNITY_VERSION = "6000.3.16f1"
liste, cdir, tdir, out = sys.argv[1:5]; os.makedirs(out, exist_ok=True)
W, H, OX, OY, COLS, ROWS = 86, 43, -620, -490, 14, 40
MW, MH = COLS * W, ROWS * H // 2
sel = {tuple(map(int, k.split(','))): v for k, v in json.load(open(liste)).items()}
raw = {xy: json.load(open(f'{cdir}/map_{v[0]}.json')) for xy, v in sel.items()}
maps = {xy: r['mapData'] for xy, r in raw.items()}
# Éléments interactifs (portes, cadres de mine, panneaux…) : rangés à part dans references ; ceux qui ont une image fixe
# sont posés avec le décor (les animés — minerais, céréales — sont dans d'autres paquets et restent absents).
for xy, r in raw.items():
    R = {q['rid']: q.get('data') for q in r.get('references', {}).get('RefIds', [])}
    maps[xy]['ies'] = [R[e['rid']] for e in maps[xy].get('interactiveElements', []) if R.get(e['rid']) and 'gfxId' in R[e['rid']]]
need = set(e['gfxId'] for md in maps.values() for k in ['backgroundElements', 'sortableElements', 'ies'] for e in md[k])
extra = {xy: (v[2] if len(v) > 2 else {}) for xy, v in sel.items()}
imgs = {}
CACHE = os.environ.get('CACHE')   # fichier pickle des textures déjà lues (la lecture des bundles est longue)
if CACHE and os.path.exists(CACHE):
    import pickle; imgs = pickle.load(open(CACHE, 'rb'))
else:
    for b in glob.glob(f'{tdir}/mapgfx_*.bundle'):
        for o in UnityPy.load(b).objects:
            if o.type.name != 'Texture2D': continue
            d = o.read()
            if d.m_Name.isdigit() and int(d.m_Name) in need: imgs[int(d.m_Name)] = d.image.convert('RGBA')
    if CACHE: import pickle; pickle.dump(imgs, open(CACHE, 'wb'))
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
# Ciel : le grand fond opaque que Dofus met sous chaque carte du bord (SKY=gfxId,... ; Incarnam : 805542).
# On le retire des sols (sinon il fait des coutures rectangulaires entre cartes) et le jeu en pose un seul, derrière tout.
SKY = {int(g) for g in os.environ.get('SKY', '').split(',') if g}
x0m, y0m = OX + W // 4, OY + H // 4
x1m, y1m = x0m + MW, y0m + MH
# ONLY_INSIDE=1 : ne réécrit les images que des intérieurs (les cartes du dehors déjà exportées ne changent pas)
ONLY_INSIDE = os.environ.get('ONLY_INSIDE') == '1'
# DECOR_ONLY=1 : ne réécrit que les atlas de décor (sols et fonds inchangés)
DECOR_ONLY = os.environ.get('DECOR_ONLY') == '1'
def pack(variants, path, write=True):
    """Atlas Phaser d'une carte : une image par (gfx, couleur, échelle), rangées en étagères."""
    items = sorted(variants.values(), key=lambda v: -v[1].height)
    maxW = 2048; px = py = rowH = 0; pos = {}
    for name, im in items:
        b = im.getbbox() or (0, 0, 1, 1); w, h = b[2] - b[0] + 2, b[3] - b[1] + 2
        if px + w > maxW: px = 0; py += rowH; rowH = 0
        pos[name] = (px, py, b); px += w; rowH = max(rowH, h)
    if not write:
        return (maxW, max(1, py + rowH))
    atlas = Image.new('RGBA', (maxW, max(1, py + rowH))); frames = {}
    for name, im in items:
        ax, ay, b = pos[name]; atlas.paste(im.crop(b), (ax + 1, ay + 1)); w, h = b[2] - b[0], b[3] - b[1]
        frames[name] = {'frame': {'x': ax + 1, 'y': ay + 1, 'w': w, 'h': h}, 'rotated': False, 'trimmed': True,
                        'spriteSourceSize': {'x': b[0], 'y': b[1], 'w': w, 'h': h}, 'sourceSize': {'w': im.width, 'h': im.height}}
    atlas.save(path + '.webp', 'WEBP', quality=82, method=6)
    json.dump({'frames': frames, 'meta': {'image': os.path.basename(path) + '.webp', 'size': {'w': maxW, 'h': atlas.height}, 'scale': '1'}}, open(path + '.json', 'w'))
    return atlas.size
sky = None
for (x, y), md in sorted(maps.items(), key=lambda t: (t[0][1], t[0][0])):
    ix, iy = x - X0, y - Y0; dx, dy = ix * MW, iy * MH; tag = extra[(x, y)].get('tag', f'{x}_{y}')
    write = not ONLY_INSIDE or extra[(x, y)].get('inside')
    for c, cell in enumerate(md['cellsData']):
        r, k = divmod(c, COLS)
        if cell['mov']: mov[(iy * ROWS + r) * COLS * nx + ix * COLS + k] = '1'
    # Sol = exactement une période de la grille (1204 x 860) côté voisin : on coupe pile au raccord ;
    # côté vide, rien n'est coupé (falaises, nuages au bord du monde).
    # Les nuages / rayons translucides qui débordent sur un voisin iraient se couper net au raccord :
    # ils partent dans un calque « fond » non coupé, posé sous tous les sols.
    els = []
    for e in md['backgroundElements']:
        im = styled(e)
        if im is None: continue
        if e['gfxId'] in SKY and not extra[(x, y)].get('inside'):
            sky = sky or im; continue
        tr = e['transform']; ex, ey = round(tr['m31'] - im.width / 2), round(-tr['m32'] - im.height / 2)
        els.append((im, ex, ey))
    nb = {'l': (x - 1, y) in sel, 't': (x, y - 1) in sel, 'r': (x + 1, y) in sel, 'b': (x, y + 1) in sel}
    def crosses(ex, ey, im):
        return (nb['l'] and ex < x0m) or (nb['t'] and ey < y0m) or (nb['r'] and ex + im.width > x1m) or (nb['b'] and ey + im.height > y1m)
    def atmo(im):
        # nuage / rayon de lumière : grand, surtout translucide, clair (les ombres sont sombres, les touffes d'herbe petites)
        if im.width * im.height < 150000: return False
        a = im.getchannel('A'); h = a.histogram(); vis = sum(h[9:])
        if vis == 0 or sum(h[9:200]) < vis * 0.6: return False
        st = ImageStat.Stat(im.convert('RGB'), a.point(lambda q: 255 if q > 8 else 0))
        return sum(st.mean) / 3 > 110
    def hard_edge(im):
        # bord net (grand dégradé rectangulaire) : en monde ouvert on le verrait, Dofus le cache hors caméra
        a = im.getchannel('A'); b = a.point(lambda q: 255 if q > 8 else 0).getbbox()
        if not b: return False
        c = a.crop(b); w, h = c.size
        sides = [c.crop((0, 0, w, 3)), c.crop((0, h - 3, w, h)), c.crop((0, 0, 3, h)), c.crop((w - 3, 0, w, h))]
        return max(ImageStat.Stat(x).mean[0] for x in sides) > 40
    at = [t for t in els if atmo(t[0])]
    hard = [t for t in at if hard_edge(t[0])]   # retirés partout : on verrait leurs bords dans les trous du sol
    fond_els = [t for t in at if crosses(t[1], t[2], t[0]) and id(t) not in {id(u) for u in hard}]
    fid = {id(t) for t in hard + fond_els}; sol_els = [t for t in els if id(t) not in fid]
    bx0 = x0m if nb['l'] else min([x0m] + [ex for _, ex, _ in sol_els])
    by0 = y0m if nb['t'] else min([y0m] + [ey for _, _, ey in sol_els])
    bx1 = x1m if nb['r'] else max([x1m] + [ex + im.width for im, ex, _ in sol_els])
    by1 = y1m if nb['b'] else max([y1m] + [ey + im.height for im, _, ey in sol_els])
    sol = Image.new('RGBA', (bx1 - bx0, by1 - by0))
    for im, ex, ey in sol_els: sol.alpha_composite(im, (ex - bx0, ey - by0))
    fond = None
    if fond_els:
        fx0 = min(ex for _, ex, _ in fond_els); fy0 = min(ey for _, _, ey in fond_els)
        fx1 = max(ex + im.width for im, ex, _ in fond_els); fy1 = max(ey + im.height for im, _, ey in fond_els)
        fim = Image.new('RGBA', (fx1 - fx0, fy1 - fy0))
        for im, ex, ey in fond_els: fim.alpha_composite(im, (ex - fx0, ey - fy0))
        # flou par nature : moitié de résolution (le jeu l'agrandit x2), 4 fois moins de mémoire vidéo
        if write and not DECOR_ONLY: fim.resize((max(1, fim.width // 2), max(1, fim.height // 2)), Image.LANCZOS).save(f'{out}/fond_{tag}.webp', 'WEBP', quality=80, method=6)
        fond = {'x': fx0 + dx, 'y': fy0 + dy, 'w': fim.width, 'h': fim.height, 'k': 2}
    if write and not DECOR_ONLY: sol.save(f'{out}/sol_{tag}.webp', 'WEBP', quality=80, method=6)
    # Décor : un atlas par carte, pour que le jeu ne charge que les cartes proches du joueur
    variants = {}; places = []
    els_d = md['sortableElements'] + [e for e in md['ies'] if e['gfxId'] in imgs]
    for e in sorted(els_d, key=lambda e: (e['cellId'], e.get('innerCellRenderOrder', 0))):
        tr = e['transform']; key = (e['gfxId'], e['color']['value'], round(tr['m11'], 3), round(tr['m22'], 3))
        if key not in variants:
            im = styled(e)
            if im is None: continue
            variants[key] = ('d%d' % len(variants), im)
        r, k = divmod(e['cellId'], COLS)
        places.append({'f': variants[key][0], 'x': round(tr['m31'] + dx, 1), 'y': round(-tr['m32'] + dy, 1),
                       'c': (iy * ROWS + r) * COLS * nx + ix * COLS + k, 'o': e['innerCellRenderOrder']})
    asz = pack(variants, f'{out}/decor_{tag}', write)
    monde['maps'].append({'x': x, 'y': y, 'id': sel[(x, y)][0], 'sub': sel[(x, y)][1], 'tag': tag,
                          'sol': {'x': bx0 + dx, 'y': by0 + dy, 'w': sol.width, 'h': sol.height}, 'decor': places,
                          **({'fond': fond} if fond else {}), **({'inside': 1} if extra[(x, y)].get('inside') else {})})
    print(tag, 'retirés', len(hard), 'sol', sol.size, 'fond', fond and (fond['w'], fond['h']), 'decor', len(places), asz)
if sky is not None:
    sky.convert('RGB').save(f'{out}/ciel.webp', 'WEBP', quality=85, method=6); monde['sky'] = 'ciel.webp'
monde['mov'] = ''.join(mov)
json.dump(monde, open(f'{out}/monde.json', 'w'))
