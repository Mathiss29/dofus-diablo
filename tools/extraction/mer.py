# mer.py <dossier du monde> <cartes séparées par des virgules> : couleur de la mer des cartes du rivage (champ "mer" de monde.json).
# Le bord du monde (worldView.brume) s'y fond au lieu du bleu nuit : la mer continue au-delà de la côte (Calanques d'Astrub,
# retour de Mathis 2026-11-07). Couleur = médiane des pixels d'eau (bleu-vert) du sol, près des côtés sans voisine.
# Champ "rivage" (maquette Raccords, 2026-11-08) : où est la terre dans le cadre de chaque carte du rivage, par carrés de 16 px
# du monde ('1' = terre, '0' = mer reliée au bord du cadre ; les mares au milieu du sable comptent comme terre). Le jeu fond la
# mer officielle dans la couleur de la mer à partir de la vraie côte, et plus au cadre de la carte : plus d'aplats rectangulaires.
# SOLS=dossier (option) : où lire les sol_<tag>.webp s'ils ne sont pas dans le dossier du monde (fichiers lourds sur R2).
import json, sys, os
import numpy as np
from PIL import Image
from collections import deque
D, tags = sys.argv[1], sys.argv[2].split(',')
SOLS = os.environ.get('SOLS', D); KR = 16
M = json.load(open(f'{D}/monde.json')); dehors = {(m['x'], m['y']) for m in M['maps'] if not m.get('inside')}
g = M['grid']; X0, Y0 = M['origin']; W, H = 14 * g['w'], 20 * g['h']
n = 0
for m in M['maps']:
    if m['tag'] not in tags: continue
    s = m['sol']; a = np.asarray(Image.open(f"{SOLS}/sol_{m['tag']}.webp").convert('RGBA')).astype(int)
    k = a.shape[1] / s['w']   # le sol est enregistré à la moitié de sa taille
    x0 = g['ox'] + g['w'] // 4 + (m['x'] - X0) * W - s['x']; y0 = g['oy'] + g['h'] // 4 + (m['y'] - Y0) * H - s['y']
    masque = np.zeros(a.shape[:2], bool); b = 4 * g['w']
    def zone(x1, y1, x2, y2): masque[max(0, int(y1 * k)):max(0, int(y2 * k)), max(0, int(x1 * k)):max(0, int(x2 * k))] = True
    if (m['x'] + 1, m['y']) not in dehors: zone(x0 + W - b, -1e9, 1e9, 1e9)
    if (m['x'] - 1, m['y']) not in dehors: zone(-1e9, -1e9, x0 + b, 1e9)
    if (m['x'], m['y'] + 1) not in dehors: zone(-1e9, y0 + H - b, 1e9, 1e9)
    if (m['x'], m['y'] - 1) not in dehors: zone(-1e9, -1e9, 1e9, y0 + b)
    r, v, bl, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    eau = masque & (al > 250) & (bl > r + 15) & (v > r + 15)
    if eau.sum() < 0.05 * max(1, (masque & (al > 250)).sum()): m.pop('mer', None); continue
    c = np.median(a[eau][:, :3], axis=0).astype(int); m['mer'] = int(c[0]) << 16 | int(c[1]) << 8 | int(c[2]); n += 1
    # terre / mer par carrés de KR px dans le cadre de la carte
    nx, ny = -(-W // KR), -(-H // KR); terre = np.zeros((ny, nx), bool)
    toute_eau = (al < 128) | ((bl > r + 15) & (v > r + 15))
    for j in range(ny):
        for i in range(nx):
            px0, py0 = int((x0 + i * KR) * k), int((y0 + j * KR) * k); px1, py1 = int((x0 + (i + 1) * KR) * k), int((y0 + (j + 1) * KR) * k)
            if px1 <= 0 or py1 <= 0 or px0 >= a.shape[1] or py0 >= a.shape[0]: continue   # hors de l'image : mer
            b = toute_eau[max(0, py0):py1, max(0, px0):px1]
            terre[j, i] = b.size > 0 and b.mean() < 0.5
    mer_c = np.zeros_like(terre); q = deque((j, i) for j in range(ny) for i in range(nx) if (j in (0, ny - 1) or i in (0, nx - 1)) and not terre[j, i])
    for j, i in q: mer_c[j, i] = True
    while q:
        j, i = q.popleft()
        for jj, ii in ((j + 1, i), (j - 1, i), (j, i + 1), (j, i - 1)):
            if 0 <= jj < ny and 0 <= ii < nx and not terre[jj, ii] and not mer_c[jj, ii]: mer_c[jj, ii] = True; q.append((jj, ii))
    m['rivage'] = {'k': KR, 'w': nx, 'h': ny, 'd': ''.join('0' if v_ else '1' for v_ in mer_c.ravel())}
    print(m['tag'], '#%06x' % m['mer'], int(eau.sum()))
# une seule couleur pour toute la côte : des bords de couleurs voisines mais différentes faisaient des rectangles sur la mer
mer = [m for m in M['maps'] if 'mer' in m]
if mer:
    c = np.median([[m['mer'] >> 16, m['mer'] >> 8 & 255, m['mer'] & 255] for m in mer], axis=0).astype(int)
    for m in mer: m['mer'] = int(c[0]) << 16 | int(c[1]) << 8 | int(c[2])
    print('mer', '#%02x%02x%02x' % tuple(c))
json.dump(M, open(f'{D}/monde.json', 'w'), separators=(',', ':'))
print(n, 'cartes du rivage')
