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
print('décor en double retiré :', n)

# Copies DÉCALÉES (Cité d'Astrub, Cimetière, Tainéla…) : entre certaines cartes voisines, la copie du décor qui déborde n'est pas
# au même endroit que l'original mais décalée d'une ou deux cases, toujours du même décalage pour une paire de cartes
# (ex. 7,-18 -> 8,-18 : 67 copies à (0, -43)). Dofus ne montre qu'une carte : ça ne se voit pas. Chez nous la maison était posée
# deux fois, l'une à côté de l'autre (retour de Mathis 2026-11-06). Une copie = un élément hors du cadre de sa carte, dont la même
# image se trouve dans une voisine (plus près de son cadre) au décalage habituel de la paire ; on garde l'original.
par = {(m['x'], m['y']): m for m in outs}
def dist(q):
    m, _, p = q; x0, y0, x1, y1 = cadre(m)
    return max(x0 - p['x'], p['x'] - x1, 0) + max(y0 - p['y'], p['y'] - y1, 0)
def jumeaux(m, p):
    """(voisine, décalage) des mêmes images dans les cartes voisines, à moins de 2 cases."""
    fr = frame(cle(m, p), p['f']); sz = (fr['sourceSize']['w'], fr['sourceSize']['h']); r = []
    ref = None
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            o = par.get((m['x'] + dx, m['y'] + dy))
            if not o or o is m: continue
            for q in o['decor']:
                ox, oy = q['x'] - p['x'], q['y'] - p['y']
                if abs(ox) > 2 * W + 1 or abs(oy) > 2 * H + 1 or abs(ox) + abs(oy) < 1: continue
                if (q.get('z', 1), q.get('b'), q.get('w', 1), q.get('c', 0) < 0) != (p.get('z', 1), p.get('b'), p.get('w', 1), p.get('c', 0) < 0): continue
                fq = frame(cle(o, q), q['f'])
                if (fq['sourceSize']['w'], fq['sourceSize']['h']) != sz or dist((o, 0, q)) >= dist((m, 0, p)): continue
                if ref is None: ref = pixels(cle(m, p), p['f'])
                if np.abs(pixels(cle(o, q), q['f']) - ref).mean() < 12: r.append((o['tag'], round(ox), round(oy)))
    return r
cand = []
for m in outs:
    if m.get('decales'): continue
    for i, p in enumerate(m['decor']):
        if dist((m, i, p)) > 0: cand.append((m, i, jumeaux(m, p)))
# décalages habituels de chaque paire (à 1 px près) : au moins 3 copies et un quart des copies de la paire
compte = {}
for m, i, J in cand:
    for t, ox, oy in set(J): compte.setdefault((m['tag'], t), {}).setdefault((ox, oy), 0); compte[(m['tag'], t)][(ox, oy)] += 1
def habituel(a, t, ox, oy):
    c = compte.get((a, t), {}); tot = sum(c.values())
    k = sum(v for (x, y), v in c.items() if abs(x - ox) <= 1 and abs(y - oy) <= 1)
    return k >= 3 and k * 4 >= tot
n2, jeter2 = 0, {m['tag']: set() for m in outs}
for m, i, J in cand:
    if any(habituel(m['tag'], t, ox, oy) for t, ox, oy in J): jeter2[m['tag']].add(i); n2 += 1
for m in outs:
    if m.get('decales'): continue
    m['decor'] = [p for i, p in enumerate(m['decor']) if i not in jeter2[m['tag']]]
    m['decales'] = 1
json.dump(M, open(f'{D}/monde.json', 'w'))
print('copies décalées retirées :', n2)
