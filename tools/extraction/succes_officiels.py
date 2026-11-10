"""Succès officiels de Dofus 3 utiles au jeu (maquette « Succès : » 9A-9E, 2026-11-10).

Usage : python succes_officiels.py <dossier des tables> <I18n/fr.bin>
  Le dossier contient les tables tirées par data_dump.py (JSON) : achievements, achievementcategories, achievementobjectives,
  achievementrewards, titles, ornaments, subareas. Écrit tools/contenu/succes_officiels.json (lu par tools/contenu/quetes.py).
  Les tables viennent du cache /mnt/project-files/cache-dofus/donnees.tar.gz (Data/data_assets_<table>dataroot.asset.bundle).
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import i18n

DOS, FR = sys.argv[1], sys.argv[2]
g = i18n.load(FR)
def table(n):
    d = json.load(open(os.path.join(DOS, n + '.json')))
    R = {r['rid']: r['data'] for r in d['references']['RefIds']}
    o = d['objectsById']
    return {k: R.get(v['rid']) for k, v in zip(o['m_keys'], o['m_values']) if R.get(v['rid'])}

A, C = table('achievements'), table('achievementcategories')
O, RW = table('achievementobjectives'), table('achievementrewards')
T, OR, SA = table('titles'), table('ornaments'), table('subareas')
OBJ, REW = {}, {}
for o in O.values(): OBJ.setdefault(o['achievementId'], []).append(o)
for r in RW.values(): REW.setdefault(r['achievementId'], []).append(r)

def chemin(a):
    c = C.get(a['categoryId']); p = C.get(c['parentId']) if c else None
    return (g(p['nameId']) if p else g(c['nameId'])), (g(c['nameId']) if p else 'Général')

# catégories gardées (le reste attendra les zones et les systèmes qui vont avec)
GARDE = {('Général', 'Général'), ('Métiers', 'Général'), ('Exploration', 'Incarnam'), ('Exploration', 'Astrub'), ('Exploration', 'Amakna'),
         ('Monstres', 'Astrub'), ('Monstres', 'Amakna'), ('Monstres', 'Île de la cawotte'), ('Donjons', 'Niveaux 1 à 50'), ('Donjons', 'Niveaux 51 à 100')}
out = []
for i, a in sorted(A.items()):
    cat, sous = chemin(a)
    if (cat, sous) not in GARDE: continue
    rw = {'xp': 0.0, 'objets': [], 'titres': [], 'ornements': []}
    for r in REW.get(i, []):
        rw['xp'] += r['experienceRatio']
        rw['objets'] += [[str(x), q] for x, q in zip(r['itemsReward'], r['itemsQuantityReward'])]
        rw['titres'] += [g(int(T[t]['nameMaleId'])) for t in r['titlesReward'] if t in T]
        rw['ornements'] += [{'id': o, 'nom': g(OR[o]['nameId']), 'icone': OR[o]['iconId']} for o in r['ornamentsReward'] if o in OR]
    out.append({'id': i, 'nom': g(a['nameId']), 'description': g(a['descriptionId']) or '', 'categorie': cat, 'sousCategorie': sous,
                'points': a['points'], 'niveau': a['level'], 'icone': a['iconId'], 'ordre': a['order'],
                'objectifs': [[g(o['nameId']) or '', o['criterion']] for o in sorted(OBJ.get(i, []), key=lambda o: o['order'])],
                'recompense': rw})
dest = os.path.join(os.path.dirname(__file__), '..', 'contenu', 'succes_officiels.json')
json.dump(out, open(dest, 'w'), ensure_ascii=False, indent=0)
print(len(out), 'succès officiels ->', dest)
