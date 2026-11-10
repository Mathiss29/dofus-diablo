"""Champs de la guerre des Cawottes (ligne « Guerre : », 1A : un champ par îlot) -> zones.json astrub.open.guerre.champs.

Pour chaque îlot, une grande carte dégagée : 12 cawottes (2C) sur les cases dégagées les plus proches du milieu (espacées),
3 entrées (5C : chemins) à 330-520 px du champ dans trois directions, l'épouvantail (6A) au bord du champ.
Cases en numéros de la grande grille du monde (à refaire en cas de regrillage, comme les arènes).
Usage : python3 tools/extraction/wabbits04/champs.py
"""
import json, math, os
ICI = os.path.dirname(os.path.abspath(__file__)); R = os.path.join(ICI, '..', '..', '..')
D = os.path.join(R, 'public/assets/mondes/astrub')
M = json.load(open(f'{D}/monde.json')); g = M['grid']; W, H, OX, OY, cols = g['w'], g['h'], g['ox'], g['oy'], g['cols']
X0, Y0 = M['origin']; mc = M['movCartes']
maps = {m['tag']: m for m in M['maps']}
CHAMPS = [('Champ de la Cawotte', '23_-7', [40, 48]), ('Champ de Waldo', '27_-12', [50, 55]),
          ('Champ des Tombeaux', '21_-12', [50, 56]), ('Champ de la Couronne', '23_-13', [55, 60])]

def pix(k, r): return OX + W / 2 + k * W + (r % 2) * W / 2, OY + H / 2 + r * H / 2
def voisins(k, r):
    o = r % 2
    return [(k - 1 + o, r - 1), (k + o, r - 1), (k - 1 + o, r + 1), (k + o, r + 1), (k, r - 2), (k, r + 2), (k - 1, r), (k + 1, r)]
# toutes les cases marchables du dehors
libre = set()
for t, m in maps.items():
    if m.get('inside'): continue
    s = mc.get(t, ''); k0, r0 = (m['x'] - X0) * 14, (m['y'] - Y0) * 40
    for i, ch in enumerate(s):
        if ch == '1': libre.add((k0 + i % 14, r0 + i // 14))

Zp = os.path.join(R, 'src/data/zones.json'); Z = json.load(open(Zp)); o = Z['astrub']['open']
champs = []
for nom, tag, niv in CHAMPS:
    m = maps[tag]; k0, r0 = (m['x'] - X0) * 14, (m['y'] - Y0) * 40
    A = {(k, r) for (k, r) in libre if k0 <= k < k0 + 14 and r0 <= r < r0 + 40}
    ouvert = [p for p in A if all(v in libre for v in voisins(*p)) and all(w in libre for v in voisins(*p) for w in voisins(*v))]
    cx = sum(pix(*p)[0] for p in ouvert) / len(ouvert); cy = sum(pix(*p)[1] for p in ouvert) / len(ouvert)
    proches = sorted(ouvert, key=lambda p: math.hypot(pix(*p)[0] - cx, pix(*p)[1] - cy))
    caw = []
    for p in proches:
        x, y = pix(*p)
        if all(math.hypot(x - pix(*q)[0], (y - pix(*q)[1]) * 1.6) >= 82 for q in caw): caw.append(p)
        if len(caw) == 12: break
    mx = sum(pix(*p)[0] for p in caw) / 12; my = sum(pix(*p)[1] for p in caw) / 12
    # morceau d'un seul tenant autour du champ (les entrées doivent y mener)
    vu, f = {caw[0]}, [caw[0]]
    while f:
        n = []
        for q in f:
            for v in voisins(*q):
                if v in libre and v not in vu and math.hypot(pix(*v)[0] - mx, pix(*v)[1] - my) < 700: vu.add(v); n.append(v)
        f = n
    loin = [p for p in vu if 330 <= math.hypot(pix(*p)[0] - mx, pix(*p)[1] - my) <= 520 and p in A or
            330 <= math.hypot(pix(*p)[0] - mx, pix(*p)[1] - my) <= 520 and all(v in libre for v in voisins(*p))]
    entrees = []
    for secteur in range(3):   # trois directions à 120° ; dans chacune, la case la plus dégagée
        a0 = secteur * 2 * math.pi / 3 + math.pi / 2
        cand = [p for p in loin if math.cos(math.atan2(pix(*p)[1] - my, pix(*p)[0] - mx) - a0) > 0.5]
        if not cand: continue
        best = max(cand, key=lambda p: sum(v in libre for v in voisins(*p)) * 1000 - math.hypot(pix(*p)[0] - mx, pix(*p)[1] - my))
        entrees.append(best)
    if len(entrees) < 3:
        for p in sorted(loin, key=lambda p: -min([math.hypot(pix(*p)[0] - pix(*e)[0], pix(*p)[1] - pix(*e)[1]) for e in entrees] or [1e9])):
            if len(entrees) >= 3: break
            entrees.append(p)
    epou = min((p for p in ouvert if p not in caw and all(math.hypot(pix(*p)[0] - pix(*q)[0], pix(*p)[1] - pix(*q)[1]) >= 70 for q in caw)),
               key=lambda p: abs(math.hypot(pix(*p)[0] - mx, pix(*p)[1] - my) - 200))
    cell = lambda p: p[1] * cols + p[0]
    champs.append({'nom': nom, 'tag': tag, 'sub': m['sub'], 'niveau': niv, 'cawottes': [cell(p) for p in caw],
                   'entrees': [cell(p) for p in entrees], 'epouvantail': cell(epou)})
    print(nom, tag, 'cawottes', len(caw), 'entrées', len(entrees))
o['guerre'] = {**o.get('guerre', {}), 'champs': champs}
open(Zp, 'w').write(json.dumps(Z, ensure_ascii=False, indent=1) + '\n')
