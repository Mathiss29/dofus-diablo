# export04.py mondes_dir [apercu_dir] [ids]   (lancé depuis le dossier de travail : tex/, cartes/, djs.json, grp_*.json)
# Les 11 arènes de la 0.4 (ligne « Arènes finales : 1A 2A », 10 nov. 2026) mises en vraies cartes du jeu :
# 10 cours façon Astrub (compositions cours6/squel/kwakwa/craq/chateau_ww.py) + Scarafeuilles = vraie salle agrandie (dilate.py).
# Même export que tools/extraction/arenes.py (sol en une image, décor en atlas posé case par case, cases marchables, points).
# En attendant Amakna, elles sont rangées sous le monde d'Astrub (lignes ajoutées en bas), ouvertes en partie de test.
import sys, os, json, math, random, runpy, importlib
os.environ.setdefault('TEXDIR', 'tex')
mondes = sys.argv[1]; apercu = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] != '-' else None
SEUL = sys.argv[3].split(',') if len(sys.argv) > 3 else None
import cour_auto
A = cour_auto.A
from PIL import Image, ImageDraw

# donjon officiel -> (tag, place [x, y] dans le monde d'Astrub, salle officielle du boss (id), sous-zone officielle)
DJ = json.load(open('djs.json')); DM = json.load(open('djs_monstres.json'))
ORDRE = ['45', '47', '48', '138', '13', '21', '32', '33', '18', '52', '17']
TAGS = {'45': 'arene_scarafeuilles', '47': 'arene_squelettes', '48': 'arene_tofus', '138': 'arene_gobs', '13': 'arene_bworks',
        '21': 'arene_forgerons', '32': 'arene_kwakwa', '33': 'arene_larves', '18': 'arene_craqueleurs', '52': 'arene_chateau_ww', '17': 'arene_terrier'}
