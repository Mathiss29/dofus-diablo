# Usage: build_char.py out.json bone_dir1[,bone_dir2...] skin_dir1,skin_dir2 colors(hex,..|-) anim1,anim2,...
import json, glob, sys, os, re
from anim_parse import parse
out, bone_dirs, skin_dirs, colors, wanted = sys.argv[1], sys.argv[2].split(','), [d for d in sys.argv[3].split(',') if d not in ('', '-')], sys.argv[4], sys.argv[5].split(',')
colors = [] if colors == '-' else [int(c) for c in colors.split(',')]
def load_dir(d):
    mbs = {f: json.load(open(f)) for f in glob.glob(d + '/mb_*.json')}
    tex = glob.glob(d + '/tex_*.png')[0]
    return mbs, tex
from skin_mesh import mesh_from as _mesh_from
def mesh_from(skin, key_idx, tex, tint=None): return _mesh_from(skin, key_idx, tex, colors, tint)
def add(ms):
    out = []
    for m in ms: meshes.append(m); out.append(len(meshes) - 1)
    return out
skins = []
for d in skin_dirs:
    mbs, tex = load_dir(d); s = list(mbs.values())[0]; skins.append((s, {k: i for i, k in enumerate(s['m_keys'])}, tex))
meshes = []; anims = {}; shots = {}; custom_cache = {}
def custom(name):
    if name in custom_cache: return custom_cache[name]
    ids = []
    for s, idx, tex in skins:
        if name in idx: ids += add(mesh_from(s, idx[name], tex))
    custom_cache[name] = ids; return ids
for bd in bone_dirs:
    mbs, btex = load_dir(bd)
    m = [v for v in mbs.values() if 'animations' in v][0]
    bskin = mbs[bd + '/mb_%d.json' % m['boneAsset']['m_PathID']]
    bidx = {k: i for i, k in enumerate(bskin['m_keys'])}
    gmesh = []
    for g in m['graphics']:
        gmesh.append(add(mesh_from(bskin, bidx[g['part']['name']], btex)))
    exposed = m['exposedNodeNames']
    # Squelette sans skin (familier « aux couleurs du porteur ») : la couleur est portée par le nœud animé
    # (ColorGray_N_Corps0_1…) et non par un groupe du dessin -> même morceau, teint de la couleur N.
    teints = {}
    def teint(sym, n):
        if (sym, n) not in teints:
            g = m['graphics'][sym]['part']['name']
            teints[(sym, n)] = add(mesh_from(bskin, bidx[g], btex, colors[n - 1]))
        return teints[(sym, n)]
    for f in glob.glob(bd + '/ta_*.bin'):
        name = os.path.basename(f)[3:-4].split('_', 1)[1]
        if name not in wanted: continue
        raw = open(f, 'rb').read(); a = parse(raw)
        i = raw.find(b'SHOT')
        if 0 < i < len(a['header']): shots[name] = int.from_bytes(raw[i-3:i-1], 'little')
        state = {}; frames = []
        # nœud ColorGray_N_… (sans dessin) d'indice k : il colore le nœud dessiné d'indice k - 1
        couleur_de = {}
        for fr in a['frames']:
            for r in fr:
                if r.get('sym', 0) < 0 and 0 <= r.get('par', -1) < len(exposed):
                    nc = re.match(r'^Color\w+?_(\d+)_', exposed[r['par']])
                    if nc and colors and int(nc.group(1)) <= len(colors): couleur_de.setdefault(r['idx'] - 1, int(nc.group(1)))
        for fr in a['frames']:
            for r in fr:
                s = state.setdefault(r['idx'], {'sym': -1, 'cus': -1, 'm': [1,0,0,0,1,0], 'alpha': 127, 'mul': [127]*4})
                if 'sym' in r: s['sym'] = r['sym']; s['cus'] = r['par']
                if r['fl'] & 2: s['alpha'] = r['alpha']
                if 'mul' in r: s['mul'] = list(r['mul'])
                if 'm' in r: s['m'] = list(r['m'])
            draws = []
            for k in sorted(state):
                s = state[k]
                ids = []
                if k in couleur_de and 0 <= s['sym'] < len(gmesh): ids += teint(s['sym'], couleur_de[k])
                elif 0 <= s['sym'] < len(gmesh): ids += gmesh[s['sym']]
                if 0 <= s['cus'] < len(exposed): ids += custom(exposed[s['cus']])
                for mid in ids: draws.append([mid, s['m'], s['alpha'], s['mul']])
            frames.append(draws)
        anims[name] = frames
json.dump({'meshes': meshes, 'anims': anims, 'shots': shots}, open(out, 'w'))
print({k: len(v) for k, v in anims.items()}, 'SHOT', shots, 'meshes', len(meshes))
