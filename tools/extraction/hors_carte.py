# hors_carte.py dossier_du_monde : à lancer après batiments.py. Retire les bâtiments qu'une carte pose chez sa voisine.
# Dans Dofus, une carte reprend parfois un bâtiment de la carte voisine, à un autre endroit que l'original (la Taverne d'Astrub
# était posée trois fois : par sa carte, et deux fois juste en dessous par les cartes [5,-18] et [6,-18] ; une maison de [6,-17]
# recopiée par [5,-17] sur la terrasse de la Taverne). Dofus n'affiche qu'une carte : ces copies, hors de l'écran, ne se voient
# pas. Chez nous elles recouvraient le décor de la voisine (« Taverne en double », retour de Mathis 2026-11-07).
# Règle (choix de Mathis : « l'essai 2 ») : un bâtiment (images d'une carte qui ont le même numéro bt) reste sur la carte où
# il est posé, c'est-à-dire où se trouve son pied (bas de son dessin). S'il est posé dans le cadre d'une autre carte du dehors,
# c'est la copie d'un bâtiment de cette carte : on le retire. Les cartes traitées sont notées « horscarte » dans monde.json.
import sys, json, collections
D = sys.argv[1]
M = json.load(open(f'{D}/monde.json'))
W, H, OX, OY, COLS, ROWS = 86, 43, -620, -490, 14, 40
X0, Y0 = M['origin']
dehors = {(m['x'], m['y']): m for m in M['maps'] if not m.get('inside') and not m.get('ciel')}
def proprio(x, y):
    return (X0 + int((x - (OX + W // 4)) // (COLS * W)), Y0 + int((y - (OY + H // 4)) // (ROWS * H // 2)))
fr = {}
def cadre(m, d):
    k = f"p{d['p']}" if 'p' in d else m['tag']
    if k not in fr: fr[k] = json.load(open(f'{D}/decor_{k}.json'))['frames']
    F = fr[k][d['f']]; z = d.get('z', 1)
    x = d['x'] + (F['spriteSourceSize']['x'] - F['sourceSize']['w'] / 2) * z; y = d['y'] + (F['spriteSourceSize']['y'] - F['sourceSize']['h'] / 2) * z
    return x, y, x + F['frame']['w'] * z, y + F['frame']['h'] * z
n = nb = 0
for m in dehors.values():
    if m.get('horscarte'): continue
    G = collections.defaultdict(lambda: [1e9, 1e9, -1e9, -1e9])
    for d in m['decor']:
        if d.get('bt') is None: continue
        a = G[d['bt']]; x0, y0, x1, y1 = cadre(m, d)
        a[0] = min(a[0], x0); a[1] = min(a[1], y0); a[2] = max(a[2], x1); a[3] = max(a[3], y1)
    jet = set()
    for bt, (x0, y0, x1, y1) in G.items():
        p = proprio((x0 + x1) / 2, y1 - 20)   # pied : bas du dessin, un peu au-dessus de l'ombre
        if p != (m['x'], m['y']) and p in dehors: jet.add(bt)
    av = len(m['decor'])
    m['decor'] = [d for d in m['decor'] if d.get('bt') not in jet]
    n += av - len(m['decor']); nb += len(jet); m['horscarte'] = 1
# images restées d'un bâtiment retiré (posées par une autre carte sur la copie) : elles ne sont plus d'aucun bâtiment
grand = collections.Counter()
for m in dehors.values():
    for d in m['decor']:
        if d.get('bt') is not None:
            x0, y0, x1, y1 = cadre(m, d); grand[d['bt']] = max(grand[d['bt']], (x1 - x0) * (y1 - y0))
for m in dehors.values():
    for d in m['decor']:
        if d.get('bt') is not None and grand[d['bt']] <= 20000: del d['bt']
json.dump(M, open(f'{D}/monde.json', 'w'))
print('bâtiments posés chez la voisine retirés :', nb, '(', n, 'images )')
