# fige.py <dossier du monde> : un seul jeu de bâtiments, le même quelle que soit la carte où l'on est (Mathis, 2026-11-07 :
# « je ne veux pas ce déplacement de bâtiment »). Les débords recopiés (h) sont retirés au profit de l'original toujours montré ;
# les débords sans original deviennent visibles de partout, sauf s'ils doublent un élément d'une voisine.
import json, sys
from collections import defaultdict
D = sys.argv[1]; M = json.load(open(f'{D}/monde.json'))
FR = {}
def rect(m, d):
    k = f"p{d['p']}" if 'p' in d else m['tag']
    if k not in FR: FR[k] = json.load(open(f'{D}/decor_{k}.json'))['frames']
    F = FR[k][d['f']]; z = d.get('z', 1)
    return (d['x'] + (F['spriteSourceSize']['x'] - F['sourceSize']['w'] / 2) * z, d['y'] + (F['spriteSourceSize']['y'] - F['sourceSize']['h'] / 2) * z,
            F['frame']['w'] * z, F['frame']['h'] * z)
def meme(a, b, tol): return abs(a[0] - b[0]) <= tol and abs(a[1] - b[1]) <= tol and abs(a[2] - b[2]) <= 3 and abs(a[3] - b[3]) <= 3
def couvre(a, b):
    # même grande image, un peu décalée ou d'une variante voisine (Taverne recopiée à 41 px) : elles se recouvrent à plus de la moitié
    ix = max(0, min(a[0] + a[2], b[0] + b[2]) - max(a[0], b[0])); iy = max(0, min(a[1] + a[3], b[1] + b[3]) - max(a[1], b[1]))
    return min(a[2] * a[3], b[2] * b[3]) > 8000 and ix * iy > 0.5 * min(a[2] * a[3], b[2] * b[3])
orig = defaultdict(list)
for m in M['maps']:
    for d in m['decor']:
        for t in d.get('cc', []): orig[t].append(rect(m, d))
jete = garde = 0
for m in M['maps']:
    copies = set()
    for d in m['decor']:
        if d.get('h'):
            r = rect(m, d)
            if any(meme(o, r, 64) or couvre(o, r) for o in orig[m['tag']]): copies.add(d.get('bt', id(d)))
    L = []
    for d in m['decor']:
        if d.get('h'):
            if d.get('bt', id(d)) in copies: jete += 1; continue
            d.pop('h'); d['_promu'] = 1; garde += 1
        L.append(d)
    m['decor'] = L
par = {(m['x'], m['y']): m for m in M['maps'] if not m.get('inside')}
dbl = 0
for m in M['maps']:
    if m.get('inside'): continue
    dbt = set()
    for d in m['decor']:
        if d.get('_promu'):
            r = rect(m, d)
            if any(meme(rect(n, o), r, 12) or couvre(rect(n, o), r) for dx in (-1, 0, 1) for dy in (-1, 0, 1) for n in [par.get((m['x'] + dx, m['y'] + dy))]
                   if n and n is not m for o in n['decor']): dbt.add(d.get('bt', id(d)))
    L = []
    for d in m['decor']:
        if d.pop('_promu', None) and d.get('bt', id(d)) in dbt: dbl += 1; continue
        L.append(d)
    m['decor'] = L
# bâtiment dont il ne reste que des petits morceaux (sa grande image était un débord recopié) : plus un bâtiment
grand = defaultdict(float)
for m in M['maps']:
    for d in m['decor']:
        if 'bt' in d: r = rect(m, d); grand[d['bt']] = max(grand[d['bt']], r[2] * r[3])
for m in M['maps']:
    for d in m['decor']:
        if 'bt' in d and grand[d['bt']] <= 20000: d.pop('bt')
nc = 0
for m in M['maps']:
    for d in m['decor']:
        if d.pop('cc', None): nc += 1
    m.pop('courante', None)
json.dump(M, open(f'{D}/monde.json', 'w'), separators=(',', ':'))
print(D, 'copies retirées', jete, '; débords sans original montrés partout', garde - dbl, '; en double retirés', dbl, '; originaux toujours montrés', nc)
