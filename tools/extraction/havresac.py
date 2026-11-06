# havresac.py theme.json meubles.json sortie.json : pose nos meubles (maquette Hub 6B : décor fait par nous) dans une carte
# officielle du Havre-Sac, avant world_export.py.
#  theme.json  = map_{id}.json d'un thème (bundle mapdata_assets_world_621 : les 45 thèmes, table havenbagthemes)
#  meubles.json = [[gfxId, case, miroir], ...] : meubles officiels du Havre-Sac (table havenbagfurnitures, textures mapgfx_1x_*)
# Chaque meuble devient un élément triable de la carte (le bas de l'image posé au milieu de la case, comme le Havre-Sac de Dofus)
# et sa case n'est plus marchable, sauf les tapis (gfx listés dans TAPIS, posés à plat au milieu de la case).
import sys, json, struct, re, bisect, os, glob, warnings
warnings.filterwarnings('ignore')
src, meubles, out = sys.argv[1:4]
TEX = os.environ.get('TEXTURES', '/mnt/project-files/cache-dofus/astrub/textures-1x')
W, H, OX, OY, COLS = 86, 43, -620, -490, 14
TAPIS = {52662, 52663, 52664, 52264, 52265, 52266, 52267, 52268, 71134, 71132, 71133}
t = json.load(open(src)); md = t['mapData']
L = json.load(open(meubles))
# taille des images : lue dans les bundles de textures (catalogue Addressables)
cat = open(f'{TEX}/catalog_1.0.bin', 'rb').read()
bund = [(m.start(), m.group().decode()) for m in re.finditer(rb'mapgfx_1x_\d+_assets_all[^.]*\.bundle', cat)]; st = [b[0] for b in bund]
def where(g):
    k = b'\x00%d.png' % g; i = cat.find(k)
    if i < 0: return None
    e = i + len(k); dep = struct.unpack_from('<I', cat, e + 20)[0]; rec = struct.unpack_from('<I', cat, dep)[0]
    return re.sub(r'_[0-9a-f]{32}', '', bund[bisect.bisect_left(st, rec) - 1][1])
import UnityPy
UnityPy.config.FALLBACK_UNITY_VERSION = "6000.3.16f1"
need = {g for g, *_ in L}; size = {}
for b in sorted({where(g) for g in need} - {None}):
    for o in UnityPy.load(f'{TEX}/{b}').objects:
        if o.type.name != 'Texture2D': continue
        d = o.read()
        if d.m_Name.isdigit() and int(d.m_Name) in need: size[int(d.m_Name)] = (d.m_Width, d.m_Height)
manque = need - set(size)
if manque: sys.exit(f'textures introuvables : {sorted(manque)}')
from collections import Counter
proto = dict(md['sortableElements'][0])
# teinte de la pièce : celle de la plupart de ses éléments (lumière du thème)
proto['color'] = {'value': Counter(e['color']['value'] for e in md['sortableElements']).most_common(1)[0][0]}
for n, (g, c, *r) in enumerate(L):
    rr, k = divmod(c, COLS)
    x = OX + W / 2 + k * W + (rr % 2) * W / 2; y = OY + H / 2 + rr * H / 2
    w, h = size[g]
    cy = y if g in TAPIS else y + 6 - h / 2   # meuble debout : bas de l'image juste sous le milieu de la case
    e = dict(proto, gfxId=g, cellId=c, innerCellRenderOrder=50 + n,
             transform={'m11': -1.0 if (r and r[0]) else 1.0, 'm12': 0.0, 'm21': 0.0, 'm22': 1.0, 'm31': x, 'm32': -cy})
    if g in TAPIS: md['backgroundElements'].append(e)
    else:
        md['sortableElements'].append(e)
        md['cellsData'][c]['mov'] = 0
json.dump(t, open(out, 'w'))
print(len(L), 'meubles posés ;', sum(1 for c in md['cellsData'] if c.get('mov')), 'cases marchables')
