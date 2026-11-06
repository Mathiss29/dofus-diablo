"""Catalogue officiel des sorts d'une classe pour l'onglet Sorts (src/data/sorts.json).

python class_spells.py <tables> <fr.bin> <sortie.json> iop:8 cra:9
  tables : dossier des tables sorties par data_dump.py (spells, spelllevels, spellvariants, breeds .json)
Pour chaque classe : les 22 paires officielles (spellvariantsdataroot : sort de base, variante), triées par niveau
d'obtention (puis dans l'ordre officiel de la classe, breedSpellsId). Chaque sort : id Dofus, nom, icône, description fr, et ses grades (spelllevels) : niveau requis
(minPlayerLevel), PA, portée en cases, relance en tours, lancers par tour et par cible, dommages du premier effet
de dommages (min, max, élément). Le jeu traduit en temps réel (1 tour = 3 s, 1 case = 48 px) dans src/sim/sorts.ts."""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from i18n import load as I18N  # noqa: E402

tables, frbin, out = sys.argv[1], sys.argv[2], sys.argv[3]
tr = I18N(frbin)


def table(n):
    d = json.load(open(os.path.join(tables, n + '.json')))
    R = {r['rid']: r['data'] for r in d['references']['RefIds']}
    o = d['objectsById']
    return {int(k): R.get(v['rid']) for k, v in zip(o['m_keys'], o['m_values'])}


S, L, V, B = table('spells'), table('spelllevels'), table('spellvariants'), table('breeds')
# Effets de dommages et de vol de vie : id -> élément
DMG = {96: 'eau', 97: 'terre', 98: 'air', 99: 'feu', 100: 'neutre', 91: 'eau', 92: 'terre', 93: 'air', 94: 'feu', 95: 'neutre', 2822: 'meilleur'}


def grade(l):
    g = {'niv': l['minPlayerLevel'], 'pa': l['apCost'], 'po': [l['minRange'], l['range']], 'relance': l['minCastInterval'],
         'parTour': l['maxCastPerTurn'], 'parCible': l['maxCastPerTarget']}
    for e in l['effects']:
        if e['effectId'] in DMG:
            g['dmg'] = [e['diceNum'], max(e['diceNum'], e['diceSide'])]
            g['element'] = DMG[e['effectId']]
            if e['effectId'] <= 95: g['vol'] = True
            break
    return g


def spell(sid):
    s = S[sid]
    return {'id': sid, 'name': tr(s['nameId']), 'icon': s['iconId'], 'desc': tr(s['descriptionId']),
            'grades': [grade(L[i]) for i in s['spellLevels'] if i in L]}


res = {}
for arg in sys.argv[4:]:
    key, breed = arg.split(':')
    pairs = [[spell(i) for i in v['spellIds']] for v in V.values() if v and v['breedId'] == int(breed)]
    # à niveau égal, l'ordre officiel de la classe (breedSpellsId : Pression avant Couperet...)
    order = [int(x) for x in (B[int(breed)]['breedSpellsId'] if isinstance(B[int(breed)]['breedSpellsId'], list) else eval(B[int(breed)]['breedSpellsId']))]
    rank = lambda p: min((order.index(s['id']) for s in p if s['id'] in order), default=99)
    pairs.sort(key=lambda p: (p[0]['grades'][0]['niv'], rank(p)))
    res[key] = pairs
    print(key, len(pairs), 'paires')
json.dump(res, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
