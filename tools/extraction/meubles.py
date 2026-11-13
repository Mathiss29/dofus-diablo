# meubles.py <havenbagfurnitures.json> <textures> <public/assets> : catalogue des meubles officiels du Havre-Sac (0.6, 10A + 11B/11C).
#  havenbagfurnitures.json = table havenbagfurnituresdataroot (cache-dofus/donnees.tar.gz) lue par UnityPy (read_typetree)
#  textures = dossier des mapgfx_1x_* + catalog_1.0.bin (cache-dofus/astrub/textures-1x)
# Écrit src/data/meubles.json (compact : un tableau par meuble) et public/assets/sprites/meubles/<gfx>.webp (fichiers lourds :
# lancer ensuite node tools/hebergement/envoi.mjs).
# Colonnes de chaque meuble : [id, thème, gfx, couche, largeur, hauteur (cases), origine x, origine y, bloque, empilable, hauteur de pose, miroir officiel]
#  couche 0 = au sol (tapis), 1 = meuble, 2 = bibelot (posable sur un meuble empilable, à « hauteur de pose » px au-dessus).
import sys, json, re, struct, bisect, os, io, warnings
warnings.filterwarnings('ignore')
src, TEX, assets = sys.argv[1:4]
HERE = os.path.dirname(os.path.abspath(__file__))
d = json.load(open(src))
F = sorted((r['data'] for r in d['references']['RefIds']), key=lambda f: (f['themeId'], f['layerId'], f['order'], f['typeId']))
cat = open(f'{TEX}/catalog_1.0.bin', 'rb').read()
bund = [(m.start(), m.group().decode()) for m in re.finditer(rb'mapgfx_1x_\d+_assets_all[^.]*\.bundle', cat)]; st = [b[0] for b in bund]
def where(g):
    k = b'\x00%d.png' % g; i = cat.find(k)
    if i < 0: return None
    e = i + len(k); dep = struct.unpack_from('<I', cat, e + 20)[0]; rec = struct.unpack_from('<I', cat, dep)[0]
    return re.sub(r'_[0-9a-f]{32}', '', bund[bisect.bisect_left(st, rec) - 1][1])
import UnityPy
UnityPy.config.FALLBACK_UNITY_VERSION = "6000.3.16f1"
out = f'{assets}/sprites/meubles'; os.makedirs(out, exist_ok=True)
need = {f['gfxId'] for f in F}; faits = set()
for b in sorted({where(g) for g in need} - {None}):
    for o in UnityPy.load(f'{TEX}/{b}').objects:
        if o.type.name != 'Texture2D': continue
        t = o.read()
        if not (t.m_Name.isdigit() and int(t.m_Name) in need): continue
        g = int(t.m_Name); im = t.image
        bb = im.getbbox()
        if not bb: continue
        im.save(f'{out}/{g}.webp', 'WEBP', quality=90, method=6)
        faits.add(g)
L = [[f['typeId'], f['themeId'], f['gfxId'], f['layerId'], f['cellsWidth'], f['cellsHeight'], f['origin']['x'], f['origin']['y'],
      f['blocksMovement'], f['isStackable'], f['height'], f['horizontalSymmetry']] for f in F if f['gfxId'] in faits]
P = os.path.join(HERE, '../../src/data/meubles.json')
doc = {'_': "Meubles officiels du Havre-Sac (table havenbagfurnitures de Dofus 3, tools/extraction/meubles.py). Colonnes : id, thème, gfx, couche (0 sol, 1 meuble, 2 bibelot), largeur, hauteur (cases), origine x, origine y, bloque, empilable, hauteur de pose (px), miroir officiel. Image : assets/sprites/meubles/<gfx>.webp.",
       'colonnes': ['id', 'theme', 'gfx', 'couche', 'l', 'h', 'ox', 'oy', 'bloque', 'empilable', 'pose', 'miroir'], 'meubles': L}
with open(P, 'w') as fh:
    fh.write('{\n "_": ' + json.dumps(doc['_'], ensure_ascii=False) + ',\n "colonnes": ' + json.dumps(doc['colonnes']) + ',\n "meubles": [\n')
    fh.write(',\n'.join('  ' + json.dumps(m, separators=(',', ':')) for m in L) + '\n ]\n}\n')
print(len(L), 'meubles,', len(faits), 'images ;', len(need - faits), 'gfx introuvables')
