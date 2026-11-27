# compo07.py : arènes des 7 donjons de la 0.7 (ligne « 0.7 : » 4A-4G, 27 nov. 2026), comme compo06.py : sol = salles officielles
# du donjon recopiées autour de la salle du boss, anneau et abris faits des pièces (groupes d'éléments) de ces salles.
# Les pièces sont choisies une fois pour toutes par `python3 compo07.py pieces` (groupes de taille moyenne, rangés dans
# pieces07.json : donjon -> [[carte, cadre], ...]) ; `python3 compo07.py apercu [noms]` écrit vues/arene_<nom>.jpg.
# Lancé depuis un dossier de travail avec cartes/ (map_<id>.json des salles, map_dump.py) et tex/ (<gfx>.png).
import json, sys, os, math, random, runpy
HERE = os.path.dirname(os.path.abspath(__file__))
_ARGS = sys.argv[1:]
C6 = runpy.run_path(os.path.join(HERE, '..', 'arenes06', 'compo06.py'), run_name='compo06')
globals().update({k: v for k, v in C6.items() if not k.startswith('__') and k not in ('COMPOS', 'PC', 'P', 'HERE')})
PJ = os.path.join(HERE, 'pieces07.json')
PC = json.load(open(PJ)) if os.path.exists(PJ) else {}

# donjon -> salles dont on prend les pièces (ids des salles officielles, table dungeons)
SALLES = {
    'koulosse': [107218944, 107219968, 107220992, 107223040, 107224064, 107225088, 107227136, 107216896],
    'corbac': [159125512, 159124488, 159121666],
    'rasboul': [22806530, 22807554, 22808578, 22809602, 22808576],
    'damadrya': [208666624, 208667648, 208668672, 208669696, 208670720],
    'skeunk': [107486208, 107483136, 107485184, 107480064, 107482112, 107484160],
    'blop': [166990850],
    'royalmouth': [55050242, 55052290, 55052288, 55050240, 55053312],
    # 6C : Laboratoire caché d'Otomaï (sous-zone 473, cinq salles sous [-55,4])
    'labo': [90177536, 90178560, 90179584, 90181632, 90180608],
}


def groupes(mid, k=0.3):
    bs = _boites(mid); n = len(bs); par = list(range(n))
    inner = [((b[0] * (1 - k) + b[2] * k), (b[1] * (1 - k) + b[3] * k), (b[2] * (1 - k) + b[0] * k), (b[3] * (1 - k) + b[1] * k)) for b, _ in bs]
    def f(i):
        while par[i] != i: par[i] = par[par[i]]; i = par[i]
        return i
    for i in range(n):
        a = inner[i]
        for j in range(i + 1, n):
            b = inner[j]
            if a[0] + 6 < b[2] and b[0] + 6 < a[2] and a[1] + 6 < b[3] and b[1] + 6 < a[3]: par[f(i)] = f(j)
    g = {}
    for i in range(n): g.setdefault(f(i), []).append(i)
    out = []
    for ix in g.values():
        sombre = sum(1 for i in ix if (lambda v: ((v >> 16) & 255) + ((v >> 8) & 255) + (v & 255))(bs[i][1]['color']['value']) < 150)
        c = (min(bs[i][0][0] for i in ix), min(bs[i][0][1] for i in ix), max(bs[i][0][2] for i in ix), max(bs[i][0][3] for i in ix))
        out.append((c, sombre * 2 > len(ix)))
    return out


def choisir(mids, mn=90, mx=560, n=48):
    L = []
    for mid in mids:
        for c, sombre in groupes(mid):
            w, h = c[2] - c[0], c[3] - c[1]
            if mn < w < mx and mn < h < mx * 1.2 and not sombre: L.append([mid, list(c)])
    L.sort(key=lambda p: -(p[1][2] - p[1][0]) * (p[1][3] - p[1][1]))
    vu, out = set(), []
    for m, c in L:   # une seule fois chaque pièce (mêmes images, même taille)
        sig = (tuple(sorted(q['g'] for q in piece(m, boite=c))), round(c[2] - c[0]), round(c[3] - c[1]))
        if sig not in vu: vu.add(sig); out.append([m, c])
    return out[:n]


def P(n, i):
    mid, c = PC[n][i % len(PC[n])]; return piece(mid, boite=c)


def tous(n, sauf=()): return [P(n, i) for i in range(len(PC[n])) if i not in sauf]


# pièces choisies sur les planches (vues/pieces_<donjon>.jpg) : anneau, 4 abris, décor des bords
CHOIX = {
    'koulosse': ([9, 14, 15, 18, 22, 5, 6, 2, 4], [15, 12, 22, 13], [5, 6, 2, 16, 17, 3, 10, 14, 23]),
    'corbac': ([0, 4, 6, 8, 13, 15, 16, 17, 11], [26, 40, 45, 21], [7, 18, 14, 5, 24, 27, 35, 20, 41]),
    'rasboul': ([12, 13, 14, 16, 0, 6, 18], [3, 19, 27, 47], [1, 2, 4, 5, 26, 25, 31, 47, 0]),
    'damadrya': ([0, 1, 2, 3, 4, 5, 6, 12, 13, 23, 24], [10, 9, 34, 8], [7, 15, 39, 37, 45, 30, 27, 26, 0]),
    'skeunk': ([2, 3, 4, 9, 11, 14, 22, 24, 31, 32, 33, 43, 47], [7, 26, 21, 29], [0, 1, 6, 8, 12, 13, 25, 30, 36]),
    'blop': ([9, 12, 13, 15, 16, 17, 18, 19, 20, 21, 22, 24, 25, 26], [11, 14, 23, 27], [6, 7, 8, 10, 32, 33, 34, 0, 5]),
    'royalmouth': ([16, 18, 22, 30, 9, 8, 0, 1], [9, 15, 23, 28], [2, 3, 5, 7, 24, 26, 27, 29, 35]),
    'labo': ([4, 6, 7, 8, 9, 11, 12, 14, 15, 16, 17], [18, 21, 20, 23], [5, 13, 19, 22, 18, 21, 5, 13, 22]),
}


