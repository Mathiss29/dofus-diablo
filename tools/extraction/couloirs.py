# couloirs.py monde donjon
# Donjons en couloirs (maquette « Couloirs : 1C 2B 3A 4A », 9 nov. 2026) : les vraies salles officielles d'un donjon, reliées
# par des couloirs façon Diablo, puis la cour en vagues du boss (l'arène d'arenes.py) au bout du dernier couloir.
# Tout tient dans une bande de cartes ajoutée sous le monde (sans coupure, 4A) :
#   salle 1 | couloir | salle 2 | couloir | … | salle n | couloir | arène (3 x 3)
# Les salles et l'arène sont DÉPLACÉES (sol, décor, cases marchables, points de l'arène) : leurs images ne changent pas.
# Chaque couloir est une carte (tag couloir_<salle>) : un sol en V aligné sur les cases, peint avec le vrai sol de la salle
# d'avant (recopié case par case). Les cases des couloirs ne sont PAS dans mov : elles sont dans zones.json (couloirs.cases),
# et le jeu les ouvre en partie de test seulement (la partie publique garde l'arène fermée, sans couloir). Plan fixe (3A) : refaire tourner l'outil donne le même résultat.
#   python3 tools/extraction/couloirs.py astrub "Grange du Tournesol Affamé"
# Lit les sols des salles dans public/assets/mondes/<monde> (node tools/hebergement/envoi.mjs --recuperer), écrit
# sol_couloir_*.webp, monde.json et zones.json (open.donjons[].couloirs). Puis : node tools/hebergement/envoi.mjs
import sys, os, json, math
from PIL import Image, ImageDraw, ImageFilter

RACINE = os.path.join(os.path.dirname(__file__), '../..')
W, H, OX, OY, COLS, ROWS = 86, 43, -620, -490, 14, 40
MW, MH = COLS * W, ROWS * H // 2
LARG = 3           # demi-largeur du couloir, en demi-rangées de cases (≈ 3 cases et demie de large)
PERIODE = (4, 8)   # motif du sol recopié : 4 colonnes x 8 rangées prises au milieu de la salle

# Donjons gérés : salles dans l'ordre du trajet (la salle du boss officielle n'en fait pas partie : le boss est dans l'arène)
DONJONS = {
    'Grange du Tournesol Affamé': {'salles': ['grange_1', 'grange_2', 'grange_3', 'grange_4'], 'errants': 2},
}

