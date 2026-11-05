# monster_stats.py <dossier des tables (json de data_dump.py)> [src/data/monsters.json]
# Caractéristiques OFFICIELLES de chaque monstre (grade 1 de monstersdataroot.grades), choix 19A et 10D de Mathis :
#  - PV = PV officiels × PV_MULT (2,5 : « ×2 à ×3, jeu rapide façon Diablo 3 ») ; les boss gardent leurs PV du jeu ;
#  - résistances officielles par élément (%), niveau, et caractéristiques (Force, Intelligence, Chance, Agilité, Sagesse,
#    Esquive PA / PM, Tacle, Fuite, Retrait PA) dans le champ « caracs ».
# L'XP donnée reste celle du jeu (champ xp figé si absent), pour ne pas changer la progression.
import sys, os, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from monster_spells import table, P

PV_MULT = float(os.environ.get('PV_MULT', '2.5'))
RES = {'terre': 'earthResistance', 'feu': 'fireResistance', 'eau': 'waterResistance', 'air': 'airResistance', 'neutre': 'neutralResistance'}
CAR = {'force': 'strength', 'intelligence': 'intelligence', 'chance': 'chance', 'agilite': 'agility', 'sagesse': 'wisdom',
       'esquivePA': 'paDodge', 'esquivePM': 'pmDodge'}
BONUS = {'tacle': 'tackleBlock', 'fuite': 'tackleEvade', 'retraitPA': 'aPRemoval'}

def main(d, out='src/data/monsters.json'):
    M = table(d, 'monsters'); ours = json.load(open(out))
    for key, md in ours.items():
        m = M.get(md.get('dofusId', -1))
        if not m: continue
        g = P(m['grades'])[0]; b = g.get('bonusCharacteristics') or {}
        if 'xp' not in md: md['xp'] = round(md['hp'] / 5)
        if not md.get('boss'): md['hp'] = max(1, math.ceil(g['lifePoints'] * PV_MULT))
        md['level'] = g['level']
        md['res'] = {k: g[v] + b.get(v, 0) for k, v in RES.items()}
        md['caracs'] = {**{k: g[v] + b.get(v, 0) for k, v in CAR.items()}, **{k: b.get(v, 0) for k, v in BONUS.items()}}
        print(f"{key:20} pv {md['hp']:>4} res {md['res']}")
    json.dump(ours, open(out, 'w'), ensure_ascii=False, indent=1)

if __name__ == '__main__': main(*sys.argv[1:])
