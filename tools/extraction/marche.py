# marche.py cartes_dir mondes_dir [apercu_dir]   (TEXDIR=dossier des <gfx>.png)
# Le Marché couvert du Bastion des Douze (maquette « Magasin : » du 2026-11-12, 1A + 13A-13F) : une grande salle CRÉÉE par nous
# avec les vraies pièces de Dofus 3, tout en Astrub comme l'île centrale :
#  - murs, poteaux, fenêtres et porte en arche d'un intérieur d'Astrub (192675846, maison de la Cité près de l'Hôtel de vente),
#    répétés le long des deux murs du fond ; sol de dalles claires bordé de planches (même salle) ;
#  - les trois étals officiels des Hôtels de vente d'Astrub (ressources 191104004, consommables 191102976, équipements 191106052) :
#    Otomaï, Mère Bouillotte et Goultard derrière le leur ; l'étal rayé (191105028) pour Tissebelle ; une place pour le
#    Responsable de la boutique (13E) près de la charrette.
# Kerubim attend dehors, à la porte du Marché (13F) : l'Hôtel de vente des cosmétiques d'Astrub (pièce « as_boutique » de bastion.py).
#  cartes_dir = map_<id>.json des cartes ci-dessus (bundles world_729, 735 de cache-dofus/astrub/cartes.tar, map_dump.py)
#  mondes_dir = public/assets/mondes : écrit sol_marche.webp, decor_marche.webp/json dans mondes/bastion et ajoute la salle
#               (tag « marche », 3 x 3 places, sous l'archipel) à mondes/bastion/monde.json ;
#               dans src/data/zones.json : la porte (bastion.open.portes) et les cases des PNJ du Marché (bastion.open.bastion.pnj :
#               cases de la salle « marche », la place « responsable » est gardée pour le Responsable de la boutique, 13E) ;
#               dans src/data/quetes.json : carte et case des marchands (marche) et de Kerubim (dehors).
# À relancer APRÈS bastion.py (qui réécrit monde.json et les PNJ du Bastion).
import sys, os, json, math, random
from PIL import Image, ImageDraw
cdir, mondes = sys.argv[1:3]
apercu = sys.argv[3] if len(sys.argv) > 3 else None
sys.argv = ['arenes.py', cdir, '', mondes]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import arenes as A
from arenes import W, H, OX, OY, COLS, ROWS, MW, MH, gfx, styled, piece
NS = 3                                   # la salle : 3 x 3 places
CX, CY = OX + NS * MW / 2, OY + NS * MH / 2
BOX = (-1500, -1250, 1500, 800)
A.BOX = BOX
SLOT = (0, 9)                            # place de la salle dans la grille du Bastion (l'archipel tient sur 8 x 8, une rangée vide)
ZONES = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../src/data/zones.json')
def R(x0, y0, x1, y1, s=0.6, b=(-1300, -1100)): return (x0 / s + b[0], y0 / s + b[1], x1 / s + b[0], y1 / s + b[1])

# --- La salle : un losange (demi-largeur HX, demi-hauteur HY), murs sur les deux bords du fond ----------------------------
SALLE = 192675846
PAS_G = (-387, 195.4)                    # un pan du mur gauche (poteau à poteau, deux fenêtres)
PAS_D = (129, 66.4)                      # un pan du mur droit (un panneau)
NG, ND = 3, 9                            # 3 pans à gauche, 9 à droite (dont la porte en arche)
HX = NG * -PAS_G[0]                      # 1161
HY = HX / 2
FOND = (0, -HY - 20)                    # pied du poteau du coin du fond
SOL = lambda x, y: abs(x) / HX + abs(y - FOND[1] - HY) / HY
# éléments des murs, relatifs au poteau du coin (repère de la salle officielle : poteau 63104 en -19.5, -269.2)
P0 = (-19.5, -269.2)
def rel(x, y): return (x - P0[0], y - P0[1])
MUR_G = [(63086, rel(-89.5, -233.2), 0xff71674d), (63114, rel(-73.5, -261.8), 0xff75715f), (63107, rel(-112.5, -249.2), 0xff787360),
         (63093, rel(-170.5, -189.2), 0xff75705f), (63093, rel(-256.5, -146.2), 0xff7f7661), (63107, rel(-284.5, -163.2), 0xff8d8066),
         (63086, rel(-347.5, -104.2), 0xff71674d), (63114, rel(-331.5, -134.8), 0xff9c896a), (63104, rel(-406.5, -73.8), 0xff9c866b)]
