# compo06.py : compositions des 5 arènes de la 0.6 (maquette « Arènes de la 0.6 », ligne « Arènes : 1A 2D 3A 4A+4C 5B 6B+6C 7A
# 8A+8B 9A+9C 10A+10C 11A », 13 nov. 2026). Lancé depuis un dossier de travail qui contient cartes/ (map_<id>.json des salles
# officielles, map_dump.py) et tex/ (<gfx>.png). Les pièces sont des groupes d'éléments officiels choisis sur les planches de la
# maquette (pieces.json : donjon -> liste de [carte, cadre]).
# Chaque fonction rend (arene, fond, points, ok) : ok(x, y, bloque) dit si une case est marchable.
#   python3 compo06.py apercu [blops draeg nyee ancestral labyrinthe]   -> vues/arene_<nom>.jpg
import json, sys, os, random, math
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
_ARGS = sys.argv[1:]
sys.argv = ['x', 'cartes', '-', '/tmp/none']; os.environ.setdefault('TEXDIR', 'tex')
exec(open(os.path.join(HERE, '..', 'arenes.py')).read().split('def grange():')[0])
def rendre(els, box, fond):   # comme arenes.py, mais une image qui dépasse en haut ou à gauche est coupée au lieu de planter
    x0, y0, x1, y1 = box; cv = Image.new('RGBA', (int(x1 - x0), int(y1 - y0)), fond + (255,) if fond else (0, 0, 0, 0))
    for e in sorted(els, key=lambda e: e['k']):
        im = styled(e)
        if im is None: continue
        px, py = round(e['x'] - x0 - im.width / 2), round(e['y'] - y0 - im.height / 2)
        if px < 0 or py < 0:
            if -px >= im.width or -py >= im.height: continue
            im = im.crop((max(0, -px), max(0, -py), im.width, im.height)); px, py = max(0, px), max(0, py)
            if im.width <= 0 or im.height <= 0: continue
        cv.alpha_composite(im, (px, py))
    return cv
PC = json.load(open(os.path.join(HERE, 'pieces.json')))


def P(n, i):
    mid, c = PC[n][i]; return piece(mid, boite=c)


_V = {}
def voile(g, im):
    """Grand voile translucide qui couvre toute une salle (lumière, brume) : sauté, il fait un rectangle une fois recopié."""
    if g not in _V:
        import numpy as np
        A = np.array(im.convert('RGBA'))[:, :, 3]; _V[g] = im.width > 300 and (A > 0).mean() > 0.97 and A.mean() < 140
    return _V[g]


def sol_carte(a, mid, lvl=0, offs=None, maxw=99999):
    """Recopie le fond (backgroundElements) d'une salle officielle à chaque décalage (dx, dy, miroir), dans l'ordre officiel des couches."""
    m = carte(mid)
    for ci, (dx, dy, fl) in enumerate(offs):
        for ii, e in enumerate(m['backgroundElements']):
            im = gfx(e['gfxId'])
            if im is None or im.width * abs(e['transform']['m11']) > maxw or voile(e['gfxId'], im): continue
            t = e['transform']; x = t['m31']; y = -t['m32']
            a.bg(e['gfxId'], dx + (-x if fl else x), dy + y, sx=(-t['m11'] if fl else t['m11']), lvl=lvl, c=e['color']['value'])
            a.els[-1]['sy'] = t['m22']; a.els[-1]['k'] = (0, lvl, ii, ci)


def base(seed, centre, autour, k=0.92, mw=1500):
    """Sol : 8 copies d'une salle autour, la salle du boss au centre."""
    a = Arene(seed)
    sol_carte(a, autour, 0, [(dx * MW * k, dy * MH * k, (dx + dy) % 2 == 1) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (dx, dy) != (0, 0)], maxw=mw)
    sol_carte(a, centre, 1, [(0, 0, False)], maxw=mw)
    return a


# repris d'arenes.py (cour ronde : l'ellipse et les couloirs des entrées)
def marchable(x, y, bloque):
    if any(math.hypot((x - bx) / 1.0, (y - by) * 2) < r for bx, by, r in bloque): return False
    if DEDANS(x, y) <= 1: return True
    for (ex, ey), (px, py) in zip(ENT, POINTS['entrees']):   # couloirs des entrées, jusqu'au point d'arrivée des monstres
        dx, dy = px - ex * 0.85, py - ey * 0.85; L = math.hypot(dx, dy)
        t = max(0, min(1, ((x - ex * 0.85) * dx + (y - ey * 0.85) * dy) / L / L))
        if math.hypot(x - ex * 0.85 - t * dx, (y - ey * 0.85 - t * dy) * 2) < 110: return True
    return False


