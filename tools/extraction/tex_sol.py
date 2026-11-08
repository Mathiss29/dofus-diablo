# tex_sol.py liste.json cartes_dir textures_dir sortie : textures des éléments de sol (backgroundElements) en <gfx>.png
import sys, json, glob, warnings, os
warnings.filterwarnings('ignore')
import UnityPy
UnityPy.config.FALLBACK_UNITY_VERSION = "6000.3.16f1"
L, C, T, O = sys.argv[1:5]
need = set()
for v in json.load(open(L)).values():
    md = json.load(open(f'{C}/map_{v[0]}.json'))['mapData']
    need |= {e['gfxId'] for e in md['backgroundElements']}
need -= {int(f[:-4]) for f in os.listdir(O) if f.endswith('.png')}
print('à sortir', len(need))
for b in sorted(glob.glob(f'{T}/mapgfx_*.bundle')):
    n = 0
    for o in UnityPy.load(b).objects:
        if o.type.name != 'Texture2D': continue
        d = o.read()
        if d.m_Name.isdigit() and int(d.m_Name) in need: d.image.save(f'{O}/{d.m_Name}.png'); need.discard(int(d.m_Name)); n += 1
    print(os.path.basename(b), n, flush=True)
print('introuvables', len(need), sorted(need)[:20])
