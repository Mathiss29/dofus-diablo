# recoltes_corrige.py <dossier des tables (data_dump)> <fr.bin> : relie à nouveau chaque emplacement de src/data/recoltes.json
# à sa ressource (recoltes_gfx.py) sans réexporter les cartes : les cases et les dessins (recoltes_cases.py) sont gardés.
# Lancé une fois le 2026-11-07 pour corriger les ressources devinées (puits = Frêne, etc.). Les exports suivants passent par recoltes.py.
import json, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'extraction'))
sys.path.insert(0, os.path.dirname(__file__))
from i18n import load as i18n
from recoltes_gfx import ressource

tables, frbin = sys.argv[1:3]
T = i18n(frbin)
def table(n):
    d = json.load(open(f'{tables}/{n}.json')); R = {r['rid']: r['data'] for r in d['references']['RefIds']}; o = d['objectsById']
    return {int(k): R.get(v['rid']) for k, v in zip(o['m_keys'], o['m_values'])}
SA, SK, I, J = table('subareas'), table('skills'), table('items'), table('jobs')
METIERS = {1: '', 2: 'bucheron', 24: 'mineur', 26: 'alchimiste', 28: 'paysan', 36: 'pecheur'}
RES = {}
for s in SK.values():
    g, j = s.get('gatheredRessourceItem'), s.get('parentJobId')
    if g and g > 0 and j in METIERS and (g not in RES or s['levelMin'] < RES[g][1]): RES[g] = (METIERS[j], s['levelMin'], s['useAnimation'], s.get('range', 1))

RAC = os.path.join(os.path.dirname(__file__), '..', '..')
OUT = os.path.join(RAC, 'src', 'data', 'recoltes.json')
data = json.load(open(OUT))
mondes = [k for k in data if not k.startswith('_') and k not in ('metiers', 'ressources')]
for monde in mondes:
    maps = {m['tag']: m for m in json.load(open(os.path.join(RAC, 'public', 'assets', 'mondes', monde, 'monde.json')))['maps']}
    out = []
    for e in data[monde]:
        m = maps[e[0]]
        peche = [(x, RES[x][1]) for x in SA[m['sub']].get('harvestables', []) if x in RES and RES[x][0] == 'pecheur']
        h = ressource(e[3], m.get('id'), e[0], e[1], peche)
        if h: out.append([e[0], e[1], str(h), *e[3:]])
    print(monde, len(data[monde]), '->', len(out)); data[monde] = out
tous = {int(x[2]) for k in mondes for x in data[k]}
data['_'] = "Métiers de récolte (0.2b), écrit par tools/contenu/recoltes.py. Ressource d'un emplacement : relevé officiel de sa carte (tools/contenu/recoltes_gfx.py). metier vide = sans métier (puits). portee : portée officielle en cases (pêche 10)."
data['metiers'] = {k: {'id': j, 'nom': T(J[j]['nameId'])} for j, k in METIERS.items() if k}
data['ressources'] = {str(h): {'nom': T(I[h]['nameId']), 'metier': RES[h][0], 'niveau': RES[h][1], 'anim': RES[h][2], 'icone': I[h]['iconId'],
                               'niveauObjet': I[h]['level'], **({'portee': RES[h][3]} if RES[h][3] > 1 else {})} for h in sorted(tous)}
json.dump(data, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
for k, v in data['ressources'].items(): print(f"  {v['nom']} ({v['metier'] or 'sans métier'} {v['niveau']}) : " + ', '.join(f"{m} {sum(1 for x in data[m] if x[2] == k)}" for m in mondes))
