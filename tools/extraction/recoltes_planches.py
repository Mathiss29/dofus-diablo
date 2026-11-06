# recoltes_planches.py : planches des ressources à récolter (blé, arbres, minerais, plantes, pêche).
#
# Usage : python recoltes_planches.py <dossier b/ de Stasis> <sortie public/assets/sprites/recoltes>
#
# Source : les animations « motion.bin » + « motion.webp » des éléments interactifs, tirées du cache du client Stasis
# (tools/contenu/recoltes.py donne les gfx). Format : gzip + msgpack, façon Flash :
#   [version, [?, ?, atlas, ?, ?], formes, symboles, matrices (a, b, c, d, tx, ty), couleurs (mult RGBA, add RGBA)]
#   forme   = [id, origineX, origineY, largeur, hauteur, x, y, l, h (rectangle de l'atlas), ?, ?, [?, quads (pixels de l'atlas), triangles]]
#   symbole = [id, nb frames, nom, enfants]; enfant = [id forme/symbole, [frame début, frame fin], matrices par frame, couleurs par frame, ...]
# États : AnimState0 = prête (repoussée), AnimState2_to_AnimState1 = coupe, AnimState1 = récoltée.
# Sortie : <gfx>.avif + <gfx>.json (atlas Phaser, frames pret / coupe_0..n / recolte ; ancre = pied de la ressource).
import gzip, json, os, sys, glob, msgpack, numpy as np
from PIL import Image, ImageDraw

K = 2.0          # pixels de planche par pixel Dofus (affiché à 1,1 / K)
COUPE = 10       # frames gardées de l'animation de coupe

def mul(m, n):
    a, b, c, d, tx, ty = m; a2, b2, c2, d2, tx2, ty2 = n
    return (a*a2 + c*b2, b*a2 + d*b2, a*c2 + c*d2, b*c2 + d*d2, a*tx2 + c*ty2 + tx, b*tx2 + d*ty2 + ty)
def cmul(c, n):
    return [c[0]*n[0], c[1]*n[1], c[2]*n[2], c[3]*n[3], c[4]*n[0] + n[4], c[5]*n[1] + n[5], c[6]*n[2] + n[6], c[7]*n[3] + n[7]]

class Motion:
    def __init__(self, dossier):
        d = msgpack.unpackb(gzip.decompress(open(f'{dossier}/motion.bin', 'rb').read()), strict_map_key=False)
        self.d, self.atlas = d, Image.open(f'{dossier}/motion.webp').convert('RGBA')
        self.formes = {s[0]: s for s in d[2]}; self.syms = {s[0]: s for s in d[3]}
        self.anims = {s[2]: s for s in d[3] if s[2]}
        self.cache = {}
    def morceau(self, f):
        if f[0] in self.cache: return self.cache[f[0]]
        ox, oy, w, h, ax, ay, aw, ah = f[1:9]
        im = self.atlas.crop((ax, ay, ax + aw, ay + ah))
        mesh = f[11] if len(f) > 11 else None
        if mesh and mesh[1]:
            m = Image.new('L', im.size, 0); dr = ImageDraw.Draw(m); q = [v - (ax if i % 2 == 0 else ay) for i, v in enumerate(mesh[1])]
            if mesh[2]:
                for i in range(0, len(mesh[2]), 3):
                    dr.polygon([(q[2*j], q[2*j+1]) for j in mesh[2][i:i+3]], fill=255)
            else:
                for i in range(0, len(q), 8):
                    xs, ys = q[i:i+8:2], q[i+1:i+8:2]; dr.rectangle((min(xs), min(ys), max(xs) - 1, max(ys) - 1), fill=255)
            a = np.asarray(im).copy(); a[..., 3] = np.minimum(a[..., 3], np.asarray(m)); im = Image.fromarray(a, 'RGBA')
        self.cache[f[0]] = im
        return im
    def items(self, sid, frame, M=(1, 0, 0, 1, 0, 0), C=(1, 1, 1, 1, 0, 0, 0, 0)):
        if sid in self.formes: return [(self.formes[sid], M, C)]
        out = []
        for ch in self.syms[sid][3]:
            cid, (f0, f1), ms, cs = ch[0], ch[1], ch[2], ch[3]
            if not (f0 <= frame <= f1): continue
            k = min(frame - f0, len(ms) - 1)
            out += self.items(cid, 0, mul(M, self.d[4][ms[k]]), cmul(self.d[5][cs[k]], C))
        return out
    def bornes(self, L):
        pts = []
        for f, M, C in L:
            if C[3] <= 0.001 and C[7] <= 0: continue
            ox, oy, w, h = f[1:5]
            for x, y in [(-ox, -oy), (w - ox, -oy), (-ox, h - oy), (w - ox, h - oy)]:
                pts.append((M[0]*x + M[2]*y + M[4], M[1]*x + M[3]*y + M[5]))
        return pts
    def rendu(self, L, x0, y0, W, H):
        can = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        for f, M, C in L:
            if C[3] <= 0.001 and C[7] <= 0: continue
            ox, oy, w, h, ax, ay, aw, ah = f[1:9]
            if aw < 1 or ah < 1: continue
            a = np.asarray(self.morceau(f)).astype(np.float32) / 255
            for i in range(4): a[..., i] = np.clip(a[..., i] * C[i] + C[4 + i], 0, 1)
            im = Image.fromarray((a * 255).astype(np.uint8), 'RGBA')
            T = np.array([[K, 0, -x0*K], [0, K, -y0*K], [0, 0, 1]]) @ np.array([[M[0], M[2], M[4]], [M[1], M[3], M[5]], [0, 0, 1]]) \
                @ np.array([[w/aw, 0, -ox], [0, h/ah, -oy], [0, 0, 1]])
            if abs(np.linalg.det(T)) < 1e-9: continue   # morceau aplati à zéro (masqué)
            Ti = np.linalg.inv(T)
            can.alpha_composite(im.transform((W, H), Image.AFFINE, tuple(Ti[:2].flatten()), resample=Image.BILINEAR))
        return can

