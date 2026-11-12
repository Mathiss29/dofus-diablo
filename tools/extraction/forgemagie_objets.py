"""Objets officiels de la forgemagie v2 (maquette « Forgemagie v2 », 2026-11-12) -> ressources et recettes de src/data/items.json.

python forgemagie_objets.py <donnees> <fr.bin>
  donnees : tables sorties par data_dump.py (items.json, recipes.json de Dofus).
Ajoute :
  - les 8 Potions de forgemagie (type 26 : Étincelle, Crachin, Courant d'Air, Secousse, puis Incendie, Tsunami, Ouragan, Séisme)
    et leur recette officielle d'Alchimiste (5 Métarias + Fiole à élément + Pépites) ;
  - les Métarias (recette officielle « Base » : plumes et bec de Kwak ou coquilles et œuf de Dragoeuf + Sphère à Métarias),
    faites ici par l'Alchimiste (le jeu n'a pas d'artisanat hors métier) ; Sphère à Métarias et Fiole à élément se vendent chez Otomaï ;
  - les 4 Orbes régénérants (type 189) et leur recette officielle (Pépites ; métier officiel 24 = Mineur).
Les icônes : python icones_ajout.py <item_assets_2x.bundle> 26001 26002 26003 26004 50723 50724 50725 50726 66240 66241 66243 66244 66246 66247 66249 66250 66252 71057"""
import ast, json, os, sys
from i18n import load as load_i18n

donnees, fr = sys.argv[1:3]
T = load_i18n(fr)
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
L = lambda v: v if isinstance(v, (list, dict)) else ast.literal_eval(v)


def table(n):
    d = json.load(open(os.path.join(donnees, n + '.json')))
    rf = {r['rid']: r['data'] for r in d['references']['RefIds']}
    o = d['objectsById']
    return {int(k): rf.get(v['rid']) for k, v in zip(o['m_keys'], o['m_values'])}


I, RC = table('items'), table('recipes')
ELEM = {1333: 'feu', 1335: 'eau', 1337: 'air', 1338: 'terre', 1345: 'feu', 1346: 'eau', 1347: 'air', 1348: 'terre'}
ORBES = {17272: 60, 17273: 120, 17274: 180, 17275: 200}   # « Réinitialise les effets d'un objet de niveau inférieur ou égal à »
METARIAS = [1526, 1527, 1528, 1529, 1535, 1536, 1537, 1538]
VENTE = [1634, 1463]
METIER = {26: 'alchimiste', 24: 'mineur', 1: 'alchimiste'}

IP = os.path.join(R, 'src/data/items.json')
items = json.load(open(IP))
res = items['resources']
def ajoute(i, **plus):
    v = I[i]
    res[str(i)] = {'name': T(int(v['nameId'])), 'icon': int(v['iconId']), 'level': int(v['level']), **plus}
for i, e in ELEM.items(): ajoute(i, potionFM=e)
for i, n in ORBES.items(): ajoute(i, orbe=n)
for i in METARIAS + VENTE: ajoute(i)
voulus = set(ELEM) | set(ORBES) | set(METARIAS)
deja = {r['result'] for r in items['recipes']}
for r in RC.values():
    if not r or int(r['resultId']) not in voulus or str(r['resultId']) in deja: continue
    ing = [[str(int(a)), int(q)] for a, q in zip(L(r['ingredientIds']), L(r['quantities']))]
    if any(a not in res for a, _ in ing): print('ingrédient absent', r['resultId'], ing); continue
    items['recipes'].append({'result': str(r['resultId']), 'metier': METIER[int(r['jobId'])], 'level': max(1, int(r['resultLevel'])), 'ingredients': ing})
json.dump(items, open(IP, 'w'), ensure_ascii=False, indent=1)
print(len(res), 'ressources ;', len(items['recipes']), 'recettes')
