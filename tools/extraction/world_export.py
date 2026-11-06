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
from PIL import Image, ImageStat, ImageFilter
import numpy as np
from collections import Counter
UnityPy.config.FALLBACK_UNITY_VERSION = "6000.3.16f1"
liste, cdir, tdir, out = sys.argv[1:5]; os.makedirs(out, exist_ok=True)
W, H, OX, OY, COLS, ROWS = 86, 43, -620, -490, 14, 40
MW, MH = COLS * W, ROWS * H // 2
sel = {tuple(map(int, k.split(','))): v for k, v in json.load(open(liste)).items()}
raw = {xy: json.load(open(f'{cdir}/map_{v[0]}.json')) for xy, v in sel.items()}
maps = {xy: r['mapData'] for xy, r in raw.items()}
# Éléments interactifs (portes, cadres de mine, panneaux…) : rangés à part dans references ; ceux qui ont une image fixe
# sont posés avec le décor (les animés — minerais, céréales — sont dans d'autres paquets et restent absents).
REFS = {}
for xy, r in raw.items():
    R = REFS[xy] = {q['rid']: q.get('data') for q in r.get('references', {}).get('RefIds', [])}
    maps[xy]['ies'] = [R[e['rid']] for e in maps[xy].get('interactiveElements', []) if R.get(e['rid']) and 'gfxId' in R[e['rid']]]
need = set(e['gfxId'] for md in maps.values() for k in ['backgroundElements', 'sortableElements', 'ies'] for e in md[k])
extra = {xy: (v[2] if len(v) > 2 else {}) for xy, v in sel.items()}
imgs = {}
CACHE = os.environ.get('CACHE')   # fichier pickle des textures déjà lues (la lecture des bundles est longue)
# TEXDIR=dossier : textures déjà sorties en <gfx>.png (une par fichier), lues à la demande. Pour les grands mondes (Astrub :
# 360 cartes), tout charger d'un coup dépassait la mémoire.
TEXDIR = os.environ.get('TEXDIR')
class Lazy(dict):
    def __init__(self, d): super().__init__(); self.d = d; self.ids = {int(f[:-4]) for f in os.listdir(d) if f.endswith('.png')}
    def get(self, k, default=None):
        if k not in self.ids: return default
        if not dict.__contains__(self, k):
            if dict.__len__(self) > 400: self.clear()
            dict.__setitem__(self, k, Image.open(f'{self.d}/{k}.png').convert('RGBA'))
        return dict.__getitem__(self, k)
    def __contains__(self, k): return k in self.ids
    def __len__(self): return len(self.ids)
if TEXDIR:
    imgs = Lazy(TEXDIR)
elif CACHE and os.path.exists(CACHE):
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
# ONLY=1_-4,mine_2_-4 : ne réécrit les images que de ces cartes (ex. une image abîmée par un export interrompu)
ONLY = set(filter(None, os.environ.get('ONLY', '').split(',')))
# DECOR_ONLY=1 : ne réécrit que les atlas de décor (sols et fonds inchangés)
DECOR_ONLY = os.environ.get('DECOR_ONLY') == '1'
# avec DECOR_ONLY : NO_DECOR=1 saute aussi les atlas de décor ; CALQUES=fond,bord réécrit quand même ces calques
NO_DECOR = os.environ.get('NO_DECOR') == '1'
CALQUES = set(os.environ.get('CALQUES', 'bord').split(','))
sols, entiers = {}, {}
# L'encodage WebP (method=6) est le plus long : il part dans 4 fils en parallèle (PIL libère le verrou pendant l'encodage).
from concurrent.futures import ThreadPoolExecutor
POOL = ThreadPoolExecutor(int(os.environ.get('FILS', os.cpu_count() or 4)))
PENDING = []
def webp(im, path, q):
    PENDING.append(POOL.submit(lambda: im.save(path, 'WEBP', quality=q, method=6)))
    while len(PENDING) > 8: PENDING.pop(0).result()   # pas plus de 8 images en attente d'encodage (mémoire)