def cour(x, y, bl): return marchable(x, y, bl)


def blops():   # 1A : clairière d'herbe et de pavés, anneau de rondins, 4 totems Blops comme abris
    d = 'blops2'; a = base(71, 166985730, 166986752)
    a.anneau([P(d, i) for i in (1, 7, 9, 21, 22, 24, 32, 35, 79, 81, 83, 95, 154)], 1060, 600, 22, ENT + [(0, -590)], ecart=230)
    for i, (x, y) in enumerate(ABRIS): a.put(P(d, [18, 25, 56, 131][i]), x, y, i % 2 == 1, bloque=90)
    for x, y, i, f in [(0, -760, 2, False), (-420, -700, 37, False), (420, -700, 155, True), (-860, -560, 11, False), (860, -560, 31, True),
                       (-1260, -120, 128, False), (1260, -120, 72, True), (-1220, 420, 61, False), (1220, 420, 69, True), (-700, 860, 8, False),
                       (700, 860, 144, True), (-1000, -420, 103, False), (1000, -420, 96, True)]: a.put(P(d, i), x, y, f)
    a.put(P(d, 45), -330, -560); a.put(P(d, 139), 330, -560, True)
    return a, (40, 60, 20), dict(POINTS), cour


def draeg():   # 3A : îlots d'herbe entre les mares, œufs de dragon comme abris
    d = 'draeg'; a = base(61, 199757824, 199756800, mw=800)
    a.anneau([P(d, i) for i in (8, 9, 13, 23, 24, 32, 47, 70, 77, 86, 101, 104, 106, 48)], 1080, 620, 16, ENT + [(0, -590)], ecart=260)
    for i, (x, y) in enumerate(ABRIS): a.put(P(d, [77, 101, 47, 86][i]), x, y, i % 2 == 1, bloque=100)
    for x, y, i, f in [(380, -720, 16, True), (-880, -520, 76, False), (880, -520, 88, True), (-1270, 100, 67, False), (1270, 100, 74, True),
                       (-760, 860, 84, False), (760, 860, 107, True), (-1150, -300, 80, False), (1150, -300, 76, True)]: a.put(P(d, i), x, y, f)
    for x, y in [(-200, -560), (200, -560), (-380, -470), (380, -470)]: a.put(P(d, 96), x, y)
    return a, (40, 120, 120), dict(POINTS), cour


def nyee():   # 5B : sol plein (dalles de pierre de l'antre sous les salles recopiées), toiles, souches, cocon au fond
    d = 'nyee'; a = Arene(81)
    random.seed(81)
    a.sol(lambda x, y: 0, [38030], -1, pas=(300, 150), alea=True)
    a.semis(lambda x, y: 0.5, [30297, 30300, 7715], 60, lvl=-1, lo=0, hi=1)
    k = 0.8
    sol_carte(a, 149164032, 0, [(dx * MW * k, dy * MH * k, (dx + dy) % 2 == 1) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (dx, dy) != (0, 0)], maxw=1500)
    sol_carte(a, 149165056, 1, [(0, 0, False)], maxw=1500)
    a.anneau([P(d, i) for i in (1, 5, 13, 36, 43, 30, 41, 35, 22)], 1060, 610, 16, ENT + [(0, -590)], ecart=250)
    for i, (x, y) in enumerate(ABRIS): a.put(P(d, [34, 40, 42, 44][i]), x, y, i % 2 == 1, bloque=100)
    for x, y, i, f in [(0, -760, 33, False), (-480, -700, 4, False), (480, -700, 20, True), (-940, -480, 10, False), (940, -480, 7, True),
                       (-1260, 120, 30, False), (1260, 120, 41, True), (-760, 860, 9, False), (760, 860, 17, True), (-300, -560, 25, False),
                       (300, -560, 23, True)]: a.put(P(d, i), x, y, f)
    return a, (20, 16, 12), dict(POINTS), cour


def ancestral():   # 7A : sous-bois sombre, rochers pointus en anneau, champignons comme abris
    d = 'ancestral'; a = base(91, 149688320, 149687296)
    a.anneau([P(d, i) for i in (0, 24, 26, 29, 56, 63, 71, 57, 88, 96)], 1060, 610, 16, ENT + [(0, -590)], ecart=250)
    for i, (x, y) in enumerate(ABRIS): a.put(P(d, [7, 37, 83, 95][i]), x, y, i % 2 == 1, bloque=90)
    for x, y, i, f in [(0, -780, 51, False), (-460, -720, 2, False), (460, -720, 16, True), (-900, -520, 21, False), (900, -520, 33, True),
                       (-1280, 100, 113, False), (1280, 100, 115, True), (-760, 860, 60, False), (760, 860, 66, True), (-320, -580, 27, False),
                       (320, -580, 13, True)]: a.put(P(d, i), x, y, f)
    return a, (14, 24, 12), dict(POINTS), cour


