"""Points d'intérêt officiels d'un monde pour la carte du monde (table hints de Dofus 3 : ateliers, banque, Zaaps, donjons…).

Usage : python reperes.py <hints.json (data_dump.py)> <fr.bin> <public/assets/mondes/<monde>>
Écrit monde.json['reperes'] = [{t: tag de la carte, n: nom, g: icône (public/assets/ui/reperes/<g>.webp), c: catégorie}].
Les icônes sont les sprites numérotés de uidarkstone_assets_all (même numéro que hints.gfx), réduites à 40 px.
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from i18n import load as i18n
H, FR, D = sys.argv[1:4]
d = json.load(open(H)); R = {r['rid']: r['data'] for r in d['references']['RefIds']}
hints = [R.get(v['rid']) for v in d['objectsById']['m_values']]
T = i18n(FR)
M = json.load(open(f'{D}/monde.json'))
tags = {m['id']: m['tag'] for m in M['maps'] if not m.get('inside')}
out = []
for h in hints:
    if not h or h.get('mapId') not in tags: continue
    out.append({'t': tags[h['mapId']], 'n': T(h['nameId']), 'g': h['gfx'], 'c': h['categoryId']})
M['reperes'] = sorted(out, key=lambda r: (r['t'], r['c'], r['n']))
json.dump(M, open(f'{D}/monde.json', 'w'))
print(len(out), 'repères')
