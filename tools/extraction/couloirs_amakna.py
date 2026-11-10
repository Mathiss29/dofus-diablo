# couloirs_amakna.py
# Donjons d'Amakna en couloirs (« 0.4 suite : 5B », 10 nov. 2026), même idée que couloirs.py (Grange) pour le monde continu
# d'Astrub + Amakna (cases marchables carte par carte dans movCartes) et les donjons de la 0.4 (zones.json > astrub > donjonsTest).
#   python3 tools/extraction/couloirs_amakna.py plan.json
# plan.json = { "<clé>": { "salles": ["<clé>_1", ...], "x0": X, "yb": Y } } : les vraies salles officielles du donjon (premières
# cartes de dungeons.mapIds, la dernière = salle du boss = l'arène) sont déjà exportées en (x0 + 2j, yb + 1) par world_export.py
# + monde_continent.py fusion. L'outil :
#   - retire les grands masques noirs des salles (pièces presque noires : ils cachaient les couloirs) ;
#   - pose l'arène du donjon (arene_<clé>, 3 x 3) au bout de la rangée, en (x0 + 2n, yb) ;
#   - trace un couloir en V entre chaque salle et la suivante (carte couloir_<salle>, sol peint avec le vrai sol de la salle) ;
#   - écrit dans zones.json : salles (groupes officiels du donjon, 2 par salle), couloirs (cases ouvertes en partie de test),
#     et la porte d'entrée du donjon mène à la première salle.
# Tout est marqué essai (0.4 cachée hors partie de test). Puis : node tools/hebergement/envoi.mjs
import sys, os, json, math
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from couloirs import peindre, LARG

RACINE = os.path.join(os.path.dirname(__file__), '../..')
COLS, ROWS = 14, 40

