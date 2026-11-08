# archimonstres.py : version 0.3 (choix 15B) : les archimonstres officiels des monstres d'Astrub (monsters.correspondingMiniBossId).
# Dans Dofus, un archimonstre a le même dessin que son monstre (même gfxId, échelle à part) : on garde la planche du monstre,
# à l'échelle officielle de l'archimonstre, dorée comme les trois des Champs (render/looks.ts : archiDe + archiEchelle).
# Caractéristiques officielles du grade 1 (PV × 2,5 comme monster_stats.py, résistances, caracs), mêmes sorts que le monstre (vérifié :
# les archimonstres d'Astrub ont les sorts de leur monstre), XP au rapport des gradeXp officiels, sons du monstre.
# Ensuite : drops_ajout.py (butin officiel), puis icones_ajout.py.
# Usage : python archimonstres.py <dossier des tables (data_dump)> <fr.bin>
import json, math, os, re, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'extraction'))
from i18n import load as i18n
from monster_spells import table, P
from monster_stats import RES, CAR, BONUS, PV_MULT
tables, frbin = sys.argv[1:3]; T = i18n(frbin)
M = table(tables, 'monsters')
R = os.path.join(os.path.dirname(__file__), '..', '..')
PM, PS = os.path.join(R, 'src/data/monsters.json'), os.path.join(R, 'src/data/sons.json')
mons, sons = json.load(open(PM)), json.load(open(PS))
echelle = lambda look: int((re.match(r'\{\d+\|[^|]*\|[^|]*\|(\d+)', look) or [0, 100])[1]) / 100
n = 0
for key, md in list(mons.items()):
    m = M.get(int(md.get('dofusId', 0) or 0))
    if not m or md.get('archiDe') or md.get('elite') or md.get('boss') or key.startswith('archi_'): continue
    aid = int(m.get('correspondingMiniBossId') or 0); a = M.get(aid)
    if aid <= 0 or not a or f'archi_{key}' in mons: continue   # les trois des Champs (vagues) restent tels quels
    k = f'archi_{key}'
    gb, ga = P(m['grades'])[0], P(a['grades'])[0]; b = ga.get('bonusCharacteristics') or {}
    old = mons.get(k, {})
    md2 = {**md, **{kk: v for kk, v in old.items() if kk in ('look',)}}
    md2.update({'dofusId': aid, 'name': T(int(a['nameId'])), 'elite': True, 'archiDe': key,
                'archiEchelle': round(echelle(a['look']) / echelle(m['look']), 3) if echelle(m['look']) else 1,
                'hp': max(1, math.ceil(ga['lifePoints'] * PV_MULT)), 'level': ga['level'],
                'dmg': round(md['dmg'] * 1.6), 'speed': round(md['speed'] * 1.12), 'radius': md['radius'] + 2, 'mass': round(md['mass'] * 1.7, 2),
                'color': '#ffd27a', 'xp': max(1, round(md.get('xp', 1) * ga['gradeXp'] / max(1, gb['gradeXp']))),
                'res': {r: ga[v] + b.get(v, 0) for r, v in RES.items()},
                'caracs': {**{c: ga[v] + b.get(v, 0) for c, v in CAR.items()}, **{c: b.get(v, 0) for c, v in BONUS.items()}}})
    if k not in mons: md2['look'] = k
    mons[k] = md2
    if key in sons.get('monstres', {}) and k not in sons['monstres']: sons['monstres'][k] = sons['monstres'][key]
    n += 1; print(f'{k:28} {md2["name"]:28} pv {md2["hp"]:>5} xp {md2["xp"]:>4} échelle ×{md2["archiEchelle"]}')
json.dump(mons, open(PM, 'w'), ensure_ascii=False, indent=1)
json.dump(sons, open(PS, 'w'), ensure_ascii=False, indent=1)
print(n, 'archimonstres')
