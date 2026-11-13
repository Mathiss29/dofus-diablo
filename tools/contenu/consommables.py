# consommables.py : « Métiers : » 4A+4B+4C+5A (2026-11-13). Ajoute à src/data/items.json les objets officiels qui deviennent des
# consommables de combat (boissons de résistance, élixir uchronique, parchemins de caractéristique, variantes rares des plantes
# de l'Alchimiste) et leurs recettes à nous (officiellement, ces objets n'ont pas de recette ou en ont une avec des ingrédients
# absents du jeu). Les effets sont dans src/data/consommables.json. Ne réécrit pas le reste du fichier.
# Usage : python consommables.py <dossier des tables (data_dump)> <fr.bin>   puis   icones_ajout.py <bundle> <icônes affichées>
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'extraction'))
from i18n import load as i18n
tables, frbin = sys.argv[1:3]; T = i18n(frbin)
def table(n):
    d = json.load(open(f'{tables}/{n}.json')); R = {r['rid']: r['data'] for r in d['references']['RefIds']}; o = d['objectsById']
    return {int(k): R.get(v['rid']) for k, v in zip(o['m_keys'], o['m_values'])}
I = table('items')
R = os.path.join(os.path.dirname(__file__), '..', '..')
P = os.path.join(R, 'src/data/items.json'); d = json.load(open(P))
# variantes rares (récolte de la plante de base, 5A) : Ortie Roïde, Sauge Divine au Rhum, Trèfle Agare, Menthe Religieuse, Orchidée de Génie, Edelweiss Marguerite
RARES = [16378, 16379, 16380, 16381, 16382, 16383]
# [objet, métier, niveau, ingrédients]
RECETTES = [
    # boissons de résistance (4A) : 5 s d'un élément à +30 %
    (21673, 'alchimiste', 10, [(421, 4), (399, 1)]),      # Boisson épicée (Feu) : Ortie, Huile de Sésame
    (21674, 'alchimiste', 10, [(421, 4), (311, 2)]),      # Boisson givrée (Eau) : Ortie, Eau Potable
    (21678, 'alchimiste', 20, [(428, 3), (400, 2)]),      # Boisson orientale (Air) : Sauge, Orge
    (21677, 'alchimiste', 20, [(428, 3), (441, 2)]),      # Boisson sombre (Terre) : Sauge, Cuivre
    (21675, 'alchimiste', 30, [(428, 3), (473, 2)]),      # Boisson angélique (Neutre) : Sauge, Bois de Châtaignier
    # élixir (4C) : % Réduction des recharges
    (20962, 'alchimiste', 40, [(395, 5), (311, 2), (1182, 1)]),   # Élixir uchronique mineur : Trèfle, Eau Potable, Potion de Mini Soin
    # parchemins (5A) : 2 Trèfle Agare (variante rare) + une récolte du niveau 40 d'un autre métier
    (795, 'alchimiste', 40, [(16380, 2), (442, 10)]),     # Force : Bronze
    (815, 'alchimiste', 40, [(16380, 2), (533, 10)]),     # Intelligence : Avoine
    (811, 'alchimiste', 40, [(16380, 2), (395, 10)]),     # Chance : Trèfle à 5 feuilles
    (799, 'alchimiste', 40, [(16380, 2), (603, 10)]),     # Agilité : Poisson-Chaton
    (807, 'alchimiste', 40, [(16380, 2), (476, 10)]),     # Vitalité : Bois de Noyer
    (803, 'alchimiste', 40, [(16380, 2), (7652, 3)]),     # Sagesse : Potion de Souvenir
]
icones = set()
def ajouter(rid, niveau=None):
    o = I[rid]; k = str(rid)
    if k not in d['resources']: d['resources'][k] = {'name': T(int(o['nameId'])), 'icon': int(o['iconId']), 'level': niveau or int(o['level'])}
    icones.add(d['resources'][k]['icon'])
for rid in RARES: ajouter(rid)
deja = {r['result'] for r in d['recipes']}
for rid, metier, niv, ing in RECETTES:
    ajouter(rid, niv)
    for i, _ in ing: assert str(i) in d['resources'], f'ingrédient absent : {i}'
    if str(rid) not in deja: d['recipes'].append({'result': str(rid), 'metier': metier, 'level': niv, 'ingredients': [[str(i), q] for i, q in ing]})
open(P, 'w').write(json.dumps(d, ensure_ascii=False, indent=1) + '\n')
ic = json.load(open(os.path.join(R, 'src/data/icones_objets.json')))['icons']
print('icônes à ajouter :', ' '.join(str(i) for i in sorted(icones) if str(i) not in ic))