PANNEAU_D = [(63088, rel(44.5, -233.2), 0xff71674d), (63104, rel(109.5, -202.8), 0xff817b62)]
PORTE_D = [(63116, (197, 155.4), 0xff7a7560), (63113, (190, 15), 0xff827c62), (63095, (203, 24), 0xff807a61), (63095, (191, 32), 0xff807a61),
           (63104, (258, 131), 0xff7a7560)]
BOUT_D = [(63103, (388, 196.4), 0xff6b685d), (63097, (360, 173.4), 0xff6e6962)]
PORTE_PAN = 7                            # la porte : 8e pan du mur droit (près du coin de droite, côté entrée)
# --- Les étals (Hôtels de vente d'Astrub) et ce qui les entoure --------------------------------------------------------------
PIECES = {
    'etal_ressources': (191104004, R(650, 300, 1000, 720)),
    'etal_consommables': (191102976, R(580, 340, 1000, 760)),
    'etal_equipements': (191106052, R(540, 310, 890, 740)),
    'etal_raye': (191105028, R(1190, 955, 1310, 1085)),
    'charrette': (191105028, R(555, 520, 670, 630)),
}
# images retirées des pièces : remparts, buissons, arbres et herbes des cartes du dehors autour des étals
SANS = {'etal_consommables': {72731, 72732, 72734, 63010, 72772, 72773, 72774, 72775, 72776, 62959, 62737, 39609, 62949, 52386, 73055, 73056,
                              73057, 73103, 73104, 73114, 73134, 73135, 73136, 49017, 700617, 62998, 62955, 62956, 62954, 62735, 72622,
                              72623, 72624, 72625},
        'etal_equipements': {47522, 802197, 61213, 62766, 51929, 73152, 73164, 73147, 63024, 72750},
        'etal_ressources': {33207, 62615, 62618}}
# pièce, ancre (bas-milieu), miroir, rayon bloqué, PNJ devant (décalage)
ETALS = [('etal_consommables', (0, -330), False, 230, ('bouillotte', (0, 80))),
         ('etal_ressources', (-580, -40), False, 220, ('otomai', (80, 80))),
         ('etal_equipements', (580, -40), True, 220, ('goultard', (-80, 80))),
         ('etal_raye', (-430, 330), False, 80, ('tissebelle', (90, -20))),
         ('charrette', (380, 330), True, 80, ('responsable', (-100, -30)))]
OBJETS = []
# dehors : la porte de l'Hôtel de vente des cosmétiques d'Astrub (as_boutique en (-1000, 200) dans bastion.py), Kerubim à côté
PORTE_DEHORS = (-935, -35)
KERUBIM = (-830, 30)
ASSISTANTE = (-175, 63)                  # l'Assistante d'Otomaï, un peu à droite de son étal (les PNJ restent à 200 px l'un de l'autre)
LUMIERES = {305396, 404317, 57871, 57971, 806080, 305477, 60327, 36648, 39767, 42481, 44653, 805552, 402668, 806081, 62942, 63044}

# --- L'arène des âmes (maquette « Archis : » 7B, 2026-11-12) : une salle jumelle, au fond du Marché (porte dans son mur droit) ---------
# on y relâche une âme capturée (src/sim/world.ts relacherAme) : sol de planches, piste ronde de dalles, tapis officiel au centre.
ARENE_SLOT = (4, 9)
PORTE_ARENE = 3                          # la porte de l'arène : 4e pan du mur droit du Marché
SALLES = {'marche': {'slot': SLOT, 'portes': [PORTE_PAN, PORTE_ARENE]}, 'arene': {'slot': ARENE_SLOT, 'portes': [PORTE_PAN]}}