def main(monde_nom, nom):
    dossier = f'{RACINE}/public/assets/mondes/{monde_nom}'
    M = json.load(open(f'{dossier}/monde.json'))
    Zp = f'{RACINE}/src/data/zones.json'; Z = json.load(open(Zp))
    dj = next(d for d in Z[monde_nom]['open']['donjons'] if d['nom'] == nom)
    conf = DONJONS[nom]; salles = conf['salles']; atag = dj['arene']['tag']
    X0, Y0 = M['origin']; cols = M['grid']['cols']
    maps = {m['tag']: m for m in M['maps']}
    if dj.get('couloirs'): raise SystemExit('déjà fait : repartir de monde.json et zones.json d avant (git checkout) puis relancer')
    origine = {t: [maps[t]['x'], maps[t]['y']] for t in salles + [atag]}
    # bande neuve sous tout le reste : arène sur 3 rangées de cartes, salles et couloirs sur celle du milieu
    bas = max(m['y'] + m.get('n', [1, 1])[1] - 1 for m in M['maps'] if m['tag'] not in origine)
    yb = bas + 2; ym = yb + 1
    x = X0
    places = {}
    for t in salles: places[t] = (x, ym); x += 2
    places[atag] = (x, yb)
    rows_voulues = (yb + 3 - Y0) * ROWS
    if rows_voulues > M['grid']['rows']:
        M['mov'] += '0' * (rows_voulues - M['grid']['rows']) * cols; M['grid']['rows'] = rows_voulues
    for t, (px, py) in places.items(): deplacer(M, maps[t], px, py, cols, X0, Y0, Z, monde_nom, atag)
    # cases marchables de chaque salle et de l'arène (grande grille)
    mov = list(M['mov'])
    def cases_de(m):
        n = m.get('n', [1, 1]); out = set()
        for rr in range((m['y'] - Y0) * ROWS, (m['y'] - Y0 + n[1]) * ROWS):
            for kk in range((m['x'] - X0) * COLS, (m['x'] - X0 + n[0]) * COLS):
                if mov[rr * cols + kk] == '1': out.add((kk, rr))
        return out
    def pix(k, r): return OX + W / 2 + k * W + (r % 2) * W / 2, OY + H / 2 + r * H / 2
    def case(x, y):
        r = round((y - OY - H / 2) / (H / 2)); best, bd = None, 9e9
        for rr in (r - 1, r, r + 1):
            k = round((x - OX - W / 2 - (rr % 2) * W / 2) / W)
            for kk in (k - 1, k, k + 1):
                cx, cy = pix(kk, rr); d = abs(x - cx) / (W / 2) + abs(y - cy) / (H / 2)
                if d < bd: bd, best = d, (kk, rr)
        return best
    chaine = salles + [atag]
    tags, errants, ouvrir = [], [], set()
    for i, (ta, tb) in enumerate(zip(chaine, chaine[1:])):
        A, B = cases_de(maps[ta]), cases_de(maps[tb])
        ya = sum(pix(*p)[1] for p in A) / len(A); yb_ = sum(pix(*p)[1] for p in B) / len(B)
        pa = max(A, key=lambda p: pix(*p)[0] - abs(pix(*p)[1] - ya) * 0.6)
        pb = min(B, key=lambda p: pix(*p)[0] + abs(pix(*p)[1] - yb_) * 0.6)
        (xa, ya), (xb, yb2) = pix(*pa), pix(*pb)
        DX, DY = xb - xa, yb2 - ya; a_, b_ = (DX / 2 + DY) / 2, (DX / 2 - DY) / 2
        pts = [(xa, ya), (xa + 2 * a_, ya + a_), (xb, yb2)] if a_ > 0 and b_ > 0 else [(xa, ya), (xb, yb2)]
        cor = set()
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            n = int(math.hypot(x1 - x0, y1 - y0) / 12) + 1
            for t in range(n + 1):
                x_ = x0 + (x1 - x0) * t / n; y_ = y0 + (y1 - y0) * t / n
                r0 = round((y_ - OY - H / 2) / (H / 2))
                for r in range(r0 - LARG, r0 + LARG + 1):
                    k0 = round((x_ - OX - W / 2 - (r % 2) * W / 2) / W)
                    for k in (k0 - 1, k0, k0 + 1):
                        cx, cy = pix(k, r)
                        if abs(cy - y_) <= LARG * H / 2 + 1 and abs(cx - x_) <= W * 0.8: cor.add((k, r))
        neuves = cor - A - B
        ouvrir |= neuves   # pas dans mov : le jeu les ouvre seulement en partie de test (World, donjon en couloirs)
        # la carte du couloir : la place libre entre les deux salles
        cx_, cy_ = places[ta][0] + 1, places[ta][1]
        tag = f'couloir_{ta}'; tags.append(tag)
        sol = peindre(dossier, maps[ta], A, neuves, A | B | cor, pix)
        x0s = min(pix(k, r)[0] for k, r in neuves) - W; y0s = min(pix(k, r)[1] for k, r in neuves) - H * 2
        sol.save(f'{dossier}/sol_{tag}.webp', quality=82, method=6)
        M['maps'] = [m for m in M['maps'] if m['tag'] != tag] + [{
            'x': cx_, 'y': cy_, 'id': maps[ta]['id'], 'sub': maps[ta]['sub'], 'tag': tag, 'inside': 1, 'batiments': 1, 'dessus': 1,
            'sol': {'x': round(x0s, 1), 'y': round(y0s, 1), 'w': sol.width, 'h': sol.height}, 'decor': []}]
        # errants (2B) : au creux du V, une case du couloir dans sa propre carte
        mil = pts[len(pts) // 2] if len(pts) == 3 else ((xa + xb) / 2, (ya + yb2) / 2)
        errants.append(case(*mil))
    M['mov'] = ''.join(mov)
    json.dump(M, open(f'{dossier}/monde.json', 'w'))
    def gcell(p): return p[1] * cols + p[0]
    dj['couloirs'] = {'salles': salles, 'tags': tags, 'errants': [gcell(p) for p in errants], 'nErrants': conf['errants'],
                      'cases': sorted(gcell(p) for p in ouvrir),
                      'origine': origine}
    json.dump(Z, open(Zp, 'w'), ensure_ascii=False, indent=1)
    print(nom, ': salles', salles, '-> bande y =', ym, '; arène', places[atag], '; couloirs', tags)

def deplacer(M, m, nx, ny, cols, X0, Y0, Z, monde_nom, atag):
    """Déplace une carte (et ses cases marchables, son sol, son décor ; les points de l'arène) vers la place nx, ny."""
    dxs, dys = nx - m['x'], ny - m['y']
    if not dxs and not dys: return
    n = m.get('n', [1, 1]); mov = list(M['mov']); dc = dys * ROWS * cols + dxs * COLS
    vieux = []
    for rr in range((m['y'] - Y0) * ROWS, (m['y'] - Y0 + n[1]) * ROWS):
        for kk in range((m['x'] - X0) * COLS, (m['x'] - X0 + n[0]) * COLS):
            c = rr * cols + kk; vieux.append((c, mov[c])); mov[c] = '0'
    for c, v in vieux: mov[c + dc] = v
    M['mov'] = ''.join(mov)
    m['x'], m['y'] = nx, ny
    m['sol']['x'] = round(m['sol']['x'] + dxs * MW, 1); m['sol']['y'] = round(m['sol']['y'] + dys * MH, 1)
    for p in m.get('decor', []):
        p['x'] = round(p['x'] + dxs * MW, 1); p['y'] = round(p['y'] + dys * MH, 1)
        if p.get('c', -1) >= 0: p['c'] += dc
    if m['tag'] == atag:
        a = next(d for d in Z[monde_nom]['open']['donjons'] if d.get('arene', {}).get('tag') == atag)['arene']
        for k, v in a.items():
            if k == 'entrees': a[k] = [c + dc for c in v]
            elif k != 'tag': a[k] = v + dc

def peindre(dossier, salle, A, neuves, tout, pix):
    """Sol du couloir : le vrai sol de la salle d'avant, recopié case par case avec un motif de PERIODE cases
    (le dallage reste continu), bords assombris là où le couloir touche le vide."""
    src = Image.open(f'{dossier}/sol_{salle["tag"]}.webp').convert('RGBA'); sx0, sy0 = salle['sol']['x'], salle['sol']['y']
    # coin du motif : une case de la salle dont tout le voisinage (PERIODE) est marchable, la plus proche du milieu
    cx = sum(pix(*p)[0] for p in A) / len(A); cy = sum(pix(*p)[1] for p in A) / len(A)
    pk, pr = PERIODE
    bons = [p for p in A if all((p[0] + i, p[1] + j) in A for i in range(pk) for j in range(pr))]
    def clarte(p):   # motif sans ombres d'objets : le plus clair parmi les 40 plus proches du milieu
        x, y = pix(*p); b = src.crop((round(x - sx0), round(y - sy0 - H), round(x - sx0 + pk * W), round(y - sy0 + pr * H / 2))).convert('L')
        return sum(b.getdata()) / max(1, b.width * b.height)
    proches = sorted(bons or A, key=lambda p: math.hypot(pix(*p)[0] - cx, pix(*p)[1] - cy))[:40]
    k0, r0 = max(proches, key=clarte)
    x0 = min(pix(k, r)[0] for k, r in neuves) - W; y0 = min(pix(k, r)[1] for k, r in neuves) - H * 2
    x1 = max(pix(k, r)[0] for k, r in neuves) + W; y1 = max(pix(k, r)[1] for k, r in neuves) + H
    can = Image.new('RGBA', (int(x1 - x0), int(y1 - y0)), (0, 0, 0, 0))
    losange = Image.new('L', (W + 4, H + 2), 0)
    ImageDraw.Draw(losange).polygon([(0, H / 2 + 1), (W / 2 + 2, 0), (W + 4, H / 2 + 1), (W / 2 + 2, H + 2)], fill=255)
    for k, r in sorted(neuves, key=lambda p: (p[1], p[0])):
        sk, sr = k0 + (k - k0) % pk, r0 + (r - r0) % pr
        if (sr % 2) != (r % 2): sr += 1
        qx, qy = pix(sk, sr); bx, by = round(qx - sx0 - W / 2 - 2), round(qy - sy0 - H / 2 - 1)
        tuile = src.crop((bx, by, bx + W + 4, by + H + 2))
        tx, ty = pix(k, r)
        can.paste(tuile, (round(tx - x0 - W / 2 - 2), round(ty - y0 - H / 2 - 1)), losange)
    # bords : ombre vers le vide
    vide = Image.new('L', can.size, 0); d = ImageDraw.Draw(vide)
    for k, r in neuves:
        for dk, dr in ((0, -2), (0, 2), (1, 0), (-1, 0)):
            q = (k + dk, r + dr)
            if q in tout: continue
            x, y = pix(*q); X, Y = x - x0, y - y0
            d.polygon([(X - W / 2, Y), (X, Y - H / 2), (X + W / 2, Y), (X, Y + H / 2)], fill=255)
    vide = vide.filter(ImageFilter.GaussianBlur(14))
    noir = Image.new('RGBA', can.size, (8, 6, 4, 255)); a = can.getchannel('A')
    can = Image.composite(noir, can, vide.point(lambda v: min(200, v * 2)))
    can.putalpha(a)
    return can

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
