"""Régions de la 0.7 (ligne « 0.7 : » 1A-1E, 2026-11-27) -> zones.json astrub.open.subareas, drapeau v07 (#test tant que V07_PUBLIC est faux).

Usage : python3 sous_zones.py <dossier des tables data_dump (subareas, monsters)> <fr.bin>
Monstres officiels de chaque sous-zone, hors archimonstres (ajoutés par
archimonstres.py) et hors monstres de plus de 25 niveaux au-dessus de la sous-zone, comme les régions de la 0.6.
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
REGIONS = {454: "Île d'Otomaï", 457: "Île d'Otomaï", 471: "Île d'Otomaï", 468: "Île d'Otomaï", 466: "Île d'Otomaï", 55: 'Cania', 69: 'Cania', 523: 'Cania',
           230: 'Montagne des Koalaks', 275: 'Montagne des Koalaks', 942: 'Île de Pandala', 941: 'Île de Pandala', 944: 'Île de Pandala', 951: 'Île de Pandala', 602: 'Frigost'}
SOUS_ZONES = tuple(REGIONS)
EXCLUS = {'gobrechaun', 'boufmouth_legendaire'}   # lutin au trésor (15A) et boss du monde (10B) : apparitions à part, pas dans les groupes
Z = json.load(open(f'{R}/src/data/zones.json')); subs = Z['astrub']['open']['subareas']
for sid in SOUS_ZONES:
    sa = SA[sid]; mons = []
    for i in sa['monsters']:
        if i in archi or i not in MO or MO[i]['grades'][0]['level'] > sa['level'] + 25: continue
        k = par_id.get(i)
        if k and k not in mons and k not in EXCLUS: mons.append(k)
        elif not k: print('  manque', i, T(int(MO[i]['nameId'])))
    subs[str(sid)] = {**subs.get(str(sid), {}), 'name': T(int(sa['nameId'])), 'level': sa['level'], 'monsters': mons,
                      'groupsPerMap': 2 if mons else 0, 'groupSize': [3, 6], 'v07': True, 'region': REGIONS[sid]}
    print(sid, subs[str(sid)]['name'], sa['level'], mons)
open(f'{R}/src/data/zones.json', 'w').write(json.dumps(Z, ensure_ascii=False, indent=1) + '\n')