def composer(salle='marche'):
    random.seed(7)
    for mid in {m for m, _ in PIECES.values()}:   # lumières retirées (comme bastion.py) : elles font de grandes taches claires
        md = A.carte(mid); md['sortableElements'] = [e for e in md['sortableElements'] if e['gfxId'] not in LUMIERES]
    P = {n: [q for q in piece(m, r) if q['g'] not in SANS.get(n, ())] for n, (m, r) in PIECES.items()}
    a = A.Arene(7)
    if salle == 'arene':   # planches partout, piste ronde de dalles au milieu, tapis au centre
        PISTE = lambda x, y: math.hypot(x / 560, (y - FOND[1] - HY) / 280)
        a.sol(SOL, [61601, 61359, 61360, 61362, 61600], 0, pas=(172, 86))
        a.sol(PISTE, [63318, 63319, 63320, 63321], 1, edge=0.1, pas=(172, 86))
        a.bg(46940, 0, FOND[1] + HY, lvl=2)
    else:
        # sol : dalles claires au milieu, planches au bord
        a.sol(SOL, [63318, 63319, 63320, 63321], 0, pas=(172, 86))
        a.sol(lambda x, y: SOL(x, y) / 0.86, [61601, 61359, 61360, 61362, 61600], 1, edge=0.08, pas=(172, 86))
        a.bg(46940, -130, -20, lvl=2); a.bg(46940, 260, 120, -1, lvl=2)   # tapis officiels de la salle
    # murs : le coin, puis les pans vers la gauche et vers la droite
    fx, fy = FOND; px, py = fx + 0, fy - 132
    def pose(g, d, c, ox, oy):
        im = gfx(g)
        if im is None: return
        a.n += 1; a.els.append(dict(g=g, x=ox + d[0], y=oy + d[1], sx=1, sy=1, c=c, fx=ox + d[0], fy=fy - 400 + oy - py, o=0, k=(1, fy - 400 + (oy - py) * 0.01, ox + d[0], a.n)))
    pose(63104, (0, 0), 0xff69634b, px, py)
    for i in range(NG):
        for g, d, c in MUR_G: pose(g, d, c, px + i * PAS_G[0], py + i * PAS_G[1])
    for i in range(ND):
        ox, oy = px + i * PAS_D[0], py + i * PAS_D[1]
        if i in SALLES[salle]['portes']:
            for g, d, c in PORTE_D: pose(g, (d[0] - 129, d[1] - 66.4), c, ox, oy)
        else:
            for g, d, c in PANNEAU_D: pose(g, d, c, ox, oy)
    for g, d, c in BOUT_D: pose(g, (d[0] - 387, d[1] - 199.2), c, px + ND * PAS_D[0], py + ND * PAS_D[1])
    pnj = {}
    for n, (x, y), f, r, q in ETALS if salle == 'marche' else []:
        a.put(P[n], x, y, f, bloque=r)
        if q: pnj[q[0]] = (x + q[1][0], y + q[1][1])
    for n, (x, y), f, r in OBJETS if salle == 'marche' else []: a.put(P[n], x, y, f, bloque=r)
    if salle == 'marche': pnj['assistante_otomai'] = ASSISTANTE   # quête de l'Ocre (« Archis : » 9A), près de l'étal d'Otomaï
    # les portes : seuil devant l'arche (milieu du pan) ; la première est l'entrée, arrivée une case plus loin dans la salle
    seuils = [(px + i * PAS_D[0] + PAS_D[0] / 2, py + i * PAS_D[1] + PAS_D[1] / 2 + 160) for i in SALLES[salle]['portes']]
    return a, pnj, seuils, (seuils[0][0] - 60, seuils[0][1] + 60)

def marchable(x, y, bloque):
    if any(math.hypot(x - bx, (y - by) * 2) < r for bx, by, r in bloque): return False
    return SOL(x, y) <= 0.9

