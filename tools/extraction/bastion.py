# bastion.py cartes_dir mondes_dir [apercu_dir]   (TEXDIR=dossier des <gfx>.png)
# Le Bastion des Douze (maquette « Ville », ligne de Mathis du 2026-11-07 : Ville : 1A 2A 3C 4B+4C 5A+5B+5C+5F 6A+6B 7A+7B 8A 9A 10B 11B).
# Notre ville, hors de la carte officielle, reliée à tous les Zaaps. Plan en archipel (10B) : une île centrale (place du Zaap,
# PNJ de service, taverne) et une île par nation, qui ne s'ouvrira que quand la nation sera libérée (4C). Tout est RECOMPOSÉ
# par nous avec les vraies pièces des villes de Dofus 3 (11B). Île centrale tout en Astrub, chaque nation sur son île (Mathis, 22:58).
#  cartes_dir = map_<id>.json des cartes officielles d'où viennent les pièces (bundles mapdata : Astrub world_729 dans
#               cache-dofus/astrub/cartes.tar ; Bonta 811, Brâkmar 812, Pandala 787, Frigost 206 dans cache-dofus/villes/)
#  mondes_dir = public/assets/mondes : écrit mondes/bastion (monde.json, sol_bastion.webp, decor_bastion.webp/json)
#               et les points du Bastion dans src/data/zones.json (bastion.open.bastion)
# Une seule carte de 4 x 4 places (n = [4, 4]) : le sol de l'île centrale en une image, les îles des nations en objets entiers.
import sys, os, json, math, random
from PIL import Image, ImageDraw, ImageFilter
cdir, mondes = sys.argv[1:3]
apercu = sys.argv[3] if len(sys.argv) > 3 else None
# particules officielles des cartes de Brâkmar (sortie de particules.py, voir LISEZMOI) : dossier, ou rien = pas de particules
PARTS = os.environ.get('PARTICULES_BRAKMAR')
sys.argv = ['arenes.py', cdir, '', mondes]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import arenes as A
from arenes import W, H, OX, OY, COLS, ROWS, MW, MH, gfx, styled, piece, ell
NS = 6   # 6 x 6 places : l'île de Brâkmar, en grand, tient à droite
CX, CY = OX + NS * MW / 2, OY + NS * MH / 2
BOX = (-1400, -1000, 1400, 1000)            # sol : l'île centrale et son dessous
A.BOX = BOX
ZONES = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../src/data/zones.json')

# --- Pièces officielles (cadres pris sur les planches des cartes, repère carte) ---------------------------------------
def R(x0, y0, x1, y1, s=0.6, b=(-1300, -1100)):   # cadre en pixels de la planche (échelle 0,6) -> repère de la carte
    return (x0 / s + b[0], y0 / s + b[1], x1 / s + b[0], y1 / s + b[1])
