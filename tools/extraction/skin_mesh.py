"""Morceaux de skin (corps, tête) -> maillages, avec la zone de couleur ColorGray_N. Partagé par build_char.py et squelette_export.py."""
import re
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
def mesh_from(skin, key_idx, tex, colors, tint=None):
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