# --- Labyrinthe du Dragon Cochon (9A+9C : murets bas, grand pilier aux coins ; 10A+10C) -------------------------------------
LAB_N, LAB_S, LAB_DY = 5, 500, 40
def lab_pos(u, v): return ((u - v) * LAB_S * 0.5, (u + v - LAB_N + 1) * LAB_S * 0.25 + LAB_DY)
def lab_uv(x, y):
    a, b = x / (LAB_S * 0.5), (y - LAB_DY) / (LAB_S * 0.25)
    return (a + b) / 2 + (LAB_N - 1) / 2, (b - a) / 2 + (LAB_N - 1) / 2
LAB_PORTES = [(2, -0.5), (-0.5, 2), (LAB_N - 0.5, 2), (2, LAB_N - 0.5)]


def lab_murs(graine):
    """Un dédale 5 x 5 (exploration en profondeur depuis le centre, 6 murs en moins pour des boucles, centre ouvert).
    Rend les murs comme arêtes ((u, v), (u2, v2)) entre deux cases voisines."""
    rnd = random.Random(graine); N = LAB_N
    vu = {(2, 2)}; murs = set()
    for u in range(N):
        for v in range(N):
            if u < N - 1: murs.add(((u, v), (u + 1, v)))
            if v < N - 1: murs.add(((u, v), (u, v + 1)))
    pile = [(2, 2)]
    while pile:
        u, v = pile[-1]
        ns = [(u + du, v + dv) for du, dv in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= u + du < N and 0 <= v + dv < N and (u + du, v + dv) not in vu]
        if not ns: pile.pop(); continue
        n = rnd.choice(ns); vu.add(n); murs.discard(tuple(sorted([(u, v), n]))); pile.append(n)
    for _ in range(6): murs.discard(rnd.choice(sorted(murs)))
    for c in [(1, 2), (2, 1), (3, 2), (2, 3)]: murs.discard(tuple(sorted([(2, 2), c])))
    return sorted(murs)


# 10A (« le dédale change à chaque entrée », 16A) : plusieurs dédales tirés d'avance ; le jeu en prend un à l'entrée.
# Les murs du dedans de chaque dédale sont des éléments de décor marqués `lab` (affichés pour le dédale tiré), le tour et
# les piliers sont communs ; les cases bloquées par les murs du dedans de chaque dédale vont dans arene.murs.
LAB_GRAINES = [7, 11, 23, 31, 42, 57, 64, 88]


def lab_dedans(murs):
    """Milieu et sens de chaque mur du dedans."""
    segs = []
    for a1, b1 in murs:
        (x1, y1), (x2, y2) = lab_pos(*a1), lab_pos(*b1); segs.append(((x1 + x2) / 2, (y1 + y2) / 2, b1[0] != a1[0]))
    return segs


def lab_tour():
    """Le tour du dédale, avec une ouverture au milieu de chaque côté."""
    segs = []
    for k2 in range(LAB_N):
        for (u, v, f) in [(k2, -0.5, False), (k2, LAB_N - 0.5, False), (-0.5, k2, True), (LAB_N - 0.5, k2, True)]:
            if (u, v) in LAB_PORTES: continue
            x, y = lab_pos(u, v); segs.append((x, y, f))
    return segs


def lab_segments(murs): return lab_dedans(murs) + lab_tour()


def pres_mur(x, y, segs):   # à moins de 40 px d'un mur (distance écran, y compté double)
    for sx, sy, f in segs:
        dx, dy = lab_demi(f); L2 = dx * dx + dy * dy * 4
        t = max(-1, min(1, ((x - sx) * dx + (y - sy) * dy * 4) / L2))
        if math.hypot(x - sx - t * dx, (y - sy - t * dy) * 2) < 40: return True
    return False


def lab_demi(f):   # demi-arête d'un mur (le mur est perpendiculaire à l'écart entre ses deux cases)
    return (LAB_S * 0.25, -LAB_S * 0.125) if f else (LAB_S * 0.25, LAB_S * 0.125)


