"""Découpe un rendu « big » de render.cjs en planches en grille pour l'écran de création (gros perso sur le socle).

python accueil_grille.py <big.png> <big.json> <sortie_prefixe> <x0,y0,x1,y1 repos/garde> <x0,y0,x1,y1 attaque> [largeur_max]

Pourquoi une grille : à l'échelle 3,2 (deux fois plus fin qu'avant), une bande de 23 images d'attaque ferait plus de
16 383 px de large, la limite du format WebP. On range donc les images en lignes de largeur <= largeur_max (8192 par défaut).
L'écran d'accueil retrouve le nombre de colonnes tout seul à partir de la taille de l'image (src/render/accueil.ts).
Les boîtes de découpe sont en pixels du rendu : à l'échelle 1,6 c'étaient (135,152)-(387,494) et 400 px de large pour
l'attaque ; à l'échelle 3,2 on double tout.
Écrit <sortie_prefixe>_<pose>.webp pour chaque pose trouvée dans big.json (repos_0, repos_1… garde_0… attaque_0…)."""
import json, math, sys
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
png, js, out, box, box_att = sys.argv[1:6]
maxw = int(sys.argv[6]) if len(sys.argv) > 6 else 8192
box = tuple(map(int, box.split(','))); box_att = tuple(map(int, box_att.split(',')))
im = Image.open(png).convert('RGBA'); frames = json.load(open(js))['frames']
poses: dict[str, list[tuple[int, dict]]] = {}
for k, f in frames.items():
    pose, i = k.rsplit('_', 1); poses.setdefault(pose, []).append((int(i), f['frame']))
for pose, lst in poses.items():
    lst.sort(); b = box_att if pose == 'attaque' else box
    fw, fh = b[2] - b[0], b[3] - b[1]; n = len(lst)
    cols = max(1, min(n, maxw // fw)); rows = math.ceil(n / cols)
    sheet = Image.new('RGBA', (cols * fw, rows * fh))
    for j, (_, r) in enumerate(lst):
        c = im.crop((r['x'] + b[0], r['y'] + b[1], r['x'] + b[2], r['y'] + b[3]))
        sheet.paste(c, ((j % cols) * fw, (j // cols) * fh))
    sheet.save(f'{out}_{pose}.webp', quality=92, method=6)
    print(pose, n, 'images', f'{cols}x{rows}', sheet.size)
