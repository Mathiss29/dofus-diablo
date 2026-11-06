# Usage: build_char.py out.json bone_dir1[,bone_dir2...] skin_dir1,skin_dir2 colors(hex,..|-) anim1,anim2,...
import json, glob, sys, os, re
from anim_parse import parse
out, bone_dirs, skin_dirs, colors, wanted = sys.argv[1], sys.argv[2].split(','), sys.argv[3].split(','), sys.argv[4], sys.argv[5].split(',')
colors = [] if colors == '-' else [int(c) for c in colors.split(',')]
def load_dir(d):
    mbs = {f: json.load(open(f)) for f in glob.glob(d + '/mb_*.json')}
    tex = glob.glob(d + '/tex_*.png')[0]
    return mbs, tex
_texs = {}
def _gris(tex, pts):
    """Vrai si la zone de texture du morceau est en niveaux de gris (morceau fait pour être teinté)."""
    from PIL import Image
    if tex not in _texs: _texs[tex] = Image.open(tex).convert('RGBA')
    im = _texs[tex]; W, H = im.size
    us = [p[2] for p in pts]; vs = [p[3] for p in pts]
    box = (int(min(us) * W), int((1 - max(vs)) * H), int(max(us) * W) + 1, int((1 - min(vs)) * H) + 1)
    if box[2] <= box[0] or box[3] <= box[1]: return False
    px = [q for q in im.crop(box).getdata() if q[3] > 128]
    if len(px) < 20: return False
    sat = sum(max(q[:3]) - min(q[:3]) for q in px) / len(px)
    return sat < 12
def mesh_from(skin, key_idx, tex, tint=None):
    """Un morceau = liste aplatie d'entrées (groupes nommés + feuilles -1). Chaque feuille
    consomme le chunk de maillage suivant ; sa transformation est déjà composée. Les
    feuilles situées sous un groupe ColorGray_N_* prennent la couleur N.
    Certaines feuilles grises sont posées à côté de leur groupe de couleur au lieu d'être dedans
    (frange de la Crâ, mèche de l'Iopette) : elles prennent la couleur du groupe ColorGray voisin
    (le précédent dans le même parent, sinon le suivant), sinon elles restaient grises."""
    v = skin['m_values'][key_idx]; V = skin['vertices']; T = skin['triangles']; rs = skin['referencedSymbols']
    chunks = iter(v['skinChunks']); res = []; stack = []
    entries = v['DisplayListEntry']
    voisin = {}    # id du niveau parent -> dernière couleur ColorGray vue parmi ses enfants
    attente = {}   # id du niveau parent -> feuilles grises sans couleur, en attente du groupe suivant
    for e in entries:
        while stack and stack[-1][0] == 0: stack.pop()
        if stack: stack[-1][0] -= 1
        sid, n = e['symbolId'], e['entries']
        if sid >= 0:
            name = rs[sid] if sid < len(rs) else ''
            mm = re.match(r'^Color\w+?_(\d+)_', name)
            par = id(stack[-1]) if stack else 0
            if mm:
                c = int(mm.group(1)); voisin[par] = c
                for m in attente.pop(par, []):
                    if colors and c - 1 < len(colors): m['tint'] = colors[c - 1]
            if n > 0: stack.append([n, name])
            continue
        ch = next(chunks, None)
        if ch is None: break
        t = e['transform']
        ci = None
        for _, nm in stack:
            mm = re.match(r'^Color\w+?_(\d+)_', nm)
            if mm: ci = int(mm.group(1))
        tt = colors[ci - 1] if (ci and colors and ci - 1 < len(colors)) else tint
        sv, vc = ch['startVertexIndex'], ch['vertexCount']
        pts = []
        for i in range(vc):
            x, y = V[sv+i]['pos']['x'], V[sv+i]['pos']['y']
            pts.append([x, y, V[sv+i]['uv']['x'], V[sv+i]['uv']['y']])  # sommets déjà dans l'espace du morceau
        m = {'tex': tex, 'tint': tt, 'v': pts, 't': T[ch['startIndexIndex']:ch['startIndexIndex'] + ch['indexCount']]}
        if ci is None and colors and stack and _gris(tex, pts):
            par = id(stack[-1]); c = voisin.get(par)
            if c and c - 1 < len(colors): m['tint'] = colors[c - 1]
            else: attente.setdefault(par, []).append(m)
        res.append(m)
    return res
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
    for f in glob.glob(bd + '/ta_*.bin'):
        name = os.path.basename(f)[3:-4].split('_', 1)[1]
        if name not in wanted: continue
        raw = open(f, 'rb').read(); a = parse(raw)
        i = raw.find(b'SHOT')
        if 0 < i < len(a['header']): shots[name] = int.from_bytes(raw[i-3:i-1], 'little')
        state = {}; frames = []
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
                if 0 <= s['sym'] < len(gmesh): ids += gmesh[s['sym']]
                if 0 <= s['cus'] < len(exposed): ids += custom(exposed[s['cus']])
                for mid in ids: draws.append([mid, s['m'], s['alpha'], s['mul']])
            frames.append(draws)
        anims[name] = frames
json.dump({'meshes': meshes, 'anims': anims, 'shots': shots}, open(out, 'w'))
print({k: len(v) for k, v in anims.items()}, 'SHOT', shots, 'meshes', len(meshes))
