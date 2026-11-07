# arenes.py cartes_dir textures_dir mondes_dir [apercu_dir]
# Arènes des donjons (maquette « Donjons en vagues », ligne Donjons : 1B 2D … 16A) : une seule grande salle par donjon,
# CRÉÉE par nous avec les vraies pièces de Dofus 3 (sols, clôtures, murs, objets des salles officielles du donjon).
#  cartes_dir   = dossier des map_<id>.json des salles officielles (MonoBehaviour des bundles mapdata_assets_world_N)
#  textures_dir = dossier des bundles mapgfx_1x_*_assets_all.bundle (ou TEXDIR=dossier des <gfx>.png déjà sortis)
#  mondes_dir   = public/assets/mondes : écrit sol_/decor_arene_<donjon> dans le monde du donjon et complète son monde.json
#  apercu_dir   = (option) une image réduite de chaque arène, avec les cases marchables en vert
# Une arène fait 3 x 3 cartes : elle est rangée sous les intérieurs du monde (lignes ajoutées en bas de la grille, les numéros
# de case du reste ne bougent pas). Sa carte porte n = [3, 3] : le jeu la voit comme une seule carte sur ces 9 places.
# Points de l'arène (cases de la grande grille) écrits dans src/data/zones.json (open.donjons[].arene) : arrivée, 3 entrées
# des monstres, estrade du boss, portail de sortie et coffre.
import sys, os, json, math, random, glob, warnings
from PIL import Image, ImageDraw
warnings.filterwarnings('ignore')
cdir, tdir, mondes = sys.argv[1:4]
apercu = sys.argv[4] if len(sys.argv) > 4 else None
W, H, OX, OY, COLS, ROWS = 86, 43, -620, -490, 14, 40
MW, MH, NS = COLS * W, ROWS * H // 2, 3          # une arène = 3 x 3 cartes
CX, CY = OX + NS * MW / 2, OY + NS * MH / 2       # centre de l'arène dans le repère de sa première carte
BOX = (-1650, -1300, 1650, 1000)                   # ce qu'on dessine (repère de l'arène, centre = 0, 0)
ZONES = os.path.join(os.path.dirname(__file__), '../../src/data/zones.json')

# --- Textures -------------------------------------------------------------------------------------------------
TEXDIR = os.environ.get('TEXDIR')
_g = {}
def gfx(g):
    if g in _g: return _g[g]
    im = None
    if TEXDIR and os.path.exists(f'{TEXDIR}/{g}.png'): im = Image.open(f'{TEXDIR}/{g}.png').convert('RGBA')
    _g[g] = im
    return im
def charger(need):
    """Sans TEXDIR : lit les textures voulues dans les bundles (long)."""
    if TEXDIR: return
    import UnityPy
    UnityPy.config.FALLBACK_UNITY_VERSION = "6000.3.16f1"
    for b in glob.glob(f'{tdir}/mapgfx_*.bundle'):
        for o in UnityPy.load(b).objects:
            if o.type.name != 'Texture2D': continue
            d = o.read()
            if d.m_Name.isdigit() and int(d.m_Name) in need: _g[int(d.m_Name)] = d.image.convert('RGBA')
