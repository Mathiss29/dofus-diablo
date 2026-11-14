"""Intérieurs utiles des 5 régions de la 0.6 (choix de Mathis du 2026-11-14 : « les lieux utiles », pas les maisons vides).

Usage : python3 interieurs06.py <dossier des cartes map_<id>.json> <sortie liste.json>
  - écrit la liste à exporter (salles rangées en rangée y = 80/82 sous le continent, une case vide entre deux salles) ;
  - écrit les portes dans src/data/zones.json (astrub > open > portes, marquées `i06`), et la sous-zone 90011 « Souterrains des Porcos »
    (monstres du Territoire des Porcos, `interieur`).
Le lien porte -> salle n'existe que sur le serveur de Dofus : porte du dehors = élément interactif de la carte officielle aux mêmes
coordonnées (porte, cadre de mine, trou), choisi à l'œil ; dans un groupe, les salles sont reliées en chaîne comme les Égouts
(arrivée = case marchable la plus basse, passage vers la suivante = la plus haute). Puis export comme le Château d'Amakna :
PARTAGE=1 world_export.py, COURANTE=1 batiments.py, decor_par_carte.py, regions_monde.py joindre, monde_continent.py fusion,
`v06: 1`, regions_monde.py scinder.
"""
import json, os, sys
CARTES, OUT = sys.argv[1:3]
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..')
# (clé, nom, sous-zone en jeu, porte du dehors [carte, case], salles dans l'ordre)
GROUPES = [
    ('dede', 'Mine de Dédé', 168, ['-10_-11', 364], [150473730, 150471682, 150470658, 150472706, 150474754]),
    ('voyageurs', 'Tour des Voyageurs Dimensionnels', 525, ['-22_-24', 329],
     [130024961, 130155009, 130023939, 130155011, 130024963, 130025985, 130023937, 130025987]),
    ('grotte_rocailleuse', 'Grotte des Routes Rocailleuses', 525, ['-22_-27', 200],
     [168036352, 168035328, 168034306, 168034308, 168034310, 168034312]),
    ('cabane_rocailleuse', 'Cabane des Routes Rocailleuses', 525, ['-18_-33', 235], [166724096, 166725120]),
    ('porcos_mine', 'Souterrains des Porcos', 90011, ['0_33', 165],
     [30670848, 30671107, 30671110, 30671113, 30671116, 30672649, 30672652, 30672655, 30672658]),
    ('porcos_grotte', 'Souterrains des Porcos', 90011, ['1_32', 132], [30670855, 30670857, 30671879, 30671881, 30802951]),
    ('kanojedo', 'Le Kanojedo', 315, ['-4_24', 202], [199230724]),
    ('lisa_kaya', 'Taverne de Lisa Kaya', 600, ['-81_-41', 357], [54789135]),
    ('paradis', 'Taverne du Paradis Frigostien', 600, ['-77_-38', 249], [54791183, 54790159]),
    ('hdv_runes', 'Hôtel de vente des runes', 600, ['-83_-40', 288], [54530069]),
    ('taverne_argent', "Taverne d'Argent", 601, ['-77_-44', 397], [54536217, 54534169, 54535193]),
    ('medecin', 'Médecin de Frigost', 601, ['-80_-45', 220], [54534177, 54535201]),
    ('skis', 'Fabricant de skis', 601, ['-82_-46', 397], [54535195, 54534171]),
]

def marchables(m):
    cd = json.load(open(f'{CARTES}/map_{m}.json'))['mapData']['cellsData']
    return [c['cellNumber'] for c in cd if c['mov'] and not c.get('nonWalkableDuringRP')]

liste, portes, x, y = {}, [], -80, 80
for cle, nom, sz, dehors, salles in GROUPES:
    tags = [f'{cle}_{i + 1}' for i in range(len(salles))]
    for tag, m in zip(tags, salles):
        if x > 38: x, y = -80, y + 2
        liste[f'{x},{y}'] = [m, sz, {'tag': tag, 'inside': 1}]; x += 2
    bas = [max(marchables(m)) for m in salles]; haut = [min(marchables(m)) for m in salles]
    portes.append({'a': dehors, 'b': [tags[0], bas[0]], 'nom': nom, 'i06': 1})
    for i in range(len(salles) - 1):
        portes.append({'a': [tags[i], haut[i]], 'b': [tags[i + 1], bas[i + 1]], 'nom': nom, 'i06': 1})
json.dump(liste, open(OUT, 'w'), indent=0)
ZP = os.path.join(R, 'src/data/zones.json'); Z = json.load(open(ZP)); o = Z['astrub']['open']
o['portes'] = [p for p in o['portes'] if not p.get('i06')] + portes
s11 = o['subareas']['11']
o['subareas']['90011'] = {'name': 'Souterrains des Porcos', 'level': s11['level'], 'monsters': list(s11['monsters']), 'groupsPerMap': 1,
                          'groupSize': [2, 4], 'v06': True, 'region': s11.get('region', 'Amakna'), 'interieur': True}
open(ZP, 'w').write(json.dumps(Z, ensure_ascii=False, indent=1) + '\n')
print(len(liste), 'salles,', len(portes), 'portes')
