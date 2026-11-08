"""Planche d'un habitant à look de personnage (« {1|corps,tête,skins…|couleurs|échelle} » de la table npcs) : repos et marche.

python habitant_planche.py <persos> '<look>' <sortie> [nb_images_max]
  persos : dossier de cache-dofus/persos.tar.gz, avec en plus les skins d'objets du look (Characters/Skins, pris sur le PC)
           et les squelettes bone_1-movement / bone_1-static (AnimMarche, AnimStatiqueExplo0).
Écrit <sortie>/<nom>.json + <nom>.avif (atlas « trimmed », même cellule et même pied que perso_planche.py).
Sert aux habitants qui se promènent au Bastion des Douze (maquette Ville 5F) : src/data/passants.json, src/sim/passants.ts.
Variable BREEDS = breeds.json (data_dump.py) : couleurs de la classe quand le look n'en donne pas. Variable SCALE (défaut 0.5 : les habitants sont plus nombreux que le joueur, planches plus légères)."""
import json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
persos, look, out = sys.argv[1], sys.argv[2], sys.argv[3]
MAXN = int(sys.argv[4]) if len(sys.argv) > 4 else 32
os.makedirs(out, exist_ok=True)

m = re.match(r'\{1\|([^|]*)\|?([^|]*)', look)
if not m: sys.exit('look de personnage attendu : {1|corps,tête,...|couleurs}')
skins = [s for s in m.group(1).split(',') if s]
cols = {}
for c in (x for x in m.group(2).split(',') if x):
    k, v = c.split('=')
    cols[int(k)] = int(v[1:], 16) if v.startswith('#') else int(v)
# couleurs absentes du look = couleurs de la classe (breeds.maleColors / femaleColors ; corps = classe x 10, +1 pour une femme)
BREEDS = os.environ.get('BREEDS')   # breeds.json sorti par data_dump.py
if BREEDS:
    d = json.load(open(BREEDS)); R = {r['rid']: r['data'] for r in d['references']['RefIds']}
    br = {int(R[v['rid']]['id']): R[v['rid']] for v in d['objectsById']['m_values']}
    corps = int(skins[0]); b = br.get(corps // 10)
    if b:
        for i, c in enumerate(b['femaleColors' if corps % 2 else 'maleColors']): cols.setdefault(i + 1, int(c))
colors = ','.join(str(cols.get(i, 0)) for i in range(1, max(cols, default=0) + 1)) or '-'

bones = os.path.join(persos, 'Characters', 'Bones'); sk_dir = os.path.join(persos, 'Characters', 'Skins')
work = os.path.join(out, 'travail'); os.makedirs(work, exist_ok=True)
dump = lambda f, d: os.path.isdir(d) or subprocess.run([sys.executable, os.path.join(HERE, 'b_dump.py'), f, d], check=True, capture_output=True)
dirs = []
for b in ('1-static', '1-movement'):
    d = os.path.join(work, 'bone_' + b); dump(os.path.join(bones, f'bones_assets_bone_{b}.bundle'), d); dirs.append(d)
sk = []
for s in skins:
    d = os.path.join(work, 'skin_' + s); dump(os.path.join(sk_dir, f'skins_assets_skin_{s}.bundle'), d); sk.append(d)

# marche : 5 orientations (+ miroirs : 8 directions) ; repos : les deux diagonales (_1 et _5, le jeu prend la plus proche), en entier
names = ','.join([f'AnimMarche_{o}' for o in (0, 1, 2, 5, 6)] + ['AnimStatiqueExplo0_1', 'AnimStatiqueExplo0_5'])
scene = os.path.join(work, 'scene.json')
subprocess.run([sys.executable, os.path.join(HERE, 'build_char.py'), scene, ','.join(dirs), ','.join(sk), colors, names], check=True, capture_output=True)
subprocess.run([sys.executable, os.path.join(HERE, 'drop_shadow.py'), scene], check=True, capture_output=True)
counts = {k: len(v) for k, v in json.load(open(scene))['anims'].items()}
frames = {k: min(MAXN, n) for k, n in counts.items()}
nom = os.path.basename(os.path.normpath(out))
raw = os.path.join(work, nom + '_raw')
env = dict(os.environ, BOX='-260,-1000,260,120')
subprocess.run(['node', os.path.join(HERE, 'render.cjs'), scene, '-', raw, ','.join(f'{k}:{n}' for k, n in frames.items()), '1', os.environ.get('SCALE', '0.5')],
               check=True, env=env, cwd=HERE)
subprocess.run([sys.executable, os.path.join(HERE, 'trim_pack.py'), raw, os.path.join(out, nom), '4096', '4096'], check=True, env={**os.environ, 'FORMAT': 'AVIF'})
print(nom, frames)