def labyrinthe():
    d = 'cochon'; a = Arene(101)
    random.seed(7)
    N = LAB_N
    def dans(x, y):
        u, v = lab_uv(x, y); return -1.0 < u < N and -1.0 < v < N
    # sol : vraies dalles crème du Labyrinthe (30784-30788) case par case, plus sombres vers les bords, noir autour (comme les salles officielles)
    for i in range(-48, 49):
        for j in range(-48, 49):
            x, y = (i - j) * 43, (i + j) * 21.5
            if BOX[0] - 60 < x < BOX[2] + 60 and BOX[1] - 60 < y < BOX[3] + 60 and dans(x, y):
                u, v = lab_uv(x, y); t = int(0x78 - max(abs(u - 2), abs(v - 2)) * 9)
                a.bg(random.choice([30785, 30785, 30784, 30787, 30788, 30786]), x, y, c=0xFF000000 | (t << 16) | (t << 8) | t)
                a.els[-1]['k'] = (0, 0, y, x)
    tour = lab_tour(); dedans = [lab_dedans(lab_murs(g)) for g in LAB_GRAINES]
    PIED = 40   # les murets sont posés par le milieu de leur image : on les descend pour que leur pied tombe sur la ligne du mur
    W1 = [P(d, i) for i in (23, 32, 34, 35, 36, 41)]
    def muret(segs, lab=None):
        for x, y, f in segs:
            dx, dy = lab_demi(f)
            for s_ in (-2, -1, 0, 1, 2):
                n = len(a.els); a.put(random.choice(W1), x + s_ * dx * 0.4, y + s_ * dy * 0.4 + PIED, flip=not f)
                if lab is not None:
                    for e in a.els[n:]: e['lab'] = lab
    muret(tour)
    for k, segs in enumerate(dedans): muret(segs, k)
    for u in range(N + 1):
        for v in range(N + 1):
            x, y = lab_pos(u - 0.5, v - 0.5); a.put(P(d, 28 if (u + v) % 2 else 40), x, y + PIED)
    for u, v in [(0, 0), (N, 0), (0, N), (N, N)]:
        x, y = lab_pos(u - 0.5, v - 0.5); a.put(P(d, 26), x, y + PIED)
    cx, cy = lab_pos(2, 2)
    a.put(P(d, 4), cx - 90, cy - 10); a.put(P(d, 54), cx + 90, cy - 10, True); a.put(P(d, 13), cx, cy - 70)
    # 10C : les monstres arrivent par les trois autres ouvertures et cherchent leur chemin ; arrivée du joueur dans le coin du bas
    pts = dict(arrivee=lab_pos(4, 4), entrees=[lab_pos(2, -0.8), lab_pos(-0.8, 2), lab_pos(4.8, 2)], boss=lab_pos(2, 2),
               sortie=lab_pos(1.7, 1.7), coffre=lab_pos(2.3, 2.3))
    def ok(x, y, bl):   # sans les murs du dedans (ils changent : arene.murs)
        if not dans(x, y) or pres_mur(x, y, tour): return False
        for u in range(N + 1):   # piliers
            for v in range(N + 1):
                px, py = lab_pos(u - 0.5, v - 0.5)
                if math.hypot(x - px, (y - py) * 2) < 50: return False
        return not any(math.hypot(x - bx, (y - by) * 2) < r for bx, by, r in bl)
    a.bloque.append((cx - 90, cy - 10, 60)); a.bloque.append((cx + 90, cy - 10, 60))
    a.dedans = dedans
    return a, (10, 9, 8), pts, ok


COMPOS = {'blops': blops, 'draeg': draeg, 'nyee': nyee, 'ancestral': ancestral, 'labyrinthe': labyrinthe}

if __name__ == '__main__' and _ARGS[:1] == ['apercu']:
    os.makedirs('vues', exist_ok=True)
    for n in _ARGS[1:] or COMPOS:
        a, fond, pts, ok = COMPOS[n]()
        im = rendre(a.els, BOX, fond); dr = ImageDraw.Draw(im, 'RGBA')
        for rr in range(NS * ROWS):
            for kk in range(NS * COLS):
                x = OX + W / 2 + kk * W + (rr % 2) * W / 2 - CX; y = OY + H / 2 + rr * H / 2 - CY
                if ok(x, y, a.bloque): dr.ellipse((x - BOX[0] - 5, y - BOX[1] - 3, x - BOX[0] + 5, y - BOX[1] + 3), fill=(80, 255, 80, 90))
        for k, v in pts.items():
            for x, y in (v if k == 'entrees' else [v]): dr.ellipse((x - BOX[0] - 16, y - BOX[1] - 9, x - BOX[0] + 16, y - BOX[1] + 9), outline=(255, 60, 60, 255), width=4)
        im.convert('RGB').resize((im.width // 2, im.height // 2)).save(f'vues/arene_{n}.jpg', quality=84); print(n)
