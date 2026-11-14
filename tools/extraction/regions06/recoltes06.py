# recoltes06.py <dossier des cartes map_<id>.json> <tables (data_dump)> <fr.bin> : récoltes des 838 cartes du dehors de la 0.6.
# Avant : relevés officiels de ces cartes ajoutés à tools/contenu/recoltables_dofusdb.json (api.dofusdb.fr/recoltable, par 40 ids).
# Enchaîne recoltes.py (liste de la 0.6, clé v06), recoltes_cases.py sur cette seule liste (mise sous la clé astrub le temps du script),
# puis l'ajoute à la suite de la liste d'Astrub (en remplaçant les cartes de la 0.6 déjà présentes). Après coup :
# - les cailloux gris 2204 (Fer à Astrub) sont retirés des cartes dont le relevé n'a pas de Fer (aucune carte de la 0.6 n'en a) ;
# - les coins de pêche sans dessin animé (9248, 9255) prennent celui d'un autre remous (recoltes_gfx.DESSIN).
import json, os, subprocess, sys
cartes, tables, frbin = sys.argv[1:4]
ICI = os.path.dirname(os.path.abspath(__file__)); RAC = os.path.join(ICI, '..', '..', '..')
sys.path.insert(0, os.path.join(RAC, 'tools', 'contenu'))
from recoltes_gfx import DESSIN
OUT = os.path.join(RAC, 'src', 'data', 'recoltes.json')
LISTE = os.path.join(ICI, 'liste.json')
py = lambda *a: subprocess.run([sys.executable, *a], check=True)
py(os.path.join(RAC, 'tools/contenu/recoltes.py'), LISTE, cartes, tables, frbin, os.path.join(RAC, 'public/assets/mondes/astrub/monde.json'), 'v06')
d = json.load(open(OUT)); garde = d['astrub']; d['astrub'] = d.pop('v06')
json.dump(d, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
py(os.path.join(RAC, 'tools/contenu/recoltes_cases.py'), 'astrub', cartes)
d = json.load(open(OUT)); v06 = d['astrub']
rel = json.load(open(os.path.join(RAC, 'tools/contenu/recoltables_dofusdb.json')))['cartes']
mid = {m['tag']: m.get('id') for m in json.load(open(os.path.join(RAC, 'public/assets/mondes/astrub/monde.json')))['maps']}
tags = {k.replace(',', '_') for k in json.load(open(LISTE))}
out = []
for e in v06:
    if e[3] == 2204 and '312' not in rel.get(str(mid.get(e[0])), {}): continue
    out.append([e[0], e[1], e[2], DESSIN.get(e[3], e[3]), *e[4:]])
d['astrub'] = [e for e in garde if e[0] not in tags] + out
json.dump(d, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'récoltes sur les cartes de la 0.6 ;', len(d['astrub']), 'dans le monde d\'Astrub')