# Grands mondes (Astrub) : les images gardées pour la fin (sol entier pour le calque « bord », décor partagé) vont sur le disque.
import tempfile
TMP = tempfile.mkdtemp(prefix='world_export_')
class Disque:
    """Image rangée sur le disque, relue à la demande (mêmes attributs que ce qu'on en utilise)."""
    def __init__(self, im, path):
        im.save(path); self.path = path; self.width, self.height = im.size; self.size = im.size; self._b = im.getbbox()
    def getbbox(self): return self._b
    def crop(self, b): return Image.open(self.path).convert('RGBA').crop(b)
    def load(self): return Image.open(self.path).convert('RGBA')
# Lumières (halos sur l'eau, lueurs, rayons de soleil) : Dofus les dessine en les AJOUTANT à l'image (ShaderBlendingParameters,
# facteurs de mélange Unity), avec un masque de dissolution animé. Posées comme du décor normal, elles faisaient de grandes taches
# blanches. Elles sortent du sol et partent dans le décor avec 'b' (mélange) et 'k' (intensité) : le jeu les dessine en mode additif,
# en entier (plus de coupure au raccord) et plus fort la nuit (choix 1B de Mathis, 2026-11-06). Nuages et constellations restent du décor.
LUMIERES = {305396, 404317, 57871, 57971, 806080, 305477, 60327, 36648, 39767,  # halos / lueurs
            42481, 44653, 805552, 402668, 806081}                               # rayons de lumière
# lumières du soleil (reflets sur l'eau, rayons) : 'j' = 1, elles s'éteignent la nuit ; les autres (feux, lueurs) s'y renforcent
SOLEIL = {305396, 404317, 806080, 60327, 42481, 44653, 805552, 402668, 806081}
VOILES = {62942}
# Fond du lac : de grandes ellipses (49153-49156) que Dofus fond entre elles (masque de dissolution 201) sur la couleur de fond
# de la carte (backgroundColor, vert d'eau). On adoucit leurs bords et on remplit dessous de cette couleur : plus de disques.
EAU_FOND = {49153, 49154, 49155, 49156}
def adoucir(im):
    a = np.asarray(im).astype(np.float32); h, w = a.shape[:2]; yy, xx = np.mgrid[0:h, 0:w]
    r = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2); f = np.clip((1 - r) / 0.45, 0, 1)
    a[..., 3] *= f * f * (3 - 2 * f)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')   # rectangle blanc en mode « multiplier » : ne change rien dans Dofus, un voile blanc chez nous -> retiré
def melange(xy, mk, e):
    """(b, k) : 'a' = additif, 's' = écran ; k = intensité (le masque de dissolution de Dofus en cache une bonne part)."""
    sd = maps[xy][mk].get('shaderData', []); i = e.get('materialIndex', -1); R = REFS[xy]
    f = None
    if 0 <= i < len(sd):
        for p in (R.get(sd[i]['rid']) or {}).get('shaderParameters', []):
            d = R.get(p['rid']) or {}
            if 'sourceFactor' in d: f = (d['sourceFactor'], d['destinationFactor'])
    # intensités réglées à l'œil en jeu (le masque de dissolution de Dofus ne laisse passer qu'un scintillement)
    if f is None: return 's', 0.2             # rayons sans mélange : écran adouci
    if f[0] == 2: return 's', 0.2             # DstColor, One : éclaircit ce qui est dessous
    if f[0] == 3: return 'a', 0.1             # SrcColor, One : couleur au carré
    return 'a', 0.25
def additif(xy, mk, e):
    """Matériau officiel en mélange additif (destinationFactor = One) : lueur, halo, œuf de Dofus du Temple Céleste…
    Posé comme du décor normal, sa couleur sombre (0xff171a1e : « n'ajoute presque rien ») le rendait noir."""
    sd = maps[xy][mk].get('shaderData', []); i = e.get('materialIndex', -1); R = REFS[xy]
    if 0 <= i < len(sd):
        for p in (R.get(sd[i]['rid']) or {}).get('shaderParameters', []):
            d = R.get(p['rid']) or {}
            if d.get('destinationFactor') == 1 and d.get('sourceFactor') in (1, 2, 3): return True
    return False