def styled(e):
    """Image d'un élément : échelle, miroir et couleur officielle (128 = neutre)."""
    im = gfx(e['g'])
    if im is None: return None
    if e['sx'] < 0: im = im.transpose(Image.FLIP_LEFT_RIGHT)
    if e['sy'] < 0: im = im.transpose(Image.FLIP_TOP_BOTTOM)
    w, h = im.size; nw, nh = max(1, round(w * abs(e['sx']))), max(1, round(h * abs(e['sy'])))
    if (nw, nh) != (w, h): im = im.resize((nw, nh), Image.BILINEAR)
    v = e['c']; r, g, b, a = (v >> 16) & 255, (v >> 8) & 255, v & 255, (v >> 24) & 255
    if (r, g, b, a) not in ((128, 128, 128, 255), (255, 255, 255, 255)):
        ch = im.split(); f = [r / 128, g / 128, b / 128]
        ch = [c.point(lambda q, k=k: min(255, int(q * k))) for c, k in zip(ch[:3], f)] + [ch[3].point(lambda q: q * a // 255)]
        im = Image.merge('RGBA', ch)
    return im

# --- Pièces des salles officielles -------------------------------------------------------------------------
_md = {}
def carte(mid):
    if mid not in _md: _md[mid] = json.load(open(f'{cdir}/map_{mid}.json'))['mapData']
    return _md[mid]
def centre_case(c):
    r, k = divmod(c, COLS)
    return OX + W / 2 + k * W + (r % 2) * W / 2, OY + H / 2 + r * H / 2
def _boites(mid):
    md = carte(mid); bs = []
    for e in md['sortableElements']:
        im = gfx(e['gfxId'])
        if im is None: continue
        t = e['transform']; w, h = im.width * abs(t['m11']), im.height * abs(t['m22']); x, y = t['m31'], -t['m32']
        bs.append(((x - w / 2, y - h / 2, x + w / 2, y + h / 2), e))
    return bs
def piece(mid, rect=None, boite=None, k=0.3):
    """Pièce (groupe d'éléments triables) d'une salle officielle : un mur, une tour, un tas d'objets. rect = les éléments
    dont le centre est dans ce rectangle ; boite = le groupe d'images qui se recouvrent (boîtes rétrécies de 30 %) dont
    le cadre est le plus proche (planches de choix de la maquette). Ancre = bas-milieu ; chaque élément garde sa case
    d'origine (pied) pour l'ordre d'affichage."""
    bs = _boites(mid)
    if rect:
        x0, y0, x1, y1 = rect; els = [e for b, e in bs if x0 <= (b[0] + b[2]) / 2 <= x1 and y0 <= (b[1] + b[3]) / 2 <= y1]
    else:
        n = len(bs); par = list(range(n))
        inner = [((b[0] * (1 - k) + b[2] * k), (b[1] * (1 - k) + b[3] * k), (b[2] * (1 - k) + b[0] * k), (b[3] * (1 - k) + b[1] * k)) for b, _ in bs]
        def f(i):
            while par[i] != i: par[i] = par[par[i]]; i = par[i]
            return i
        for i in range(n):
            a = inner[i]
            for j in range(i + 1, n):
                b = inner[j]
                if a[0] + 6 < b[2] and b[0] + 6 < a[2] and a[1] + 6 < b[3] and b[1] + 6 < a[3]: par[f(i)] = f(j)
        g = {}
        for i in range(n): g.setdefault(f(i), []).append(i)
        def cadre(ix): return (min(bs[i][0][0] for i in ix), min(bs[i][0][1] for i in ix), max(bs[i][0][2] for i in ix), max(bs[i][0][3] for i in ix))
        best = min(g.values(), key=lambda ix: sum(abs(u - v) for u, v in zip(cadre(ix), boite)))
        els = [bs[i][1] for i in best]
    out = []
    for e in els:
        t = e['transform']; fx, fy = centre_case(e['cellId'])
        out.append(dict(g=e['gfxId'], x=t['m31'], y=-t['m32'], sx=t['m11'], sy=t['m22'], c=e['color']['value'], fx=fx, fy=fy, o=e['innerCellRenderOrder']))
    if not out: raise SystemExit(f'pièce vide : {mid} {rect or boite}')
    # ancre = bas-milieu de l'image du groupe ; les pieds gardent leur écart entre eux (ordre interne officiel),
    # le plus bas est ramené juste au-dessus du bas de l'image (une case d'origine loin sous l'image faisait passer
    # l'objet devant le perso)
    def bord(p):
        im = gfx(p['g']); w, h = im.width * abs(p['sx']), im.height * abs(p['sy'])
        return p['x'] - w / 2, p['y'] - h / 2, p['x'] + w / 2, p['y'] + h / 2
    bx = [bord(p) for p in out]
    ax = (min(b[0] for b in bx) + max(b[2] for b in bx)) / 2; ay = max(b[3] for b in bx)
    dz = ay - 16 - max(p['fy'] for p in out)
    for p in out: p['x'] -= ax; p['y'] -= ay; p['fx'] -= ax; p['fy'] += dz - ay
    return out
def planche(d):
    """Pièces choisies sur les planches de la maquette : numéro -> (salle, cadre)."""
    return {i: piece(m, boite=b) for i, (m, b) in d.items()}

# --- Composition ------------------------------------------------------------------------------------------------
ell = lambda rx, ry, cx=0, cy=0: (lambda x, y: ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2)
class Arene:
    def __init__(s, seed):
        s.els = []; s.n = 0; random.seed(seed); s.bloque = []
    def bg(s, g, x, y, sx=1, lvl=0, c=0xFF808080): s.els.append(dict(g=g, x=x, y=y, sx=sx, sy=1, c=c, k=(0, lvl, y)))
    def one(s, g, x, y, sx=1, c=0xFF808080, pied=None, bloque=0):
        """Un objet seul, image centrée sur (x, y) ; pied = point du sol qui règle l'ordre d'affichage (bas de l'image par défaut)."""
        im = gfx(g)
        if im is None: return
        fy = y + im.height / 2 - 14 if pied is None else pied
        s.n += 1; s.els.append(dict(g=g, x=x, y=y, sx=sx, sy=1, c=c, fx=x, fy=fy, o=0, k=(1, fy, x, s.n)))
        if bloque: s.bloque.append((x, fy - bloque * 0.25, bloque))
    def put(s, p, x, y, flip=False, bloque=0):
        """Pose une pièce (groupe officiel) : ancre en (x, y). Elle s'efface d'un bloc devant le perso (bâtiment, bt)."""
        s.ngrp = getattr(s, 'ngrp', 0) + 1
        for q in p:
            s.n += 1
            s.els.append(dict(grp=s.ngrp, g=q['g'], x=x + (-q['x'] if flip else q['x']), y=y + q['y'], sx=-q['sx'] if flip else q['sx'], sy=q['sy'], c=q['c'],
                              fx=x + (-q['fx'] if flip else q['fx']), fy=y + q['fy'], o=q['o'], k=(1, y + q['fy'], q['o'], s.n)))
        if bloque: s.bloque.append((x, y - bloque * 0.3, bloque))
    def sol(s, f, tiles, lvl, edge=0.0, pas=(86, 43), alea=True):
        sx, sy = pas
        for r in range(int(BOX[1] / (sy / 2)) - 2, int(BOX[3] / (sy / 2)) + 3):
            for c in range(int(BOX[0] / sx) - 2, int(BOX[2] / sx) + 3):
                x = c * sx + (r % 2) * sx / 2; y = r * sy / 2; v = f(x, y)
                if v <= 1 - edge or (v <= 1 and random.random() < 0.5): s.bg(random.choice(tiles), x, y, random.choice([1, -1]) if alea else 1, lvl)
    def semis(s, f, tiles, n, lvl=2, lo=0.85, hi=1.05, sortable=False):
        k = t = 0
        while k < n and t < n * 400:
            t += 1; x, y = random.uniform(BOX[0], BOX[2]), random.uniform(BOX[1], BOX[3])
            if lo <= f(x, y) <= hi:
                if sortable: s.one(random.choice(tiles), x, y, random.choice([1, -1]))
                else: s.bg(random.choice(tiles), x, y, random.choice([1, -1]), lvl)
                k += 1
    def chemins(s, ent, tiles, lvl=3, k0=0.45):
        for ex, ey in ent:
            for t in range(25):
                k = k0 + t * 0.026
                for d in (-50, 0, 50): s.bg(random.choice(tiles), ex * k + (0 if abs(ex) > abs(ey) else d), ey * k + (d * 0.5 if abs(ex) > abs(ey) else 0), lvl=lvl)
    def anneau(s, pieces, rx, ry, n, trous, ecart=190, sens=True):
        for k in range(n):
            a = k / n * 2 * math.pi; x, y = rx * math.cos(a), ry * math.sin(a)
            if min(math.hypot(x - ex, y - ey) for ex, ey in trous) < ecart: continue
            p = random.choice(pieces)
            if isinstance(p, list): s.put(p, x, y, flip=(math.cos(a) * math.sin(a) > 0) == sens)
            else: s.one(p, x, y, 1 if (math.cos(a) * math.sin(a) > 0) == sens else -1)
    def estrade(s, cx, cy, n, a, b):
        for i in range(-n, n + 1):
            for j in range(-n, n + 1):
                if abs(i) + abs(j) <= n: s.bg(a if (i + j) % 2 else b, cx + (i - j) * 90, cy + (i + j) * 45, lvl=4)

# Disposition commune (la « cour ronde » choisie par Mathis, 16A) : grande ellipse, anneau bas percé de trois entrées
# (gauche, droite, devant) et d'une ouverture au fond, estrade du boss au fond, quatre abris au milieu.
DEDANS = ell(1000, 565)                       # cases marchables
ENT = [(-1000, 250), (1000, 250), (0, 640)]   # entrées des monstres (trous de l'anneau)
ABRIS = [(-430, -120), (430, -120), (-300, 220), (300, 220)]
ESTRADE = (0, -470)
POINTS = dict(arrivee=(0, 330), entrees=[(-1090, 270), (1090, 270), (0, 700)], boss=(0, -470), sortie=(0, -360), coffre=(170, -330))

def grange():
    G = 190316544   # grange_5, salle du Tournesol Affamé
    def R(a, b): return (2 * a[0] - 1840.5, 2 * a[1] - 1010.25, 2 * b[0] - 1840.5, 2 * b[1] - 1010.25)
    P = {n: piece(G, R(*r)) for n, r in dict(tour=((950, 150), (1260, 480)), meule=((730, 650), (880, 815)), arbre=((960, 560), (1160, 860)),
                                               cabane=((1240, 460), (1470, 820)), rocher=((1190, 480), (1330, 610)), buisson=((320, 470), (470, 610))).items()}
    GRASS = [700836, 899, 900]; DIRT = [60985, 60986, 60987, 60984]; TUFT = [20503, 20504, 20501, 20497, 20498, 20499]
    FLEURS = [700799, 700762, 63554, 32339, 44496]
    a = Arene(11); herbe = ell(1300, 760); terre = ell(900, 500)
    a.sol(herbe, GRASS, 0, edge=0.08); a.sol(terre, DIRT, 1, edge=0.15); a.semis(terre, TUFT, 40, lo=0.9, hi=1.08)
    a.chemins(ENT, DIRT)
    a.anneau([62767, 62766, 62767, 62766, 700399], 1030, 590, 56, ENT + [(0, -590)])
    a.estrade(*ESTRADE, 2, 63321, 63319)
    for x, y in ABRIS: a.one(33230, x, y, random.choice([1, -1]), bloque=110)
    a.one(63077, -60, -860)
    a.semis(lambda x, y: 1.05 if terre(x, y) < 1.1 else herbe(x, y), FLEURS, 26, lo=0, hi=1, sortable=True)
    for n, x, y, f in [('arbre', -1180, -260, False), ('tour', -780, -620, False), ('arbre', 1180, -260, True), ('cabane', 820, -640, True),
                       ('meule', -1230, 40, False), ('rocher', 1240, 40, True), ('buisson', -840, 860, False), ('arbre', -640, 990, False),
                       ('buisson', 840, 860, True), ('arbre', 640, 990, True), ('buisson', -1000, -470, False), ('buisson', 980, -480, True)]:
        a.put(P[n], x, y, f)
    for g, x, y in [(63557, -1120, -120), (63557, 1120, -120), (63540, -880, 520), (63543, 880, 520), (33204, -1260, 330), (700648, 1270, 330),
                    (32976, -420, -680), (54407, 420, -660), (63557, -300, 700), (63544, 300, 700)]:
        a.one(g, x, y, random.choice([1, -1]))
    a.semis(herbe, TUFT, 30, lo=0.82, hi=1.0)
    return a, (14, 12, 10)

def crypte():
    P = planche({8: (152834048, (353.5, -367.2, 746.5, 72.2)), 13: (152832000, (158.5, -448.8, 399.5, -81.2)), 14: (152833024, (-257.5, -310.2, 2.5, 19.8)),
                 15: (152832000, (-279.5, -423.8, -13.5, -133.8)), 17: (152834048, (-286.5, -463.2, -56.5, -147.2)), 22: (152834048, (212.5, -377.8, 432.5, -81.2)),
                 23: (152832000, (-8.5, -466.2, 225.5, -191.2)), 24: (152829952, (152.5, -488.8, 332.5, -132.2)), 25: (152834048, (-62.5, -168.2, 201.5, 67.8)),
                 28: (152829952, (260.5, -387.2, 450.5, -73.2)), 32: (152829952, (168.5, -103.8, 411.5, 126.2)), 35: (152833024, (341.5, -123.8, 545.5, 115.2)),
                 36: (152833024, (-481.5, -227.2, -325.5, 81.2)), 43: (152834048, (360.5, -8.2, 629.5, 147.8))})
    a = Arene(21); dalle = ell(1250, 720); centre = ell(880, 490)
    a.sol(dalle, [49235, 49233, 49225], 0, edge=0.1, pas=(172, 86))
    a.sol(centre, [49218, 49217, 49214, 49220, 49215], 1, edge=0.15, pas=(120, 60))
    a.semis(dalle, [13299, 38904, 13419], 40, lo=0.2, hi=1.0)
    a.chemins(ENT, [49218, 49217, 49214], k0=0.5)
    a.estrade(*ESTRADE, 2, 49217, 49215)
    # anneau : braseros d'os et bougies sur leur dalle, entrées libres
    a.anneau([P[32], P[35], P[43]], 1030, 590, 16, ENT + [(0, -590)], ecart=240)
    # fond : la grande arche, murs à torches et piliers ; portes de la crypte aux entrées des côtés
    a.put(P[8], 0, -660); a.put(P[17], -360, -620); a.put(P[23], 360, -620, True); a.put(P[15], -620, -560); a.put(P[13], 620, -560, True)
    a.put(P[28], -880, -430); a.put(P[36], 880, -430, True); a.put(P[24], -1180, 150); a.put(P[14], 1180, 150, True)
    for i, (x, y) in enumerate(ABRIS): a.put(P[25], x, y, i % 2 == 1, bloque=120)
    a.put(P[22], -760, 640); a.put(P[22], 760, 640, True); a.put(P[43], -1150, 470); a.put(P[32], 1150, 470, True)
    return a, (6, 5, 6)

def chateau():
    P = planche({0: (193725440, (91.5, 38.8, 723.5, 748.8)), 1: (193725440, (475.5, -93.2, 1073.5, 506.8)), 4: (193727488, (600.5, -283.8, 1196.5, 200.2)),
                 5: (193727488, (-1132.5, 384.8, -536.5, 868.8)), 16: (193727488, (-706.5, -852.2, -306.5, -304.2)), 22: (193727490, (-1079.5, -667.8, -703.5, -167.8)),
                 23: (193725440, (908.5, -558.8, 1276.5, -82.8)), 27: (193726464, (-975.5, 58.2, -544.5, 341.8)), 29: (193727488, (-1104.5, -194.8, -684.5, 62.8)),
                 43: (193725440, (594.5, -96.8, 1002.5, 113.8)), 44: (193728512, (-1357.5, -334.8, -949.5, -130.8)), 45: (193727490, (-1128.5, -539.8, -892.5, -191.8)),
                 46: (193725440, (40.5, 157.8, 276.5, 505.8)), 47: (193727488, (585.5, -481.2, 825.5, -161.2))})
    a = Arene(31); plage = ell(1360, 790); sable = ell(1180, 680)
    a.sol(plage, [17600], 0, edge=0.12)
    a.sol(sable, [17600], 1, edge=0.0)
    a.semis(plage, [19987], 6, lvl=2, lo=0.3, hi=0.9)
    a.estrade(*ESTRADE, 2, 17600, 17600)
    a.anneau([P[43], P[44], P[29], P[27]], 1030, 590, 14, ENT + [(0, -590)], ecart=260)
    a.put(P[4], -330, -650); a.put(P[5], 330, -650, True); a.put(P[16], 0, -760)
    a.put(P[0], -1060, -360); a.put(P[1], 1080, -360); a.put(P[22], -700, -560); a.put(P[23], 700, -560, True)
    a.put(P[16], -1230, 60); a.put(P[16], 1230, 60, True)
    for i, (x, y) in enumerate(ABRIS): a.put(P[[45, 46, 47, 45][i]], x, y, i % 2 == 1, bloque=90)
    a.put(P[27], -700, 680); a.put(P[29], 700, 680, True)
    return a, (40, 104, 132)

def cour():
    P = planche({2: (121374209, (-236.5, -919.2, 207.5, -211.2)), 3: (121374209, (466.5, -572.2, 910.5, 135.8)), 4: (121373185, (-796.5, -142.2, -384.5, 585.8)),
                 5: (121374211, (236.5, -845.2, 648.5, -117.2)), 10: (121373187, (274.5, 6.2, 728.5, 502.8)), 11: (121374211, (102.5, 92.2, 566.5, 540.8)),
                 17: (121375233, (360.5, 6.2, 728.5, 496.8)), 18: (121375233, (-490.5, -528.8, -77.5, -102.2)), 19: (121373187, (-533.5, -611.2, -107.5, -210.2)),
                 20: (121374211, (-742.5, -485.8, -388.5, -60.8)), 23: (121374211, (446.5, 6.2, 728.5, 482.8)), 37: (121373187, (-578.5, -390.8, -208.5, -76.8))})
    a = Arene(41); herbe = ell(1300, 760); terre = ell(900, 500)
    a.sol(herbe, [700836, 899, 900], 0, edge=0.08); a.sol(terre, [60985, 60986, 60987, 60984], 1, edge=0.15)
    a.semis(terre, [20503, 20504, 20501, 20502], 30, lo=0.9, hi=1.08)
    a.chemins(ENT, [60985, 60986, 60987, 60984])
    a.anneau([62767, 62766], 1030, 590, 56, ENT + [(0, -590)])
    a.estrade(*ESTRADE, 2, 63321, 63319)
    a.put(P[4], -170, -700); a.put(P[5], 260, -720, True); a.put(P[2], -720, -600); a.put(P[3], 720, -600, True)
    a.put(P[19], -1080, -330); a.put(P[20], 1080, -330, True); a.put(P[10], -1240, 120); a.put(P[11], 1240, 120, True)
    a.put(P[18], -760, 900); a.put(P[37], 760, 900, True); a.put(P[17], -1180, 560); a.put(P[23], 1180, 560, True)
    for x, y in ABRIS: a.one(33230, x, y, random.choice([1, -1]), bloque=110)
    a.semis(herbe, [20503, 20504, 20501], 26, lo=0.82, hi=1.0)
    return a, (14, 12, 10)

def cache():
    P = planche({0: (146672898, (555.5, -612.2, 1443.5, 319.8)), 1: (146672898, (-1378.5, -561.2, -490.5, 370.8)), 27: (146670592, (-837.5, -305.2, -372.5, 230.8)),
                 28: (146670592, (247.5, 75.8, 717.5, 483.8)), 29: (146672640, (-258.5, 110.8, 153.5, 544.8)), 30: (146672898, (-665.5, 188.2, -122.5, 515.8)),
                 32: (146672898, (275.5, -265.2, 715.5, 130.2)), 33: (146674688, (-299.5, 192.8, 108.5, 612.8)), 34: (146673664, (426.5, -314.2, 866.5, 45.8)),
                 35: (146672640, (-61.5, 166.8, 310.5, 584.8)), 36: (146670592, (36.5, -639.8, 390.5, -201.2)), 40: (146672898, (-880.5, 240.8, -408.5, 536.8)),
                 44: (146670592, (-179.5, -530.8, 168.5, -166.8)), 45: (146672898, (-364.5, 26.8, 27.5, 331.8)), 46: (146670592, (-295.5, -410.2, 16.5, -35.8)),
                 47: (146673664, (105.5, -430.8, 428.5, -70.8)), 6: (146672640, (429.5, -1378.8, 1033.5, -354.8)), 7: (146672640, (-645.5, -944.2, -41.5, 79.8))})
    a = Arene(51); plancher = ell(1300, 760)
    a.sol(plancher, [47381], 0, edge=0.25, pas=(640, 440), alea=False)
    a.anneau([P[30], P[40], P[44], P[45], P[29], P[35], P[46]], 1060, 610, 10, ENT + [(0, -590)], ecart=300)
    a.put(P[6], -420, -720); a.put(P[7], 420, -720, True); a.put(P[0], -1300, -230); a.put(P[1], 1300, -230)
    a.put(P[27], -820, -600); a.put(P[34], 820, -600, True); a.put(P[47], -1300, 420); a.put(P[28], 1300, 420, True)
    for i, (x, y) in enumerate(ABRIS): a.put(P[[36, 33, 32, 28][i]], x, y, i % 2 == 1, bloque=120)
    a.put(P[30], -760, 820); a.put(P[45], 760, 820, True)
    return a, (6, 5, 4)

ARENES = {   # tag -> (monde, nom du donjon, salle officielle d'où vient la sous-zone, composition)
    'arene_crypte': ('incarnam', 'Crypte de Kardorim', 'crypte_5', crypte),
    'arene_grange': ('astrub', 'Grange du Tournesol Affamé', 'grange_5', grange),
    'arene_chateau': ('astrub', 'Château Ensablé', 'chateau_6', chateau),
    'arene_cour': ('astrub', 'Cour du Bouftou Royal', 'cour_5', cour),
    'arene_cache': ('astrub', 'Cache de Kankreblath', 'cache_7', cache),
}
SEUL = os.environ.get('SEUL')
BT0 = {}   # tag -> premier et dernier numéro de bâtiment de l'arène

# --- Export -------------------------------------------------------------------------------------------------------
def rendre(els, box, fond):
    x0, y0, x1, y1 = box; cv = Image.new('RGBA', (int(x1 - x0), int(y1 - y0)), fond + (255,) if fond else (0, 0, 0, 0))
    for e in sorted(els, key=lambda e: e['k']):
        im = styled(e)
        if im is None: continue
        cv.alpha_composite(im, (round(e['x'] - x0 - im.width / 2), round(e['y'] - y0 - im.height / 2)))
    return cv
def marchable(x, y, bloque):
    if any(math.hypot((x - bx) / 1.0, (y - by) * 2) < r for bx, by, r in bloque): return False
    if DEDANS(x, y) <= 1: return True
    for (ex, ey), (px, py) in zip(ENT, POINTS['entrees']):   # couloirs des entrées, jusqu'au point d'arrivée des monstres
        dx, dy = px - ex * 0.85, py - ey * 0.85; L = math.hypot(dx, dy)
        t = max(0, min(1, ((x - ex * 0.85) * dx + (y - ey * 0.85) * dy) / L / L))
        if math.hypot(x - ex * 0.85 - t * dx, (y - ey * 0.85 - t * dy) * 2) < 110: return True
    return False

def exporter(tag, monde_nom, nom, salle, fn, slot):
    a, fond = fn()
    out = f'{mondes}/{monde_nom}'; M = json.load(open(f'{out}/monde.json'))
    X0, Y0 = M['origin']; sx, sy = slot; ix, iy = sx - X0, sy - Y0; dx, dy = ix * MW, iy * MH
    ox, oy = dx + CX, dy + CY   # repère arène -> repère du monde (carte)
    cols, rows = M['grid']['cols'], M['grid']['rows']
    need_rows = (iy + NS) * ROWS
    if need_rows > rows:   # lignes de cartes ajoutées en bas : les numéros de case du reste ne bougent pas
        M['mov'] += '0' * (need_rows - rows) * cols; M['grid']['rows'] = rows = need_rows
    # sol : tout le fond (sols, chemins, estrade) en une image
    sol = rendre([e for e in a.els if e['k'][0] == 0], BOX, fond)
    sol.convert('RGB').save(f'{out}/sol_{tag}.webp', quality=80, method=6)
    # décor : une image par (gfx, couleur, échelle) dans un atlas, posée à sa case (pied) pour l'ordre d'affichage
    variants, places = {}, []
    mov = list(M['mov'])
    def case(x, y):   # case de la grande grille sous un point de l'arène (-1 hors de l'arène)
        px, py = x + CX - OX, y + CY - OY
        r = round((py - H / 2) / (H / 2)); best, bd = -1, 9e9
        for rr in (r - 1, r, r + 1):
            if not 0 <= rr < NS * ROWS: continue
            k = round((px - W / 2 - (rr % 2) * W / 2) / W)
            for kk in (k - 1, k, k + 1):
                if not 0 <= kk < NS * COLS: continue
                cx, cy = W / 2 + kk * W + (rr % 2) * W / 2, H / 2 + rr * H / 2; d = abs(px - cx) / (W / 2) + abs(py - cy) / (H / 2)
                if d < bd: bd, best = d, (iy * ROWS + rr) * cols + ix * COLS + kk
        return best
    # bâtiments (fondu d'un bloc, tools/extraction/batiments.py) : chaque pièce posée dont une image est grande ; numéros après ceux du monde
    bt0 = max([p.get('bt', 0) for m in M['maps'] if not m['tag'].startswith('arene_') for p in m['decor']] + [b[1] for b in BT0.values()] + [0]) + 1
    grand = {}
    for e in a.els:
        if 'grp' in e:
            b = gfx(e['g']).getbbox() or (0, 0, 0, 0)   # taille sans le vide autour (comme le cadre de l'atlas)
            grand[e['grp']] = max(grand.get(e['grp'], 0), (b[2] - b[0]) * abs(e['sx']) * (b[3] - b[1]) * abs(e['sy']))
    for e in sorted([e for e in a.els if e['k'][0] == 1], key=lambda e: e['k']):
        key = (e['g'], e['c'], round(e['sx'], 3), round(e['sy'], 3))
        if key not in variants:
            im = styled(e)
            if im is None: continue
            variants[key] = ('d%d' % len(variants), im)
        bt = {'bt': bt0 + e['grp']} if 'grp' in e and grand[e['grp']] > 30000 else {}
        places.append({'f': variants[key][0], 'x': round(e['x'] + ox, 1), 'y': round(e['y'] + oy, 1), 'c': case(e['fx'], e['fy']), 'o': e['o'], **bt})
    BT0[tag] = (bt0, bt0 + getattr(a, 'ngrp', 0))
    # atlas en étagères
    items = sorted(variants.values(), key=lambda v: -v[1].height); maxW = 2048; px = py = rowH = 0; pos = {}
    for name, im in items:
        b = im.getbbox() or (0, 0, 1, 1); w, h = b[2] - b[0] + 2, b[3] - b[1] + 2
        if px + w > maxW: px = 0; py += rowH; rowH = 0
        pos[name] = (px, py, b); px += w; rowH = max(rowH, h)
    atlas = Image.new('RGBA', (maxW, max(1, py + rowH))); frames = {}
    for name, im in items:
        ax, ay, b = pos[name]; atlas.paste(im.crop(b), (ax + 1, ay + 1)); w, h = b[2] - b[0], b[3] - b[1]
        frames[name] = {'frame': {'x': ax + 1, 'y': ay + 1, 'w': w, 'h': h}, 'rotated': False, 'trimmed': True,
                        'spriteSourceSize': {'x': b[0], 'y': b[1], 'w': w, 'h': h}, 'sourceSize': {'w': im.width, 'h': im.height}}
    atlas.save(f'{out}/decor_{tag}.webp', quality=82, method=6)
    json.dump({'frames': frames, 'meta': {'image': f'decor_{tag}.webp', 'size': {'w': maxW, 'h': atlas.height}, 'scale': '1'}}, open(f'{out}/decor_{tag}.json', 'w'))
    # cases marchables : l'ellipse, les couloirs des entrées ; pas sous les abris
    vert = []
    for rr in range(NS * ROWS):
        for kk in range(NS * COLS):
            c = (iy * ROWS + rr) * cols + ix * COLS + kk
            x = OX + W / 2 + kk * W + (rr % 2) * W / 2 - CX; y = OY + H / 2 + rr * H / 2 - CY
            ok = marchable(x, y, a.bloque); mov[c] = '1' if ok else '0'
            if ok: vert.append((x, y))
    M['mov'] = ''.join(mov)
    ancien = next(m for m in M['maps'] if m['tag'] == salle)
    entree = {'x': sx, 'y': sy, 'id': ancien['id'], 'sub': ancien['sub'], 'tag': tag, 'n': [NS, NS], 'inside': 1, 'batiments': 1,
              'sol': {'x': BOX[0] + ox, 'y': BOX[1] + oy, 'w': sol.width, 'h': sol.height}, 'decor': places}
    M['maps'] = [m for m in M['maps'] if m['tag'] != tag] + [entree]
    json.dump(M, open(f'{out}/monde.json', 'w'))
    pts = {k: ([case(*p) for p in v] if k == 'entrees' else case(*v)) for k, v in POINTS.items()}
    if apercu:
        im = rendre(a.els, BOX, fond); d = ImageDraw.Draw(im, 'RGBA')
        for x, y in vert: d.ellipse((x - BOX[0] - 5, y - BOX[1] - 3, x - BOX[0] + 5, y - BOX[1] + 3), fill=(80, 255, 80, 90))
        for k, v in POINTS.items():
            for x, y in (v if k == 'entrees' else [v]): d.ellipse((x - BOX[0] - 16, y - BOX[1] - 9, x - BOX[0] + 16, y - BOX[1] + 9), outline=(255, 60, 60, 255), width=4)
        im.convert('RGB').resize((im.width // 2, im.height // 2)).save(f'{apercu}/{tag}.jpg', quality=84)
    print(tag, monde_nom, 'carte', slot, len(places), 'éléments,', len(variants), 'images, atlas', atlas.size, ', sol', sol.size, ',', len(vert), 'cases')
    return pts

# Places : sous les intérieurs, une ligne de cartes vide pour séparer, puis les arènes côte à côte (une carte vide entre deux)
PLACES = {'arene_crypte': ('incarnam', (-3, 17)), 'arene_grange': ('astrub', (-4, 4)), 'arene_chateau': ('astrub', (0, 4)),
          'arene_cour': ('astrub', (4, 4)), 'arene_cache': ('astrub', (8, 4))}
if __name__ == '__main__':
    if not TEXDIR: raise SystemExit('TEXDIR=dossier des <gfx>.png (sortis des bundles mapgfx) : voir LISEZMOI')
    if apercu: os.makedirs(apercu, exist_ok=True)
    Z = json.load(open(ZONES))
    for tag, (monde_nom, nom, salle, fn) in ARENES.items():
        if SEUL and tag not in SEUL.split(','): continue
        pts = exporter(tag, monde_nom, nom, salle, fn, PLACES[tag][1])
        d = next(d for d in Z[monde_nom]['open']['donjons'] if d['nom'] == nom)
        d['arene'] = {'tag': tag, **pts}
    json.dump(Z, open(ZONES, 'w'), ensure_ascii=False, indent=1)
