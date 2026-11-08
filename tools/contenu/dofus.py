# dofus.py : version 0.3 (ligne « Dofus 0.3 : 1A 2B 3A 4C 5A+5B ») : les 31 Dofus officiels dans src/data/dofus.json.
# Lit les Dofus (type 23) et leurs passifs déjà extraits pour la maquette des Dofus (/mnt/project-files/dofus-passifs/dofus2.json,
# dof.py), les passifs traduits en temps réel et validés (trad.json), et les tables effects/characteristics de Dofus (stats).
# « jeu » : passif codé dans src/sim/dofus.ts (Argenté et Cacao en 0.3). « source » : où le trouver (maquettes Dofus, Enfers, Uniques).
# Usage : python dofus.py <dossier dofus-passifs> <tables Dofus (effects.json, characteristics.json)>
import json, os, sys
R = os.path.join(os.path.dirname(__file__), '..', '..')
src, tables = sys.argv[1:3]
sys.path.insert(0, os.path.join(R, 'tools', 'extraction'))
def table(n):
    d = json.load(open(os.path.join(tables, n + '.json')))
    RR = {r['rid']: r['data'] for r in d['references']['RefIds']}
    o = d['objectsById']
    return {int(k): RR.get(v['rid']) for k, v in zip(o['m_keys'], o['m_values'])}
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
         'pushDamageReduction': 'resPoussee', 'criticalDamageReduction': 'resCritiques', 'maxSummonedCreaturesBoost': 'invocations'}
EFF, CH = table('effects'), table('characteristics')
STATS = {}
for eid, e in EFF.items():
    kw = (CH.get(int(e.get('characteristic') or 0)) or {}).get('keyword')
    if kw in CARAC and e.get('characteristicOperator') in ('+', '-'): STATS[eid] = (CARAC[kw], 1 if e['characteristicOperator'] == '+' else -1)
D = json.load(open(os.path.join(src, 'dofus2.json'))); T = json.load(open(os.path.join(src, 'trad.json')))
JEU = {19629: 'argente', 20987: 'cacao'}
CLE = {19629: 'argente', 20987: 'cacao', 972: 'cawotte', 16061: 'veilleurs'}
SOURCE = {'Dofus Argenté': 'Quête « L\'œuf d\'argent » (Gawdien du Dofus, Bastion des Douze)', 'Dofus Cacao': 'Quête « L\'œuf en chocolat » (Gawdien du Dofus, Bastion des Douze)',
  'Dofus Cawotte': 'Quête, avec Amakna', 'Dofus des Veilleurs': 'Quête, avec Amakna', 'Dofus Argenté Scintillant': 'Quête au niveau 200, avec le Dofus Argenté',
  'Dofus Ocre': 'Sa propre quête (plus tard)', 'Dofus Vulbis': 'Crocabulia (boss de donjon), très rare', 'Dofus Kaliptus': 'Repaire de Skeunk',
  'Dofus des Glaces': 'Les Enfers : Harebourg', 'Dofus Abyssal': 'Les Enfers : Dantinéa', 'Dofus Turquoise': 'Les Enfers : Meno', 'Dofus Pourpre': 'Les Enfers : Solar',
  'Dofus Tacheté': 'Les Enfers : Bethel Akarna', 'Dofus Émeraude': 'Les Enfers : Torkélonia', 'Dofus Ivoire': 'Les Enfers : Ilyzaelle', 'Dofus Ébène': 'Les Enfers : Dazak',
  'Dofus Forgelave': 'Les Enfers : Kabahal', 'Dofus Sylvestre': 'Les Enfers : Belladone', 'Dofus Nébuleux': 'Les Enfers : Éternel Conflit'}
vus = {}
for x in D:   # doublons officiels (2 Cacao, 2 Vulbis, 2 Sylvestre) : on garde celui qui a un passif
    if x['nom'] not in vus or (x['passif'] and not vus[x['nom']]['passif']): vus[x['nom']] = x
out = {}
for x in sorted(vus.values(), key=lambda x: (x['niv'], x['nom'])):
    st = {}
    for r in x['raw']:
        s = STATS.get(r['effectId'])
        if s: st[s[0]] = st.get(s[0], 0) + s[1] * max(r['diceNum'], r['diceSide'])   # Dofus : jet maximum (objet unique, jets parfaits)
    t = T.get(str(x['id'])); p = x['passif'] or {}
    out[str(x['id'])] = {'nom': x['nom'], 'niveau': x['niv'], 'icon': x['icon'], 'stats': st,
        **({'passif': {'nom': p.get('nom', ''), 'texte': t[0] if t else ''}} if p.get('nom') and (t or p.get('texte')) else {}),
        **({'cle': CLE[x['id']]} if x['id'] in CLE else {}), **({'jeu': True} if x['id'] in JEU else {}),
        'source': SOURCE.get(x['nom'], "Les Enfers (n'importe quel seigneur)")}
json.dump({'_': 'Dofus officiels (0.3, tools/contenu/dofus.py) : stats au jet maximum, passif traduit en temps réel, source. jeu = passif codé (src/sim/dofus.ts).',
           'dofus': out}, open(os.path.join(R, 'src/data/dofus.json'), 'w'), ensure_ascii=False, indent=1)
print(len(out), 'Dofus ;', [v['nom'] for v in out.values() if v.get('jeu')])
