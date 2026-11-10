# sous-zones d'Amakna -> zones.json astrub.open.subareas (nom, niveau officiel, monstres officiels hors archimonstres)
import json, sys
sys.path.insert(0, '/home/user/dofus-diablo/tools/extraction')
from monster_spells import table
from i18n import load
S = sys.argv[1]; R = '/home/user/dofus-diablo'
T = load(f'{S}/donnees/d/I18n/fr.bin'); SA = table(f'{S}/donnees/d', 'subareas'); MO = table(f'{S}/tab', 'monsters')
archi = {int(m.get('correspondingMiniBossId') or 0) for m in MO.values()}
A = json.load(open(f'{S}/am/w/amakna.json'))
M = json.load(open(f'{R}/src/data/monsters.json'))
par_id = {}
for k, v in M.items():
    if v.get('dofusId') and not v.get('archiDe') and not v.get('boss') and not k.startswith('archi_'): par_id.setdefault(v['dofusId'], k)
Z = json.load(open(f'{R}/src/data/zones.json')); subs = Z['astrub']['open']['subareas']
for sid in sorted({v[1] for v in A.values()}):
    sa = SA[sid]; mons = []
    for i in sa['monsters']:
        if i in archi: continue
        k = par_id.get(i)
        if k and k not in mons: mons.append(k)
        elif not k: print('  manque', sid, i, T(int(MO[i]['nameId'])) if i in MO else '?')
    subs[str(sid)] = {**subs.get(str(sid), {}), 'name': T(int(sa['nameId'])), 'level': sa['level'], 'monsters': mons,
                      'groupsPerMap': 2 if mons else 0, 'groupSize': [3, 6]}
    print(sid, subs[str(sid)]['name'], sa['level'], mons)
open(f'{R}/src/data/zones.json', 'w').write(json.dumps(Z, ensure_ascii=False, indent=1) + '\n')
