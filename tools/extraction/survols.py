# survols.py <monde.json> <dossier des map_<id>.json (map_dump.py)> <dossier des bundles mapgfx_1x> <sortie, ex. public/assets/ui/survols_astrub>
#  Contour officiel des portes au survol (comme Dofus 3 et Sanstour).
#  Une porte peinte dans l'image d'un bâtiment n'a pas d'image à elle, mais la carte officielle a une « boîte de survol »
#  pour elle (mapData.boundingBoxes) : une silhouette blanche cachée, exactement l'embrasure, que Dofus entoure d'un trait
#  au survol (shaderOutlineParameters). Les portes dessinées à part (éléments interactifs, gfx 62977-62999) aussi.
#  Ce script dessine le trait de chaque silhouette (lilas, comme Sanstour) dans un atlas <sortie>.png/.json et pose
#  "survols": [{f, x, y}] sur chaque carte de monde.json (x, y : centre, mêmes coordonnées que le décor).
#  L'intérieur de chaque forme est gardé presque transparent (1/255) : survoler n'importe où dans la porte la désigne.
#  À relancer après chaque world_export.py (il réécrit monde.json).
import sys, json, os, glob, collections, warnings
warnings.filterwarnings('ignore')
import UnityPy
from PIL import Image, ImageFilter, ImageChops
UnityPy.config.FALLBACK_UNITY_VERSION = "6000.3.16f1"
PORTES = range(62977, 63000)
TRAIT, HALO = (226, 216, 255), (120, 90, 200)   # trait lilas clair, halo violet doux
mpath, mdir, tdir, out = sys.argv[1:5]
monde = json.load(open(mpath))
par_carte = {}
for m in monde['maps']:
    f = f"{mdir}/map_{m['id']}.json"
    if not os.path.exists(f): continue
    t = json.load(open(f)); md = t['mapData']
    R = {r['rid']: r.get('data') for r in t.get('references', {}).get('RefIds', [])}
    ies = [R[e['rid']] for e in md.get('interactiveElements', []) if R.get(e['rid']) and 'gfxId' in R[e['rid']]]
    formes = [e for e in md.get('boundingBoxes', []) if 'gfxId' in e] + [e for e in ies if e['gfxId'] in PORTES]
    m.pop('survols', None)
    if not formes or not m['decor']: continue
    # décalage carte -> monde : le même pour tout le décor de la carte (world_export pose x = m31 + dx, y = -m32 + dy)
    els = md['sortableElements'] + ies
    cnt = collections.Counter((round(p['x'] - e['transform']['m31'], 1), round(p['y'] + e['transform']['m32'], 1)) for p in m['decor'] for e in els)
    par_carte[m['tag']] = (m, formes, cnt.most_common(1)[0][0])
need = {e['gfxId'] for _, fs, _ in par_carte.values() for e in fs}
imgs = {}
for b in sorted({g // 10000 * 10000 for g in need}):
    for f in glob.glob(f'{tdir}/mapgfx_1x_{b}_assets_all.bundle'):
        for o in UnityPy.load(f).objects:
            if o.type.name != 'Texture2D': continue
            d = o.read()
            if d.m_Name.isdigit() and int(d.m_Name) in need: imgs[int(d.m_Name)] = d.image.convert('RGBA')
print('silhouettes', len(imgs), '/', len(need))
P = 4   # marge autour de la silhouette (le trait déborde) : le centre ne bouge pas
def trait(e):
    im = imgs.get(e['gfxId']); tr = e['transform']
    if im is None: return None
    if tr['m11'] < 0: im = im.transpose(Image.FLIP_LEFT_RIGHT)
    if tr['m22'] < 0: im = im.transpose(Image.FLIP_TOP_BOTTOM)
    w, h = im.size; nw, nh = max(1, round(w * abs(tr['m11']))), max(1, round(h * abs(tr['m22'])))
    if (nw, nh) != (w, h): im = im.resize((nw, nh), Image.BILINEAR)
    a = Image.new('L', (nw + 2 * P, nh + 2 * P)); a.paste(im.split()[3].point(lambda q: 255 if q > 24 else 0), (P, P))
    ligne = ImageChops.subtract(a.filter(ImageFilter.MaxFilter(5)), a)            # 2 px autour de la forme
    halo = ImageChops.subtract(a.filter(ImageFilter.MaxFilter(9)), a).filter(ImageFilter.GaussianBlur(1.2))
    o = Image.new('RGBA', a.size, HALO + (0,)); o.putalpha(halo.point(lambda q: q * 90 // 255))
    l = Image.new('RGBA', a.size, TRAIT + (0,)); l.putalpha(ligne.filter(ImageFilter.GaussianBlur(0.5)))
    # l'intérieur de la forme reste dans le dessin avec une opacité de 1/255 (invisible) : le jeu y lit le survol au pixel
    f = Image.new('RGBA', a.size, TRAIT + (0,)); f.putalpha(a.point(lambda q: 1 if q else 0))
    return Image.alpha_composite(Image.alpha_composite(f, o), l)
frames, cles = {}, {}
for tag, (m, formes, (dx, dy)) in par_carte.items():
    m['survols'] = []
    for e in formes:
        tr = e['transform']; k = (e['gfxId'], round(tr['m11'], 3), round(tr['m22'], 3))
        if k not in cles:
            im = trait(e)
            if im is None: continue
            cles[k] = f's{len(cles)}'; frames[cles[k]] = im
        m['survols'].append({'f': cles[k], 'x': round(tr['m31'] + dx, 1), 'y': round(-tr['m32'] + dy, 1)})
# atlas en étagères
L = 1024; x = y = hl = 0; pos = {}
for n, im in sorted(frames.items(), key=lambda kv: -kv[1].height):
    if x + im.width > L: x, y, hl = 0, y + hl + 1, 0
    pos[n] = (x, y); x += im.width + 1; hl = max(hl, im.height)
atlas = Image.new('RGBA', (L, y + hl))
for n, im in frames.items(): atlas.paste(im, pos[n])
atlas.save(out + '.png', optimize=True)
json.dump({'frames': {n: {'frame': {'x': pos[n][0], 'y': pos[n][1], 'w': im.width, 'h': im.height}} for n, im in frames.items()},
           'meta': {'image': os.path.basename(out) + '.png', 'size': {'w': L, 'h': y + hl}, 'scale': 1}}, open(out + '.json', 'w'))
json.dump(monde, open(mpath, 'w'), separators=(',', ':'))
print(sum(len(m.get('survols', [])) for m in monde['maps']), 'contours posés,', len(frames), 'dessins ->', out + '.png')
