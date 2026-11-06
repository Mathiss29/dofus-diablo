# voiles_fondu.py dossier_du_monde : adoucit le bord des grands voiles de lumière du décor (sans relire les bundles).
# Certaines cartes (Cité d'Astrub, gfx 63044) posent un grand dégradé jaune semi-transparent (2000 x 868) sur toute la carte.
# Dans Dofus, ses bords sont hors de l'écran (on ne voit qu'une carte) ; en monde continu ils débordaient sur les voisines et
# faisaient des rectangles clairs à bords nets (retour de Mathis 2026-11-06). Un voile = une grande image sans aucun pixel opaque
# dont le bord n'est pas transparent : on la fond vers le transparent sur ses bords, directement dans les pages de l'atlas.
# À relancer après world_export.py / decor_par_carte.py ; les images déjà traitées sont notées dans monde.json (« voiles »).
import sys, json, glob, os
import numpy as np
from PIL import Image
D = sys.argv[1]
M = json.load(open(f'{D}/monde.json'))
faits = set(M.get('voiles', []))
n = 0
for jf in sorted(glob.glob(f'{D}/decor_*.json')):
    page = os.path.basename(jf)[6:-5]
    frames = json.load(open(jf))['frames']
    im, change = None, False
    for f, fr in frames.items():
        r = fr['frame']
        if r['w'] * r['h'] < 600 * 300 or f'{page}:{f}' in faits: continue
        if im is None: im = Image.open(jf[:-5] + '.webp').convert('RGBA')
        box = (r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h'])
        a = np.asarray(im.crop(box)).astype(np.float32)
        al = a[..., 3]
        bord = np.concatenate([al[0], al[-1], al[:, 0], al[:, -1]])
        if al.max() >= 235 or (bord > 40).mean() < 0.05: continue
        h, w = al.shape; yy, xx = np.mgrid[0:h, 0:w]
        d = np.minimum(np.minimum(xx, w - 1 - xx), np.minimum(yy, h - 1 - yy)) / (0.2 * min(w, h))
        t = np.clip(d, 0, 1); a[..., 3] = al * t * t * (3 - 2 * t)
        im.paste(Image.fromarray(a.astype(np.uint8), 'RGBA'), box[:2])
        faits.add(f'{page}:{f}'); change = True; n += 1
    if change: im.save(jf[:-5] + '.webp', 'WEBP', quality=82, method=6)
M['voiles'] = sorted(faits)
json.dump(M, open(f'{D}/monde.json', 'w'))
print('voiles adoucis :', n)
