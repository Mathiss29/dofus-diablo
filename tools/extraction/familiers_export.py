"""Familiers officiels (maquette Familiers, ligne « 1A+1C+1D 2C 3A 4A 5A 6A ») : src/data/familiers.json + planches.

python familiers_export.py <tables> <fr.bin> <dossier Bones des familiers> [sortie sprites]
  tables : items, itemtypes, evolutiveeffects, evolutiveitemtypes, effects, characteristics (data_dump.py)
  Bones  : bones_assets_bone_<b>.bundle (b de familiers_squelettes.json) copiés depuis Characters/Bones du PC
           (cache-dofus/familiers/vrais-squelettes.tar)

Un familier (type 18) ou un familier d'apparat (type 249) se dessine avec le squelette de familiers_squelettes.json.
ATTENTION : son appearanceId n'est PAS un squelette (le serveur envoie le dessin) ; s'en servir dessinait un PNJ au hasard.
Seuls ceux dont le squelette a une animation de repos sont gardés. Planche = repos + course (ou marche) en diagonales 1 et 5, faite par monster_planche.py (ANIMS).
Bonus : evolutiveeffects (valeur au niveau 0 + gain par niveau jusqu'au niveau 100) ; courbe d'XP : evolutiveitemtypes.
Sources (1A) : SOURCES ci-dessous, familier -> monstres de sa famille qui vivent dans nos zones."""
import glob, json, os, re, subprocess, sys, warnings
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


SQ = json.load(open(os.path.join(HERE, 'familiers_squelettes.json'), encoding='utf-8'))['familiers']
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


fam, faits, porteurs = {}, {}, set()
for i, v in sorted(I.items()):
    if not v or int(v['typeId']) not in (18, 249): continue
    nom = T(int(v['nameId']))
    if not nom or '(MJ)' in nom: continue
    if str(i) not in SQ: continue   # dessin inconnu (pas de capture ni de PNJ du même nom)
    b = SQ[str(i)]['b']
    if b not in faits: faits[b] = anims(b)
    A = faits[b]
    if not A: continue
    e = {'nom': nom, 'niveau': int(v['level']), 'icon': int(v['iconId']), 'planche': f'fam_{b}', 'anims': A}
    if int(v['typeId']) == 249: e['apparat'] = True
    if SQ[str(i)].get('porteur'):   # aux couleurs du porteur : carte des zones de couleur, même disposition que la planche
        e['porteur'] = True; porteurs.add(b)
        z = sorted(glob.glob(os.path.join(out, f'fam_{b}_zones.*.webp')))
        if z: e['zones'] = os.path.basename(z[-1])
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
from concurrent.futures import ThreadPoolExecutor


def planche(b, A):
    r = subprocess.run([sys.executable, os.path.join(HERE, 'monster_planche.py'), str(b), f'fam_{b}', bones, out, 'x'],
                       env={**os.environ, 'ANIMS': ','.join(A), 'SCALE': os.environ.get('SCALE', '2.5')},
                       capture_output=True, text=True)
    print(b, (r.stdout.strip() or r.stderr[-300:]).splitlines()[-1:], flush=True)


# Carte des zones : chaque zone de couleur N en aplat de ZONES_RVB[N-1], le reste en noir (WebP sans perte).
# Le jeu (familierView.ts) y retrouve la zone de chaque pixel et teint la planche avec les couleurs du perso.
FORCE_Z = os.environ.get('FORCE')
ZONES_RVB = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff]


def zones(b, A):
    r = subprocess.run([sys.executable, os.path.join(HERE, 'monster_planche.py'), str(b), f'fam_{b}_zones', bones, out, 'x'],
                       env={**os.environ, 'ANIMS': ','.join(A), 'SCALE': os.environ.get('SCALE', '2.5'), 'ZONES': '1', 'FORMAT_PLANCHE': 'WEBP', 'SANS_PERTE': '1',
                            'COULEURS': ','.join(f'{i + 1}={c}' for i, c in enumerate(ZONES_RVB))}, capture_output=True, text=True)
    j = os.path.join(out, f'fam_{b}_zones.json')
    if os.path.exists(j):
        # remise à la disposition de la planche (l'ombre peut décaler la découpe d'un pixel) : chaque image de la carte est
        # recopiée à l'endroit de la même image dans la planche, en coordonnées de cellule
        from PIL import Image
        base, zj = json.load(open(os.path.join(out, f'fam_{b}.json'))), json.load(open(j))
        zim = {t['image']: Image.open(os.path.join(out, t['image'])).convert('RGBA') for t in zj['textures']}
        zf = {x['filename']: (zim[t['image']], x) for t in zj['textures'] for x in t['frames']}
        for t in base['textures']:
            img = Image.new('RGBA', (t['size']['w'], t['size']['h']))
            for x in t['frames']:
                if x['filename'] not in zf: continue
                zi, y = zf[x['filename']]
                F, S, ZF, ZS = x['frame'], x['spriteSourceSize'], y['frame'], y['spriteSourceSize']
                # rectangle commun, en coordonnées de cellule
                x0, y0 = max(S['x'], ZS['x']), max(S['y'], ZS['y'])
                x1, y1 = min(S['x'] + S['w'], ZS['x'] + ZS['w']), min(S['y'] + S['h'], ZS['y'] + ZS['h'])
                if x1 <= x0 or y1 <= y0: continue
                c = zi.crop((ZF['x'] + x0 - ZS['x'], ZF['y'] + y0 - ZS['y'], ZF['x'] + x1 - ZS['x'], ZF['y'] + y1 - ZS['y']))
                img.paste(c, (F['x'] + x0 - S['x'], F['y'] + y0 - S['y']))
            nom = t['image'].rsplit('.', 2)[0].replace(f'fam_{b}', f'fam_{b}_zones')
            import hashlib, io
            buf = io.BytesIO(); img.save(buf, 'WEBP', lossless=True, method=6)
            open(os.path.join(out, f'{nom}.{hashlib.md5(buf.getvalue()).hexdigest()[:8]}.webp'), 'wb').write(buf.getvalue())
        for t in zj['textures']: os.remove(os.path.join(out, t['image']))
        os.remove(j)
    print(b, 'zones', (r.stdout.strip() or r.stderr[-300:]).splitlines()[-1:], flush=True)


with ThreadPoolExecutor(int(os.environ.get('JOBS', os.cpu_count() or 4))) as ex:   # une planche par cœur
    for b, A in sorted(faits.items()):
        if not A or (os.path.exists(os.path.join(out, f'fam_{b}.json')) and not os.environ.get('FORCE')): continue
        ex.submit(planche, b, A)
with ThreadPoolExecutor(int(os.environ.get('JOBS', os.cpu_count() or 4))) as ex:
    for b in sorted(porteurs):
        if faits.get(b) and os.path.exists(os.path.join(out, f'fam_{b}.json')) and (FORCE_Z or not glob.glob(os.path.join(out, f'fam_{b}_zones.*.webp'))):
            ex.submit(zones, b, faits[b])