def vague(xy, mk, e):
    """Vague de rivage (ShaderWaveParameters, ex. Château Ensablé) : la texture est une forme pleine que Dofus anime en
    écume sur ses bords. Posée telle quelle, elle faisait de grandes taches blanches sur la mer : on ne la pose pas."""
    sd = maps[xy][mk].get('shaderData', []); i = e.get('materialIndex', -1); R = REFS[xy]
    return 0 <= i < len(sd) and any('waveTexID' in (R.get(p['rid']) or {}) for p in (R.get(sd[i]['rid']) or {}).get('shaderParameters', []))
def cache(e):
    """Élément caché par défaut (couleur d'alpha 0) : montré par une mise en scène du serveur (ex. Dofus posé sur son socle)."""
    return (e['color']['value'] >> 24) & 255 == 0
def shader(xy, mk, e):
    """Paramètres officiels du matériau d'un élément (les classes ne sont pas gardées : on les reconnaît à leurs champs)."""
    sd = maps[xy][mk].get('shaderData', []); i = e.get('materialIndex', -1); R = REFS[xy]; out = {}
    if 0 <= i < len(sd):
        for p in (R.get(sd[i]['rid']) or {}).get('shaderParameters', []):
            d = R.get(p['rid']) or {}
            if 'flexibility' in d: out['vent'] = d
            elif 'finalColor' in d: out['couleur'] = d
            elif 'amplitude' in d and 'direction' in d: out['glisse'] = d
    return out
def anime(xy, mk, e):
    """Mouvements officiels repris par le jeu (maquette « Vivant », 2026-11-06) :
    w = souplesse au vent (arbres, herbes) ; t = [dx, dy, amplitude px, fréquence] (eau qui glisse) ;
    ca = [couleur 0xRRGGBB, alpha, fréquence] (eau dont la couleur va et vient)."""
    p = shader(xy, mk, e); out = {}
    if 'vent' in p: out['w'] = round(p['vent']['flexibility'], 2)
    if 'glisse' in p:
        d = p['glisse']; out['t'] = [round(d['direction']['x'], 2), round(d['direction']['y'], 2), round(d['amplitude'], 2), round(d['frequency'], 3)]
    if 'couleur' in p:
        v = p['couleur']['finalColor']['value']; out['ca'] = [v & 0xffffff, round(((v >> 24) & 255) / 255, 2), round(p['couleur']['frequency'], 3)]
    return out
def pack(variants, path, write=True):
    write = write and not NO_DECOR
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
    webp(atlas, path + '.webp', 82)
    json.dump({'frames': frames, 'meta': {'image': os.path.basename(path) + '.webp', 'size': {'w': maxW, 'h': atlas.height}, 'scale': '1'}}, open(path + '.json', 'w'))
    return atlas.size
