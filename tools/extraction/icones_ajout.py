"""Ajoute des icônes officielles d'objets aux planches du jeu (src/data/icones_objets.json) :
  - public/assets/ui/objets/<iconId>.webp : une icône de 128 px par fichier, pour les fenêtres (HTML, nettes même avec l'échelle
    d'interface ou un écran à 125-150 %). Un fichier par icône et pas une planche : la planche de 128 px (2560 x 13696, 140 Mo une fois
    décodée) faisait attendre l'inventaire à chaque ouverture, le temps que le navigateur la décode ;
  - public/assets/ui/objets.webp    : planche de cases de 64 px, pour Phaser (icônes au sol, récoltes, PNJ).

Usage : python icones_ajout.py <item_assets_2x.bundle> <iconId> [iconId ...]
        python icones_ajout.py <item_assets_2x.bundle>            refait seulement la planche et les fichiers (même ordre des cases)
La planche grandit d'une rangée quand elle est pleine (20 icônes par rangée). Les icônes déjà présentes sont ignorées.
Le paquet est dans Dofus_Data/StreamingAssets/Content/Picto/Items (copie dans cache-dofus/astrub/item_assets_2x.bundle) ;
ses icônes font 128 px (celles d'item_assets_1x, 64 px, sont trop petites pour les fenêtres).
Les planches sont toujours refaites depuis les icônes d'origine (jamais réencodées par-dessus l'ancienne image, qui se dégraderait).
"""
import sys, os, json, math, warnings
warnings.filterwarnings('ignore')
import UnityPy
from PIL import Image
UnityPy.config.FALLBACK_UNITY_VERSION = '6000.3.16f1'
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
J = os.path.join(R, 'src/data/icones_objets.json')
HD, SD = os.path.join(R, 'public/assets/ui/objets'), os.path.join(R, 'public/assets/ui/objets.webp')
C, CHD = 64, 128
d = json.load(open(J)); cols = d['cols']
voulues = [i for i in sys.argv[2:] if i not in d['icons']]
cherchees = set(d['icons']) | set(voulues)
trouvees = {}
for o in UnityPy.load(sys.argv[1]).objects:
    if o.type.name == 'Texture2D':
        t = o.read()
        if t.m_Name in cherchees: trouvees[t.m_Name] = t.image.convert('RGBA')
for i in voulues:
    if i not in trouvees: print('absente', i)
n = len(d['icons'])
for i in voulues:
    if i in trouvees: d['icons'][i] = n; n += 1
rows = max(d['rows'], math.ceil(n / cols))

def case(im, c):
    im = im.copy(); im.thumbnail((c, c), Image.LANCZOS); return im

os.makedirs(HD, exist_ok=True)
hd = Image.new('RGBA', (cols * CHD, rows * CHD))   # planche de 128 px en mémoire seulement : réduite en objets.webp
for i, im in trouvees.items():
    k = d['icons'].get(i)
    if k is None: continue
    im = case(im, CHD); x, y = (k % cols) * CHD, (k // cols) * CHD
    c = Image.new('RGBA', (CHD, CHD)); c.paste(im, ((CHD - im.width) // 2, (CHD - im.height) // 2))
    c.save(os.path.join(HD, f'{i}.webp'), 'WEBP', quality=90, alpha_quality=100, method=6)
    hd.paste(c, (x, y))
manque = [i for i in d['icons'] if i not in trouvees]
if manque: print('absentes du paquet (cases vides) :', manque)
d['rows'] = rows
hd.resize((cols * C, rows * C), Image.LANCZOS).save(SD, 'WEBP', quality=90, method=6)
json.dump(d, open(J, 'w'))
print(len(trouvees), 'icônes lues ;', n, 'icônes,', rows, 'rangées')
