"""Île des Wabbits (« 0.4 suite : 10A ») : sous-zones officielles 161-164 -> zones.json astrub.open.subareas (en partie de test).

Usage : python3 sous_zones.py <dossier des tables data_dump (subareas, monsters, items)> <fr.bin>
Monstres officiels de chaque sous-zone, hors archimonstres ; ceux dont la planche manque encore (Wabbits Squelettes, Nono le Wobot :
squelettes sur le PC de Mathis) sont signalés et laissés de côté.
Niveaux (Wabbits 3A) : Cawotte 40, îlots 50 (officiels).
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
Z = json.load(open(f'{R}/src/data/zones.json')); subs = Z['astrub']['open']['subareas']
for sid in (161, 162, 163, 164):
    sa = SA[sid]; mons = []
    for i in sa['monsters']:
        if i in archi: continue
        k = par_id.get(i)
        if k and k not in mons: mons.append(k)
        elif not k: print('  manque', sid, i, T(int(MO[i]['nameId'])) if i in MO else '?')
    subs[str(sid)] = {**subs.get(str(sid), {}), 'name': T(int(sa['nameId'])), 'level': sa['level'], 'monsters': mons,
                      'groupsPerMap': 2 if mons else 0, 'groupSize': [3, 6], 'essai': True, 'region': 'Île des Wabbits'}
    print(sid, subs[str(sid)]['name'], sa['level'], mons)
open(f'{R}/src/data/zones.json', 'w').write(json.dumps(Z, ensure_ascii=False, indent=1) + '\n')