def planche(dossier, sortie, g):
    m = Motion(dossier)
    A = m.anims
    pret = 'AnimState0_0' if 'AnimState0_0' in A else next(iter(A))
    recolte = 'AnimState1_0' if 'AnimState1_0' in A else pret
    coupe = next((n for n in ['AnimState2_to_AnimState1_0', 'AnimState0_to_AnimState1_0'] if n in A), None)
    poses = [('pret', pret, 0), ('recolte', recolte, 0)]
    if coupe:
        n = A[coupe][1]; idx = sorted({round(i * (n - 1) / (COUPE - 1)) for i in range(COUPE)}) if n > 1 else [0]
        poses += [(f'coupe_{j}', coupe, i) for j, i in enumerate(idx)]
    listes = [(nom, m.items(A[a][0], fr)) for nom, a, fr in poses]
    pts = sum((m.bornes(L) for _, L in listes), [])
    x0, y0 = min(p[0] for p in pts), min(p[1] for p in pts)
    W, H = int((max(p[0] for p in pts) - x0) * K) + 2, int((max(p[1] for p in pts) - y0) * K) + 2
    images = []
    for nom, L in listes:
        im = m.rendu(L, x0, y0, W, H); bb = im.getbbox() or (0, 0, 1, 1)
        images.append((nom, im.crop(bb), bb))
    # rangement en lignes de 4096 px au plus (limite des textures)
    pos, x, y, lh, PL = [], 0, 0, 0, 0
    for nom, im, bb in images:
        if x and x + im.width > 4096: x, y, lh = 0, y + lh + 2, 0
        pos.append((x, y)); x += im.width + 2; lh = max(lh, im.height); PL = max(PL, x)
    PH = y + lh
    out = Image.new('RGBA', (PL, PH), (0, 0, 0, 0)); frames = {}
    for (nom, im, bb), (x, y) in zip(images, pos):
        out.paste(im, (x, y))
        frames[nom] = {'frame': {'x': x, 'y': y, 'w': im.width, 'h': im.height}, 'rotated': False, 'trimmed': True,
                       'spriteSourceSize': {'x': bb[0], 'y': bb[1], 'w': im.width, 'h': im.height}, 'sourceSize': {'w': W, 'h': H}}
    out.save(f'{sortie}/{g}.avif', 'AVIF', quality=int(os.environ.get('QUALITY', 55)), speed=6)
    meta = {'image': f'{g}.avif', 'size': {'w': PL, 'h': PH}, 'scale': 1, 'ancre': {'x': round(-x0 * K / W, 4), 'y': round(-y0 * K / H, 4)},
            'echelle': K, 'coupe': sum(1 for n in frames if n.startswith('coupe_'))}
    json.dump({'frames': frames, 'meta': meta}, open(f'{sortie}/{g}.json', 'w'), separators=(',', ':'))
    return PL, PH

if __name__ == '__main__':
    src, sortie = sys.argv[1:3]; os.makedirs(sortie, exist_ok=True)
    gfx = sys.argv[3].split(',') if len(sys.argv) > 3 else sorted(os.listdir(src), key=int)
    for g in gfx:
        if not os.path.exists(f'{src}/{g}/motion.bin'): print(g, 'absent'); continue
        print(g, planche(f'{src}/{g}', sortie, g))
