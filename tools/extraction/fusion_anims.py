# fusion_anims.py <neuf anims_<b>.json> <public anims_<b>.json> <anim,anim...>
# Ajoute au squelette publié les seules animations demandées, prises dans un export neuf (squelette_export.py EXTRA=...),
# en renumérotant les morceaux (graphiques) et les nœuds ; les autres animations ne bougent pas.
import json, os, shutil, sys
neuf, pub, noms = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
N, P = json.load(open(neuf)), json.load(open(pub))
gk = {json.dumps(g, sort_keys=True): i for i, g in enumerate(P['graphiques'])}
nk = {n: i for i, n in enumerate(P['noeuds'])}
def g_de(i):
    if i < 0: return i
    k = json.dumps(N['graphiques'][i], sort_keys=True)
    if k not in gk: gk[k] = len(P['graphiques']); P['graphiques'].append(N['graphiques'][i])
    return gk[k]
def n_de(i):
    if i < 0: return i
    n = N['noeuds'][i]
    if n not in nk: nk[n] = len(P['noeuds']); P['noeuds'].append(n)
    return nk[n]
ajout = 0
for k, frames in N['anims'].items():
    if k.rsplit('_', 1)[0] not in noms or k in P['anims']: continue
    P['anims'][k] = [[[g_de(m[0]), n_de(m[1]), *m[2:]] for m in f] for f in frames]
    if k in N.get('shots', {}): P['shots'][k] = N['shots'][k]
    ajout += 1
L = json.load(open('src/data/fichiers-lourds.json'))
for t in {x['tex'] for g in P['graphiques'] for x in g if isinstance(x, dict) and 'tex' in x}:
    if 'sprites/squelette/' + t not in L: print('TEXTURE ABSENTE', t)
json.dump(P, open(pub, 'w'), separators=(',', ':'))
print(pub, ajout, 'animations ajoutées')