def cour07(d, seed, centre, autour, k=0.92, mw=1500, fond=(10, 10, 10), anneau_n=18):
    """Cour ronde commune : sol officiel, anneau de pièces du donjon percé des 3 entrées et du fond, 4 abris, décor des bords."""
    a = base(seed, centre, autour, k=k, mw=mw)
    an, ab, de = CHOIX[d]; rnd = random.Random(seed)
    a.anneau([P(d, i) for i in an], 1060, 610, anneau_n, ENT + [(0, -590)], ecart=250)
    for i, (x, y) in enumerate(ABRIS): a.put(P(d, ab[i]), x, y, i % 2 == 1, bloque=90)
    for j, (x, y, f) in enumerate([(0, -780, False), (-460, -720, False), (460, -720, True), (-900, -520, False), (900, -520, True),
                                   (-1280, 100, False), (1280, 100, True), (-760, 860, False), (760, 860, True)]):
        a.put(P(d, de[j % len(de)]), x, y, f)
    return a, fond, dict(POINTS), cour


def koulosse(etage):
    # 5A : trois étages qu'on descend (salles officielles d'entrée, du milieu et du fond de la caverne)
    c, t = [(107218944, 107223040), (107224064, 107220992), (107216896, 107225088)][etage]
    return cour07('koulosse', 300 + etage, c, t, fond=(18, 12, 6))


COMPOS = {
    'koulosse_1': lambda: koulosse(0), 'koulosse_2': lambda: koulosse(1), 'koulosse_3': lambda: koulosse(2),
    'corbac': lambda: cour07('corbac', 310, 159121666, 159121666, k=0.75, mw=330, fond=(30, 24, 14)),
    'rasboul': lambda: cour07('rasboul', 320, 22809602, 22807554, fond=(40, 70, 20)),
    'damadrya': lambda: cour07('damadrya', 330, 208670720, 208667648, fond=(4, 7, 3)),
    'skeunk': lambda: cour07('skeunk', 340, 107484160, 107483136, fond=(30, 50, 14)),
    'blop': lambda: cour07('blop', 350, 166990850, 166990850, fond=(40, 60, 20)),
    'royalmouth': lambda: cour07('royalmouth', 360, 55052290, 55050242, k=0.55, fond=(16, 20, 12)),
    'labo': lambda: cour07('labo', 370, 90179584, 90181632, k=0.45, mw=330, fond=(12, 9, 4)),
}

if __name__ == '__main__' and _ARGS[:1] == ['pieces']:
    out = {d: choisir(m) for d, m in SALLES.items()}
    json.dump(out, open(PJ, 'w')); print({d: len(v) for d, v in out.items()})
if __name__ == '__main__' and _ARGS[:1] == ['planche']:
    from PIL import Image, ImageDraw
    os.makedirs('vues', exist_ok=True)
    for d in _ARGS[1:] or PC:
        L = PC[d]; cols, cw = 8, 240
        Wp = Image.new('RGB', (cols * cw, ((len(L) + cols - 1) // cols) * cw), (30, 30, 30)); dr = ImageDraw.Draw(Wp)
        for i in range(len(L)):
            p = P(d, i); a = Arene(1); a.put(p, 0, 0)
            xs = [e['x'] for e in a.els]; ys = [e['y'] for e in a.els]
            im = rendre(a.els, (min(xs) - 400, min(ys) - 500, max(xs) + 400, max(ys) + 200), None)
            bb = im.getbbox()
            if bb: im = im.crop(bb)
            im.thumbnail((cw - 10, cw - 24)); Wp.paste(im, ((i % cols) * cw + 5, (i // cols) * cw + 5), im)
            dr.text(((i % cols) * cw + 5, (i // cols) * cw + cw - 16), str(i), fill=(255, 255, 0))
        Wp.save(f'vues/pieces_{d}.jpg', quality=80); print(d)
if __name__ == '__main__' and _ARGS[:1] == ['apercu']:
    from PIL import ImageDraw
    os.makedirs('vues', exist_ok=True)
    for n in _ARGS[1:] or COMPOS:
        a, fond, pts, ok = COMPOS[n]()
        im = rendre(a.els, BOX, fond); dr = ImageDraw.Draw(im, 'RGBA')
        for k, v in pts.items():
            for x, y in (v if k == 'entrees' else [v]): dr.ellipse((x - BOX[0] - 16, y - BOX[1] - 9, x - BOX[0] + 16, y - BOX[1] + 9), outline=(255, 60, 60, 255), width=4)
        im.convert('RGB').resize((im.width // 3, im.height // 3)).save(f'vues/arene_{n}.jpg', quality=84); print(n)
