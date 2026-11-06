# recoltes_cases.py <monde> <dossier des cartes map_<id>.json> : à lancer après recoltes.py.
# Dans les cartes officielles, la case d'une ressource (cellId) est parfois loin de son dessin (transform) : jusqu'à 15 cases,
# parfois sur la carte voisine. Le dessin est ce que Dofus affiche ; recoltes.py le ramenait sur la case, et du blé se
# retrouvait à flotter au-dessus du vide (Champs d'Incarnam, retour de Mathis, 2026-11-06).
# À lancer UNE fois sur la sortie de recoltes.py (il retrouve les éléments officiels par leur case d'origine).
# Ici chaque ressource prend la case (de sa carte ou d'une voisine) la plus proche de son dessin ; le petit écart restant
# est gardé en décalage du dessin. Lit et réécrit src/data/recoltes.json.
import sys, json, os, collections
monde, cartes = sys.argv[1:3]
RAC = os.path.join(os.path.dirname(__file__), '..', '..')
OUT = os.path.join(RAC, 'src', 'data', 'recoltes.json')
M = json.load(open(os.path.join(RAC, 'public', 'assets', 'mondes', monde, 'monde.json')))
X0, Y0 = M['origin']
dehors = {(m['x'], m['y']): m for m in M['maps'] if not m.get('inside')}
par_tag = {m['tag']: m for m in M['maps']}
CENTRES = [(c, 43 + (c % 14) * 86 + ((c // 14) % 2) * 43 - 623.5, 21.5 + (c // 14) * 21.5 - 505.25) for c in range(560)]

def case_proche(m, wx, wy):
    """(distance, tag, case, dx, dy) de la case la plus proche du point (repère du monde) sur la carte m."""
    lx, ly = wx - (m['x'] - X0) * 1204, wy - (m['y'] - Y0) * 860
    c, cx, cy = min(CENTRES, key=lambda t: (t[1] - lx) ** 2 + (t[2] - ly) ** 2)
    return ((cx - lx) ** 2 + (cy - ly) ** 2, m['tag'], c, round(lx - cx, 1), round(ly - cy, 1))

data = json.load(open(OUT)); brut = {}; vus = collections.Counter(); out = []; n = 0
for e in data[monde]:
    tag, cell, item, gfx = e[:4]; m = par_tag.get(tag)
    if m is None or 'id' not in m or not os.path.exists(f"{cartes}/map_{m['id']}.json"): out.append(e); continue
    if tag not in brut:
        r = json.load(open(f"{cartes}/map_{m['id']}.json"))
        brut[tag] = [q['data'] for q in r.get('references', {}).get('RefIds', []) if q['type']['class'] == 'ClientInteractiveAnimatedElementTransform']
    # n-ième (case, gfx) de la liste = n-ième élément officiel avec cette case et ce gfx (même ordre que recoltes.py)
    k = vus[(tag, cell, gfx)]; vus[(tag, cell, gfx)] += 1
    q = [d for d in brut[tag] if d['cellId'] == cell and d['gfxId'] == gfx]
    if k >= len(q): out.append(e); continue
    t = q[k]['transform']; wx, wy = t['m31'] + (m['x'] - X0) * 1204, -t['m32'] + (m['y'] - Y0) * 860
    if m.get('inside'): cands = [m]
    else: cands = [dehors[(m['x'] + a, m['y'] + b)] for a in (-1, 0, 1) for b in (-1, 0, 1) if (m['x'] + a, m['y'] + b) in dehors]
    _, t2, c2, dx, dy = min(case_proche(o, wx, wy) for o in cands)
    if (t2, c2) != (tag, cell): n += 1
    out.append([t2, c2, item, gfx, dx, dy, *e[6:]])
# les cartes voisines recopient les ressources qui débordent chez elles (comme le décor) : une fois ramenées sur la même case,
# ces copies se superposaient. On n'en garde qu'une (même case, même dessin, à 3 px près).
garde = []
for e in out:
    if not any(g[:2] == e[:2] and g[3] == e[3] and abs(g[4] - e[4]) <= 3 and abs(g[5] - e[5]) <= 3 for g in garde): garde.append(e)
print(monde, len(out) - len(garde), 'copies retirées')
data[monde] = out = garde
json.dump(data, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
print(monde, len(out), 'ressources,', n, 'changées de case')
