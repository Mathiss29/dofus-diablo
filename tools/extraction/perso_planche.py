"""Rend en une passe toutes les animations utiles d'une classe (sorts officiels compris) en planche Phaser.

python perso_planche.py <persos> <donnees> <classe> <m|f> <sortie> [nb_images_max]
  persos  : dossier où l'on a décompressé cache-dofus/persos.tar.gz (contient Characters/Bones et Characters/Skins)
  donnees : dossier des tables déjà sorties par data_dump.py (breeds.json, heads.json, spells.json, spellscripts.json)
  classe  : identifiant Dofus de la classe (8 = Iop, 9 = Crâ, 2 = Osamodas...)
Écrit dans <sortie> : <nom>.webp + <nom>.json (atlas « trimmed »), anims.json (chaque sort -> animation, frame d'impact SHOT)
et apercu.png (une image sur deux de chaque animation, pour caler les bornes dans src/render/looks.ts).
Le rendu (render.cjs) demande Playwright. Compter ~2 min par classe.
Variable ANIMS (liste séparée par des virgules) : ne rendre que ces animations, pour la planche du jeu."""
import ast, json, os, re, subprocess, sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from anim_parse import parse  # noqa: E402

Image.MAX_IMAGE_PIXELS = None
persos, donnees, classe, sexe, out = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4], sys.argv[5]
MAXN = int(sys.argv[6]) if len(sys.argv) > 6 else 32
os.makedirs(out, exist_ok=True)
L = lambda v: v if isinstance(v, (list, dict)) else ast.literal_eval(v)


def table(n):
    d = json.load(open(os.path.join(donnees, n + '.json')))
    R = {r['rid']: r['data'] for r in d['references']['RefIds']}
    o = d['objectsById']
    return {int(k): R.get(v['rid']) for k, v in zip(o['m_keys'], o['m_values'])}


B, H, S, SC = table('breeds')[classe], table('heads'), table('spells'), table('spellscripts')
look = B['maleLook' if sexe == 'm' else 'femaleLook']
body = look.split('|')[1]
heads = sorted((h for h in H.values() if h and int(h['breed']) == classe and int(h['gender']) == (0 if sexe == 'm' else 1)
                and str(h.get('availableAtCreation')) == '1'), key=lambda h: int(h['order']))
head = str(heads[0]['skins'])
colors = ','.join(str(c) for c in L(B['maleColors' if sexe == 'm' else 'femaleColors']))

# Sorts de la classe -> animation du lanceur (spellscripts.rawParams.casterAnimation)
spells = {}
for sid in L(B['breedSpellsId']):
    s = S.get(int(sid))
    if not s: continue
    anims = []
    for u in L(s['boundScriptUsageData']):
        r = str((SC.get(int(u['scriptId'])) or {}).get('rawParams', ''))
        anims += re.findall(r'casterAnimation[^0-9A-Za-z]*([A-Za-z0-9_]+)', r)
    spells[int(sid)] = {'icon': int(s['iconId']), 'anims': list(dict.fromkeys(anims))}

# AnimArme<typeId> = auto-attaque avec une arme de ce type (2 Arc, 3 Baguette, 4 Bâton, 5 Dague, 6 Épée, 7 Marteau, 8 Pelle, 19 Hache, 22 Faux)
base = ['AnimStatiqueCombat0', 'AnimStatiqueExplo0', 'AnimCourse', 'AnimArme0', 'AnimHit', 'AnimMort'] + [f'AnimArme{t}' for t in (2, 3, 4, 5, 6, 7, 8, 19, 22)]
wanted = list(dict.fromkeys(base + [a for s in spells.values() for a in s['anims']]))

# 1. Bundles -> morceaux (b_dump.py), une seule fois
bones = os.path.join(persos, 'Characters', 'Bones'); skins = os.path.join(persos, 'Characters', 'Skins')
work = os.path.join(out, 'travail'); os.makedirs(work, exist_ok=True)
dirs = []
for b in ['1-static', '1-movement', '1-combat', '1-combat-armes', f'1-{classe}-combat', f'1-{classe}-static']:
    f = os.path.join(bones, f'bones_assets_bone_{b}.bundle')
    if not os.path.exists(f): continue
    d = os.path.join(work, 'bone_' + b)
    if not os.path.isdir(d): subprocess.run([sys.executable, os.path.join(HERE, 'b_dump.py'), f, d], check=True, capture_output=True)
    dirs.append(d)
sk = []
for s in (body, head):
    d = os.path.join(work, 'skin_' + s)
    if not os.path.isdir(d):
        subprocess.run([sys.executable, os.path.join(HERE, 'b_dump.py'), os.path.join(skins, f'skins_assets_skin_{s}.bundle'), d], check=True, capture_output=True)
    sk.append(d)

# Animations réellement présentes (dans les deux orientations _1 et _5)
have = set()
for d in dirs:
    for f in os.listdir(d):
        m = re.match(r'ta_.+?_(Anim\w+?)_([15])\.bin$', f)
        if m: have.add(m.group(1))
