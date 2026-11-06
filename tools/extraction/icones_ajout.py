"""Ajoute des icônes officielles d'objets à la planche du jeu (public/assets/ui/objets.webp + src/data/icones_objets.json).

Usage : python icones_ajout.py <item_assets_1x.bundle> <iconId> [iconId ...]
La planche grandit d'une rangée quand elle est pleine (20 icônes de 64 px par rangée). Les icônes déjà présentes sont ignorées.
Le paquet est dans Dofus_Data/StreamingAssets/Content/Picto/Items (copie dans cache-dofus/astrub/).
"""
import sys, os, json, math, warnings
warnings.filterwarnings('ignore')
import UnityPy
from PIL import Image
UnityPy.config.FALLBACK_UNITY_VERSION = '6000.3.16f1'
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
J, W = os.path.join(R, 'src/data/icones_objets.json'), os.path.join(R, 'public/assets/ui/objets.webp')
d = json.load(open(J)); C, cols = d['cell'], d['cols']
voulues = [i for i in sys.argv[2:] if i not in d['icons']]
trouvees = {}
for o in UnityPy.load(sys.argv[1]).objects:
    if o.type.name == 'Texture2D':
        t = o.read()
        if t.m_Name in voulues: trouvees[t.m_Name] = t.image.convert('RGBA')
for i in voulues:
    if i not in trouvees: print('absente', i)
old = Image.open(W).convert('RGBA'); n = len(d['icons'])
rows = max(d['rows'], math.ceil((n + len(trouvees)) / cols))
sheet = Image.new('RGBA', (cols * C, rows * C)); sheet.paste(old, (0, 0))
for i, im in trouvees.items():
    im.thumbnail((C, C)); x, y = (n % cols) * C, (n // cols) * C
    sheet.paste(im, (x + (C - im.width) // 2, y + (C - im.height) // 2)); d['icons'][i] = n; n += 1
d['rows'] = rows
sheet.save(W, 'WEBP', quality=90, method=6); json.dump(d, open(J, 'w'))
print(len(trouvees), 'ajoutées ;', n, 'icônes,', rows, 'rangées')
