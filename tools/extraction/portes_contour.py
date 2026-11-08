# portes_contour.py <monde.json> <dossier des map_<id>.json (map_dump.py)>
#  Contour des portes au survol (façon Sanstour ; dans Dofus 3 les éléments interactifs s'entourent au survol).
#  Marque "po": <gfx> sur les images du décor qui sont une porte dessinée à part dans les données officielles
#  (gfx 62977 à 62999 ; 62970-62976 sont des bâtiments entiers). Le jeu entoure la plus proche de la porte survolée
#  (WorldView.contour). Une porte peinte dans l'image du bâtiment n'a pas d'image à elle.
#  À relancer après chaque world_export.py / batiments.py (les images du décor sont renumérotées à l'export).
import sys, json, os, collections
PORTES = range(62977, 63000)
mpath, mdir = sys.argv[1:3]
monde = json.load(open(mpath))
par_pos = collections.defaultdict(list)
for m in monde['maps']:
    for p in m['decor']:
        p.pop('po', None); par_pos[(round(p['x']), round(p['y']))].append(p)
n = 0
for m in monde['maps']:
    f = f"{mdir}/map_{m['id']}.json"
    if not os.path.exists(f): continue
    t = json.load(open(f)); md = t['mapData']
    R = {r['rid']: r.get('data') for r in t.get('references', {}).get('RefIds', [])}
    ies = [R[e['rid']] for e in md.get('interactiveElements', []) if R.get(e['rid']) and 'gfxId' in R[e['rid']]]
    els = md['sortableElements'] + ies
    portes = [e for e in els if e['gfxId'] in PORTES]
    if not portes or not m['decor']: continue
    cnt = collections.Counter((round(p['x'] - e['transform']['m31'], 1), round(p['y'] + e['transform']['m32'], 1)) for p in m['decor'] for e in els)
    (dx, dy), _ = cnt.most_common(1)[0]
    for e in portes:
        X, Y = e['transform']['m31'] + dx, -e['transform']['m32'] + dy
        for k in [(round(X) + i, round(Y) + j) for i in (-1, 0, 1) for j in (-1, 0, 1)]:
            for p in par_pos.get(k, []):
                if abs(p['x'] - X) < 0.6 and abs(p['y'] - Y) < 0.6 and not p.get('po'): p['po'] = e['gfxId']; n += 1
json.dump(monde, open(mpath, 'w'), separators=(',', ':'))
print(n, 'images de porte marquées')
