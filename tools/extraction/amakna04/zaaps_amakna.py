"""Zaaps d'Amakna (« 0.4 suite : 7A », 2026-11-10) : ajoute à zones.json[astrub].open.checkpoints les Zaaps des cartes en essai.

Sur les cartes d'Amakna, les particules du Zaap (ZAAP_Warp*, ZAAP_Onde…) sont posées par rapport à la case de l'arche (cellId) :
l'arche = milieu de cette case (ZAAP_Onde est à ±1 px). Les Zaaps d'Astrub gardent leur place (zaaps.py, particule « Vortex »).
Usage : python3 zaaps_amakna.py <dossier des map_*.json (map_dump.py)> [liste.json, par défaut celle d'Amakna]   (repères « Zaap » déjà dans monde.json : reperes.py)
"""
import json, os, sys
ICI = os.path.dirname(os.path.abspath(__file__)); R = os.path.join(ICI, '..', '..', '..')
cartes = sys.argv[1]
Z = json.load(open(f'{R}/src/data/zones.json')); o = Z['astrub']['open']
M = json.load(open(f'{R}/public/assets/mondes/astrub/monde.json')); g = M['grid']; X0, Y0 = M['origin']
L = json.load(open(sys.argv[2] if len(sys.argv) > 2 else f'{ICI}/liste.json'))
maps = {m['tag']: m for m in M['maps'] if not m.get('inside')}
deja = {tuple(c['map']) for c in o['checkpoints']}
for r in M['reperes']:
    if r['n'] != 'Zaap' or not maps.get(r['t'], {}).get('essai'): continue
    x, y = map(int, r['t'].split('_'))
    if (x, y) in deja: continue
    md = json.load(open(f"{cartes}/map_{L[f'{x},{y}'][0]}.json"))['mapData']
    cell = next(p['cellId'] for p in md['particlesParameters'] if p['id'].startswith(('ZAAP_', 'Warp')))   # île des Wabbits : Warp1-4
    rr, k = divmod(cell, 14)
    px = g['ox'] + (x - X0) * 1204 + k * 86 + (rr % 2) * 43 + 43
    py = g['oy'] + (y - Y0) * 860 + rr * 21.5 + 21.5
    sub = maps[r['t']]['sub']
    nom = 'Zaap ' + o['subareas'][str(sub)]['name']
    o['checkpoints'].append({'name': nom, 'map': [x, y], 'zaap': [round(px, 1), round(py, 1)], 'sub': sub})
    print(nom, [x, y], round(px), round(py))
open(f'{R}/src/data/zones.json', 'w').write(json.dumps(Z, ensure_ascii=False, indent=1) + '\n')
