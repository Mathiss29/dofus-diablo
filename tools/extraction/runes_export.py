"""Runes de forgemagie officielles (maquette Forgemagie, 2026-11-07) -> src/data/forgemagie.json (runes) + ressources de items.json.

python runes_export.py <donnees> <fr.bin>
  donnees : tables sorties par data_dump.py (items.json, effects.json, characteristics.json de Dofus)
Garde les runes de type 78 (« Rune de forgemagie ») dont l'effet est une caractéristique du jeu.
Poids officiel d'une rune = valeur × effectPowerRate de son effet (Rune Fo 1, Rune Sa 3, Rune Ga Pa 100…).
Les icônes s'ajoutent ensuite à la planche avec icones_ajout.py <item_assets_1x.bundle> <iconId…> (la commande est affichée)."""
import ast, json, os, sys
from i18n import load as load_i18n

donnees, fr = sys.argv[1:3]
T = load_i18n(fr)
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
L = lambda v: v if isinstance(v, (list, dict)) else ast.literal_eval(v)


def table(n):
    d = json.load(open(os.path.join(donnees, n + '.json')))
    rf = {r['rid']: r['data'] for r in d['references']['RefIds']}
    o = d['objectsById']
    return {int(k): rf.get(v['rid']) for k, v in zip(o['m_keys'], o['m_values'])}, rf


# même correspondance que items_export.py (characteristics.keyword -> caractéristique du jeu)
CARAC = {'vitality': 'vitalite', 'wisdom': 'sagesse', 'strength': 'force', 'intelligence': 'intelligence', 'chance': 'chance',
         'agility': 'agilite', 'damagePercent': 'puissance', 'allDamageBonus': 'dommages', 'criticalHit': 'critique', 'healBonus': 'soins',
         'actionPoints': 'pa', 'movementPoints': 'pm', 'magicFind': 'prospection', 'range': 'portee', 'initiative': 'initiative',
         'earthDamageBonus': 'dommagesTerre', 'fireDamageBonus': 'dommagesFeu', 'waterDamageBonus': 'dommagesEau',
         'airDamageBonus': 'dommagesAir', 'neutralDamageBonus': 'dommagesNeutre',
         'earthElementResistPercent': 'resTerre', 'fireElementResistPercent': 'resFeu', 'waterElementResistPercent': 'resEau',
         'airElementResistPercent': 'resAir', 'neutralElementResistPercent': 'resNeutre',
         'earthElementReduction': 'redTerre', 'fireElementReduction': 'redFeu', 'waterElementReduction': 'redEau',
         'airElementReduction': 'redAir', 'neutralElementReduction': 'redNeutre',
         'tackleBlock': 'tacle', 'tackleEvade': 'fuite', 'DodgeApLostProbability': 'esquivePA', 'DodgeMpLostProbability': 'esquivePM',
         'apReduction': 'retraitPA', 'mpReduction': 'retraitPM', 'pushDamageBonus': 'dommagesPoussee', 'pushDamageReduction': 'resPoussee',
         'criticalDamageBonus': 'dommagesCritiques', 'criticalDamageReduction': 'resCritiques',
         'maxSummonedCreaturesBoost': 'invocations', 'weight': 'pods'}
I, RI = table('items'); E, _ = table('effects'); CH, _ = table('characteristics')

runes, poids, ressources = {}, {}, {}
for k, v in sorted(I.items()):
    if not v or int(v['typeId']) != 78: continue
    effs = [RI.get(r['rid']) for r in L(v['possibleEffects'])]
    effs = [e for e in effs if e]
    if len(effs) != 1: continue
    e = E.get(int(effs[0]['effectId'])) or {}
    kw = (CH.get(int(e.get('characteristic') or 0)) or {}).get('keyword')
    if kw not in CARAC or e.get('characteristicOperator') != '+': continue
    stat, val, rate = CARAC[kw], int(effs[0].get('diceNum', 0)), float(e['effectPowerRate'])
    if val <= 0: continue
    runes[str(k)] = {'stat': stat, 'val': val, 'poids': round(val * rate, 2)}
    poids[stat] = round(rate, 3)
    ressources[str(k)] = {'name': T(int(v['nameId'])), 'icon': int(v['iconId']), 'level': int(v['level']), 'rune': True}

P = os.path.join(R, 'src/data/forgemagie.json')
fm = json.load(open(P)) if os.path.exists(P) else {}
fm['runes'] = runes; fm['poids'] = dict(sorted(poids.items()))
json.dump(fm, open(P, 'w'), ensure_ascii=False, indent=1)
IP = os.path.join(R, 'src/data/items.json')
items = json.load(open(IP))
items['resources'].update(ressources)
open(IP, 'w').write(json.dumps(items, ensure_ascii=False, indent=1) + '\n')
print(len(runes), 'runes ;', len(poids), 'caractéristiques')
print('icônes : python icones_ajout.py <item_assets_1x.bundle>', ' '.join(sorted({str(r['icon']) for r in ressources.values()})))