anims = [a for a in wanted if a in have]
# ANIMS=AnimCourse,AnimAttaque911,... : ne garder que celles-là (planche plus légère pour le jeu)
if os.environ.get('ANIMS'): anims = [a for a in anims if a in os.environ['ANIMS'].split(',')]
# Orientations : _1 (face, bas-droite) et _5 (dos, haut-gauche) pour tout ; les animations de déplacement et de repos
# existent aussi en _0 (droite), _2 (bas) et _6 (haut) : avec les miroirs, le perso se tourne dans les 8 directions.
EIGHT = {'AnimCourse', 'AnimStatiqueExplo0'}
orients = lambda a: (0, 1, 2, 5, 6) if a in EIGHT else (1, 5)
names = ','.join(f'{a}_{o}' for a in anims for o in orients(a))

# 2. Scène (squelette + skins + couleurs de la classe), 3. rendu, 4. planche rognée
scene = os.path.join(work, 'scene.json')
subprocess.run([sys.executable, os.path.join(HERE, 'build_char.py'), scene, ','.join(dirs), ','.join(sk), colors, names], check=True, capture_output=True)
# Ombre au sol de Dofus (4 quarts qui se chevauchent = croix sombre) : retirée, le jeu dessine la sienne
subprocess.run([sys.executable, os.path.join(HERE, 'drop_shadow.py'), scene], check=True, capture_output=True)
sc = json.load(open(scene))
counts = {k: len(v) for k, v in sc['anims'].items()}
shots = sc.get('shots', {})
frames_of = {f'{a}_{o}': min(MAXN, counts.get(f"{a}_{o}", 1)) for a in anims for o in orients(a) if f'{a}_{o}' in counts}
nom = os.path.basename(os.path.normpath(out))
env = dict(os.environ, BOX='-260,-1000,260,120')
# SCALE : taille du rendu (0.7 = net jusqu'à un zoom x1,2 avec une échelle d'affichage ~0,8 dans looks.ts)
SCALE = os.environ.get('SCALE', '0.7')
# Rendu par paquets d'environ 280 images : une seule toile pour toute la classe dépasse la taille maximale du navigateur
groups, cur, n = [], [], 0
for k, c in frames_of.items():
    if cur and n + c > 280: groups.append(cur); cur, n = [], 0
    cur.append(k); n += c
groups.append(cur)
raws = []
for gi, gk in enumerate(groups):
    raw = os.path.join(work, f'{nom}_raw{gi}')
    subprocess.run(['node', os.path.join(HERE, 'render.cjs'), scene, '-', raw, ','.join(f'{k}:{frames_of[k]}' for k in gk), '1', SCALE], check=True, env=env, cwd=HERE)
    raws.append(raw)
# Planches de 4096 x 4096 au plus (multiatlas Phaser si plusieurs pages) : <nom>.json + <nom>.avif, <nom>-1.avif... (AVIF depuis le 6 nov. 2026)
subprocess.run([sys.executable, os.path.join(HERE, 'trim_pack.py'), ','.join(raws), os.path.join(out, nom), '4096', '4096'], check=True, env={**os.environ, 'FORMAT': 'AVIF'})

# Résumé : sorts -> animations, frame d'impact (fraction) quand le repère SHOT existe
info = {'classe': classe, 'sexe': sexe, 'skins': [body, head], 'animations': {},
        'sorts': {sid: s for sid, s in spells.items()}}
for a in anims:
    n = counts.get(f'{a}_1', 1)
    sh = shots.get(f'{a}_1')
    info['animations'][a] = {'images': min(MAXN, n), 'shot': round(sh / n, 3) if sh else None}
json.dump(info, open(os.path.join(out, 'anims.json'), 'w'), ensure_ascii=False, indent=1)

# Aperçu : une ligne par animation (orientation face), une image sur deux
rj = {'frames': {}}; ims = {}
for raw in raws:
    for k, f in json.load(open(raw + '.json'))['frames'].items(): rj['frames'][k] = f; ims[k] = raw
opened = {r: Image.open(r + '.png') for r in raws}
cw, ch = 104, 224
rows = [(a, sorted((k for k in rj['frames'] if k.startswith(a + '_1_')), key=lambda k: int(k.rsplit('_', 1)[1]))[::2]) for a in anims]
W = max(len(r[1]) for r in rows)
sheet = Image.new('RGB', (cw * W, ch * len(rows)), (34, 34, 30)); d = ImageDraw.Draw(sheet)
for r, (a, ks) in enumerate(rows):
    for i, k in enumerate(ks):
        f = rj['frames'][k]['frame']
        c = opened[ims[k]].crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h'])).resize((cw, ch))
        sheet.paste(c, (i * cw, r * ch), c); d.text((i * cw + 2, r * ch + 2), k.rsplit('_', 1)[1], fill=(255, 230, 0))
    d.text((2, r * ch + ch - 14), a, fill=(255, 255, 255))
sheet.save(os.path.join(out, 'apercu.png'))
print(nom, len(anims), 'animations :', ', '.join(anims))
