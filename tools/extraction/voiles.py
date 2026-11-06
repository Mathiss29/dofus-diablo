# voiles.py dossier_du_monde : retire du décor les grands voiles de lumière posés sur toute une carte (sans relire les bundles).
# Certaines cartes (Cité d'Astrub, gfx 63044, 2000 x 868) posent un grand dégradé jaune semi-transparent sur toute la carte :
# une lueur de soleil dans les coins hauts de L'ÉCRAN, puisque Dofus ne montre qu'une carte. En monde continu ces coins tombent
# au milieu des rues voisines : grandes zones claires à bords nets, même une fois les bords fondus (retours de Mathis 2026-11-06).
# Un voile = une grande image (>= 600 x 300) sans aucun pixel opaque dont le bord n'est pas transparent ; ses poses sont retirées.
# À relancer après world_export.py / decor_par_carte.py (world_export.py les retire déjà : VOILES). Images trouvées notées dans
# monde.json (« voiles »).
import sys, json, glob, os
import numpy as np
from PIL import Image
D = sys.argv[1]
M = json.load(open(f'{D}/monde.json'))
voiles = set(M.get('voiles', []))
for jf in sorted(glob.glob(f'{D}/decor_*.json')):
    page = os.path.basename(jf)[6:-5]
    im = None
    for f, fr in json.load(open(jf))['frames'].items():
        r = fr['frame']
        if r['w'] * r['h'] < 600 * 300 or f'{page}:{f}' in voiles: continue
        if im is None: im = Image.open(jf[:-5] + '.webp').convert('RGBA')
        al = np.asarray(im.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h'])))[..., 3]
        bord = np.concatenate([al[0], al[-1], al[:, 0], al[:, -1]])
        if al.max() < 235 and (bord > 40).mean() >= 0.05: voiles.add(f'{page}:{f}')
n = 0
for m in M['maps']:
    garde = [p for p in m['decor'] if f"{'p' + str(p['p']) if 'p' in p else m['tag']}:{p['f']}" not in voiles]
    n += len(m['decor']) - len(garde); m['decor'] = garde
M['voiles'] = sorted(voiles)
json.dump(M, open(f'{D}/monde.json', 'w'))
print('voiles :', len(voiles), 'images,', n, 'poses retirées')
