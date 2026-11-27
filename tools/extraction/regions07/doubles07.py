"""Finitions des régions de la 0.7 après la fusion : à lancer sur le monde JOINT (regions_monde.py joindre), après raccord_doubles.py.

1. Une image vue deux fois depuis une carte (même test que tests/cartes.test.ts, « façon Sanstour » : les images des voisines sans
   débord ni cachées depuis la carte, plus les débords de la carte) entre deux cartes de la liste : retirée de la carte qui la pose
   sans débord quand l'autre la pose en débord, sinon de la seconde (ordre des tags).
2. Un « bâtiment » (bt) dont aucune image (sur toutes les cartes : raccord_doubles.py retire aussi des voisines hors liste) ne dépasse 20000 px² n'en est pas un : on lui retire son bt.
Usage : python3 doubles07.py <public/assets/mondes/astrub> <liste.json> [--voir]
"""
import json, sys
D = sys.argv[1]; L = {k.replace(',', '_') for k in json.load(open(sys.argv[2]))}; VOIR = '--voir' in sys.argv
M = json.load(open(f'{D}/monde.json')); F = {}
def frames(m, d):
    k = f"p{d['p']}" if 'p' in d else m['tag']
    if k not in F: F[k] = json.load(open(f'{D}/decor_{k}.json'))['frames']
    return F[k].get(d['f'])
par = {(m['x'], m['y']): m for m in M['maps'] if not m.get('inside')}
img = {}
for m in par.values():
    l = []
    for d in m['decor']:
        f = frames(m, d)
        if not f or d.get('b') or d['c'] < 0: continue
        z = d.get('z', 1); w, h = f['frame']['w'] * z, f['frame']['h'] * z
        if w * h < 8000: continue
        l.append((d['x'] + (f['spriteSourceSize']['x'] - f['sourceSize']['w'] / 2) * z, d['y'] + (f['spriteSourceSize']['y'] - f['sourceSize']['h'] / 2) * z, w, h, m['tag'], d))
    img[m['tag']] = l
retirer = set()
for (x, y), m in par.items():
    vus = [e for i in (-1, 0, 1) for j in (-1, 0, 1) if (n := par.get((x + i, y + j)))
           for e in img[n['tag']] if (e[4] == m['tag'] if e[5].get('h') else True) and m['tag'] not in e[5].get('cc', [])]
    for a in vus:
        for b in vus:
            if b[4] <= a[4] or abs(a[0] - b[0]) > 2 or abs(a[1] - b[1]) > 2 or abs(a[2] - b[2]) > 3 or abs(a[3] - b[3]) > 3: continue
            if a[4] not in L or b[4] not in L: continue
            r = a if (not a[5].get('h') and b[5].get('h')) else b
            if VOIR: print(m['tag'], ':', a[4], '/', b[4], round(a[0]), round(a[1]), a[2], a[3], 'h' if a[5].get('h') else '-', 'h' if b[5].get('h') else '-', '-> retire', r[4])
            retirer.add(id(r[5]))
for m in par.values(): m['decor'] = [d for d in m['decor'] if id(d) not in retirer]
t = {}
for m in M['maps']:
    for d in m['decor']:
        if 'bt' in d and (f := frames(m, d)): t[d['bt']] = max(t.get(d['bt'], 0), f['frame']['w'] * f['frame']['h'] * d.get('z', 1) ** 2)
petits = {b for b, s in t.items() if s <= 20000}
for m in M['maps']:
    for d in m['decor']:
        if d.get('bt') in petits: del d['bt']
if not VOIR: open(f'{D}/monde.json', 'w').write(json.dumps(M, ensure_ascii=False, separators=(',', ':')))
print(len(retirer), 'doubles retirés,', len(petits), 'petits bâtiments sans bt')
