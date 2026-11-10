"""Cania sud et Île de Moon (« 0.4 suite : 9A+9B », 2026-11-10) : sous-zones officielles -> zones.json astrub.open.subareas
(en partie de test) + musiques (sons.json > lieux).

Usage : python3 sous_zones.py <dossier des tables data_dump (subareas, monsters)> <fr.bin>
Monstres officiels de chaque sous-zone, hors archimonstres et hors monstres de plus de 25 niveaux au-dessus de la sous-zone
(Musha L'Oni 80, Dopeul Dark Vlad 120), comme pour Amakna.
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
SOUS = {178: ('Cania', 'cania_1', ['amakna_campagne']), 334: ('Cania', 'cania_2', ['mer', 'amakna_campagne']),
        62: ('Cania', 'cania_3', ['amakna_campagne']), 93: ('Île de Moon', 'moon', ['mer']), 166: ('Île de Moon', 'moon', ['mer'])}
Z = json.load(open(f'{R}/src/data/zones.json')); subs = Z['astrub']['open']['subareas']
S = json.load(open(f'{R}/src/data/sons.json'))
for sid, (region, musique, fond) in SOUS.items():
    sa = SA[sid]; mons = []
    for i in sa['monsters']:
        if i in archi or i not in MO: continue
        if MO[i]['grades'][0]['level'] > sa['level'] + 25: continue
        k = par_id.get(i)
        if k and k not in mons: mons.append(k)
        elif not k: print('  manque', sid, i, T(int(MO[i]['nameId'])))
    subs[str(sid)] = {**subs.get(str(sid), {}), 'name': T(int(sa['nameId'])), 'level': sa['level'], 'monsters': mons,
                      'groupsPerMap': 2 if mons else 0, 'groupSize': [3, 6], 'essai': True, 'region': region}
    S['lieux'][str(sid)] = {'musique': musique, 'fond': fond, 'fondNuit': ['grillons_nuit']}
    print(sid, subs[str(sid)]['name'], sa['level'], mons)
open(f'{R}/src/data/zones.json', 'w').write(json.dumps(Z, ensure_ascii=False, indent=1) + '\n')
open(f'{R}/src/data/sons.json', 'w').write(json.dumps(S, ensure_ascii=False, indent=1) + '\n')
