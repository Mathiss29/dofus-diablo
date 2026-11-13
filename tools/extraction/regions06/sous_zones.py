"""Sous-zones des 5 régions de la 0.6 (ligne « 0.6 : » 1A-1E, 2026-11-13) -> zones.json astrub.open.subareas, cachées hors
partie de test (`v06: true`, comme les cartes `v06: 1`).

Usage : python3 sous_zones.py <dossier des tables data_dump (subareas, monsters)> <fr.bin>
Monstres officiels de chaque sous-zone, hors archimonstres et hors monstres de plus de 25 niveaux au-dessus de la sous-zone
(comme Amakna et Cania sud). Les monstres pas encore rendus en planche sont listés (« manque ») : relancer après leur ajout.
"""
import json, os, sys
ICI = os.path.dirname(os.path.abspath(__file__)); R = os.path.join(ICI, '..', '..', '..')
sys.path.insert(0, os.path.join(ICI, '..'))
from monster_spells import table  # noqa: E402
from i18n import load  # noqa: E402
D, FR = sys.argv[1], sys.argv[2]
T = load(FR); SA = table(D, 'subareas'); MO = table(D, 'monsters')
archi = {int(m.get('correspondingMiniBossId') or 0) for m in MO.values()}
M = json.load(open(f'{R}/src/data/monsters.json'))
par_id = {}
for k, v in M.items():
    if v.get('dofusId') and not v.get('archiDe') and not v.get('boss') and not k.startswith('archi_'): par_id.setdefault(v['dofusId'], k)
# région affichée (bandeau, carte M, fichier de décor region_<clé>.json)
REGIONS = {'Forêt des Abraknydes': [33, 168], 'Montagne des Koalaks': [235, 233, 234, 253, 231],
           'Cania': [70, 525, 521], 'Amakna': [11, 315], 'Frigost': [601, 600]}
# mannequins et monstres à part (Poutchs, Coffre Malveillant qui fuit de la 0.6), comme pour Amakna
EXCLUS = {'poutch_ingball', 'coffre_malveillant'}
L = json.load(open(f'{ICI}/liste.json')); presentes = {v[1] for v in L.values()}
Z = json.load(open(f'{R}/src/data/zones.json')); subs = Z['astrub']['open']['subareas']
manque = {}
for region, ids in REGIONS.items():
    for sid in ids:
        if sid not in presentes: continue
        sa = SA[sid]; mons = []
        for i in sa['monsters']:
            if i in archi or i not in MO: continue
            if MO[i]['grades'][0]['level'] > sa['level'] + 25: continue
            k = par_id.get(i)
            if k in EXCLUS: continue
            if k and k not in mons: mons.append(k)
            elif not k: manque[i] = (T(int(MO[i]['nameId'])), MO[i]['look'])
        subs[str(sid)] = {**subs.get(str(sid), {}), 'name': T(int(sa['nameId'])), 'level': sa['level'], 'monsters': mons,
                          'groupsPerMap': 2 if mons else 0, 'groupSize': [3, 6], 'v06': True, 'region': region}
        print(sid, subs[str(sid)]['name'], sa['level'], mons)
for i, (n, look) in sorted(manque.items()): print('  manque', i, n, look)
open(f'{R}/src/data/zones.json', 'w').write(json.dumps(Z, ensure_ascii=False, indent=1) + '\n')
json.dump({str(i): [n, look] for i, (n, look) in manque.items()}, open(f'{ICI}/monstres_manquants.json', 'w'), ensure_ascii=False, indent=1)
