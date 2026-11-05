# interieurs.py interieurs.json cartes_dehors.json cartes_dir liste_out.json zones.json zone
#  Range les intérieurs (maisons, mine, taverne…) dans la grille du monde, sous les cartes du dehors,
#  une case de carte vide entre chaque salle (rien ne se touche, rien ne se voit d'une salle à l'autre).
#  Écrit la liste complète pour world_export.py et les portes dans zones.json (<zone>.open.portes).
import sys, json
defs, dehors, cdir, out, zpath, zone = sys.argv[1:7]
D = json.load(open(defs)); sel = json.load(open(dehors))
xs = [int(k.split(',')[0]) for k in sel]; ys = [int(k.split(',')[1]) for k in sel]
x0, x1, y = min(xs), max(xs), max(ys) + 2
liste = dict(sel); x = x0; cells = {}
for tag, (mid, sub) in D['salles'].items():
    if x > x1: x = x0; y += 2
    md = json.load(open(f'{cdir}/map_{mid}.json'))['mapData']
    liste[f'{x},{y}'] = [mid, sub, {'tag': tag, 'inside': 1}]
    cells[tag] = [c for c, q in enumerate(md['cellsData']) if q['mov']]
    x += 2
def bas(tag):
    # porte de sortie : la case marchable la plus basse (à égalité, la plus au centre)
    return max(cells[tag], key=lambda c: (c // 14, -abs(c % 14 - 6.5)))
portes = []
for a, b, nom in D['liens']:
    a, b = [[t, bas(t) if c == 'bas' else c] for t, c in (a, b)]
    portes.append({'a': a, 'b': b, 'nom': nom})
json.dump(liste, open(out, 'w'))
Z = json.load(open(zpath)); Z[zone]['open']['portes'] = portes
json.dump(Z, open(zpath, 'w'), ensure_ascii=False, indent=1)
print(len(D['salles']), 'salles,', len(portes), 'portes')
