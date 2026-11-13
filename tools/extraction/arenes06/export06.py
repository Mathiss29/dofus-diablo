# export06.py mondes_dir [apercu_dir|-] [noms]   (lancé depuis le dossier de travail : tex/ = <gfx>.png, cartes/ = map_<id>.json)
# Les 5 arènes de la 0.6 (ligne « Arènes : 1A 2D 3A 4A+4C 5B 6B+6C 7A 8A+8B 9A+9C 10A+10C 11A », 13 nov. 2026) mises en vraies
# cartes du jeu, comme arenes.py et arenes04/export04.py : sol en une image, décor en atlas posé case par case, cases marchables.
# Rangées sous le monde d'Astrub (ligne y = 94), cartes `v06: 1` (marchables seulement si V06_PUBLIC ou en partie de test).
# Le monde doit être JOINT avant (regions_monde.py joindre) puis scindé après (regions_monde.py scinder).
# Écrit les points de chaque arène (cases) dans arenes06_points.json, que donjons06.py range dans zones.json.
import sys, os, json, runpy
_argv = sys.argv[1:]
mondes = _argv[0]; apercu = _argv[1] if len(_argv) > 1 and _argv[1] != '-' else None
SEUL = _argv[2].split(',') if len(_argv) > 2 else None
HERE = os.path.dirname(os.path.abspath(__file__))
C = runpy.run_path(os.path.join(HERE, 'compo06.py'))
from PIL import Image, ImageDraw

# arène -> (tag, place [x, y] dans le monde d'Astrub, salle officielle du boss (id), sous-zone officielle du donjon)
DJ = {'blops': ('arene_blops', (-4, 94), 166985730, 493), 'draeg': ('arene_draegnerys', (0, 94), 199757824, 920),
      'nyee': ('arene_nyee', (4, 94), 149165056, 844), 'ancestral': ('arene_ancestral', (8, 94), 149688320, 175),
      'labyrinthe': ('arene_dragon_cochon', (12, 94), 72355840, 154)}
W, H, OX, OY, COLS, ROWS, NS = C['W'], C['H'], C['OX'], C['OY'], C['COLS'], C['ROWS'], C['NS']
MW, MH, CX, CY, BOX = C['MW'], C['MH'], C['CX'], C['CY'], C['BOX']
BT0 = {}


