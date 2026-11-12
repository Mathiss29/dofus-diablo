# archis_ames.py : maquette « Archis : » 6A (2026-11-12) : une âme par archimonstre, comme dans Dofus 3.
# Chaque archimonstre du jeu reçoit son objet officiel « Âme capturée : <nom> » (items de type 328, relié par dropMonsterIds) :
#   monsters.json : archi_<x>.ame = id de l'objet ; items.json : resources[id] = { name, icon, level, ame: 'archi_<x>' }.
# 9C : les boss de donjon ont aussi la leur (type 327, icône 85004 : icones_ajout.py <item_assets_2x.bundle> 85004).
# L'icône (85003) est celle de la Pierre d'âme d'Archimonstre, déjà dans les planches.
# Usage : python archis_ames.py <dossier des tables (data_dump, avec items.json)> <fr.bin>
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'extraction'))
from i18n import load as i18n
from monster_spells import table
tables, frbin = sys.argv[1:3]; T = i18n(frbin)
R = os.path.join(os.path.dirname(__file__), '..', '..')
PM, PI = os.path.join(R, 'src/data/monsters.json'), os.path.join(R, 'src/data/items.json')
mons, items = json.load(open(PM)), json.load(open(PI))
par_monstre = {}
for i, it in table(tables, 'items').items():
    if it and it.get('typeId') in (327, 328):   # 328 : archimonstres ; 327 : boss de donjon (« Archis : » 9C)
        for m in it['dropMonsterIds']: par_monstre[m] = (str(i), it)
n = 0
for k, md in mons.items():
    if not md.get('archiDe') and not (md.get('boss') and md.get('dofusId') in par_monstre): continue
    i, it = par_monstre[md['dofusId']]
    md['ame'] = i
    items['resources'][i] = {'name': T(int(it['nameId'])), 'icon': it['iconId'], 'level': it['level'], 'ame': k}
    n += 1
json.dump(mons, open(PM, 'w'), ensure_ascii=False, indent=1)
json.dump(items, open(PI, 'w'), ensure_ascii=False, indent=1)
print(n, 'âmes')
