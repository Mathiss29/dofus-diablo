"""Passerelles de l'île des Wabbits (« Wabbits : 1B », île + 3 îlots reliés par des passerelles ; 0.4 suite : 10A).

Dans Dofus 3, l'île de la Cawotte et les îlots de la Couronne, des Tombeaux et de Waldo ne se touchent pas à pied. Ici, on les relie
par des passerelles en bois, comme les pontons du Port de Madrestam : pour chaque paire, le plus court passage sur l'eau le long
d'une diagonale de la grille (le sens des cases), 3 cases de large.
  - cases de la passerelle ouvertes (monde.json > movCartes) ; sur un emplacement de carte vide, une petite carte « pont » est posée
    (sinon le jeu ne sait plus où l'on est) ;
  - dessin : planches, poteaux et cordes, sur le sol d'une carte « pont » posée au-dessus des autres (dessus: 1), dans un
    emplacement libre à côté ; sous-zone 1600 « Passerelles de l'île » (sans monstres).
Usage : python3 tools/extraction/wabbits04/passerelles.py      (après monde_continent.py fusion de l'île) ; puis envoi.mjs.
"""
import os, json, math, random
from PIL import Image, ImageDraw, ImageFilter

ICI = os.path.dirname(os.path.abspath(__file__)); R = os.path.join(ICI, '..', '..', '..')
D = os.path.join(R, 'public/assets/mondes/astrub')
COLS, ROWS = 14, 40
SUB = 1600
PAIRES = [('24_-2', '24_-13'), ('24_-13', '21_-12'), ('24_-13', '27_-12')]   # Cawotte - Couronne, Couronne - Tombeaux, Couronne - Waldo
LIBRES = ['24_-11', '22_-13', '26_-13']   # emplacements vides où ranger le dessin de chaque passerelle

M = json.load(open(f'{D}/monde.json')); g = M['grid']; W, H, OX, OY, cols = g['w'], g['h'], g['ox'], g['oy'], g['cols']
MW, MH = COLS * W, ROWS * H // 2
X0, Y0 = M['origin']; mc = M['movCartes']
L = json.load(open(f'{ICI}/liste.json'))
maps = {m['tag']: m for m in M['maps']}
occupe = {}
for m in M['maps']:
    n = m.get('n', [1, 1])
    for i in range(n[0]):
        for j in range(n[1]): occupe[(m['x'] + i, m['y'] + j)] = m['tag']

def pix(k, r): return OX + W / 2 + k * W + (r % 2) * W / 2, OY + H / 2 + r * H / 2
def slot(k, r): return X0 + k // COLS, Y0 + r // ROWS
def local(m, k, r): return (r - (m['y'] - Y0) * ROWS) * COLS + (k - (m['x'] - X0) * COLS)
# diagonales de la grille : NE, NO, SE, SO (décalage selon la parité de la rangée)
DIRS = {'ne': lambda k, r: (k + r % 2, r - 1), 'no': lambda k, r: (k - 1 + r % 2, r - 1),
        'se': lambda k, r: (k + r % 2, r + 1), 'so': lambda k, r: (k - 1 + r % 2, r + 1)}
LAT = {'ne': ('no', 'se'), 'so': ('no', 'se'), 'no': ('ne', 'so'), 'se': ('ne', 'so')}

