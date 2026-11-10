# trophees.py : « 0.4 suite : 3A+3B » (2026-11-10) : les 85 trophées officiels du niveau 50 (type 151) dans src/data/dofus.json (clé « trophees »).
# Ils se portent dans les 6 emplacements de Dofus (comme dans Dofus 3), à partir du niveau 50, une fois chacun.
# 3A : chaque boss de la 0.4 lâche 2 trophées en butin rare (répartis une fois pour toutes, tirage à graine fixe : aucun boss ne les lâche dans Dofus).
# 3B : le Façonneur les fabrique avec leur recette officielle, sans les Galets et la Pépite (monnaies de Kolizéum et d'événement, absentes du jeu).
#      Une recette n'entre dans items.json que si tous ses ingrédients existent dans le jeu : relancer ce script après chaque ajout de ressources.
# Les trophées sont aussi rangés dans items.resources (nom, icône, niveau) pour les fenêtres d'Artisanat et de butin.
# Usage : python trophees.py <tables Dofus (data_dump : items, recipes, effects, characteristics)> <fr.bin>   puis   icones_ajout.py <bundle> <icônes listées>
import ast, json, os, random, sys
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
sys.path.insert(0, os.path.join(R, 'tools', 'extraction'))
from i18n import load as i18n
tables, frbin = sys.argv[1:3]; T = i18n(frbin)
L = lambda v: v if isinstance(v, (list, dict)) else ast.literal_eval(v)
def table(n):
    d = json.load(open(os.path.join(tables, n + '.json'))); RR = {r['rid']: r['data'] for r in d['references']['RefIds']}; o = d['objectsById']
    return {int(k): RR.get(v['rid']) for k, v in zip(o['m_keys'], o['m_values'])}, RR
I, RI = table('items'); REC, _ = table('recipes'); EFF, _ = table('effects'); CH, _ = table('characteristics')
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
STATS = {}
for eid, e in EFF.items():
    kw = (CH.get(int(e.get('characteristic') or 0)) or {}).get('keyword')
    if kw in CARAC and e.get('characteristicOperator') in ('+', '-'): STATS[eid] = (CARAC[kw], 1 if e['characteristicOperator'] == '+' else -1)
SANS = {'Galet cramoisi', 'Galet Saisonnier', 'Pépite'}
BOSS = ['scarabosse_dore', 'chafer_ronin', 'batofu', 'directeur_grunob', 'bworkette', 'coffre_des_forgerons', 'kwakwa', 'shin_larve',
        'craqueleur_legendaire', 'wa_wobot', 'wa_wabbit']

P = os.path.join(R, 'src/data/dofus.json'); D = json.load(open(P))
PI = os.path.join(R, 'src/data/items.json'); G = json.load(open(PI))
tro = {}
for k, v in sorted(I.items()):
    if not v or int(v['typeId']) != 151 or int(v['level']) != 50: continue
    st = {}
    for r in L(v['possibleEffects']):
        e = RI.get(r['rid']) or {}
        s = STATS.get(int(e.get('effectId', 0)))
        if s: st[s[0]] = st.get(s[0], 0) + s[1] * int(e.get('diceNum', 0))
    if not st: continue
    tro[str(k)] = {'nom': T(int(v['nameId'])), 'niveau': 50, 'icon': int(v['iconId']), 'stats': st}
ids = sorted(tro); random.Random(50).shuffle(ids)
for i, b in enumerate(BOSS):
    for t in ids[2 * i:2 * i + 2]: tro[t]['boss'] = b
have = set(G['resources']) | set(tro)
G['recipes'] = [r for r in G['recipes'] if r['result'] not in tro]
n = 0
for r in REC.values():
    if not r or str(r['resultId']) not in tro: continue
    ing = [[str(i), int(q)] for i, q in zip(L(r['ingredientIds']), L(r['quantities'])) if T(int(I[int(i)]['nameId'])) not in SANS]
    if not all(i in G['resources'] for i, _ in ing): continue
    G['recipes'].append({'result': str(r['resultId']), 'metier': 'faconneur', 'level': int(r['resultLevel']), 'ingredients': ing}); n += 1
G['recipes'].sort(key=lambda r: r['level'])
for k, t in tro.items(): G['resources'][k] = {'name': t['nom'], 'icon': t['icon'], 'level': 50, 'trophee': True}
D['trophees'] = tro
json.dump(D, open(P, 'w'), ensure_ascii=False, indent=1)
json.dump(G, open(PI, 'w'), ensure_ascii=False, indent=1)
print(len(tro), 'trophées ;', n, 'recettes du Façonneur ; icônes :', ' '.join(map(str, sorted({t['icon'] for t in tro.values()}))))
