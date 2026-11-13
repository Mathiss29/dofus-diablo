# cles_renforcees.py : « Métiers : » 9C (2026-11-13). Ajoute à src/data/items.json une Clef renforcée par clé de donjon
# (ressource à nous, id « cr<id de la clé> », icône de la clé officielle) et sa recette chez le Bricoleur : la clé, du bois et du
# minerai de son niveau. L'effet (monstres plus durs, plus de butin) est dans src/sim/clesRenforcees.ts. Relançable sans doublon.
# Usage : python tools/contenu/cles_renforcees.py
import json, os
R = os.path.join(os.path.dirname(__file__), '..', '..')
P = os.path.join(R, 'src/data/items.json'); d = json.load(open(P))
REC = json.load(open(os.path.join(R, 'src/data/recoltes.json')))['ressources']
def recolte(metier, niveau):
    l = sorted(((r['niveau'], k) for k, r in REC.items() if r.get('metier') == metier and r['niveau'] <= max(1, niveau)), reverse=True)
    return l[0][1]
d['recipes'] = [r for r in d['recipes'] if not str(r['result']).startswith('cr')]
for k in [k for k in d['resources'] if k.startswith('cr')]: del d['resources'][k]
for k, c in sorted(((k, v) for k, v in d['resources'].items() if v.get('cle') and v['name'].startswith('Clef')), key=lambda x: (x[1]['level'], x[0])):
    nv = min(200, c['level'] + 10)
    d['resources']['cr' + k] = {'name': c['name'] + ' renforcée', 'icon': c['icon'], 'level': nv, 'renforcee': k}
    d['recipes'].append({'result': 'cr' + k, 'metier': 'bricoleur', 'level': nv, 'ingredients': [[k, 1], [recolte('bucheron', c['level']), 10], [recolte('mineur', c['level']), 5]]})
open(P, 'w').write(json.dumps(d, ensure_ascii=False, indent=1) + '\n')
print(sum(1 for k in d['resources'] if k.startswith('cr')), 'clefs renforcées')