def exporter(k):
    a, fond, POINTS, ok = C['COMPOS'][k]()
    tag, (sx, sy), mid, sub = DJ[k]
    out = f'{mondes}/astrub'; M = json.load(open(f'{out}/monde.json'))
    if any('decor' not in m for m in M['maps']): sys.exit('monde scindé : lancer regions_monde.py joindre avant')
    X0, Y0 = M['origin']; ix, iy = sx - X0, sy - Y0; dx, dy = ix * MW, iy * MH
    ox, oy = dx + CX, dy + CY
    cols, rows = M['grid']['cols'], M['grid']['rows']
    need_rows = (iy + NS) * ROWS
    if need_rows > rows: M['grid']['rows'] = rows = need_rows   # cases marchables carte par carte (movCartes) : seule la grille grandit
    sol = C['rendre']([e for e in a.els if e['k'][0] == 0], BOX, fond)
    sol.convert('RGB').save(f'{out}/sol_{tag}.webp', quality=80, method=6)
    variants, places = {}, []
    mov = ['0'] * (NS * ROWS * NS * COLS)   # cases de l'arène, ligne par ligne (movCartes[tag])
    def case(x, y):
        px, py = x + CX - OX, y + CY - OY
        r = round((py - H / 2) / (H / 2)); best, bd = -1, 9e9
        for rr in (r - 1, r, r + 1):
            if not 0 <= rr < NS * ROWS: continue
            kk0 = round((px - W / 2 - (rr % 2) * W / 2) / W)
            for kk in (kk0 - 1, kk0, kk0 + 1):
                if not 0 <= kk < NS * COLS: continue
                cx, cy = W / 2 + kk * W + (rr % 2) * W / 2, H / 2 + rr * H / 2; d = abs(px - cx) / (W / 2) + abs(py - cy) / (H / 2)
                if d < bd: bd, best = d, (iy * ROWS + rr) * cols + ix * COLS + kk
        return best
    tags = {v[0] for v in DJ.values()}
    bt0 = max([p.get('bt', 0) for m in M['maps'] for p in m['decor'] if m['tag'] not in tags] + [b[1] for b in BT0.values()] + [0]) + 1
    grand = {}
    for e in a.els:
        if 'grp' in e:
            b = C['gfx'](e['g']).getbbox() or (0, 0, 0, 0)
            grand[e['grp']] = max(grand.get(e['grp'], 0), (b[2] - b[0]) * abs(e['sx']) * (b[3] - b[1]) * abs(e['sy']))
    for e in sorted([e for e in a.els if e['k'][0] == 1], key=lambda e: e['k']):
        key = (e['g'], e['c'], round(e['sx'], 3), round(e['sy'], 3))
        if key not in variants:
            im = C['styled'](e)
            if im is None: continue
            variants[key] = ('d%d' % len(variants), im)
        bt = {'bt': bt0 + e['grp']} if 'grp' in e and grand[e['grp']] > 30000 else {}
        places.append({'f': variants[key][0], 'x': round(e['x'] + ox, 1), 'y': round(e['y'] + oy, 1), 'c': case(e['fx'], e['fy']), 'o': e['o'], **bt})
    BT0[tag] = (bt0, bt0 + getattr(a, 'ngrp', 0))
    items = sorted(variants.values(), key=lambda v: -v[1].height); maxW = 2048; px = py = rowH = 0; pos = {}
    for name, im in items:
        b = im.getbbox() or (0, 0, 1, 1); w, h = b[2] - b[0] + 2, b[3] - b[1] + 2
        if px + w > maxW: px = 0; py += rowH; rowH = 0
        pos[name] = (px, py, b); px += w; rowH = max(rowH, h)
    atlas = Image.new('RGBA', (maxW, max(1, py + rowH))); frames = {}
    for name, im in items:
        ax, ay, b = pos[name]; atlas.paste(im.crop(b), (ax + 1, ay + 1)); w, h = b[2] - b[0], b[3] - b[1]
        frames[name] = {'frame': {'x': ax + 1, 'y': ay + 1, 'w': w, 'h': h}, 'rotated': False, 'trimmed': True,
                        'spriteSourceSize': {'x': b[0], 'y': b[1], 'w': w, 'h': h}, 'sourceSize': {'w': im.width, 'h': im.height}}
    atlas.save(f'{out}/decor_{tag}.webp', quality=82, method=6)
    json.dump({'frames': frames, 'meta': {'image': f'decor_{tag}.webp', 'size': {'w': maxW, 'h': atlas.height}, 'scale': '1'}}, open(f'{out}/decor_{tag}.json', 'w'))
    vert = []
    for rr in range(NS * ROWS):
        for kk in range(NS * COLS):
            c = rr * NS * COLS + kk
            x = OX + W / 2 + kk * W + (rr % 2) * W / 2 - CX; y = OY + H / 2 + rr * H / 2 - CY
            o = ok(x, y, a.bloque); mov[c] = '1' if o else '0'
            if o: vert.append((x, y))
    M['movCartes'][tag] = ''.join(mov)
    entree = {'x': sx, 'y': sy, 'id': mid, 'sub': sub, 'tag': tag, 'n': [NS, NS], 'inside': 1, 'batiments': 1, 'v06': 1,
              'sol': {'x': BOX[0] + ox, 'y': BOX[1] + oy, 'w': sol.width, 'h': sol.height}, 'decor': places}
    M['maps'] = [m for m in M['maps'] if m['tag'] != tag] + [entree]
    open(f'{out}/monde.json', 'w').write(json.dumps(M, ensure_ascii=False, separators=(',', ':')))
    pts = {kk: ([case(*p) for p in v] if kk == 'entrees' else case(*v)) for kk, v in POINTS.items()}
    if apercu:
        im = C['rendre'](a.els, BOX, fond); d = ImageDraw.Draw(im, 'RGBA')
        for x, y in vert: d.ellipse((x - BOX[0] - 5, y - BOX[1] - 3, x - BOX[0] + 5, y - BOX[1] + 3), fill=(80, 255, 80, 90))
        im.convert('RGB').resize((im.width // 3, im.height // 3)).save(f'{apercu}/{tag}.jpg', quality=84)
    print(tag, (sx, sy), len(places), 'éléments,', len(variants), 'images, atlas', atlas.size, ',', len(vert), 'cases')
    return tag, pts


if __name__ == '__main__':
    if apercu: os.makedirs(apercu, exist_ok=True)
    p = os.path.join(HERE, 'arenes06_points.json')
    res = json.load(open(p)) if os.path.exists(p) else {}
    for k in DJ:
        if SEUL and k not in SEUL: continue
        tag, pts = exporter(k); res[k] = dict(tag=tag, **pts)
    json.dump(res, open(p, 'w'), ensure_ascii=False, indent=1)