PLACES = {k: (-4 + 4 * (i % 4), 18 + 4 * (i // 4)) for i, k in enumerate(ORDRE)}
POINTS_COUR = A.POINTS
POINTS_ILE = dict(arrivee=(0, 330), entrees=[(-780, 80), (780, 80), (0, 470)], boss=(0, -420), sortie=(0, -330), coffre=(170, -300))

SOL = {'21': '19888,34423,19887,19892,19890,19889,19891,7716,13919,7717,700202,20634', '52': '305396,14116,14117,14118,900,14115,34423,899,700836,20605,20604,39122',
       '13': '305477,39275,39278,39276,39274,39273,39279,39271,39277,33038,39272,39270', '33': '32050,19890,19889,19888,19887,19891,19892,34423,13919,7716,22521,22523',
       '45': '33194,32050,31100,31102,22523,31103,31101,31104,22521,33188,13678,32513', '17': '57871,41869,41877,39273,39271,39276,39272,39274,39270,39275,39277,39278',
       '48': '700053,12,15367,564,563,565,20636,20635,8808,20637,33322,15624', '47': '700202,700227,700205,700053,30,7716,700203,12,10636,1542,13302,34456',
       '138': '70629,305477,54995,39271,20636,39279,39289,30300,39275,39272,39273,64742', '32': '900009,900,700836,899,29012,29011,20500,20498,20504,20497',
       '18': '900009,900,700836,899,29012,29011,20500,20498,20504,20497,32085,20037,7590,38903,38904'}   # sols exclus des pièces (planches de la maquette)

def composer(k):
    """Rejoue la composition de la maquette et rend (arene, fond, points, marchable(x, y))."""
    import groupes
    groupes.SOL.clear(); groupes.SOL.update(int(x) for x in SOL[k].split(','))
    pris = {}
    def rendu(a, nom, fond, ciel=None, K=0.3, bord=(12, 12, 16), points=None): pris.update(a=a, fond=fond, points=points)
    cour_auto.rendu = rendu
    sys.argv = ['x', k]
    if k in ('48', '138', '13', '21', '33', '17'): runpy.run_path('cours6.py', run_name='__main__')
    elif k == '47': runpy.run_path('squel.py')
    elif k == '32': runpy.run_path('kwakwa.py')
    elif k == '18': runpy.run_path('craq.py')
    elif k == '52':
        g = runpy.run_path('chateau_ww.py'); pris.update(a=g['a'], fond=g['fond'])
    elif k == '45': return scarafeuilles()
    pts = pris.get('points') or POINTS_COUR
    if k in ('32', '18'):   # îles : l'herbe de l'île, sans couloirs d'entrée (les monstres arrivent par les bords)
        ile = A.ell(1000, 560)
        def ok(x, y, bl): return ile(x, y) <= 1 and not any(math.hypot(x - bx, (y - by) * 2) < r for bx, by, r in bl)
    else:
        def ok(x, y, bl): return A.marchable(x, y, bl)
    return pris['a'], pris['fond'], pts, ok

def scarafeuilles():
    """Grotte du rayon de lumière (salle officielle 94115840) 1,6 fois plus grande : le fond (sol recopié + parois reculées)
    devient l'image du sol ; les objets triables gardent leur case (agrandie) ; cases marchables = cases officielles agrandies."""
    import dilate, numpy as np
    mid, s = 94115840, 1.6
    random.seed(1)
    md, saute = dilate.charge(mid); cd = md['cellsData']
    W, H, OX, OY, COLS = 86, 43, -620, -490, 14
    def pc(c): r, kk = divmod(c, COLS); return OX + W / 2 + kk * W + (r % 2) * W / 2, OY + H / 2 + r * H / 2
    walk = [c for c, x in enumerate(cd) if x['mov'] and not x.get('nonWalkableDuringFight')]
    P = np.array([pc(c) for c in walk]); cx, cy = P.mean(0)
    def rayon(x, y): return math.hypot(x - cx, (y - cy) * 2)
    R = np.percentile([rayon(*p) for p in P], 92)
    a = A.Arene(45)
    def bouge(x, y, f=s): return (x - cx) * f, (y - cy) * f   # repère de l'arène : centre de la salle en 0, 0
    sol, murs = [], []
    for e in md['backgroundElements']:
        if saute('backgroundMaterialData', e): continue
        x, y = e['transform']['m31'], -e['transform']['m32']; im = dilate.img(e)
        if im is None or im.width > 1000 or im.height > 800: continue
        (sol if rayon(x, y) < R * 0.95 and im.width * im.height < 450 * 450 else murs).append((e, x, y))
    def bg(e, X, Y):
        t = e['transform']; a.els.append(dict(g=e['gfxId'], x=X, y=Y, sx=t['m11'], sy=t['m22'], c=e['color']['value'], k=(0, len(a.els), Y)))
    src = np.array([(x, y) for _, x, y in sol])
    for passe in range(2):
        pas = (110, 55) if passe == 0 else (70, 35)
        for gy in np.arange(cy - R * s / 2 - 60, cy + R * s / 2 + 60, pas[1]):
            for gx in np.arange(cx - R * s - 80, cx + R * s + 80, pas[0]):
                X = gx + random.uniform(-pas[0] / 2, pas[0] / 2); Y = gy + random.uniform(-pas[1] / 2, pas[1] / 2)
                if rayon(X, Y) > R * s: continue
                ox, oy = cx + (X - cx) / s, cy + (Y - cy) / s
                d = np.hypot(src[:, 0] - ox, (src[:, 1] - oy) * 2); j = int(np.argsort(d)[random.randint(0, 2)])
                if d[j] > 220: continue
                e, x, y = sol[j]
                im = dilate.img(e)
                if passe == 1 and im.width * im.height > 150 * 150: continue
                bg(e, X - cx, Y - cy)
    for e, x, y in sol + murs: bg(e, *bouge(x, y))
    for e in md['sortableElements']:
        if saute('sortableMaterialData', e): continue
        x, y = e['transform']['m31'], -e['transform']['m32']; im = dilate.img(e)
        if im is None or im.width > 1000 or im.height > 800: continue
        X, Y = bouge(x, y); fx, fy = bouge(*pc(e.get('cellId', 0)))
        t = e['transform']; a.n += 1
        a.els.append(dict(g=e['gfxId'], x=X, y=Y, sx=t['m11'], sy=t['m22'], c=e['color']['value'], fx=fx, fy=fy, o=e.get('innerCellRenderOrder', 0), k=(1, fy, 0, a.n)))
    ok_cases = {c for c in walk}
    def ok(x, y, bl):   # case officielle sous le point ramené à la taille d'origine
        ox, oy = cx + x / s, cy + y / s
        r = round((oy - OY - H / 2) / (H / 2)); best, bd = -1, 9
        for rr in (r - 1, r, r + 1):
            kk = round((ox - OX - W / 2 - (rr % 2) * W / 2) / W)
            for k2 in (kk - 1, kk, kk + 1):
                if 0 <= rr < 40 and 0 <= k2 < COLS:
                    px, py = pc(rr * COLS + k2); d = abs(ox - px) / (W / 2) + abs(oy - py) / (H / 2)
                    if d < bd: bd, best = d, rr * COLS + k2
        return best in ok_cases and bd <= 1.05
    bc = md['backgroundColor']['value']
    # points : arrivée en bas, entrées à gauche, à droite et en bas à gauche, boss au fond sous le rayon (maquette finale)
    pts = dict(arrivee=(0, 300), entrees=[(-800, 60), (800, -20), (-440, 330)], boss=(0, -330), sortie=(0, -230), coffre=(170, -250))
    return a, ((bc >> 16) & 255, (bc >> 8) & 255, bc & 255), pts, ok

W, H, OX, OY, COLS, ROWS, NS = A.W, A.H, A.OX, A.OY, A.COLS, A.ROWS, A.NS
MW, MH, CX, CY, BOX = A.MW, A.MH, A.CX, A.CY, A.BOX
BT0 = {}

def exporter(k):
    a, fond, POINTS, ok = composer(k)
    tag = TAGS[k]; sx, sy = PLACES[k]; nom = DJ[k]['nom']
    out = f'{mondes}/astrub'; M = json.load(open(f'{out}/monde.json'))
    X0, Y0 = M['origin']; ix, iy = sx - X0, sy - Y0; dx, dy = ix * MW, iy * MH
    ox, oy = dx + CX, dy + CY
    cols, rows = M['grid']['cols'], M['grid']['rows']
    need_rows = (iy + NS) * ROWS
    if need_rows > rows: M['mov'] += '0' * (need_rows - rows) * cols; M['grid']['rows'] = rows = need_rows
    sol = A.rendre([e for e in a.els if e['k'][0] == 0], BOX, fond)
    sol.convert('RGB').save(f'{out}/sol_{tag}.webp', quality=80, method=6)
    variants, places = {}, []
    mov = list(M['mov'])
    def case(x, y):
        px, py = x + CX - OX, y + CY - OY
        r = round((py - H / 2) / (H / 2)); best, bd = -1, 9e9
        for rr in (r - 1, r, r + 1):
            if not 0 <= rr < NS * ROWS: continue
            kk0 = round((px - W / 2 - (rr % 2) * W / 2) / W)
            for kk in (kk0 - 1, kk0, kk0 + 1):
                if not 0 <= kk < NS * COLS: continue
                cx, cy = W / 2 + kk * W + (rr % 2) * W / 2, H / 2 + rr * H / 2; d = abs(px - cx) / (W / 2) + abs(py - cy) / (H / 2)
                if d < bd: bd, best = d, (iy * ROWS + rr) * cols + ix * COLS + kk
        return best
    bt0 = max([p.get('bt', 0) for m in M['maps'] for p in m['decor'] if m['tag'] not in TAGS.values()] + [b[1] for b in BT0.values()] + [0]) + 1
    grand = {}
    for e in a.els:
        if 'grp' in e:
            b = A.gfx(e['g']).getbbox() or (0, 0, 0, 0)
            grand[e['grp']] = max(grand.get(e['grp'], 0), (b[2] - b[0]) * abs(e['sx']) * (b[3] - b[1]) * abs(e['sy']))
    for e in sorted([e for e in a.els if e['k'][0] == 1], key=lambda e: e['k']):
        key = (e['g'], e['c'], round(e['sx'], 3), round(e['sy'], 3))
        if key not in variants:
            im = A.styled(e)
            if im is None: continue
            variants[key] = ('d%d' % len(variants), im)
        bt = {'bt': bt0 + e['grp']} if 'grp' in e and grand[e['grp']] > 30000 else {}
        places.append({'f': variants[key][0], 'x': round(e['x'] + ox, 1), 'y': round(e['y'] + oy, 1), 'c': case(e['fx'], e['fy']), 'o': e['o'], **bt})
    BT0[tag] = (bt0, bt0 + getattr(a, 'ngrp', 0))
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
    vert = []
    for rr in range(NS * ROWS):
        for kk in range(NS * COLS):
            c = (iy * ROWS + rr) * cols + ix * COLS + kk
            x = OX + W / 2 + kk * W + (rr % 2) * W / 2 - CX; y = OY + H / 2 + rr * H / 2 - CY
            o = ok(x, y, a.bloque); mov[c] = '1' if o else '0'
            if o: vert.append((x, y))
    M['mov'] = ''.join(mov)
    sub = DM[k]['subs'][0]; mid = DJ[k]['maps'][-1]
    entree = {'x': sx, 'y': sy, 'id': mid, 'sub': sub, 'tag': tag, 'n': [NS, NS], 'inside': 1, 'batiments': 1,
              'sol': {'x': BOX[0] + ox, 'y': BOX[1] + oy, 'w': sol.width, 'h': sol.height}, 'decor': places}
    M['maps'] = [m for m in M['maps'] if m['tag'] != tag] + [entree]
    json.dump(M, open(f'{out}/monde.json', 'w'))
    pts = {kk: ([case(*p) for p in v] if kk == 'entrees' else case(*v)) for kk, v in POINTS.items()}
    if apercu:
        im = A.rendre(a.els, BOX, fond); d = ImageDraw.Draw(im, 'RGBA')
        for x, y in vert: d.ellipse((x - BOX[0] - 5, y - BOX[1] - 3, x - BOX[0] + 5, y - BOX[1] + 3), fill=(80, 255, 80, 90))
        for kk, v in POINTS.items():
            for x, y in (v if kk == 'entrees' else [v]): d.ellipse((x - BOX[0] - 16, y - BOX[1] - 9, x - BOX[0] + 16, y - BOX[1] + 9), outline=(255, 60, 60, 255), width=4)
        im.convert('RGB').resize((im.width // 3, im.height // 3)).save(f'{apercu}/{tag}.jpg', quality=84)
    print(tag, (sx, sy), len(places), 'éléments,', len(variants), 'images, atlas', atlas.size, ',', len(vert), 'cases')
    return tag, nom, pts

if __name__ == '__main__':
    if apercu: os.makedirs(apercu, exist_ok=True)
    res = {}
    for k in ORDRE:
        if SEUL and k not in SEUL: continue
        tag, nom, pts = exporter(k); res[k] = dict(tag=tag, nom=nom, **pts)
    old = json.load(open('arenes04_points.json')) if os.path.exists('arenes04_points.json') else {}
    old.update(res); json.dump(old, open('arenes04_points.json', 'w'), ensure_ascii=False, indent=1)
