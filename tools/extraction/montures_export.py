"""Montures officielles (0.7, lignes « 17A+17C » et « Élevage : ») : src/data/montures.json + planches.

python montures_export.py <tables> <fr.bin> [dossier Bones] [sortie sprites]
  tables : mounts, mountbehaviors, effects (data_dump.py)
  Bones  : bones_assets_bone_639.bundle (Dragodinde) et bone_3588.bundle (Muldo), copiés depuis Characters/Bones du PC.
           Sans dossier Bones : seulement le JSON.

Races : familles 1 (Dragodinde, squelette 639) et 5 (Muldo, 3588) de la table mounts, sans les sauvages (ce sont nos monstres)
ni les montures spéciales (armure, plumes). couleurs = les 4 couleurs du look « {639||1=..,2=..,3=..,4=..|120} ».
stats = bonus officiels au niveau 100 (diceSide des effets ; le jeu les ramène au niveau de la monture).
Générations (arbre officiel, guidactik « généalogie ») : couleurs simples de génération 1, 3, 5, 7, 9 ci-dessous,
une race bicolore = la plus haute de ses deux couleurs + 1 (Amande et Rousse = 2, Prune et Ivoire = 10).
Planches : un seul dessin gris par squelette (repos + course, diagonales 1 et 5) et sa carte des zones de couleur ;
le jeu teint la planche avec les couleurs de la race (teinteFamilier.ts), comme les familiers « aux couleurs du porteur »."""
import glob, hashlib, io, json, os, subprocess, sys, warnings
from i18n import load as load_i18n
warnings.filterwarnings('ignore')

HERE = os.path.dirname(os.path.abspath(__file__)); R = os.path.join(HERE, '..', '..')
tables, fr = sys.argv[1:3]
bones = sys.argv[3] if len(sys.argv) > 3 else None
out = sys.argv[4] if len(sys.argv) > 4 else os.path.join(R, 'public/assets/sprites')
T = load_i18n(fr)


def table(n):
    d = json.load(open(os.path.join(tables, n + '.json')))
    Rf = {r['rid']: r['data'] for r in d['references']['RefIds']}
    o = d['objectsById']
    return {int(k): Rf.get(v['rid']) for k, v in zip(o['m_keys'], o['m_values'])}, Rf


M, MR = table('mounts')
B, _ = table('mountbehaviors')
# effectId officiel -> caractéristique du jeu (220 Dommages renvoyés : pas de caractéristique chez nous)
EFFET = {115: 'critique', 117: 'portee', 118: 'force', 119: 'agilite', 123: 'chance', 125: 'vitalite', 126: 'intelligence',
         128: 'pm', 138: 'puissance', 160: 'esquivePA', 161: 'esquivePM', 174: 'initiative', 176: 'prospection', 178: 'soins',
         182: 'invocations', 210: 'resTerre', 211: 'resEau', 212: 'resAir', 213: 'resFeu', 214: 'resNeutre',
         418: 'dommagesCritiques', 752: 'fuite', 753: 'tacle'}
FAMILLES = {1: ('dragodinde', 639, 'Dragodinde '), 5: ('muldo', 3588, 'Muldo ')}
GEN = {'dragodinde': {'Rousse': 1, 'Amande': 1, 'Dorée': 1, 'Indigo': 3, 'Ébène': 3, 'Pourpre': 5, 'Orchidée': 5,
                      'Ivoire': 7, 'Turquoise': 7, 'Émeraude': 9, 'Prune': 9},
       'muldo': {'Ébène': 1, 'Orchidée': 1, 'Pourpre': 1, 'Indigo': 1, 'Doré': 1, 'Amande': 3, 'Roux': 3, 'Ivoire': 5,
                 'Turquoise': 5, 'Émeraude': 7, 'Prune': 7, 'Ambre': 9, 'Corail': 9, 'Azur': 9, 'Aigue-marine': 9}}
# monstres sauvages (src/data/monsters.json) -> race obtenue à la capture
SAUVAGES = {'dragodinde_amande_sauvage': 'Amande', 'dragodinde_rousse_sauvage': 'Rousse', 'dragodinde_doree_sauvage': 'Dorée',
            'muldo_indigo_sauvage': 'Indigo', 'muldo_ebene_sauvage': 'Ébène', 'muldo_orchidee_sauvage': 'Orchidée',
            'muldo_pourpre_sauvage': 'Pourpre', 'muldo_dore_sauvage': 'Doré'}
norme = lambda s: s.replace('Aigue-Marine', 'Aigue-marine').replace('Emeraude', 'Émeraude')


def couleurs(look):
    c = {}
    for kv in look.split('|')[2].split(','):
        k, v = kv.split('=')
        c[int(k)] = int(v[1:], 16) if v.startswith('#') else int(v)
    return [c.get(i, 0) for i in range(1, 5)]


