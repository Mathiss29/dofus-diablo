# catalogue.py bundles_dir out_dir : extrait toutes les images (Texture2D / Sprite) des bundles d'un dossier Dofus 3,
# une image PNG par nom, rangées par bundle, avec un index CSV et des planches d'aperçu (pour chercher une image vite).
#  out_dir/png/<bundle>/<nom>.png   out_dir/index.csv (bundle;nom;largeur;hauteur)   out_dir/planches/<bundle>_<n>.jpg
import sys, os, glob, csv, warnings
warnings.filterwarnings('ignore')
import UnityPy
from PIL import Image, ImageDraw
UnityPy.config.FALLBACK_UNITY_VERSION = "6000.3.16f1"
src, out = sys.argv[1:3]
os.makedirs(out + '/planches', exist_ok=True)
rows = []
for b in sorted(glob.glob(src + '/**/*.bundle', recursive=True)):
    name = os.path.basename(b).replace('.bundle', '').replace('_assets', '')
    d = f'{out}/png/{name}'; os.makedirs(d, exist_ok=True); n = 0
    try: env = UnityPy.load(b)
    except Exception as e: print('ERR', name, e); continue
    for o in env.objects:
        if o.type.name not in ('Texture2D', 'Sprite'): continue
        try:
            t = o.read(); nm = (t.m_Name or str(o.path_id)).replace('/', '_')
            p = f'{d}/{nm}.png'
            if os.path.exists(p): continue
            im = t.image
            if im is None or im.width < 4 or im.height < 4: continue
            im.save(p); rows.append((name, nm, im.width, im.height)); n += 1
        except Exception: pass
    print(name, n, flush=True)
with open(out + '/index.csv', 'w', newline='') as f:
    w = csv.writer(f, delimiter=';'); w.writerow(['bundle', 'nom', 'largeur', 'hauteur']); w.writerows(sorted(rows))
# planches : 10 x 8 vignettes de 160 px, nom + taille sous chaque image, fond gris pour voir la transparence
by = {}
for r in sorted(rows): by.setdefault(r[0], []).append(r)
C, COLS, ROWS = 160, 10, 8
for bname, rs in by.items():
    for k in range(0, len(rs), COLS * ROWS):
        part = rs[k:k + COLS * ROWS]; nr = (len(part) + COLS - 1) // COLS
        S = Image.new('RGB', (COLS * C, nr * (C + 16)), (38, 38, 38)); dr = ImageDraw.Draw(S)
        for i, (_, nm, wd, ht) in enumerate(part):
            try: im = Image.open(f'{out}/png/{bname}/{nm}.png').convert('RGBA')
            except Exception: continue
            im.thumbnail((C - 6, C - 6)); x, y = (i % COLS) * C, (i // COLS) * (C + 16)
            bg = Image.new('RGBA', im.size, (72, 72, 72, 255)); bg.alpha_composite(im); S.paste(bg.convert('RGB'), (x + 3, y + 3))
            dr.text((x + 3, y + C), f'{nm[:18]} {wd}x{ht}', fill=(255, 240, 170))
        S.save(f'{out}/planches/{bname}_{k // (COLS * ROWS) + 1}.jpg', quality=78)
print('total', len(rows))