def main(plan_p):
    plan = json.load(open(plan_p))
    dossier = f'{RACINE}/public/assets/mondes/astrub'
    M = json.load(open(f'{dossier}/monde.json'))
    Zp = f'{RACINE}/src/data/zones.json'; Z = json.load(open(Zp))
    o = Z['astrub']['open']
    g = M['grid']; W, H, OX, OY, cols = g['w'], g['h'], g['ox'], g['oy'], g['cols']
    MW, MH = COLS * W, ROWS * H // 2
    X0, Y0 = M['origin']
    maps = {m['tag']: m for m in M['maps']}
    mc = M['movCartes']
    def pix(k, r): return OX + W / 2 + k * W + (r % 2) * W / 2, OY + H / 2 + r * H / 2
    def case(x, y):
        r = round((y - OY - H / 2) / (H / 2)); best, bd = None, 9e9
        for rr in (r - 1, r, r + 1):
            k = round((x - OX - W / 2 - (rr % 2) * W / 2) / W)
            for kk in (k - 1, k, k + 1):
                cx, cy = pix(kk, rr); d = abs(x - cx) / (W / 2) + abs(y - cy) / (H / 2)
                if d < bd: bd, best = d, (kk, rr)
        return best
    def cases_de(m):
        s = mc.get(m['tag'], ''); n = m.get('n', [1, 1]); w = n[0] * COLS
        k0, r0 = (m['x'] - X0) * COLS, (m['y'] - Y0) * ROWS
        return {(k0 + i % w, r0 + i // w) for i, ch in enumerate(s) if ch == '1'}
    def gcell(p): return p[1] * cols + p[0]
    def voisins(p):
        k, r = p; o_ = r % 2
        return [(k - 1 + o_, r - 1), (k + o_, r - 1), (k - 1 + o_, r + 1), (k + o_, r + 1), (k, r - 2), (k, r + 2), (k - 1, r), (k + 1, r)]
    def principale(A, avec=None):
        """Le plus grand morceau d'un seul tenant d'une salle (ou celui qui contient `avec`) : un couloir branché sur un îlot isolé
        ne mènerait nulle part."""
        reste, best = set(A), set()
        while reste:
            dep = reste.pop(); comp = {dep}; front = [dep]
            while front:
                n = []
                for q in front:
                    for v in voisins(q):
                        if v in reste: reste.discard(v); comp.add(v); n.append(v)
                front = n
            if avec is not None and avec in comp: return comp
            if len(comp) > len(best): best = comp
        return best
    occupe = set()
    for m in M['maps']:
        n_ = m.get('n', [1, 1])
        for i in range(n_[0]):
            for j in range(n_[1]): occupe.add((m['x'] + i, m['y'] + j))
    atlas = {}
    def sombre(m, p):
        k = f"p{p['p']}" if 'p' in p else m['tag']
        if k not in atlas: atlas[k] = (json.load(open(f'{dossier}/decor_{k}.json'))['frames'], Image.open(f'{dossier}/decor_{k}.webp').convert('RGBA'))
        fr, img = atlas[k]; F = fr.get(p['f'])
        if not F or p.get('b'): return False
        f = F['frame']
        if f['w'] * f['h'] < 60000: return False
        cr = img.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h'])).resize((max(1, f['w'] // 8), max(1, f['h'] // 8)))
        op = [q for q in cr.getdata() if q[3] > 128]
        return bool(op) and sum(1 for q in op if q[0] + q[1] + q[2] < 60) / len(op) >= 0.97
    tous = o.get('donjons', []) + o.get('donjonsTest', [])
    for cle, pl in plan.items():
        atag = f'arene_{cle}'
        dj = next(d for d in tous if d.get('arene', {}).get('tag') == atag)
        if dj.get('couloirs'): print(cle, ': déjà fait'); continue
        salles, x0, yb = pl['salles'], pl['x0'], pl['yb']; ym = yb + 1
        for t in salles:
            m = maps[t]; m['essai'] = 1
            avant = len(m['decor']); m['decor'] = [p for p in m['decor'] if not sombre(m, p)]
            # un bâtiment qui n'a plus de grande image (c'était le masque) n'en est plus un : ses pièces redeviennent du décor
            grand = {}
            for p in m['decor']:
                if 'bt' not in p: continue
                k = f"p{p['p']}" if 'p' in p else m['tag']
                if k not in atlas: atlas[k] = (json.load(open(f'{dossier}/decor_{k}.json'))['frames'], None)
                F = atlas[k][0][p['f']]['frame']; grand[p['bt']] = max(grand.get(p['bt'], 0), F['w'] * F['h'] * p.get('z', 1) ** 2)
            for p in m['decor']:
                if 'bt' in p and grand[p['bt']] <= 20000: del p['bt']
            print(f'  {t} : {avant - len(m["decor"])} masques noirs retirés')
        # l'arène au bout de la rangée
        a = maps[atag]; nx, ny = x0 + 2 * len(salles), yb
        dxs, dys = nx - a['x'], ny - a['y']; dc = dys * ROWS * cols + dxs * COLS
        if dxs or dys:
            a['x'], a['y'] = nx, ny
            a['sol']['x'] = round(a['sol']['x'] + dxs * MW, 1); a['sol']['y'] = round(a['sol']['y'] + dys * MH, 1)
            for p in a.get('decor', []):
                p['x'] = round(p['x'] + dxs * MW, 1); p['y'] = round(p['y'] + dys * MH, 1)
                if p.get('c', -1) >= 0: p['c'] += dc
            for k, v in dj['arene'].items():
                if k == 'entrees': dj['arene'][k] = [c + dc for c in v]
                elif k != 'tag': dj['arene'][k] = v + dc
        occupe |= {(nx + i, ny + j) for i in range(3) for j in range(3)}
        chaine = salles + [atag]
        tags, errants, ouvrir, annexes = [], [], set(), []
        for ta, tb in zip(chaine, chaine[1:]):
            A0, B0 = cases_de(maps[ta]), cases_de(maps[tb])
            A = principale(A0)
            ar = dj['arene']['arrivee']
            B = principale(B0, (ar % cols, ar // cols)) if tb == atag else principale(B0)
            ya = sum(pix(*p)[1] for p in A) / len(A); yb_ = sum(pix(*p)[1] for p in B) / len(B)
            pa = max(A, key=lambda p: pix(*p)[0] - abs(pix(*p)[1] - ya) * 0.6)
            pb = min(B, key=lambda p: pix(*p)[0] + abs(pix(*p)[1] - yb_) * 0.6)
            (xa, ya), (xb, yb2) = pix(*pa), pix(*pb)
            DX, DY = xb - xa, yb2 - ya; a_, b_ = (DX / 2 + DY) / 2, (DX / 2 - DY) / 2
            pts = [(xa, ya), (xa + 2 * a_, ya + a_), (xb, yb2)] if a_ > 0 and b_ > 0 else [(xa, ya), (xb, yb2)]
            cor = set()
            for (xs, ys), (xe, ye) in zip(pts, pts[1:]):
                n = int(math.hypot(xe - xs, ye - ys) / 12) + 1
                for t in range(n + 1):
                    x_ = xs + (xe - xs) * t / n; y_ = ys + (ye - ys) * t / n
                    r0 = round((y_ - OY - H / 2) / (H / 2))
                    for r in range(r0 - LARG, r0 + LARG + 1):
                        k0 = round((x_ - OX - W / 2 - (r % 2) * W / 2) / W)
                        for k in (k0 - 1, k0, k0 + 1):
                            cx, cy = pix(k, r)
                            if abs(cy - y_) <= LARG * H / 2 + 1 and abs(cx - x_) <= W * 0.8: cor.add((k, r))
            neuves = cor - A - B
            ouvrir |= neuves
            tag = f'couloir_{ta}'; tags.append(tag)
            sol = peindre(dossier, maps[ta], A, neuves, A0 | B0 | cor, pix)
            x0s = min(pix(k, r)[0] for k, r in neuves) - W; y0s = min(pix(k, r)[1] for k, r in neuves) - H * 2
            sol.save(f'{dossier}/sol_{tag}.webp', quality=82, method=6)
            M['maps'] = [m for m in M['maps'] if m['tag'] != tag] + [{
                'x': maps[ta]['x'] + 1, 'y': ym, 'id': maps[ta]['id'], 'sub': maps[ta]['sub'], 'tag': tag, 'inside': 1, 'batiments': 1,
                'dessus': 1, 'essai': 1, 'pages': [],
                'sol': {'x': round(x0s, 1), 'y': round(y0s, 1), 'w': sol.width, 'h': sol.height}, 'decor': []}]
            mc[tag] = '0' * (COLS * ROWS)
            occupe.add((maps[ta]['x'] + 1, ym))
            # cases du couloir hors de toute carte (le creux du V descend parfois d'une rangée) : petites cartes sans image,
            # pour que le jeu sache toujours où l'on est (bandeau, donjon, affichage du groupe)
            for (sx, sy) in sorted({(X0 + k // COLS, Y0 + r // ROWS) for k, r in neuves} - occupe):
                t2 = f'{tag}_{len(tags)}'; tags.append(t2); annexes.append(t2); occupe.add((sx, sy))
                Image.new('RGBA', (2, 2), (0, 0, 0, 0)).save(f'{dossier}/sol_{t2}.webp', lossless=True)
                M['maps'].append({'x': sx, 'y': sy, 'id': maps[ta]['id'], 'sub': maps[ta]['sub'], 'tag': t2, 'inside': 1, 'batiments': 1,
                    'dessus': 1, 'essai': 1, 'pages': [], 'sol': {'x': OX + (sx - X0) * MW, 'y': OY + (sy - Y0) * MH, 'w': 2, 'h': 2}, 'decor': []})
                mc[t2] = '0' * (COLS * ROWS)
            mil = pts[len(pts) // 2] if len(pts) == 3 else ((xa + xb) / 2, (ya + yb2) / 2)
            errants.append(case(*mil))
        # groupes officiels des salles : les monstres du donjon (vagues de l'arène, sans le boss), 2 groupes de 4 par salle
        pool = [m for v in dj['vagues'] for m in v['m'] if m != '?']
        pool = [m for m in dict.fromkeys(pool) if m != dj['bossVague'][0]]
        dj['salles'] = {t: [[pool[(3 * j + 2 * i + q) % len(pool)] for q in range(4)] for i in range(2)] for j, t in enumerate(salles)}
        dj['couloirs'] = {'salles': salles, 'tags': tags, 'errants': [gcell(p) for p in errants], 'nErrants': 2,
                          'cases': sorted(gcell(p) for p in ouvrir), 'origine': {}, 'annexes': annexes}
        # l'entrée du donjon mène à la première salle : la case marchable la plus à gauche (le trajet va vers la droite)
        A = principale(cases_de(maps[salles[0]])); m0 = maps[salles[0]]
        ent = min(A, key=lambda p: pix(*p)[0] + abs(pix(*p)[1] - sum(pix(*q)[1] for q in A) / len(A)) * 0.6)
        loc = (ent[1] - (m0['y'] - Y0) * ROWS) * COLS + (ent[0] - (m0['x'] - X0) * COLS)
        for po in o['portes']:
            if po['b'][0] == atag: po['b'] = [salles[0], loc]
        print(cle, ': salles', salles, '; arène', (nx, ny), '; couloirs', len(tags), '; cases', len(ouvrir))
    M['maps'] = list(M['maps'])
    json.dump(M, open(f'{dossier}/monde.json', 'w'))
    json.dump(Z, open(Zp, 'w'), ensure_ascii=False, indent=1)

if __name__ == '__main__':
    main(sys.argv[1])
