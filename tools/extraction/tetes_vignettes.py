"""Vignettes des têtes de création (écran de création, maquette Apparence 1A) : une bande par classe et par sexe.

python tetes_vignettes.py <persos> <donnees> <sortie> [classes=8,9]
Écrit <sortie>/tetes_<iop|cra>_<m|f>.webp : têtes dans l'ordre officiel (heads, availableAtCreation), 96 x 96 chacune,
rendues sur le corps de la classe avec les couleurs officielles (repos, face). Compter ~1 min par classe."""
import ast, json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
persos, donnees, out = sys.argv[1], sys.argv[2], sys.argv[3]
classes = [int(c) for c in (sys.argv[4] if len(sys.argv) > 4 else '8,9').split(',')]
CLE = {8: 'iop', 9: 'cra', 2: 'osamodas', 11: 'sacrieur', 20: 'forgelance', 7: 'eniripsa', 3: 'enutrof', 6: 'ecaflip', 10: 'sadida'}
L = lambda v: v if isinstance(v, (list, dict)) else ast.literal_eval(v)
work = os.path.join(out, '..', '.vignettes-travail') if 'TRAVAIL' not in os.environ else os.environ['TRAVAIL']
work = os.path.abspath(work); os.makedirs(work, exist_ok=True)


def table(n):
    d = json.load(open(os.path.join(donnees, n + '.json')))
    R = {r['rid']: r['data'] for r in d['references']['RefIds']}
    o = d['objectsById']
    return {int(k): R.get(v['rid']) for k, v in zip(o['m_keys'], o['m_values'])}


B, H = table('breeds'), table('heads')
P = os.path.join(persos, 'Characters')


def dump(kind, s):
    d = os.path.join(work, f'{kind}_{s}')
    if not os.path.isdir(d):
        f = f'{P}/Skins/skins_assets_skin_{s}.bundle' if kind == 'skin' else f'{P}/Bones/bones_assets_bone_{s}.bundle'
        subprocess.run([sys.executable, os.path.join(HERE, 'b_dump.py'), f, d], check=True, capture_output=True)
    return d


bone = dump('bone', '1-static')
jobs = []
for c in classes:
    b = B[c]
    for g, sx in ((0, 'm'), (1, 'f')):
        corps = (b['maleLook'] if g == 0 else b['femaleLook']).split('|')[1]
        cols = L(b['maleColors' if g == 0 else 'femaleColors'])
        hs = sorted((h for h in H.values() if h and int(h['breed']) == c and int(h['gender']) == g and str(h.get('availableAtCreation')) == '1'),
                    key=lambda h: int(h['order']))
        dump('skin', corps)
        for h in hs: dump('skin', h['skins'])
        jobs.append((f'{CLE.get(c, c)}_{sx}', corps, [h['skins'] for h in hs], cols))


def rendre(nom, corps, tete, cols):
    sc = os.path.join(work, f'{nom}_{tete}.json'); raw = os.path.join(work, f'r_{nom}_{tete}')
    subprocess.run([sys.executable, os.path.join(HERE, 'build_char.py'), sc, bone, f"{dump('skin', corps)},{dump('skin', tete)}",
                    ','.join(map(str, cols)), 'AnimStatiqueExplo0_1'], check=True, capture_output=True)
    subprocess.run(['node', 'render.cjs', sc, '-', raw, 'AnimStatiqueExplo0_1:1', '1', '1'], check=True, capture_output=True, cwd=HERE,
                   env=dict(os.environ, BOX='-110,-260,110,30'))
    # cadre de la tête dans la cellule 220 x 290 (pied en 110, 260)
    return Image.open(raw + '.png').convert('RGBA').crop((58, 70, 162, 174)).resize((96, 96), Image.LANCZOS)


for nom, corps, tetes, cols in jobs:
    with ThreadPoolExecutor(6) as ex: ims = list(ex.map(lambda t: rendre(nom, corps, t, cols), tetes))
    bande = Image.new('RGBA', (96 * len(ims), 96))
    for i, im in enumerate(ims): bande.alpha_composite(im, (96 * i, 0))
    bande.save(os.path.join(out, f'tetes_{nom}.webp'), 'WEBP', quality=88, method=6)
    print(nom, len(ims))