races = {}
for i, m in sorted(M.items()):
    if m['familyId'] not in FAMILLES: continue
    fam, os_, pre = FAMILLES[m['familyId']]
    nom = T(int(m['nameId'])) or ''
    if not nom.startswith(pre) or 'Sauvage' in nom or not m['look'].startswith('{%d|' % os_): continue
    if m['look'].split('|')[1]: continue   # skin en plus (armure) : monture spéciale
    cs = norme(nom[len(pre):]).split(' et ')
    if any(c not in GEN[fam] for c in cs): continue
    g = GEN[fam][cs[0]] if len(cs) == 1 else max(GEN[fam][c] for c in cs) + 1
    st = []
    for e in m['effects'] or []:
        ef = MR[e['rid']]; s = EFFET.get(int(ef['effectId']))
        if s and int(ef['diceSide']) > 0: st.append([s, int(ef['diceSide'])])
    races[str(i)] = {'nom': nom, 'famille': fam, 'gen': g, 'couleurs': cs, 'teinte': couleurs(m['look']), 'stats': st}
par_nom = {(r['famille'], tuple(sorted(r['couleurs']))): k for k, r in races.items()}
sauvages = {}
for mon, c in SAUVAGES.items():
    fam = 'muldo' if mon.startswith('muldo') else 'dragodinde'
    k = par_nom.get((fam, (c,)))
    if k: sauvages[mon] = k
capacites = {str(i): {'nom': T(int(b['nameId'])), 'officiel': T(int(b['descriptionId'])).split('\n')[0]} for i, b in sorted(B.items()) if i <= 9}
planches = {'dragodinde': 'mont_639', 'muldo': 'mont_3588'}
zones = {}
for fam, p in planches.items():
    z = sorted(glob.glob(os.path.join(out, f'{p}_zones.*.webp')))
    if z: zones[fam] = os.path.basename(z[-1])
doc = {'_': 'Fait par tools/extraction/montures_export.py (table mounts de Dofus 3). stats = [carac, valeur au niveau 100] ; '
            'teinte = couleurs 1 à 4 du look officiel ; gen = génération de l\'arbre officiel.',
       'races': races, 'sauvages': sauvages, 'capacites': capacites, 'planches': planches, 'zones': zones}
json.dump(doc, open(os.path.join(R, 'src/data/montures.json'), 'w'), ensure_ascii=False, indent=0)
print(len(races), 'races', {f: sum(1 for r in races.values() if r['famille'] == f) for f in planches}, 'sauvages', len(sauvages))
if not bones: sys.exit()

ANIMS = 'AnimStatique_1,AnimStatique_5,AnimCourse_1,AnimCourse_5'
ZONES_RVB = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff]


def lancer(b, nom, **env):
    r = subprocess.run([sys.executable, os.path.join(HERE, 'monster_planche.py'), str(b), nom, bones, out, 'x'],
                       env={**os.environ, 'ANIMS': ANIMS, 'SCALE': os.environ.get('SCALE', '2.5'), **env}, capture_output=True, text=True)
    print(nom, (r.stdout.strip() or r.stderr[-300:]).splitlines()[-1:], flush=True)


def carte(b, p):
    """Carte des zones (même méthode que familiers_export.py) remise à la disposition de la planche grise."""
    from PIL import Image
    lancer(b, f'{p}_zones', ZONES='1', FORMAT_PLANCHE='WEBP', SANS_PERTE='1', COULEURS=','.join(f'{i + 1}={c}' for i, c in enumerate(ZONES_RVB)))
    j = os.path.join(out, f'{p}_zones.json')
    if not os.path.exists(j): return
    base, zj = json.load(open(os.path.join(out, f'{p}.json'))), json.load(open(j))
    zim = {t['image']: Image.open(os.path.join(out, t['image'])).convert('RGBA') for t in zj['textures']}
    zf = {x['filename']: (zim[t['image']], x) for t in zj['textures'] for x in t['frames']}
    for f in glob.glob(os.path.join(out, f'{p}_zones.*.webp')): os.remove(f)   # images lues : on réécrit à la disposition de la planche
    for t in base['textures']:
        img = Image.new('RGBA', (t['size']['w'], t['size']['h']))
        for x in t['frames']:
            if x['filename'] not in zf: continue
            zi, y = zf[x['filename']]
            F, S, ZF, ZS = x['frame'], x['spriteSourceSize'], y['frame'], y['spriteSourceSize']
            x0, y0 = max(S['x'], ZS['x']), max(S['y'], ZS['y'])
            x1, y1 = min(S['x'] + S['w'], ZS['x'] + ZS['w']), min(S['y'] + S['h'], ZS['y'] + ZS['h'])
            if x1 <= x0 or y1 <= y0: continue
            img.paste(zi.crop((ZF['x'] + x0 - ZS['x'], ZF['y'] + y0 - ZS['y'], ZF['x'] + x1 - ZS['x'], ZF['y'] + y1 - ZS['y'])),
                      (F['x'] + x0 - S['x'], F['y'] + y0 - S['y']))
        nom = t['image'].rsplit('.', 2)[0].replace(p, f'{p}_zones')
        buf = io.BytesIO(); img.save(buf, 'WEBP', lossless=True, method=6)
        open(os.path.join(out, f'{nom}.{hashlib.md5(buf.getvalue()).hexdigest()[:8]}.webp'), 'wb').write(buf.getvalue())
    os.remove(j)


for fam, p in planches.items():
    b = p.split('_')[1]
    for f in glob.glob(os.path.join(out, f'{p}.*')) + glob.glob(os.path.join(out, f'{p}_zones.*')): os.remove(f)
    lancer(b, p)
    carte(b, p)
print('relancer sans dossier Bones pour noter les cartes des zones dans montures.json')
