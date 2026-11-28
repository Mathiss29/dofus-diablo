# liens_recettes.py (0.7, « 0.7 : » 9A) : relie au butin par zone les équipements de plus de 60 dont la recette officielle n'est pas
# dans le jeu (minerais, substrats ou galets absents) : champ `ing` = ingrédients officiels lâchés par un monstre du jeu.
# poolOfficiel (src/sim/butin.ts) met alors l'objet dans le butin des zones de ces monstres, comme s'il se fabriquait.
# Sans cela, du 61 au 120 presque rien ne tombait (Dofus 3 ne lâche presque jamais d'équipement).
# Usage : python liens_recettes.py <tables (data_dump : recipes)>   (après equipement_ajout.py et recettes_equipement.py)
import ast, json, os, sys
L = lambda v: v if isinstance(v, (list, dict)) else ast.literal_eval(v)
d = json.load(open(os.path.join(sys.argv[1], 'recipes.json'))); RR = {r['rid']: r['data'] for r in d['references']['RefIds']}
REC = [RR.get(v['rid']) for v in d['objectsById']['m_values']]
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src/data/items.json'); B = json.load(open(P))
E = B['equipment']; fab = {r['result'] for r in B['recipes']}
lache = {x['item'] for l in B['drops'].values() for x in l if x.get('cond') not in ('quete', 'evenement')}
for e in E.values(): e.pop('ing', None)
n = 0
for r in REC:
    k = str(r['resultId']) if r else None
    if not k or k not in E or k in fab or E[k]['level'] <= 60: continue
    ing = sorted({str(i) for i in L(r['ingredientIds']) if str(i) in lache}, key=int)
    if ing: E[k]['ing'] = ing; n += 1
open(P, 'w').write(json.dumps(B, ensure_ascii=False, indent=1) + '\n')
print(n, 'équipements reliés au butin de leurs ingrédients')
