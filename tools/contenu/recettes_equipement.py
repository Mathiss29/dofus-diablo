# recettes_equipement.py : version 0.3 (choix 9A) : les 6 métiers de fabrication (Bijoutier, Cordonnier, Tailleur, Forgeron, Sculpteur,
# Façonneur) et leurs recettes officielles d'équipement jusqu'au niveau MAX (40), quand tous leurs ingrédients existent dans le jeu
# (récoltes, butin des monstres du jeu, autres recettes). Ajoute aussi les produits intermédiaires des métiers de récolte qu'elles
# demandent (Substrats du Bûcheron, Eau Ferrugineuse du Mineur…). Les icônes des métiers : public/assets/ui/metier_<métier>.png
# (iconId de la table jobs, mêmes images que job_assets_2x.bundle). Ne réécrit pas le reste de items.json.
# Usage : python recettes_equipement.py <dossier des tables (data_dump)> <fr.bin>   puis   icones_ajout.py <bundle> <icônes affichées>
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'extraction'))
from i18n import load as i18n
tables, frbin = sys.argv[1:3]; T = i18n(frbin)
MAX = int(os.environ.get('MAX', '40'))
FAB = {16: 'bijoutier', 15: 'cordonnier', 27: 'tailleur', 11: 'forgeron', 13: 'sculpteur', 60: 'faconneur'}
RECOLTE = {28: 'paysan', 2: 'bucheron', 24: 'mineur', 26: 'alchimiste', 36: 'pecheur', 41: 'chasseur'}
def table(n):
    d = json.load(open(f'{tables}/{n}.json')); R = {r['rid']: r['data'] for r in d['references']['RefIds']}; o = d['objectsById']
    return {int(k): R.get(v['rid']) for k, v in zip(o['m_keys'], o['m_values'])}
I = table('items'); REC = table('recipes'); J = table('jobs')
R = os.path.join(os.path.dirname(__file__), '..', '..')
P = os.path.join(R, 'src/data/items.json'); d = json.load(open(P))
for jid, key in FAB.items():
    d['metiers'].setdefault(key, {'id': jid, 'name': T(int(J[jid]['nameId'])), 'icon': int(J[jid]['iconId'])})
deja = {r['result'] for r in d['recipes']}
par_res = {int(r['resultId']): r for r in REC.values() if r}
have = set(d['resources'])
def faisable(r, pile=()):
    """Tous les ingrédients existent, ou se fabriquent par un métier de récolte (récursif)."""
    for i in r['ingredientIds']:
        if str(i) in have: continue
        s = par_res.get(int(i))
        if not s or int(s['jobId']) not in RECOLTE or int(s['resultLevel']) > MAX or i in pile or not faisable(s, pile + (i,)): return False
    return True
def ajouter(r):
    k = str(int(r['resultId']))
    for i in r['ingredientIds']:
        if str(i) not in have: ajouter(par_res[int(i)])
    if k in deja: return
    jid = int(r['jobId'])
    if jid in RECOLTE and k not in d['resources']:
        o = I[int(k)]; d['resources'][k] = {'name': T(int(o['nameId'])), 'icon': int(o['iconId']), 'level': int(o['level'])}
        have.add(k)
    d['recipes'].append({'result': k, 'metier': FAB.get(jid) or RECOLTE[jid], 'level': int(r['resultLevel']),
                         'ingredients': [[str(i), int(q)] for i, q in zip(r['ingredientIds'], r['quantities'])]})
    deja.add(k)
n = 0
for r in sorted((r for r in REC.values() if r), key=lambda r: int(r['resultLevel'])):
    if int(r['jobId']) not in FAB or int(r['resultLevel']) > MAX or str(int(r['resultId'])) not in d['equipment']: continue
    if str(int(r['resultId'])) in deja or not faisable(r): continue
    ajouter(r); n += 1
d['recipes'].sort(key=lambda r: (r['level'], r['metier']))
open(P, 'w').write(json.dumps(d, ensure_ascii=False, indent=1) + '\n')
ic = json.load(open(os.path.join(R, 'src/data/icones_objets.json')))['icons']
print(n, 'recettes d\'équipement ;', len(d['recipes']), 'recettes en tout ; icônes à ajouter :',
      ' '.join(str(d['resources'][k]['icon']) for k in d['resources'] if str(d['resources'][k]['icon']) not in ic))