def exporter(salle='marche'):
    a, pnj, seuils, arrivee = composer(salle); seuil = seuils[0]
    out = f'{mondes}/bastion'; M = json.load(open(f'{out}/monde.json'))
    slot = SALLES[salle]['slot']
    X0, Y0 = M['origin']; ix, iy = slot[0] - X0, slot[1] - Y0; ox, oy = ix * MW + CX, iy * MH + CY
    cols, rows = M['grid']['cols'], M['grid']['rows']
    need = (iy + NS) * ROWS
    if need > rows: M['mov'] += '0' * (need - rows) * cols; M['grid']['rows'] = rows = need
    def case(x, y):   # case de la grande grille sous un point de la salle
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
    sol = A.rendre([e for e in a.els if e['k'][0] == 0], BOX, (8, 6, 4))
    sol.convert('RGB').save(f'{out}/sol_{salle}.webp', quality=80, method=6)
    variants, places = {}, []
    bt0 = max([p.get('bt', 0) for m in M['maps'] for p in m['decor']] + [0]) + 1
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
        bt = {'bt': bt0 + e['grp']} if 'grp' in e and grand[e['grp']] > 30000 else {}
        places.append({'f': variants[key][0], 'x': round(e['x'] + ox, 1), 'y': round(e['y'] + oy, 1), 'c': case(e['fx'], e['fy']), 'o': e['o'], **bt})
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
    atlas.save(f'{out}/decor_{salle}.webp', quality=82, method=6)
    json.dump({'frames': frames, 'meta': {'image': f'decor_{salle}.webp', 'size': {'w': maxW, 'h': atlas.height}, 'scale': '1'}}, open(f'{out}/decor_{salle}.json', 'w'))
    mov = list(M['mov']); vert = []
    for rr in range(NS * ROWS):
        for kk in range(NS * COLS):
            c = (iy * ROWS + rr) * cols + ix * COLS + kk
            x = OX + W / 2 + kk * W + (rr % 2) * W / 2 - CX; y = OY + H / 2 + rr * H / 2 - CY
            ok = marchable(x, y, a.bloque); mov[c] = '1' if ok else '0'
            if ok: vert.append((x, y))
    M['mov'] = ''.join(mov)
    entree = {'x': slot[0], 'y': slot[1], 'id': 0, 'sub': 0, 'tag': salle, 'n': [NS, NS], 'inside': 1, 'batiments': 1,
              'sol': {'x': BOX[0] + ox, 'y': BOX[1] + oy, 'w': sol.width, 'h': sol.height}, 'decor': places}
    M['maps'] = [m for m in M['maps'] if m['tag'] != salle] + [entree]
    json.dump(M, open(f'{out}/monde.json', 'w'))
    # dehors : la case libre du Bastion la plus proche de la porte de l'Hôtel de vente (repère du Bastion, centre = 0, 0)
    BCX, BCY = OX + 8 * MW / 2, OY + 8 * MH / 2
    def dehors(x, y):
        best, bd = -1, 9e9
        for c, v in enumerate(M['mov'][:320 * cols]):
            if v != '1': continue
            r, k = divmod(c, cols); cx = OX + W / 2 + k * W + (r % 2) * W / 2 - BCX; cy = OY + H / 2 + r * H / 2 - BCY
            d = math.hypot(cx - x, (cy - y) * 2)
            if d < bd: bd, best = d, c
        return best
    def locale(g):   # case de la salle (comme cellOf de src/sim/gridmap.ts : NS x 14 colonnes)
        r, k = divmod(g, cols); return (r - iy * ROWS) * NS * COLS + k - ix * COLS
    pts = {'seuil': locale(case(*seuil)), 'seuils': [locale(case(*q)) for q in seuils], 'porte': dehors(*PORTE_DEHORS), 'kerubim': dehors(*KERUBIM),
           'pnj': {k: locale(case(*v)) for k, v in pnj.items()}}
    if apercu:
        os.makedirs(apercu, exist_ok=True)
        im = A.rendre(a.els, BOX, (8, 6, 4)); d = ImageDraw.Draw(im, 'RGBA')
        for x, y in vert: d.ellipse((x - BOX[0] - 5, y - BOX[1] - 3, x - BOX[0] + 5, y - BOX[1] + 3), fill=(80, 255, 80, 70))
        for k, (x, y) in list(pnj.items()) + [('seuil', seuil), ('arrivee', arrivee)]:
            d.ellipse((x - BOX[0] - 16, y - BOX[1] - 9, x - BOX[0] + 16, y - BOX[1] + 9), outline=(255, 60, 60, 255), width=4)
            d.text((x - BOX[0] + 18, y - BOX[1] - 8), k, fill=(255, 255, 0, 255))
        im.convert('RGB').resize((im.width // 2, im.height // 2)).save(f'{apercu}/{salle}.jpg', quality=85)
    print(salle, ':', len(places), 'éléments,', len(variants), 'images, atlas', atlas.size, ', sol', sol.size, ',', len(vert), 'cases')
    return pts

if __name__ == '__main__':
    if not os.environ.get('TEXDIR'): raise SystemExit('TEXDIR=dossier des <gfx>.png (sortis des bundles mapgfx) : voir LISEZMOI')
    pts = exporter(); ar = exporter('arene')
    Z = json.load(open(ZONES)); o = Z['bastion']['open']
    o['bastion']['pnj'].update(pts['pnj']); o['bastion']['pnj']['kerubim'] = pts['kerubim']
    o['portes'] = [p for p in o.get('portes', []) if p['nom'] not in ('Marché couvert', 'Arène des âmes')] + \
        [{'a': ['bastion', pts['porte']], 'b': ['marche', pts['seuil']], 'nom': 'Marché couvert'},
         {'a': ['marche', pts['seuils'][1]], 'b': ['arene', ar['seuil']], 'nom': 'Arène des âmes'}]
    open(ZONES, 'w').write(json.dumps(Z, ensure_ascii=False, indent=1) + '\n')
    QP = os.path.join(os.path.dirname(ZONES), 'quetes.json'); Q = json.load(open(QP))
    for k, c in pts['pnj'].items():
        if k in Q['pnj']: Q['pnj'][k].update(carte='marche', case=c)
    Q['pnj']['kerubim'].update(carte='bastion', case=pts['kerubim'])
    json.dump(Q, open(QP, 'w'), ensure_ascii=False, indent=1)
    print(pts)
