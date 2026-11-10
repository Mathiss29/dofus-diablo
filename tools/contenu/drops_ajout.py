# drops_ajout.py : ajoute à src/data/items.json le butin officiel (ressources) des monstres de src/data/monsters.json qui n'en ont pas
# encore (Astrub, donjons…), sans réécrire le reste du fichier (items_export.py le refait en entier).
# Usage : python drops_ajout.py <dossier des tables (data_dump)> <fr.bin>   puis   icones_ajout.py <bundle> <icônes affichées>
import json, os, re, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'extraction'))
from i18n import load as i18n
from butin_conditions import condition
tables, frbin = sys.argv[1:3]; T = i18n(frbin)
def table(n):
    d = json.load(open(f'{tables}/{n}.json')); R = {r['rid']: r['data'] for r in d['references']['RefIds']}; o = d['objectsById']
    return {int(k): R.get(v['rid']) for k, v in zip(o['m_keys'], o['m_values'])}
M, I = table('monsters'), table('items')
R = os.path.join(os.path.dirname(__file__), '..', '..')
P = os.path.join(R, 'src/data/items.json'); d = json.load(open(P)); mons = json.load(open(os.path.join(R, 'src/data/monsters.json')))
icones = set()
for key, gm in mons.items():
    if key in d['drops']: continue
    dm = M.get(int(gm.get('dofusId', 0) or 0))
    if not dm: continue
    lst = []
    for x in dm.get('drops', []):
        o = I.get(int(x['objectId']))
        if not o: continue
        if round(float(x['percentDropForGrade1']), 2) <= 0: continue   # 6B : jamais lâché (ou moins de 0,01 %)
        e = {'item': str(x['objectId']), 'chance': round(float(x['percentDropForGrade1']), 2)}
        c = condition(x.get('criterions') or '')   # 6B : quête ou événement, ne tombe pas en temps normal
        if c: e['cond'] = c
        mj = re.search(r'Pj>(\d+),(\d+)', x.get('criterions') or '')
        if mj: e['metier'] = {'id': int(mj.group(1)), 'min': int(mj.group(2)) + 1}; e['chasse'] = 'CU>0' in x['criterions']
        lst.append(e)
        if str(x['objectId']) not in d['resources']:
            d['resources'][str(x['objectId'])] = {'name': T(int(o['nameId'])), 'icon': int(o['iconId']), 'level': int(o['level'])}
        icones.add(int(o['iconId']))
    d['drops'][key] = lst
open(P, 'w').write(json.dumps(d, ensure_ascii=False, indent=1) + '\n')
have = json.load(open(os.path.join(R, 'src/data/icones_objets.json')))['icons']
print(len(d['drops']), 'monstres avec butin ; icônes à ajouter :', ' '.join(str(i) for i in sorted(icones) if str(i) not in have))
