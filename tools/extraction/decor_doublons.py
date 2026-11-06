# decor_doublons.py dossier_du_monde : retire le décor posé en double par des cartes voisines (sans relire les bundles).
# Dans Dofus, une carte reprend les éléments de ses voisines qui débordent sur elle (toit, arbre, ombre à cheval sur le raccord) :
# on ne voit qu'une carte à la fois. En monde continu, le même élément était posé jusqu'à 4 fois au même endroit, rangé sur
# une case différente par chaque carte : ordre d'affichage faux (girouette du moulin des Champs passée sous son toit,
# retour de Mathis 2026-11-06) et ombres ou lumières qui s'additionnent (plus foncées, plus claires).
# On garde l'exemplaire de la carte où se trouve l'élément (son centre dans le cadre de la carte) : c'est elle qui le range
# sur la bonne case. Deux éléments sont le même s'ils ont la même image (taille et pixels proches) au même endroit (0,5 px).
# À relancer après chaque world_export.py qui réécrit le décor ; les cartes déjà traitées sont notées « doublons » dans monde.json.
import sys, json
import numpy as np
from PIL import Image
D = sys.argv[1]
M = json.load(open(f'{D}/monde.json'))
W, H, OX, OY, COLS, ROWS = 86, 43, -620, -490, 14, 40
X0, Y0 = M['origin']
outs = [m for m in M['maps'] if not m.get('inside') and not m.get('ciel')]
def cadre(m):
    x0 = OX + W // 4 + (m['x'] - X0) * COLS * W; y0 = OY + H // 4 + (m['y'] - Y0) * ROWS * H // 2
    return x0, y0, x0 + COLS * W, y0 + ROWS * H // 2
atlas, img = {}, {}
# décor partagé (world_export.py PARTAGE=1) : l'image est dans la page commune p<N>, sinon dans l'atlas de la carte
cle = lambda m, p: f"p{p['p']}" if 'p' in p else m['tag']
def frame(tag, f):
    if tag not in atlas:
        atlas[tag] = json.load(open(f'{D}/decor_{tag}.json'))['frames']
        img[tag] = Image.open(f'{D}/decor_{tag}.webp').convert('RGBA')
    return atlas[tag][f]
def pixels(tag, f):
    r = frame(tag, f)['frame']
    return np.asarray(img[tag].crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h'])).resize((16, 16))).astype(np.int16)
groupes = {}
for m in outs:
    for i, p in enumerate(m['decor']):
        fr = frame(cle(m, p), p['f'])
        k = (round(p['x'] * 2), round(p['y'] * 2), fr['sourceSize']['w'], fr['sourceSize']['h'], p.get('z', 1), p.get('b'), p.get('c', 0) < 0)
        groupes.setdefault(k, []).append((m, i, p))
jeter = {m['tag']: set() for m in outs}
n = 0
for k, L in groupes.items():
    if len(L) < 2: continue
    # même image ? (sinon deux éléments différents posés au même point : on les garde)
    ref = pixels(cle(L[0][0], L[0][2]), L[0][2]['f'])
    L = [q for q in L if np.abs(pixels(cle(q[0], q[2]), q[2]['f']) - ref).mean() < 12]
    if len(L) < 2: continue
    def dist(q):
        m, _, p = q; x0, y0, x1, y1 = cadre(m)
        return max(x0 - p['x'], p['x'] - x1, 0) + max(y0 - p['y'], p['y'] - y1, 0)
    garde = min(L, key=dist)
    for q in L:
        if q is not garde: jeter[q[0]['tag']].add(q[1]); n += 1
for m in outs:
    if m.get('doublons'): continue
    m['decor'] = [p for i, p in enumerate(m['decor']) if i not in jeter[m['tag']]]
    m['doublons'] = 1
json.dump(M, open(f'{D}/monde.json', 'w'))
print('décor en double retiré :', n)