AS_ZAAP, AS_BANQUE, BONTA, BRAK, PANDA, FRIG = 191105026, 191104002, 212600837, 212861954, 206307844, 54170409
PIECES = {
    'zaap': (AS_ZAAP, R(800, 490, 955, 625)),
    'taverne': (AS_ZAAP, R(1080, 115, 1560, 700)),
    'maison_astrub': (AS_ZAAP, R(440, 170, 730, 545)),
    'tour_astrub': (AS_BANQUE, R(100, 10, 470, 580)),
    'bonta_maison': (BONTA, R(280, 800, 560, 1400)),
    'bonta_etal': (BONTA, R(695, 860, 905, 1080)),
    'bonta_etal2': (BONTA, R(505, 730, 720, 935)),
    'bonta_cypres': (BONTA, R(285, 620, 400, 800)),
    'brak_forge': (BRAK, R(850, 530, 1145, 765)),
    'brak_maison': (BRAK, R(215, 770, 615, 1085)),
    'panda_maison': (PANDA, R(750, 228, 1190, 705)),
    'panda_echoppe': (PANDA, R(1085, 685, 1265, 890)),
    'panda_orange': (PANDA, R(320, 785, 665, 1100)),
    'frig_maison': (FRIG, R(80, 300, 835, 820)),
    # Astrub seulement sur l'île centrale (Mathis, 2026-11-07 22:58 : pas de mélange au centre, les nations sur leurs îles)
    'as_maison_bleue': (191105024, R(1310, 140, 1495, 580)),
    'as_tour_maison': (191104000, R(1155, 655, 1395, 1100)),
    'as_boutique': (191105028, R(385, 110, 800, 600)),
    'as_tour_blason': (191105024, R(630, 60, 930, 810)),
    'as_forge_tour': (191106050, R(1030, 140, 1240, 620)),
    'as_etal_rouge': (191104000, R(135, 650, 330, 770)),
    'as_etal_orange': (191105028, R(1190, 955, 1310, 1085)),
    'as_charrette': (191105028, R(555, 520, 670, 630)),
    'as_arbre': (191104000, R(540, 800, 715, 1030)),
    'as_petit_arbre': (191106050, R(383, 675, 440, 820)),
    # Brâkmar (île en grand, Mathis 2026-11-07 23:55 : « j'aime bien », avec les petits effets du jeu)
    'bk_temple': (212862466, R(700, 70, 1560, 780)),
    'bk_hangar': (BRAK, R(400, 100, 930, 640)),
    'bk_maison_noire': (BRAK, R(225, 810, 520, 1085)),
    'bk_maison_haute': (BRAK, R(1180, 280, 1440, 700)),
    'bk_ascenseur': (BRAK, R(930, 190, 1140, 500)),
    'bk_fonderie': (BRAK, R(850, 530, 1100, 760)),
    'bk_maison_toit': (212861955, R(1000, 120, 1400, 660)),
    'bk_roche': (212861955, R(40, 580, 340, 950)),
    'bk_machine': (212862467, R(880, 180, 1360, 740)),
    'bk_banniere': (212862467, R(670, 160, 720, 330)),
    'bk_chaine': (212862467, R(180, 20, 260, 690)),
}
# coordonnées (carte) des cartes de Brâkmar, pour retrouver leurs particules
BK_CARTES = {212861954: (-26, 36), 212862466: (-25, 36), 212861955: (-26, 37), 212862467: (-25, 37)}

# Lumières officielles (halos, rayons) : Dofus les ajoute à l'image (mélange additif) ; posées telles quelles, elles font de grandes
# taches claires. Elles sont retirées des cartes sources avant d'en tirer les pièces (comme dans world_export.py).
LUMIERES = {305396, 404317, 57871, 57971, 806080, 305477, 60327, 36648, 39767, 42481, 44653, 805552, 402668, 806081, 62942, 63044}
def nettoyer(mid):
    r = json.load(open(f'{cdir}/map_{mid}.json')); md = r['mapData']
    R = {q['rid']: q.get('data') for q in r.get('references', {}).get('RefIds', [])}
    sd = md['sortableMaterialData'].get('shaderData', [])
    def melange(e):
        i = e.get('materialIndex', -1)
        if 0 <= i < len(sd):
            for p in (R.get(sd[i]['rid']) or {}).get('shaderParameters', []):
                if 'sourceFactor' in (R.get(p['rid']) or {}): return True
        return False
    def voile(g):   # grand rayon de soleil translucide (sans matériau de mélange dans les données)
        im = gfx(g)
        if im is None or im.width * im.height < 60000: return False
        a = im.resize((48, 48)).getchannel('A'); px = [v for v in a.getdata() if v > 10]
        return bool(px) and sum(px) / len(px) < 120
    garde, lum = [], []
    for e in md['sortableElements']:
        if voile(e['gfxId']): continue
        (lum if e['gfxId'] in LUMIERES or melange(e) else garde).append(e)
    md['sortableElements'] = garde; A._md[mid] = md
    LUMS[mid] = lum   # les lumières retirées : rajoutées en calque additif sur l'île de Brâkmar
LUMS = {}
for _m in {m for m, _ in PIECES.values()}: nettoyer(_m)

