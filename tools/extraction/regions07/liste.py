"""Régions de la 0.7 (ligne « 0.7 : » 1A-1E, 2026-11-27) : liste des cartes du dehors à exporter.

Usage : python3 liste.py <dossier des tables data_dump (mapsinformation)> > liste.json
Otomaï (454, 457, 471, 468 + Village côtier 466 : Zaap et bateau officiels), Cania nord (55, 69, 523), Koalaks haut (230, 275), Pandala (942, 941, 944 + Village de Pandala 951 : Zaap officiel), Champs de glace (602) : cartes worldMap 1, sans les copies en (0, 0) ;
coordonnée doublée = la carte aux bits 23-24 de m_flags les plus hauts (comme les régions de la 0.6). Format : {"x,y": [mapId, sous-zone]}.
"""
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from monster_spells import table  # noqa: E402
SOUS_ZONES = (454, 457, 471, 468, 466, 55, 69, 523, 230, 275, 942, 941, 944, 951, 602)
MI = table(sys.argv[1], 'mapsinformation')
out = {}
for k, m in MI.items():
    s, x, y = int(m['subAreaId']), int(m['posX']), int(m['posY'])
    if s not in SOUS_ZONES or int(m['worldMap']) != 1 or (x, y) == (0, 0): continue
    c = f'{x},{y}'; poids = (int(m['m_flags']) >> 23) & 3
    if c not in out or poids > out[c][2]: out[c] = [int(m.get('id', k)), s, poids]
print(json.dumps({c: v[:2] for c, v in sorted(out.items())}))
