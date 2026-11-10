# Raccords Astrub / Amakna : une carte d'Astrub exportée sans sa voisine d'Amakna dessinait en entier son débord ;
# la voisine pose maintenant les mêmes images : on retire le double côté Astrub.
import json, sys
D = sys.argv[1]; am = set(json.load(open(sys.argv[2])))   # tags d'Amakna (liste.json : "x,y")
M = json.load(open(f'{D}/monde.json')); par = {(m['x'], m['y']): m for m in M['maps'] if not m.get('inside')}
F = {}
def taille(m, d):
    k = f"p{d['p']}" if 'p' in d else m['tag']
    if k not in F: F[k] = json.load(open(f'{D}/decor_{k}.json'))['frames']
    f = F[k][d['f']]['frame']; return f['w'], f['h']
n = 0
for (x, y), m in par.items():
    if f'{x},{y}' in am: continue
    voisines = [par[(x + i, y + j)] for i in (-1, 0, 1) for j in (-1, 0, 1) if (i or j) and (x + i, y + j) in par and f'{x + i},{y + j}' in am]
    if not voisines: continue
    autres = [(d['x'], d['y'], taille(v, d)) for v in voisines for d in v['decor']]
    garde = []
    for d in m['decor']:
        t = taille(m, d)
        if any(abs(a - d['x']) <= 2 and abs(b - d['y']) <= 2 and s == t for a, b, s in autres): n += 1; continue
        garde.append(d)
    m['decor'] = garde
json.dump(M, open(f'{D}/monde.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(n, 'doubles retirés')
