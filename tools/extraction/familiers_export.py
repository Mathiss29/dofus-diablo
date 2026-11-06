"""Familiers officiels (maquette Familiers, ligne « 1A+1C+1D 2C 3A 4A 5A 6A ») : src/data/familiers.json + planches.

python familiers_export.py <tables> <fr.bin> <dossier Bones des familiers> [sortie sprites]
  tables : items, itemtypes, evolutiveeffects, evolutiveitemtypes, effects, characteristics (data_dump.py)
  Bones  : bones_assets_bone_<appearanceId>.bundle copiés depuis Characters/Bones du PC (cache-dofus/familiers/bones.tgz)

Un familier (type 18) ou un familier d'apparat (type 249) se dessine avec le squelette dont l'id est son appearanceId.
Seuls ceux dont le squelette a une animation de repos sont gardés (le jeu télécharge les autres à la demande :
ils manquent au PC). Planche = repos + course (ou marche) en diagonales 1 et 5, faite par monster_planche.py (ANIMS).
Bonus : evolutiveeffects (valeur au niveau 0 + gain par niveau jusqu'au niveau 100) ; courbe d'XP : evolutiveitemtypes.
Sources (1A) : SOURCES ci-dessous, familier -> monstres de sa famille qui vivent dans nos zones."""
import json, os, re, subprocess, sys, warnings
import UnityPy
from i18n import load as load_i18n
warnings.filterwarnings('ignore'); UnityPy.config.FALLBACK_UNITY_VERSION = '6000.3.16f1'

HERE = os.path.dirname(os.path.abspath(__file__)); R = os.path.join(HERE, '..', '..')
tables, fr, bones = sys.argv[1:4]
out = sys.argv[4] if len(sys.argv) > 4 else os.path.join(R, 'public/assets/sprites')
T = load_i18n(fr)


def table(n):
    d = json.load(open(os.path.join(tables, n + '.json')))
    Rf = {r['rid']: r['data'] for r in d['references']['RefIds']}
    o = d['objectsById']
    return {int(k): Rf.get(v['rid']) for k, v in zip(o['m_keys'], o['m_values'])}


I, EV, EVT, EFF, CH = (table(n) for n in ('items', 'evolutiveeffects', 'evolutiveitemtypes', 'effects', 'characteristics'))
# même correspondance que items_export.py (characteristics.keyword -> caractéristique du jeu)
sys.argv = sys.argv[:1]
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
STAT = {}
for eid, e in EFF.items():
    kw = (CH.get(int(e.get('characteristic') or 0)) or {}).get('keyword')
    if kw in CARAC and e.get('characteristicOperator') == '+': STAT[eid] = CARAC[kw]

# 1A : familier -> monstres de sa famille dans nos zones (ids de src/data/monsters.json). Les autres viendront avec leurs zones.
SOURCES = {
    'Jeune Boufton Céleste': ['bouftou_nuageux', 'bouftor_ethere', 'boufton_palichon', 'boufton_orageux'],
    'Pioute violet': ['piou_violet', 'piou_rouge', 'piou_vert', 'piou_bleu', 'piou_rose', 'piou_jaune'],
    'Fotome': ['kardorim'],
    'Tofüm': ['tofu_chimerique', 'tofu_malade'],
}
# 1C : récompenses de succès (src/data/quetes.json, tools/contenu/quetes.py)
SUCCES = {'Chienchien': 'dans_les_nuages'}


def anims(b):
    f = os.path.join(bones, f'bones_assets_bone_{b}.bundle')
    if not os.path.exists(f): return None
    n = [o.read().m_Name.split('_', 1)[1] for o in UnityPy.load(f).objects if o.type.name == 'TextAsset' and 'Anim' in o.read().m_Name]
    rep = [a for a in ('AnimStatique_1', 'AnimStatique_5') if a in n]
    if not rep: return None
    mv = next(([f'{k}_1', f'{k}_5'] for k in ('AnimCourse', 'AnimMarche') if f'{k}_1' in n), [])
    return rep + [a for a in mv if a in n]


fam, faits = {}, {}
for i, v in sorted(I.items()):
    if not v or int(v['typeId']) not in (18, 249): continue
    nom = T(int(v['nameId']))
    if not nom or '(MJ)' in nom: continue
    b = int(v['appearanceId'])
    if b not in faits: faits[b] = anims(b)
    A = faits[b]
    if not A: continue
    e = {'nom': nom, 'niveau': int(v['level']), 'icon': int(v['iconId']), 'planche': f'fam_{b}', 'anims': A}
    if int(v['typeId']) == 249: e['apparat'] = True
    else:
        st = []
        for x in v['evolutiveEffectIds']:
            ev = EV.get(int(x)); s = ev and STAT.get(int(ev['actionId']))
            if not s: continue
            r = ev['progressionPerLevelRange']
            base, par = r[0]['values'][1], (r[1]['values'][1] if len(r) > 1 else 0)
            if base + 100 * par >= 1: st.append([s, round(base, 2), round(par, 4)])
        e['stats'] = st
        if nom in SOURCES: e['monstres'] = SOURCES[nom]
        if nom in SUCCES: e['succes'] = SUCCES[nom]
    if os.path.exists(os.path.join(out, f'fam_{b}.json')) or not os.environ.get('SANS_PLANCHES'): fam[str(i)] = e   # planche ratée (ex. 1804) : écarté
courbe = EVT[1]['experienceByLevel']
json.dump({'_': 'Fait par tools/extraction/familiers_export.py. stats = [carac, valeur au niveau 0, gain par niveau] ; xp = XP totale par niveau (evolutiveitemtypes 1).',
           'xp': courbe[:101], 'familiers': fam}, open(os.path.join(R, 'src/data/familiers.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(fam), 'familiers', sum(1 for x in fam.values() if x.get('apparat')), 'apparats,', sum(1 for x in faits.values() if x), 'planches')
if os.environ.get('SANS_PLANCHES'): sys.exit()   # relancer ensuite avec SANS_PLANCHES=1 pour écarter les planches ratées
for b, A in sorted(faits.items()):
    if not A or (os.path.exists(os.path.join(out, f'fam_{b}.json')) and not os.environ.get('FORCE')): continue
    r = subprocess.run([sys.executable, os.path.join(HERE, 'monster_planche.py'), str(b), f'fam_{b}', bones, out, 'x'],
                       env={**os.environ, 'ANIMS': ','.join(A), 'SCALE': os.environ.get('SCALE', '2.5')}, capture_output=True, text=True)
    print(b, (r.stdout.strip() or r.stderr[-300:]).splitlines()[-1:])
