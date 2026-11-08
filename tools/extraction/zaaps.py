"""Zaaps officiels d'un monde (maquette « Zaap : » 2A) : les repères « Zaap » de la table hints (monde.json reperes)
et la position exacte de l'arche, prise sur sa particule officielle « Vortex » (particules.json).

Usage : python zaaps.py <zone> (ex. incarnam, astrub)
Écrit src/data/zones.json[<zone>].open.checkpoints = [{name, map: [x, y], zaap: [px, py], sub}] (zaap en pixels de la grande carte,
sub = sous-zone : le « Territoire » et le niveau de la fenêtre du Zaap).
Un Zaap déjà connu garde son nom (les sauvegardes s'en servent), un nouveau prend le nom de sa sous-zone.
Le premier de la liste reste le premier (point de retour du départ).
"""
import sys, os, json
ICI = os.path.dirname(os.path.abspath(__file__))
ZONES = os.path.join(ICI, '../../src/data/zones.json')
zone = sys.argv[1]
Z = json.load(open(ZONES))
open_ = Z[zone]['open']
D = os.path.join(ICI, '../../public/assets/mondes', open_['world'])
M = json.load(open(f'{D}/monde.json'))
P = json.load(open(f'{D}/particules.json'))
subs = {m['tag']: m['sub'] for m in M['maps'] if not m.get('inside')}
anciens = {tuple(c['map']): c['name'] for c in open_['checkpoints']}
noms_anciens = [c['name'] for c in open_['checkpoints']]
out = []
for r in M.get('reperes', []):
    if r['n'] != 'Zaap': continue
    t = r['t']; x, y = map(int, t.split('_'))
    v = [d for d in P.get(t, []) if d.get('n') == 'Vortex']
    if not v: print('pas de particule Vortex sur', t); continue
    sub = open_['subareas'].get(str(subs.get(t)), {}).get('name', t)
    nom = anciens.get((x, y)) or sub
    out.append({'name': nom, 'map': [x, y], 'zaap': [round(v[0]['x'], 1), round(v[0]['y'], 1)], 'sub': subs.get(t)})
rang = {n: i for i, n in enumerate(noms_anciens)}
out.sort(key=lambda c: (rang.get(c['name'], 99), c['map'][1], c['map'][0]))
open_['checkpoints'] = out
json.dump(Z, open(ZONES, 'w'), ensure_ascii=False, indent=1)
print(zone, [(c['name'], c['map']) for c in out])