# --- Composition --------------------------------------------------------------------------------------------------
DIRT = [60985, 60986, 60987]                                  # terre battue d'Astrub
PAVES = [60993, 60994, 60995, 60996, 60997, 60998, 60999, 61000]   # pavés clairs de la place du Zaap d'Astrub
HERBE = [700851]; TOUFFES = [20503, 20499, 20636, 20635, 20504]
ILE = ell(1180, 660)          # l'île centrale
PLACE = ell(760, 420, 0, 30)  # la place pavée
# Bâtiments : pièce, ancre (bas-milieu), miroir, rayon bloqué (cases non marchables autour du pied), PNJ devant (décalage)
BATIMENTS = [
    ('taverne', (40, -420), False, 300, None),                      # la taverne : lieu de rencontre en multi (8A)
    ('maison_astrub', (-500, -360), False, 230, ('kerubim', (40, 90))),
    ('as_tour_blason', (650, -300), True, 200, ('otomai', (-30, 90))),
    ('as_boutique', (-1000, 200), False, 250, ('tissebelle', (140, 20))),
    ('as_maison_bleue', (990, 40), True, 190, ('goultard', (-60, 120))),
    ('as_forge_tour', (700, 470), True, 200, ('forgemage', (-170, -10))),     # quartier des artisans : place du forgemage (5B)
    ('as_etal_rouge', (-760, 400), False, 150, ('bouillotte', (110, -20))),
]
OBJETS = [('zaap', (0, 10), False, 120), ('as_etal_orange', (-330, 470), False, 100), ('as_charrette', (330, 470), True, 100),
          ('as_petit_arbre', (-300, -40), False, 50), ('as_petit_arbre', (300, -40), True, 50), ('as_arbre', (480, 180), False, 50)]
# Îles des nations (4C) : au loin, fermées (pont coupé) tant que la nation n'est pas libérée
ILES = [('Bonta', (0, -1520), [('bonta_maison', (-60, 40), False), ('bonta_etal', (190, 110), False)], PAVES),
        ('Brâkmar', (2420, -150), 'grand', None),     # île en grand : ile_brakmar()
        ('Pandala', (-2000, -150), [('panda_orange', (0, 60), False)], HERBE),
        ('Frigost', (0, 1250), [('frig_maison', (40, 420), False)], DIRT)]
# PNJ sans bâtiment : point du Bastion (Gawdien du Dofus, quêtes des Dofus 0.3 : sur la place, à gauche de l'arrivée)
PNJ_PLACE = {'gawdien': (-215, 138)}
# zaap : le milieu du dessin de l'arche (on clique dessus), pas son pied
POINTS = dict(arrivee=(0, 160), zaap=(0, -100))

def dessous(cv, f, ox, oy, rx, ry, cx=0, cy=0, haut=220):
    """Le dessous rocheux d'une île flottante (dessiné par nous) : roche brune, plus sombre en descendant."""
    d = Image.new('RGBA', cv.size); dr = ImageDraw.Draw(d)
    for i in range(haut, 0, -4):
        k = i / haut; c = (int(96 - 50 * k), int(72 - 40 * k), int(52 - 30 * k), 255)
        w = rx * (1 - 0.55 * k ** 1.6)
        dr.ellipse((cx - w - ox, cy - ry * (1 - 0.3 * k) + i * 1.0 - oy, cx + w - ox, cy + ry * (1 - 0.3 * k) + i * 1.0 - oy), fill=c)
    d = d.filter(ImageFilter.GaussianBlur(3)); cv.alpha_composite(d)