# PARTAGE=1 : décor partagé (maquette « Monde sans coupure », 3A). Une même image (gfx, couleur, échelle) sert à toutes les cartes :
# elle va une seule fois dans des pages d'atlas communes (decor_p<N>), rangées dans l'ordre où les cartes l'utilisent
# (les cartes voisines partagent donc les mêmes pages). Chaque carte liste ses pages ('pages'), chaque élément sa page ('p').
PARTAGE = os.environ.get('PARTAGE') == '1'
GLOBAL = {}
sky = None
for (x, y), md in sorted(maps.items(), key=lambda t: (t[0][1], t[0][0])):
    ix, iy = x - X0, y - Y0; dx, dy = ix * MW, iy * MH; tag = extra[(x, y)].get('tag', f'{x}_{y}')
    write = (not ONLY_INSIDE or extra[(x, y)].get('inside')) and (not ONLY or tag in ONLY)
    for c, cell in enumerate(md['cellsData']):
        r, k = divmod(c, COLS)
        if cell['mov']: mov[(iy * ROWS + r) * COLS * nx + ix * COLS + k] = '1'
    # Sol = exactement une période de la grille (1204 x 860) côté voisin : on coupe pile au raccord ;
    # côté vide, rien n'est coupé (falaises, nuages au bord du monde).
    # Les nuages / rayons translucides qui débordent sur un voisin iraient se couper net au raccord :
    # ils partent dans un calque « fond » non coupé, posé sous tous les sols.
    els = []; lums = []; eaux = []; gfx_els = []
    # Eau animée : les éléments du sol qui bougent (reflets et vaguelettes, translucides) sortent du sol
    # et vont dans une couche juste au-dessus (garder aussi ce qui est posé dessus emportait presque tout le sol)
    couche = []
    for e in md['backgroundElements']:
        im = styled(e)
        if im is None or e['gfxId'] in VOILES or cache(e): continue
        if vague((x, y), 'backgroundMaterialData', e): continue   # (en écume fixe, ses cercles se croisaient partout sur la mer)
        if e['gfxId'] in LUMIERES or additif((x, y), 'backgroundMaterialData', e): lums.append(('backgroundMaterialData', -1, e)); continue
        a = anime((x, y), 'backgroundMaterialData', e); a.pop('w', None)
        if a and im.width * im.height <= 160000:   # les grands (nuages, voiles) restent dans le sol
            tr = e['transform']; eaux.append((im, round(tr['m31'] - im.width / 2), round(-tr['m32'] - im.height / 2)))
            couche.append((e, a)); continue
        if e['gfxId'] in SKY and (not extra[(x, y)].get('inside') or extra[(x, y)].get('ciel')):
            sky = sky or im; continue
        tr = e['transform']; ex, ey = round(tr['m31'] - im.width / 2), round(-tr['m32'] - im.height / 2)
        if e['gfxId'] in EAU_FOND: eaux.append((im, ex, ey)); im = adoucir(im)
        els.append((im, ex, ey)); gfx_els.append((e['gfxId'], e.get('displayBehaviour', 0)))
    # Sol en carreaux (Château Ensablé : 885 losanges de sable 96 x 56) : leur bord sur la mer faisait des dents de scie.
    # Ils sont réunis en une couche dont le contour est arrondi (le dedans reste net).
    nbg = Counter(e['gfxId'] for e in md['backgroundElements'])
    # (+ les petits bords crème posés en dents de scie autour, displayBehaviour 2)
    tuiles = [i for i, t in enumerate(els) if t[0].width <= 200 and t[0].height <= 100 and (nbg[gfx_els[i][0]] >= 100 or gfx_els[i][1] == 2)]
    if tuiles and extra[(x, y)].get('inside'):   # dehors, le bord d'une carte touche sa voisine : on n'y touche pas
        tx0 = min(els[i][1] for i in tuiles); ty0 = min(els[i][2] for i in tuiles)
        tx1 = max(els[i][1] + els[i][0].width for i in tuiles); ty1 = max(els[i][2] + els[i][0].height for i in tuiles)
        P = 24; ct = Image.new('RGBA', (tx1 - tx0 + 2 * P, ty1 - ty0 + 2 * P))
        for i in tuiles: ct.alpha_composite(els[i][0], (els[i][1] - tx0 + P, els[i][2] - ty0 + P))
        al = ct.getchannel('A').filter(ImageFilter.GaussianBlur(16)).point(lambda q: 0 if q < 70 else 255 if q > 185 else (q - 70) * 255 // 115)
        lisse = ct.convert('RGB')
        for _ in range(5): lisse = lisse.filter(ImageFilter.MaxFilter(9))   # couleur prolongée sous le nouveau bord (sinon des pointes noires)
        lisse.paste(ct.convert('RGB'), (0, 0), ct.getchannel('A').point(lambda q: 255 if q > 200 else 0)); lisse = lisse.convert('RGBA')
        lisse.putalpha(al)
        garde = set(tuiles)
        els = [((lisse, tx0 - P, ty0 - P) if i == tuiles[0] else t) for i, t in enumerate(els) if i not in garde or i == tuiles[0]]
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
    # (pas dans le Temple Céleste : ses pierres flottantes animées y laissaient des taches noires, sa couleur de fond)
    bgv = md['backgroundColor']['value']; clair = ((bgv >> 16 & 255) + (bgv >> 8 & 255) + (bgv & 255)) / 3 > 140
    if eaux and not extra[(x, y)].get('ciel') and not clair:   # (fond clair, Château Ensablé : faisait des taches pâles sur la mer)   # couleur de fond de la carte sous le lac (là où sont ses ellipses, un peu élargies pour boucher les trous)
        m = Image.new('L', sol.size)
        for im, ex, ey in eaux: m.paste(255, (ex - bx0, ey - by0), im.getchannel('A').point(lambda q: 255 if q > 5 else 0))
        w8, h8 = max(1, sol.width // 8), max(1, sol.height // 8)
        m = m.resize((w8, h8)).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(1)).resize(sol.size, Image.BILINEAR)
        v = md['backgroundColor']['value']; fill = Image.new('RGBA', sol.size, ((v >> 16) & 255, (v >> 8) & 255, v & 255, 255))
        sol.paste(fill, (0, 0), m)
    for im, ex, ey in sol_els: sol.alpha_composite(im, (ex - bx0, ey - by0))
    # le sol entier, sans coupe : sert au calque « bord » (deuxième passe, après toutes les cartes)
    if sol_els and not extra[(x, y)].get('inside'):
        ux0 = min(ex for _, ex, _ in sol_els); uy0 = min(ey for _, _, ey in sol_els)
        ux1 = max(ex + im.width for im, ex, _ in sol_els); uy1 = max(ey + im.height for im, _, ey in sol_els)
        if (ux0, uy0, ux1, uy1) != (bx0, by0, bx1, by1):
            full = Image.new('RGBA', (ux1 - ux0, uy1 - uy0))
            for im, ex, ey in sol_els: full.alpha_composite(im, (ex - ux0, ey - uy0))
            entiers[tag] = (Disque(full, f'{TMP}/entier_{tag}.png'), ux0 + dx, uy0 + dy, (x0m + dx, y0m + dy, x1m + dx, y1m + dy), (bx0 + dx, by0 + dy, bx1 + dx, by1 + dy), write)
    sols[tag] = (sol.getchannel('A'), bx0 + dx, by0 + dy)   # seul l'alpha sert (calque « bord ») : 4 fois moins de mémoire
    def calque(lst, nom):
        if not lst: return None
        fx0 = min(ex for _, ex, _ in lst); fy0 = min(ey for _, _, ey in lst)
        fx1 = max(ex + im.width for im, ex, _ in lst); fy1 = max(ey + im.height for im, _, ey in lst)
        fim = Image.new('RGBA', (fx1 - fx0, fy1 - fy0))
        for im, ex, ey in lst: fim.alpha_composite(im, (ex - fx0, ey - fy0))
        # flou par nature : moitié de résolution (le jeu l'agrandit x2), 4 fois moins de mémoire vidéo
        if write and (not DECOR_ONLY or nom in CALQUES): fim.resize((max(1, fim.width // 2), max(1, fim.height // 2)), Image.LANCZOS)
        if write and (not DECOR_ONLY or nom in CALQUES): webp(fim, f'{out}/{nom}_{tag}.webp', 80)
        return {'x': fx0 + dx, 'y': fy0 + dy, 'w': fim.width, 'h': fim.height, 'k': 2}
    # rayons / nuages qui passent sur une voisine : coupés net par le sol de la voisine quoi qu'on fasse -> retirés (choix de Mathis)
    fond = calque(fond_els, 'fond') if os.environ.get('GARDER_FOND') == '1' else None
    if write and not DECOR_ONLY: webp(sol, f'{out}/sol_{tag}.webp', 80)
    # Décor : un atlas par carte, pour que le jeu ne charge que les cartes proches du joueur
    variants = GLOBAL if PARTAGE else {}; places = []
    lum_s = [e for e in md['sortableElements'] if not cache(e) and (e['gfxId'] in LUMIERES or additif((x, y), 'sortableMaterialData', e))]
    lums += [('sortableMaterialData', 0, e) for e in lum_s]
    # couche d'eau animée : g = 1 (au-dessus du sol, sous les lumières et le décor), o = ordre d'origine
    for i, (e, a) in enumerate(couche):
        tr = e['transform']; key = (e['gfxId'], e['color']['value'], round(tr['m11'], 3), round(tr['m22'], 3))
        if key not in variants:
            im = styled(e)
            if im is None: continue
            variants[key] = ('d%d' % len(variants), im)
        places.append({'f': variants[key][0], 'x': round(tr['m31'] + dx, 1), 'y': round(-tr['m32'] + dy, 1), 'c': -1, 'o': i, 'g': 1, **a})
    els_d = [e for e in md['sortableElements'] if e['gfxId'] not in VOILES and not cache(e) and not any(e is l for l in lum_s)] + [e for e in md['ies'] if e['gfxId'] in imgs]
    for e in sorted(els_d, key=lambda e: (e['cellId'], e.get('innerCellRenderOrder', 0))):
        tr = e['transform']; key = (e['gfxId'], e['color']['value'], round(tr['m11'], 3), round(tr['m22'], 3))
        if key not in variants:
            im = styled(e)
            if im is None: continue
            variants[key] = ('d%d' % len(variants), im)
        r, k = divmod(e['cellId'], COLS)
        places.append({'f': variants[key][0], 'x': round(tr['m31'] + dx, 1), 'y': round(-tr['m32'] + dy, 1),
                       'c': (iy * ROWS + r) * COLS * nx + ix * COLS + k, 'o': e['innerCellRenderOrder'],
                       **(anime((x, y), 'sortableMaterialData', e) if 'materialIndex' in e else {})})
    # lumières : c = -1 pour celles du sol (posées sur le sol, sous le décor), sinon la case comme le décor
    for mk, sortable, e in lums:
        tr = e['transform']; key = (e['gfxId'], e['color']['value'], round(tr['m11'], 3), round(tr['m22'], 3))
        if key not in variants:
            im = styled(e)
            if im is None: continue
            # flou par nature et souvent très grand (rayons de 1000 px) : un tiers de la résolution, le jeu l'agrandit x3
            variants[key] = ('d%d' % len(variants), im.resize((max(1, im.width // 3), max(1, im.height // 3)), Image.LANCZOS))
        b, kk = melange((x, y), mk, e); r, k = divmod(e.get('cellId', 0), COLS)
        places.append({'f': variants[key][0], 'x': round(tr['m31'] + dx, 1), 'y': round(-tr['m32'] + dy, 1),
                       'c': (iy * ROWS + r) * COLS * nx + ix * COLS + k if sortable == 0 else -1,
                       'o': e.get('innerCellRenderOrder', 0), 'b': b, 'k': kk, 'z': 3, **({'j': 1} if e['gfxId'] in SOLEIL else {})})
    asz = None if PARTAGE else pack(variants, f'{out}/decor_{tag}', write)
    if PARTAGE:   # images du décor partagé : sur le disque jusqu'au rangement en pages
        for kk, (nm, im) in list(GLOBAL.items()):
            if not isinstance(im, Disque): GLOBAL[kk] = (nm, Disque(im, f'{TMP}/{nm}.png'))
    monde['maps'].append({'x': x, 'y': y, 'id': sel[(x, y)][0], 'sub': sel[(x, y)][1], 'tag': tag,
                          'sol': {'x': bx0 + dx, 'y': by0 + dy, 'w': sol.width, 'h': sol.height}, 'decor': places,
                          **({'fond': fond} if fond else {}), **({'inside': 1} if extra[(x, y)].get('inside') else {}),
                          **({'ciel': 1} if extra[(x, y)].get('ciel') else {})})
    print(tag, 'retirés', len(hard), 'lumières', len(lums), 'eau', len(couche), 'sol', sol.size, 'fond', fond and (fond['w'], fond['h']), 'decor', len(places), asz)
def pages_partagees():
    """Range toutes les images du décor dans des pages de 2048 x 2048 au plus, dans l'ordre de première utilisation."""
    PW, PH = 2048, 2048; page = 0; px = py = rowH = 0; pos = {}; order = sorted(GLOBAL.values(), key=lambda v: int(v[0][1:]))
    for name, im in order:
        b = im.getbbox() or (0, 0, 1, 1); w, h = b[2] - b[0] + 2, b[3] - b[1] + 2
        if w > PW or h > PH: im = im.crop(b); b = (0, 0, im.width, im.height); w, h = min(PW, im.width) + 2, min(PH, im.height) + 2
        if px + w > PW: px = 0; py += rowH; rowH = 0
        if py + h > PH: page += 1; px = py = rowH = 0
        pos[name] = (page, px, py, b, im); px += w; rowH = max(rowH, h)
    out_pages = {}
    for name, (pg, ax, ay, b, im) in pos.items(): out_pages.setdefault(pg, []).append((name, ax, ay, b, im))
    for pg, items in out_pages.items():
        hgt = max(ay + (b[3] - b[1]) + 2 for _, _, ay, b, _ in items)
        atlas = Image.new('RGBA', (PW, min(PH, hgt))); frames = {}
        for name, ax, ay, b, im in items:
            c = im.crop(b).crop((0, 0, min(PW - 2, b[2] - b[0]), min(PH - 2, b[3] - b[1]))); atlas.paste(c, (ax + 1, ay + 1))
            frames[name] = {'frame': {'x': ax + 1, 'y': ay + 1, 'w': c.width, 'h': c.height}, 'rotated': False, 'trimmed': True,
                            'spriteSourceSize': {'x': b[0], 'y': b[1], 'w': c.width, 'h': c.height}, 'sourceSize': {'w': im.width, 'h': im.height}}
        if not NO_DECOR:
            webp(atlas, f'{out}/decor_p{pg}.webp', 82)
            json.dump({'frames': frames, 'meta': {'image': f'decor_p{pg}.webp', 'size': {'w': PW, 'h': atlas.height}, 'scale': '1'}}, open(f'{out}/decor_p{pg}.json', 'w'))
    return {name: v[0] for name, v in pos.items()}
if PARTAGE:
    PG = pages_partagees()
    for m in monde['maps']:
        for d in m['decor']: d['p'] = PG[d['f']]
        m['pages'] = sorted({d['p'] for d in m['decor']})
    print('pages de décor partagées', max(PG.values()) + 1, 'images', len(PG))
# Calque « bord » : ce qu'une carte dessine au-delà de son cadre, posé par-dessus les cartes voisines.
#  - là où la voisine n'a rien (trou, ciel) : en entier (falaises et rochers qui débordent) ;
#  - ailleurs : en fondu sur BORD px (ombres, fonds de ciel… plus de coupure nette au raccord).
import numpy as np
BORD = 160
for (x, y), md in sorted(maps.items(), key=lambda t: (t[0][1], t[0][0])):
    tag = extra[(x, y)].get('tag', f'{x}_{y}')
    if tag not in entiers: continue
    full, ux, uy, (rx0, ry0, rx1, ry1), (sx0, sy0, sx1, sy1), write = entiers[tag]
    full = full.load()
    A = np.asarray(full).astype(np.float32)
    h, w = A.shape[:2]
    gx = ux + np.arange(w)[None, :]; gy = uy + np.arange(h)[:, None]
    hors = ~((gx >= sx0) & (gx < sx1) & (gy >= sy0) & (gy < sy1))   # pas déjà dans le sol de la carte
    # alpha du sol des autres cartes sous chaque pixel
    autre = np.zeros((h, w), np.float32)
    for t2, (s2, ox, oy) in sols.items():
        if t2 == tag: continue
        x0, y0 = max(ux, ox), max(uy, oy); x1, y1 = min(ux + w, ox + s2.width), min(uy + h, oy + s2.height)
        if x0 >= x1 or y0 >= y1: continue
        a2 = np.asarray(s2.crop((x0 - ox, y0 - oy, x1 - ox, y1 - oy))).astype(np.float32)
        sub = autre[y0 - uy:y1 - uy, x0 - ux:x1 - ux]; np.maximum(sub, a2, out=sub)
    d = np.maximum(np.maximum(rx0 - gx, gx - rx1), np.maximum(ry0 - gy, gy - ry1)).clip(0)
    f = np.where(autre < 128, 1.0, np.clip(1 - d / BORD, 0, 1)) * hors
    A[..., 3] *= f
    if not (A[..., 3] > 4).any(): continue
    im = Image.fromarray(A.astype(np.uint8), 'RGBA'); b = im.getbbox()
    im = im.crop(b)
    if write and 'bord' in CALQUES: webp(im, f'{out}/bord_{tag}.webp', 80)
    e = next(m for m in monde['maps'] if m['tag'] == tag)
    e['bord'] = {'x': ux + b[0], 'y': uy + b[1], 'w': im.width, 'h': im.height}
    print('bord', tag, im.size)
if sky is not None:
    sky.convert('RGB').save(f'{out}/ciel.webp', 'WEBP', quality=85, method=6); monde['sky'] = 'ciel.webp'
monde['mov'] = ''.join(mov)
json.dump(monde, open(f'{out}/monde.json', 'w'))
POOL.shutdown(wait=True)