# cases marchables de l'île, par morceau d'un seul tenant
cases = {}
for k_, m in maps.items():
    if m.get('inside') or f"{m['x']},{m['y']}" not in L: continue
    s = mc.get(k_, ''); k0, r0 = (m['x'] - X0) * COLS, (m['y'] - Y0) * ROWS
    for i, ch in enumerate(s):
        if ch == '1': cases[(k0 + i % COLS, r0 + i // COLS)] = k_
def voisins(p):
    k, r = p; o = r % 2
    return [(k - 1 + o, r - 1), (k + o, r - 1), (k - 1 + o, r + 1), (k + o, r + 1), (k, r - 2), (k, r + 2), (k - 1, r), (k + 1, r)]
comp = {}; reste = set(cases); n = 0
while reste:
    d = reste.pop(); c = {d}; f = [d]
    while f:
        nf = []
        for q in f:
            for v in voisins(q):
                if v in reste: reste.discard(v); c.add(v); nf.append(v)
        f = nf
    for p in c: comp[p] = n
    n += 1
def morceau(tag):   # le plus grand morceau qui touche cette carte
    ids = [comp[p] for p, t in cases.items() if t == tag]
    return max(set(ids), key=ids.count)

def passage(a, b):
    """Plus court passage sur l'eau d'un morceau à l'autre, en ligne droite le long d'une diagonale ; 3 cases de large libres."""
    best = None
    bords = [p for p, c in comp.items() if c == a]
    for p in bords:
        for nom, f in DIRS.items():
            q, chemin = p, [p]
            for _ in range(70):
                q = f(*q); chemin.append(q)
                c = comp.get(q)
                if c == b: break
                if c is not None: chemin = None; break
            else: chemin = None
            if not chemin or len(chemin) < 4: continue
            if best is None or len(chemin) < len(best[1]): best = (nom, chemin)
    return best

def dessiner(nom, chemin, img, x0, y0):
    """Planches posées en travers, côté dans l'ombre, poteaux plantés dans l'eau, cordes de chaque côté."""
    rnd = random.Random(len(chemin) * 7 + ord(nom[0]))
    d = ImageDraw.Draw(img)
    (ax, ay), (bx, by) = pix(*chemin[0]), pix(*chemin[-1])
    L_ = math.hypot(bx - ax, by - ay); ux, uy = (bx - ax) / L_, (by - ay) / L_
    lat = DIRS[LAT[nom][0]]; lx, ly = pix(*lat(*chemin[0])); vx, vy = lx - ax, ly - ay   # une case de côté
    vl = math.hypot(vx, vy); vx, vy = vx / vl, vy / vl
    hw = vl * 1.45   # demi-largeur du tablier
    P = lambda t, s, dz=0: (ax + ux * t + vx * s - x0, ay + uy * t + vy * s - y0 + dz)
    EP = 9   # épaisseur des planches (px vers le bas)
    # poteaux (avant le tablier : on n'en voit que le bas)
    t = 30
    while t < L_ - 20:
        for s in (-hw + 6, hw - 6):
            px_, py_ = P(t, s)
            for i in range(40):
                a = int(200 * (1 - i / 40))
                d.line([(px_ - 4, py_ + i), (px_ + 4, py_ + i)], fill=(58, 40, 22, a))
        t += 110
    # côté du tablier (dans l'ombre)
    d.polygon([P(0, hw), P(L_, hw), P(L_, hw, EP), P(0, hw, EP)], fill=(66, 46, 26, 255))
    d.polygon([P(0, -hw), P(L_, -hw), P(L_, -hw, EP), P(0, -hw, EP)], fill=(66, 46, 26, 255))
    d.polygon([P(0, -hw), P(0, hw), P(0, hw, EP), P(0, -hw, EP)], fill=(66, 46, 26, 255))
    # dessous puis planches
    d.polygon([P(0, -hw), P(L_, -hw), P(L_, hw), P(0, hw)], fill=(52, 36, 20, 255))
    pas, t = 15, 0
    while t < L_:
        e = min(pas - 2.5, L_ - t)
        j = rnd.uniform(-1.5, 1.5)
        base = rnd.choice([(150, 112, 62), (139, 102, 56), (160, 121, 68), (128, 95, 52)])
        c = tuple(max(0, min(255, v + rnd.randint(-8, 8))) for v in base) + (255,)
        q = [P(t, -hw + j), P(t + e, -hw + j), P(t + e, hw + j), P(t, hw + j)]
        d.polygon(q, fill=c, outline=(78, 54, 30, 255))
        if rnd.random() < 0.35:   # clous
            for s in (-hw * 0.7, hw * 0.7):
                cx, cy = P(t + e / 2, s); d.ellipse([cx - 1.2, cy - 1.2, cx + 1.2, cy + 1.2], fill=(60, 50, 40, 255))
        t += pas
    # cordes et petits poteaux de chaque côté
    for s in (-hw + 3, hw - 3):
        t, prev = 0, None
        while t <= L_ + 1:
            px_, py_ = P(min(t, L_), s)
            d.rectangle([px_ - 2, py_ - 18, px_ + 2, py_], fill=(92, 64, 36, 255), outline=(52, 36, 20, 255))
            if prev:
                mx, my = (prev[0] + px_) / 2, (prev[1] + py_) / 2 - 18 + 6
                d.line([(prev[0], prev[1] - 16), (mx, my), (px_, py_ - 16)], fill=(196, 170, 120, 255), width=2)
            prev = (px_, py_); t += 55

# sous-zone des passerelles (sans monstres)
Zp = os.path.join(R, 'src/data/zones.json'); Z = json.load(open(Zp)); subs = Z['astrub']['open']['subareas']
subs[str(SUB)] = {'name': "Passerelles de l'île", 'level': 45, 'monsters': [], 'groupsPerMap': 0, 'groupSize': [3, 6], 'essai': True,
                  'region': 'Île des Wabbits'}
deja = [m['tag'] for m in M['maps'] if m['tag'].startswith('pont_wabbits')]
if deja: raise SystemExit(f'passerelles déjà posées : {deja}')
for i, ((ta, tb), libre) in enumerate(zip(PAIRES, LIBRES)):
    a, b = morceau(ta), morceau(tb)
    nom, chemin = passage(a, b)
    # les cases de la passerelle : le chemin, une case de chaque côté, et une de plus dans les terres aux deux bouts
    f = DIRS[nom]; arriere = DIRS[{'ne': 'so', 'so': 'ne', 'no': 'se', 'se': 'no'}[nom]]
    chemin = [arriere(*chemin[0])] + chemin + [f(*chemin[-1])]
    ouvre = set()
    for p in chemin:
        ouvre.add(p)
        for l in LAT[nom]: ouvre.add(DIRS[l](*p))
    # dessin
    xs = [pix(*p)[0] for p in ouvre]; ys = [pix(*p)[1] for p in ouvre]
    x0, y0 = min(xs) - W * 2, min(ys) - H * 2
    img = Image.new('RGBA', (int(max(xs) - x0 + W * 2), int(max(ys) - y0 + H * 3)), (0, 0, 0, 0))
    dessiner(nom, chemin, img, x0, y0)
    ombre = img.split()[3].filter(ImageFilter.GaussianBlur(6)).point(lambda v: v * 0.35)
    fond = Image.new('RGBA', img.size, (0, 0, 0, 0)); fond.putalpha(ombre)
    fond = Image.alpha_composite(Image.new('RGBA', img.size, (0, 0, 0, 0)), fond).transform(img.size, Image.AFFINE, (1, 0, -8, 0, 1, -10))
    img = Image.alpha_composite(fond, img)
    tag = f'pont_wabbits_{i}'
    sx, sy = map(int, libre.split('_'))
    if (sx, sy) in occupe: raise SystemExit(f'emplacement {libre} déjà pris')
    occupe[(sx, sy)] = tag
    img.save(f'{D}/sol_{tag}.webp', 'WEBP', quality=88, method=6)
    M['maps'].append({'x': sx, 'y': sy, 'id': 0, 'sub': SUB, 'tag': tag, 'dessus': 1, 'batiments': 1, 'essai': 1, 'pages': [], 'decor': [],
                      'sol': {'x': round(x0), 'y': round(y0), 'w': img.width, 'h': img.height}})
    mc[tag] = '0' * (COLS * ROWS)
    # cases ouvertes : sur la carte de leur emplacement (une petite carte « pont » sur un emplacement vide)
    vides = 0
    for (k, r) in sorted(ouvre):
        s = slot(k, r); t = occupe.get(s)
        if t is None:
            t = f'pont_wabbits_{i}_{s[0]}_{s[1]}'.replace('-', 'm'); occupe[s] = t; vides += 1
            M['maps'].append({'x': s[0], 'y': s[1], 'id': 0, 'sub': SUB, 'tag': t, 'dessus': 1, 'batiments': 1, 'essai': 1, 'pages': [], 'decor': [],
                              'sol': {'x': OX + (s[0] - X0) * MW, 'y': OY + (s[1] - Y0) * MH, 'w': 2, 'h': 2}})
            Image.new('RGBA', (2, 2), (0, 0, 0, 0)).save(f'{D}/sol_{t}.webp', lossless=True)
            mc[t] = '0' * (COLS * ROWS)
        m = next(x for x in M['maps'] if x['tag'] == t)
        li = local(m, k, r); s_ = mc[t]; mc[t] = s_[:li] + '1' + s_[li + 1:]
    print(f'{ta} -> {tb} : {nom}, {len(chemin)} cases de long, {len(ouvre)} ouvertes, image {img.size}, {vides} emplacement(s) vide(s)')
json.dump(M, open(f'{D}/monde.json', 'w'))
open(Zp, 'w').write(json.dumps(Z, ensure_ascii=False, indent=1) + '\n')