def composer():
    random.seed(12)
    P = {n: piece(m, r) for n, (m, r) in PIECES.items()}
    a = A.Arene(12)
    a.sol(ILE, HERBE + DIRT, 0, edge=0.06)
    a.sol(PLACE, DIRT, 1, edge=0.1)
    a.semis(PLACE, PAVES, 260, lvl=2, lo=0, hi=0.95)
    a.semis(ILE, TOUFFES, 40, lvl=3, lo=0.75, hi=1.0)
    pnj = {}
    for n, (x, y), f, r, q in BATIMENTS:
        a.put(P[n], x, y, f, bloque=r)
        if q: pnj[q[0]] = (x + q[1][0], y + q[1][1])
    for n, (x, y), f, r in OBJETS: a.put(P[n], x, y, f, bloque=r)
    pnj.update(PNJ_PLACE)
    # ponts coupés vers les îles des nations : planches qui s'arrêtent dans le vide, barrière au bout
    for nom, (ix, iy), _, _ in ILES:
        L = math.hypot(ix, iy); ux, uy = ix / L, iy / L
        t0 = 1 / math.sqrt((ux / 1180) ** 2 + (uy / 660) ** 2)   # bord de l'île centrale dans cette direction
        for t in range(int(t0 - 120), int(t0 + 240), 46): a.bg(63321 if (t // 46) % 2 else 63319, ux * t, uy * t, lvl=4)
        a.one(62767, ux * (t0 + 250), uy * (t0 + 250), 1 if ux * uy >= 0 else -1)
    return a, P, pnj

def ile(nom, cx, cy, pieces, sol_tiles, P):
    """Une île de nation, rendue en une image (sol, dessous, bâtiments) : posée comme un seul objet, non marchable."""
    rx, ry = 470, 270; b = A.Arene(hash(nom) % 1000)
    f = ell(rx, ry)
    els = []
    for r in range(-int(ry / 21.5) - 1, int(ry / 21.5) + 2):
        for c in range(-int(rx / 86) - 2, int(rx / 86) + 3):
            x = c * 86 + (r % 2) * 43; y = r * 21.5
            if f(x, y) <= 0.95 or (f(x, y) <= 1 and random.random() < 0.5): els.append(dict(g=random.choice(sol_tiles if sol_tiles is not PAVES else DIRT), x=x, y=y, sx=random.choice([1, -1]), sy=1, c=0xFF808080, k=(0, 0, y)))
    if sol_tiles is PAVES:
        for _ in range(60):
            x, y = random.uniform(-rx, rx), random.uniform(-ry, ry)
            if f(x, y) < 0.8: els.append(dict(g=random.choice(PAVES), x=x, y=y, sx=1, sy=1, c=0xFF808080, k=(0, 1, y)))
    n = 0
    for pn, (px, py), fl in pieces:
        for q in P[pn]:
            n += 1; els.append(dict(g=q['g'], x=px + (-q['x'] if fl else q['x']), y=py + q['y'], sx=-q['sx'] if fl else q['sx'], sy=q['sy'], c=q['c'], k=(1, py + q['fy'], q['o'], n)))
    xs, ys = [], []
    for e in els:
        im = gfx(e['g']); w, h = im.width * abs(e['sx']), im.height * abs(e['sy']); xs += [e['x'] - w / 2, e['x'] + w / 2]; ys += [e['y'] - h / 2, e['y'] + h / 2]
    box = (min(xs) - 10, min(ys) - 10, max(xs) + 10, max(ys) + 240)
    cv = Image.new('RGBA', (int(box[2] - box[0]), int(box[3] - box[1])))
    dessous(cv, f, box[0], box[1] - 30, rx, ry)
    cv.alpha_composite(A.rendre(els, box, None))
    cv.thumbnail((800, 800))   # au loin : réduite (elle reste nette à l'écran, le jeu la remet à sa taille)
    return cv, box

BK_ECHELLE = 0.75   # l'île de Brâkmar est rendue en grand puis posée aux 3/4 (elle tient dans le Bastion)
BK_POSE = [('bk_temple', (0, -330), False), ('bk_hangar', (-820, -60), False), ('bk_maison_toit', (780, -40), True),
           ('bk_machine', (950, 360), True), ('bk_maison_noire', (-760, 420), False), ('bk_maison_haute', (-1080, 200), False),
           ('bk_fonderie', (-260, 560), False), ('bk_ascenseur', (330, 600), False), ('bk_chaine', (-420, 120), False),
           ('bk_chaine', (430, 140), False), ('bk_banniere', (-150, 230), False), ('bk_banniere', (150, 250), True),
           ('bk_roche', (-1180, -180), False), ('bk_roche', (1180, -120), True)]
def _ancre(mid, rect):
    """Ancre (bas-milieu) d'une pièce dans le repère de sa carte : comme piece() d'arenes.py."""
    x0, y0, x1, y1 = rect; bx = []
    for b, e in A._boites(mid):
        if x0 <= (b[0] + b[2]) / 2 <= x1 and y0 <= (b[1] + b[3]) / 2 <= y1: bx.append(b)
    return (min(b[0] for b in bx) + max(b[2] for b in bx)) / 2, max(b[3] for b in bx)
def ile_brakmar(P):
    """L'île de Brâkmar en grand : plaques de métal, fissures de lave, Grand Temple, hangar, machine, fonderie…
    Rend (image, cadre, particules, lumières) ; particules et lumières dans le repère de l'île (échelle 1)."""
    random.seed(7)
    SOL = [67895, 67890, 67893]; GRAND = [303959, 304159, 304151]; LAVE = 68712; FEU = [68715, 68714]
    rx, ry = 1350, 780; f = ell(rx, ry); els = []; laves = []; feux = []
    for r in range(-int(ry / 21.5) - 1, int(ry / 21.5) + 2):
        for c in range(-int(rx / 86) - 2, int(rx / 86) + 3):
            x = c * 86 + (r % 2) * 43; y = r * 21.5
            if f(x, y) <= 0.95 or (f(x, y) <= 1 and random.random() < 0.5):
                els.append(dict(g=random.choice(SOL), x=x, y=y, sx=random.choice([1, -1]), sy=1, c=0xFF808080, k=(0, 0, y)))
    for _ in range(150):
        x, y = random.uniform(-rx, rx), random.uniform(-ry, ry)
        if f(x, y) < 0.8: els.append(dict(g=random.choice(GRAND), x=x, y=y, sx=random.choice([1, -1]), sy=1, c=0xFF808080, k=(0, 1, y)))
    for _ in range(22):
        x, y = random.uniform(-rx, rx), random.uniform(-ry, ry)
        if 0.3 < f(x, y) < 0.85: els.append(dict(g=LAVE, x=x, y=y, sx=1, sy=1, c=0xFF808080, k=(0, 2, y))); laves.append((x, y))
    n = 0; parts = []; lums = []
    data = json.load(open(f'{PARTS}/particules.json')) if PARTS else {}
    for pn, (px, py), fl in BK_POSE:
        for q in P[pn]:
            n += 1; els.append(dict(g=q['g'], x=px + (-q['x'] if fl else q['x']), y=py + q['y'], sx=-q['sx'] if fl else q['sx'], sy=q['sy'], c=q['c'], k=(1, py + q['fy'], q['o'], n)))
        mid, rect = PIECES[pn]; ax, ay = _ancre(mid, rect); x0, y0, x1, y1 = rect
        def ici(x, y): return (px + (ax - x if fl else x - ax), py + y - ay)
        # particules officielles de la pièce (étincelles, bulles, fumées) : elles suivent le bâtiment
        cx, cy = BK_CARTES[mid]
        for sy_ in data.get(f'{cx}_{cy}', []):
            lx, ly = sy_['x'] - (cx + 26) * MW, sy_['y'] - (cy - 36) * MH
            if x0 <= lx <= x1 and y0 <= ly <= y1:
                X, Y = ici(lx, ly); parts.append({**sy_, 'x': X, 'y': Y})
        # lumières officielles de la pièce (lueurs des enseignes, de la lave)
        for e in LUMS.get(mid, []):
            t = e['transform']; lx, ly = t['m31'], -t['m32']
            if x0 <= lx <= x1 and y0 <= ly <= y1:
                X, Y = ici(lx, ly); lums.append(dict(g=e['gfxId'], x=X, y=Y, sx=-t['m11'] if fl else t['m11'], sy=t['m22'], c=e['color']['value']))
    # bulles de lave sur nos fissures, braises au bord (systèmes officiels de Brâkmar, copiés)
    tous = [x for v in data.values() for x in v]
    bulle = next((x for x in tous if x['n'] == 'Bulles'), None); etin = next((x for x in tous if x['n'] == 'ETINCELLES_BasDroite'), None)
    for x, y in laves:
        if bulle: parts.append({**bulle, 'x': round(x, 1), 'y': round(y, 1)})
    for _ in range(14):
        x, y = random.uniform(-rx, rx) * 0.95, random.uniform(-ry, ry) * 0.95
        if 0.85 < f(x, y) < 1:
            els.append(dict(g=random.choice(FEU), x=x, y=y, sx=1, sy=1, c=0xFF808080, k=(1, y, 0, 9999)))
            if etin: parts.append({**etin, 'x': round(x, 1), 'y': round(y - 20, 1)})
    xs, ys = [], []
    for e in els:
        im = gfx(e['g'])
        if im is None: continue
        w, h = im.width * abs(e['sx']), im.height * abs(e['sy']); xs += [e['x'] - w / 2, e['x'] + w / 2]; ys += [e['y'] - h / 2, e['y'] + h / 2]
    box = (min(xs) - 40, min(ys) - 40, max(xs) + 40, max(ys) + 320)
    cv = Image.new('RGBA', (int(box[2] - box[0]), int(box[3] - box[1])))
    d = Image.new('RGBA', cv.size); dd = ImageDraw.Draw(d); ox, oy = box[0], box[1] - 30; haut = 340
    for i in range(haut, 0, -4):   # dessous : basalte sombre
        k = i / haut; w = rx * (1 - 0.55 * k ** 1.6)
        dd.ellipse((-w - ox, -ry * (1 - 0.3 * k) + i - oy, w - ox, ry * (1 - 0.3 * k) + i - oy), fill=(int(40 - 25 * k), int(32 - 22 * k), int(36 - 22 * k), 255))
    cv.alpha_composite(d.filter(ImageFilter.GaussianBlur(2)))
    cv.alpha_composite(A.rendre(els, box, None))
    cv.thumbnail((1400, 1400))
    return cv, box, parts, lums

def exporter():
    a, P, pnj = composer()
    out = f'{mondes}/bastion'; os.makedirs(out, exist_ok=True)
    cols, rows = NS * COLS, NS * ROWS
    def case(x, y):   # case de la grille du Bastion sous un point (repère du Bastion, centre = 0, 0)
        px, py = x + CX - OX, y + CY - OY
        r = round((py - H / 2) / (H / 2)); best, bd = -1, 9e9
        for rr in (r - 1, r, r + 1):
            if not 0 <= rr < rows: continue
            k = round((px - W / 2 - (rr % 2) * W / 2) / W)
            for kk in (k - 1, k, k + 1):
                if not 0 <= kk < cols: continue
                cx, cy = W / 2 + kk * W + (rr % 2) * W / 2, H / 2 + rr * H / 2; d = abs(px - cx) / (W / 2) + abs(py - cy) / (H / 2)
                if d < bd: bd, best = d, rr * cols + kk
        return best
    # sol : l'île centrale, son dessous, les ponts coupés (fond transparent : le ciel passe derrière)
    sol = Image.new('RGBA', (BOX[2] - BOX[0], BOX[3] - BOX[1]))
    dessous(sol, ILE, BOX[0], BOX[1] - 40, 1180, 660, haut=300)
    sol.alpha_composite(A.rendre([e for e in a.els if e['k'][0] == 0], BOX, None))
    sol.save(f'{out}/sol_bastion.webp', quality=82, method=6)
    variants, places = {}, []
    grand = {}
    for e in a.els:
        if 'grp' in e:
            b = gfx(e['g']).getbbox() or (0, 0, 0, 0)
            grand[e['grp']] = max(grand.get(e['grp'], 0), (b[2] - b[0]) * abs(e['sx']) * (b[3] - b[1]) * abs(e['sy']))
    for e in sorted([e for e in a.els if e['k'][0] == 1], key=lambda e: e['k']):
        key = (e['g'], e['c'], round(e['sx'], 3), round(e['sy'], 3))
        if key not in variants:
            im = styled(e)
            if im is None: continue
            variants[key] = ('d%d' % len(variants), im)
        bt = {'bt': 1 + e['grp']} if 'grp' in e and grand[e['grp']] > 30000 else {}
        places.append({'f': variants[key][0], 'x': round(e['x'] + CX, 1), 'y': round(e['y'] + CY, 1), 'c': case(e['fx'], e['fy']), 'o': e['o'], **bt})
    # îles des nations : une image chacune, posée en entier (z = agrandissement, elles sont rendues réduites)
    parts = []
    for nom, (ix, iy), pcs, tiles in ILES:
        k = 1
        if pcs == 'grand':
            im, box, bp, bl = ile_brakmar(P); k = BK_ECHELLE
        else: im, box = ile(nom, ix, iy, pcs, tiles, P)
        z = (box[2] - box[0]) * k / im.width
        key = ('ile', nom); variants[key] = ('ile_' + nom.lower().replace('â', 'a'), im)
        cx, cy = ix + k * (box[0] + box[2]) / 2, iy + k * (box[1] + box[3]) / 2
        ci = case(ix, iy + 200 if iy > 0 else iy - 300)
        places.append({'f': variants[key][0], 'x': round(cx + CX, 1), 'y': round(cy + CY, 1), 'c': ci, 'o': 0, 'z': round(z, 3)})
        if pcs == 'grand':
            for q in bp:   # particules : repère de l'île -> repère du monde
                parts.append({**q, 'x': round(CX + ix + k * q['x'], 1), 'y': round(CY + iy + k * q['y'], 1)})
            for q in bl:   # lumières : calque additif au-dessus de l'île
                lk = ('lum', q['g'], q['c'], round(q['sx'], 3), round(q['sy'], 3))
                if lk not in variants:
                    li = styled(dict(q, k=0))
                    if li is None: continue
                    variants[lk] = ('l%d' % len(variants), li)
                places.append({'f': variants[lk][0], 'x': round(CX + ix + k * q['x'], 1), 'y': round(CY + iy + k * q['y'], 1), 'c': ci, 'o': 1, 'z': k, 'b': 'a'})
    items = sorted(variants.values(), key=lambda v: -v[1].height); maxW = 4096; px = py = rowH = 0; pos = {}
    for name, im in items:
        b = im.getbbox() or (0, 0, 1, 1); w, h = b[2] - b[0] + 2, b[3] - b[1] + 2
        if px + w > maxW: px = 0; py += rowH; rowH = 0
        pos[name] = (px, py, b); px += w; rowH = max(rowH, h)
    atlas = Image.new('RGBA', (maxW, max(1, py + rowH))); frames = {}
    for name, im in items:
        ax, ay, b = pos[name]; atlas.paste(im.crop(b), (ax + 1, ay + 1)); w, h = b[2] - b[0], b[3] - b[1]
        frames[name] = {'frame': {'x': ax + 1, 'y': ay + 1, 'w': w, 'h': h}, 'rotated': False, 'trimmed': True,
                        'spriteSourceSize': {'x': b[0], 'y': b[1], 'w': w, 'h': h}, 'sourceSize': {'w': im.width, 'h': im.height}}
    atlas.save(f'{out}/decor_bastion.webp', quality=82, method=6)
    json.dump({'frames': frames, 'meta': {'image': 'decor_bastion.webp', 'size': {'w': maxW, 'h': atlas.height}, 'scale': '1'}}, open(f'{out}/decor_bastion.json', 'w'))
    # cases marchables : l'île centrale (un peu en retrait du bord), sauf sous les bâtiments
    mov = ['0'] * (cols * rows); vert = []
    for rr in range(rows):
        for kk in range(cols):
            x = OX + W / 2 + kk * W + (rr % 2) * W / 2 - CX; y = OY + H / 2 + rr * H / 2 - CY
            ok = ILE(x, y) <= 0.86 and not any(math.hypot(x - bx, (y - by) * 2) < r for bx, by, r in a.bloque)
            if ok: mov[rr * cols + kk] = '1'; vert.append((x, y))
    M = {'grid': {'w': W, 'h': H, 'ox': OX, 'oy': OY, 'cols': cols, 'rows': rows}, 'origin': [0, 0], 'sky': 'ciel.webp',
         'maps': [{'x': 0, 'y': 0, 'id': 0, 'sub': 0, 'tag': 'bastion', 'n': [NS, NS], 'inside': 1, 'ciel': 1, 'batiments': 1,
                   'sol': {'x': BOX[0] + CX, 'y': BOX[1] + CY, 'w': sol.width, 'h': sol.height}, 'decor': places}],
         'mov': ''.join(mov)}
    json.dump(M, open(f'{out}/monde.json', 'w'))
    if PARTS and parts:   # particules : un seul « monde-carte » (tag bastion), images de Brâkmar recopiées
        json.dump({'bastion': parts}, open(f'{out}/particules.json', 'w'))
        import shutil
        for fn in ('particules.webp', 'particules_atlas.json'): shutil.copy(f'{PARTS}/{fn}', f'{out}/{fn}')
        print('particules :', len(parts))
    pts = {k: case(*v) for k, v in POINTS.items()}
    pts['pnj'] = {k: case(*v) for k, v in pnj.items()}
    if apercu:
        os.makedirs(apercu, exist_ok=True)
        big = (-2600, -2300, 2600, 1800); cv = Image.new('RGBA', (big[2] - big[0], big[3] - big[1]), (14, 40, 52, 255))
        cv.alpha_composite(sol, (BOX[0] - big[0], BOX[1] - big[1]))
        allp = sorted(places, key=lambda p: (p['c'] // cols, p['c'] % cols, p['o']))
        inv = {v[0]: v[1] for v in variants.values()}
        for p in allp:
            im = inv[p['f']]
            if p.get('z'): im = im.resize((round(im.width * p['z']), round(im.height * p['z'])))
            cv.alpha_composite(im, (round(p['x'] - CX - big[0] - im.width / 2), round(p['y'] - CY - big[1] - im.height / 2)))
        d = ImageDraw.Draw(cv, 'RGBA')
        for x, y in vert: d.ellipse((x - big[0] - 4, y - big[1] - 2, x - big[0] + 4, y - big[1] + 2), fill=(80, 255, 80, 70))
        for k, (x, y) in list(pnj.items()) + list(POINTS.items()):
            d.ellipse((x - big[0] - 14, y - big[1] - 8, x - big[0] + 14, y - big[1] + 8), outline=(255, 60, 60, 255), width=4); d.text((x - big[0] + 16, y - big[1] - 8), k, fill=(255, 255, 0, 255))
        cv.convert('RGB').resize((cv.width // 3, cv.height // 3)).save(f'{apercu}/bastion.jpg', quality=85)
    print('bastion :', len(places), 'éléments,', len(variants), 'images, atlas', atlas.size, ', sol', sol.size, ',', len(vert), 'cases')
    return pts

if __name__ == '__main__':
    if not os.environ.get('TEXDIR'): raise SystemExit('TEXDIR=dossier des <gfx>.png (sortis des bundles mapgfx) : voir LISEZMOI')
    pts = exporter()
    Z = json.load(open(ZONES))
    b = Z.setdefault('bastion', {'name': 'Bastion des Douze', 'level': 1, 'open': {'world': 'bastion', 'start': [0, 0], 'aggro': 0, 'leash': 0,
                     'respawn': 60, 'checkpoints': [], 'subareas': {}}})
    b['open']['bastion'] = {'arrivee': pts['arrivee'], 'zaap': pts['zaap'], 'pnj': pts['pnj']}
    json.dump(Z, open(ZONES, 'w'), ensure_ascii=False, indent=1)
    print(pts)
