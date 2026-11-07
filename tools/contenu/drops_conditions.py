# drops_conditions.py : marque dans src/data/items.json les lignes de butin officielles qui ne tombent que pendant une quête
# ou un événement (cond), et retire celles à 0 % (maquette « Drops » 6B, 2026-11-07). Sans réécrire le reste du fichier.
# Usage : python drops_conditions.py <dossier des tables (data_dump)>   (monsters.json de monstersdataroot)
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'extraction'))
from butin_conditions import condition
tables = sys.argv[1]
d = json.load(open(f'{tables}/monsters.json')); R = {r['rid']: r['data'] for r in d['references']['RefIds']}; o = d['objectsById']
M = {int(k): R.get(v['rid']) for k, v in zip(o['m_keys'], o['m_values'])}
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
P = os.path.join(ROOT, 'src/data/items.json'); items = json.load(open(P)); mons = json.load(open(os.path.join(ROOT, 'src/data/monsters.json')))
n = {'evenement': 0, 'quete': 0, 'zero': 0}
for key, lst in items['drops'].items():
    dm = M.get(int(mons.get(key, {}).get('dofusId', 0) or 0))
    crit = {str(x['objectId']): x.get('criterions') or '' for x in (dm or {}).get('drops', [])}
    out = []
    for e in lst:
        if e['chance'] <= 0: n['zero'] += 1; continue
        e.pop('cond', None)
        c = condition(crit.get(e['item'], ''))
        if c: e['cond'] = c; n[c] += 1
        out.append(e)
    items['drops'][key] = out
open(P, 'w').write(json.dumps(items, ensure_ascii=False, indent=1) + '\n')
print(n)
