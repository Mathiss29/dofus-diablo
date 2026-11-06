# recettes.py : ajoute à src/data/items.json les recettes officielles des métiers de récolte (Paysan, Bûcheron, Mineur, Alchimiste,
# Pêcheur) et du Chasseur jusqu'au niveau MAX, quand tous leurs ingrédients existent dans le jeu (récoltes, butin, autres recettes).
# Seulement des consommables et des produits de base (pains, potions, poissons, viandes, alliages, planches, huiles, essences) :
# l'équipement fabriqué arrive en 0.3 (maquette Métiers 1A). Ne réécrit pas le reste du fichier.
# Usage : python recettes.py <dossier des tables (data_dump)> <fr.bin>   puis   icones_ajout.py <bundle> <icônes affichées>
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'extraction'))
from i18n import load as i18n
tables, frbin = sys.argv[1:3]; T = i18n(frbin)
MAX = int(os.environ.get('MAX', '60'))
JOBS = {28: 'paysan', 2: 'bucheron', 24: 'mineur', 26: 'alchimiste', 36: 'pecheur', 41: 'chasseur'}
# types d'objets gardés : potion 12, pain 33, poisson 49, viande 69, alliage 40, planche 95, huile 60, essence de gardien 167
TYPES = {12, 33, 49, 69, 40, 95, 60, 167}
GARDER = {548}   # Potion de Rappel (maquette Métiers 20A), type 43 « potion de téléportation »
def table(n):
    d = json.load(open(f'{tables}/{n}.json')); R = {r['rid']: r['data'] for r in d['references']['RefIds']}; o = d['objectsById']
    return {int(k): R.get(v['rid']) for k, v in zip(o['m_keys'], o['m_values'])}, R
I, RI = table('items'); REC, _ = table('recipes')
R = os.path.join(os.path.dirname(__file__), '..', '..')
P = os.path.join(R, 'src/data/items.json'); d = json.load(open(P))
rec = json.load(open(os.path.join(R, 'src/data/recoltes.json')))
for k, r in rec['ressources'].items():   # les récoltes sont des ressources du sac
    if k not in d['resources']: d['resources'][k] = {'name': r['nom'], 'icon': r['icone'], 'level': r['niveau']}
have = set(d['resources']); deja = {r['result'] for r in d['recipes']}; icones = set(); n = 0
for jid, key in JOBS.items():
    if key not in d['metiers']: print('métier absent de items.json :', key)
changed = True
while changed:   # une recette peut utiliser le résultat d'une autre
    changed = False
    for r in REC.values():
        if not r or int(r['jobId']) not in JOBS or int(r['resultLevel']) > MAX: continue
        rid = int(r['resultId']); k = str(rid)
        if k in deja or (int(r['resultTypeId']) not in TYPES and rid not in GARDER): continue
        if not all(str(i) in have for i in r['ingredientIds']): continue
        o = I[rid]
        if k not in d['resources']:
            res = {'name': T(int(o['nameId'])), 'icon': int(o['iconId']), 'level': int(o['level'])}
            for e in o.get('possibleEffects', []):
                e = RI.get(e.get('rid')) or {}
                if int(e.get('effectId', 0)) == 110: res['soin'] = int(e['diceNum'])   # « +N PV » : se mange / se boit
            d['resources'][k] = res
        icones.add(d['resources'][k]['icon'])
        d['recipes'].append({'result': k, 'metier': JOBS[int(r['jobId'])], 'level': int(r['resultLevel']),
                             'ingredients': [[str(i), int(q)] for i, q in zip(r['ingredientIds'], r['quantities'])]})
        have.add(k); deja.add(k); changed = True; n += 1
d['recipes'].sort(key=lambda r: (r['level'], r['metier']))
open(P, 'w').write(json.dumps(d, ensure_ascii=False, indent=1) + '\n')
ic = json.load(open(os.path.join(R, 'src/data/icones_objets.json')))['icons']
print(n, 'recettes ajoutées ; icônes à ajouter :', ' '.join(str(i) for i in sorted(icones) if str(i) not in ic))
