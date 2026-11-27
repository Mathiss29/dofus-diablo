"""Siège des Zoths (0.7, 6A) : la place du Village des Zoths (carte -50_17, la grande plaque ronde) et les chemins par où
arrivent les vagues. Écrit zones.json > astrub.open.siege07 en cases de la grande grille : coeur (la plaque) et entrees
(4 cases à 15-19 pas de la plaque, dans des directions différentes). À relancer après un nouvel export du monde."""
import json, math, re
from collections import deque
from pathlib import Path

R = Path(__file__).resolve().parents[3]
PZ = R / 'src/data/zones.json'
W = json.load(open(R / 'public/assets/mondes/astrub/monde.json'))
g = W['grid']; X0, Y0 = W['origin']; COLS = g['cols']
TAG, LOCAL = '-50_17', 311   # case de la plaque, dans la carte

mov = set()
for m in W['maps']:
    s = W['movCartes'].get(m['tag'], ''); n = m.get('n', [1, 1])[0] * 14
    c0 = (m['y'] - Y0) * 40 * COLS + (m['x'] - X0) * 14
    for i, ch in enumerate(s):
        if ch == '1': mov.add(c0 + (i // n) * COLS + i % n)
m = next(m for m in W['maps'] if m['tag'] == TAG)
coeur = (m['y'] - Y0) * 40 * COLS + (m['x'] - X0) * 14 + (LOCAL // 14) * COLS + LOCAL % 14
assert coeur in mov

def voisins(c):
    r, k = divmod(c, COLS); d = 0 if r % 2 else -1
    for rr, kk in ((r, k - 1), (r, k + 1), (r - 2, k), (r + 2, k), (r - 1, k + d), (r - 1, k + d + 1), (r + 1, k + d), (r + 1, k + d + 1)):
        yield rr * COLS + kk
def centre(c):
    r, k = divmod(c, COLS); return g['ox'] + g['w'] / 2 + k * g['w'] + (r % 2) * g['w'] / 2, g['oy'] + g['h'] / 2 + r * g['h'] / 2

dist = {coeur: 0}; q = deque([coeur])
while q:
    c = q.popleft()
    if dist[c] >= 19: continue
    for v in voisins(c):
        if v in mov and v not in dist: dist[v] = dist[c] + 1; q.append(v)
cx, cy = centre(coeur)
loin = [c for c, d in dist.items() if d >= 15]
# 4 directions : la plus lointaine de chaque quart autour de la plaque
entrees = []
for a in range(4):
    quart = [c for c in loin if int(((math.atan2(centre(c)[1] - cy, centre(c)[0] - cx) + math.pi) / (math.pi / 2))) % 4 == a]
    if quart: entrees.append(max(quart, key=lambda c: (dist[c], c)))
print('coeur', coeur, 'entrées', entrees, [dist[c] for c in entrees])

Z = json.load(open(PZ, encoding='utf-8'))
Z['astrub']['open']['siege07'] = {'nom': 'Siège des Zoths', 'tag': TAG, 'sub': 468, 'coeur': coeur, 'entrees': entrees}
t = json.dumps(Z, ensure_ascii=False, indent=1) + '\n'
t = re.sub(r'"lieux": \[\s*([^\]]*?)\s*\]', lambda x: '"lieux": [' + re.sub(r',\s+', ', ', x.group(1)) + ']', t)
open(PZ, 'w', encoding='utf-8').write(t)
