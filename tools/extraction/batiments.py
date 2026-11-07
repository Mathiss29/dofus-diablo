# batiments.py dossier_du_monde [dossier des cartes map_<id>.json] : range le décor en bâtiments (choix de Mathis « Cartes : 1B 2A 3A »,
# 2026-11-07). À lancer après world_export.py, decor_doublons.py et bords_fondu.py ; les cartes déjà traitées sont notées
# « batiments » dans monde.json.
#
# 1. Bâtiments recopiés par la carte voisine. Une carte Dofus reprend ce qui déborde de ses voisines, et parfois avec une autre
#    image du même bâtiment (autre couleur, autre version, décalée de quelques dizaines de pixels) : la Banque d'Astrub était
#    posée deux fois, à 41 px l'une de l'autre. decor_doublons.py ne retire que les copies identiques. Ici deux grandes images
#    de cartes voisines dont les FORMES se superposent (80 % une fois recalées) sont le même bâtiment : on garde celui de la carte
#    où il se trouve, et on retire avec la copie les petits morceaux qui l'accompagnent (porte, caisses : même décalage).
# 2. Bâtiments : chaque grande image en devient un, sauf si elle tient pour moitié sur un bâtiment déjà fait (toit sur ses
#    murs) ; chaque petite image qui tient aux deux tiers sur un bâtiment en fait partie (porte, enseigne, fenêtres, caisses
#    collées au mur). Le numéro « bt » sert au fondu : tout le bâtiment s'efface d'un bloc (render/transparence.ts).
# 3. Portes (3A) : dans les données de Dofus, une porte est rangée sur une case qui n'est pas sous son dessin (jusqu'à 8 cases
#    plus loin, souvent au bord de la carte qui la recopie) : elle passait derrière son mur ou par-dessus le toit d'à côté.
#    Avec le dossier des cartes, chaque porte prend la case et l'ordre de son bâtiment, juste devant son mur.
# COURANTE=1 (méthode « façon Sanstour », Mathis 2026-11-07) : à lancer sur un export SANS decor_doublons.py. Chaque carte
#    garde tout son décor, débords compris. Une image dont le centre sort du cadre de sa carte est notée « h » : le jeu ne la
#    montre que quand le joueur est sur cette carte (comme Dofus, qui n'affiche que la carte courante). Une copie (même image,
#    ou même bâtiment recopié) entre un débord « h » d'une carte C et l'original d'une voisine ne se retire plus : l'original
#    note C dans « cc » et le jeu le cache quand le joueur est sur C. Deux originaux en double (copies décalées) : on en retire un.
import sys, json, os, collections
import numpy as np
from PIL import Image
D = sys.argv[1]; CARTES = sys.argv[2] if len(sys.argv) > 2 else None
M = json.load(open(f'{D}/monde.json'))
W, H, OX, OY, COLS, ROWS = 86, 43, -620, -490, 14, 40
X0, Y0 = M['origin']
S = 4                     # masques au quart
GRAND = 20000             # pixels opaques d'une grande image (bâtiment, arbre)
COPIE = 8000              # taille mini d'une image recherchée en double
PORTES = {62977, 62986, 62987, 62988, 62989, 62995}
COURANTE = os.environ.get('COURANTE') == '1'
maps = [m for m in M['maps'] if not m.get('batiments')]
if not maps: print('déjà fait'); sys.exit()

def cadre(m):
    x0 = OX + W // 4 + (m['x'] - X0) * COLS * W; y0 = OY + H // 4 + (m['y'] - Y0) * ROWS * H // 2
    return x0, y0, x0 + COLS * W, y0 + ROWS * H // 2
def dehors_cadre(m, x, y):
    x0, y0, x1, y1 = cadre(m)
    return max(x0 - x, x - x1, 0) + max(y0 - y, y - y1, 0)

# --- les images, page par page (une page d'atlas à la fois en mémoire)
E = []
cle = lambda m, p: f"p{p['p']}" if 'p' in p else m['tag']
for m in maps:
    for i, p in enumerate(m['decor']):
        E.append({'m': m, 'i': i, 'p': p, 't': cle(m, p)})
par_page = collections.defaultdict(list)
for e in E: par_page[e['t']].append(e)
for t, L in par_page.items():
    fr = json.load(open(f'{D}/decor_{t}.json'))['frames']
    alpha = np.asarray(Image.open(f'{D}/decor_{t}.webp').getchannel('A'))
    for e in L:
        F = fr[e['p']['f']]; f = F['frame']; ss = F['spriteSourceSize']; so = F['sourceSize']; z = e['p'].get('z', 1)
        e['x0'] = e['p']['x'] + (ss['x'] - so['w'] / 2) * z; e['y0'] = e['p']['y'] + (ss['y'] - so['h'] / 2) * z
        e['w'], e['h'] = f['w'] * z, f['h'] * z
        a = alpha[f['y']:f['y'] + f['h'], f['x']:f['x'] + f['w']]
        e['n'] = int((a > 100).sum() * z * z)
        mk = Image.fromarray(a).resize((max(1, round(e['w'] / S)), max(1, round(e['h'] / S))), Image.BOX)
        e['mk'] = np.asarray(mk) > 100
    del alpha
decor = lambda e: e['p'].get('c', 0) >= 0 and 'b' not in e['p']
print(len(E), 'images')
for e in E:
    e['hc'] = COURANTE and not e['m'].get('inside') and not e['m'].get('ciel') and dehors_cadre(e['m'], e['p']['x'], e['p']['y']) > 0
def doublon(a, b, garde_a):
    """a et b (deux cartes voisines) sont la même chose. Sans COURANTE : on retire la copie. Avec : un débord cache
    l'original de la voisine quand on est sur sa carte ; deux originaux : on retire la copie ; deux débords : rien."""
    garde, copie = (a, b) if garde_a else (b, a)
    if not COURANTE or (not a['hc'] and not b['hc']): jeter.add(id(copie)); return True
    if a['hc'] and b['hc']: return False
    hn, nn = (a, b) if a['hc'] else (b, a)
    hn['copie'] = True
    # la copie prend la profondeur de l'original : sinon, rangée sur une case du bord de sa carte, elle passe devant ou
    # derrière les voisins au mauvais moment (le rempart devant le pied de l'horloge en [3,-20])
    if hn['p'].get('c', -1) >= 0 and nn['p'].get('c', -1) >= 0: hn['p']['c'], hn['p']['o'] = nn['p']['c'], nn['p']['o']
    l = nn['p'].setdefault('cc', [])
    if hn['m']['tag'] not in l: l.append(hn['m']['tag'])
    return False

def grille(L, case=512):
    G = collections.defaultdict(list)
    for e in L:
        for cx in range(int(e['x0'] // case), int((e['x0'] + e['w']) // case) + 1):
            for cy in range(int(e['y0'] // case), int((e['y0'] + e['h']) // case) + 1): G[(cx, cy)].append(e)
    return G

def recale(a, b, nx, ny, r):
    """Meilleure superposition des formes a et b (b décalé de (nx, ny) cases de masque autour du décalage nominal, ± r) : (IoU, dx, dy)."""
    hh = max(a.shape[0], b.shape[0]) + 2 * r + abs(ny) + 2; ww = max(a.shape[1], b.shape[1]) + 2 * r + abs(nx) + 2
    A = np.zeros((hh, ww)); B = np.zeros((hh, ww))
    A[:a.shape[0], :a.shape[1]] = a; B[:b.shape[0], :b.shape[1]] = b
    C = np.real(np.fft.ifft2(np.fft.fft2(B) * np.conj(np.fft.fft2(A))))   # C[dy, dx] = recouvrement de a et de b décalé de (dx, dy)
    best = (0, 0, 0)
    na, nb = a.sum(), b.sum()
    for dy in range(ny - r, ny + r + 1):
        for dx in range(nx - r, nx + r + 1):
            k = C[dy % hh, dx % ww]
            iou = k / max(1, na + nb - k)
            if iou > best[0]: best = (iou, dx, dy)
    return best

# --- 1. bâtiments recopiés par la carte voisine
dehors = [e for e in E if not e['m'].get('inside') and not e['m'].get('ciel')]
grands = [e for e in dehors if decor(e) and e['n'] >= COPIE]
jeter = set(); n1 = n2 = 0
vus = set()
for L in grille(grands).values():
    for a in L:
        for b in L:
            if id(a) >= id(b) or (id(a), id(b)) in vus or a['m'] is b['m']: continue
            vus.add((id(a), id(b)))
            if abs(a['m']['x'] - b['m']['x']) > 1 or abs(a['m']['y'] - b['m']['y']) > 1: continue
            if not (0.85 < a['w'] / b['w'] < 1.18 and 0.85 < a['h'] / b['h'] < 1.18 and 0.7 < a['n'] / max(1, b['n']) < 1.43): continue
            ox, oy = b['x0'] - a['x0'], b['y0'] - a['y0']
            if abs(ox) > 96 or abs(oy) > 96: continue
            # même forme ? (masques superposés coin contre coin, à 3 cases de masque près)
            iou, _, _ = recale(a['mk'], b['mk'], 0, 0, 3)
            if iou < 0.8: continue
            # on garde celui qui est dans le cadre de sa carte (sinon le plus près)
            da = dehors_cadre(a['m'], a['x0'] + a['w'] / 2, a['y0'] + a['h'] / 2)
            db = dehors_cadre(b['m'], b['x0'] + b['w'] / 2, b['y0'] + b['h'] / 2)
            garde, copie = (a, b) if (da, -a['p']['c']) <= (db, -b['p']['c']) else (b, a)
            if id(copie) in jeter or id(garde) in jeter: continue
            doublon(garde, copie, True); n1 += 1
            copie['vers'] = (garde, garde['x0'] - copie['x0'], garde['y0'] - copie['y0'])
print('bâtiments recopiés' + (' (retirés ou cachés depuis la carte du débord)' if COURANTE else ' retirés'), ':', n1)
# petits morceaux de la copie (porte, enseigne, caisses) : retirés s'ils existent aussi chez le gardé, au même décalage
par_carte = collections.defaultdict(list)
for e in E: par_carte[e['m']['tag']].append(e)
gp = {t: grille(L, 256) for t, L in par_carte.items()}
for c in [e for e in E if 'vers' in e]:
    g, sx, sy = c['vers']
    for q in par_carte[c['m']['tag']]:
        if id(q) in jeter or q is c: continue
        cx, cy = q['x0'] + q['w'] / 2, q['y0'] + q['h'] / 2
        if not (c['x0'] <= cx <= c['x0'] + c['w'] and c['y0'] <= cy <= c['y0'] + c['h']): continue
        tx, ty = q['x0'] + sx, q['y0'] + sy
        for r in gp[g['m']['tag']].get((int(tx // 256), int(ty // 256)), []):
            if id(r) not in jeter and abs(r['x0'] - tx) <= 14 and abs(r['y0'] - ty) <= 14 and abs(r['w'] - q['w']) <= 6 and abs(r['h'] - q['h']) <= 6 \
               and ('b' in r['p']) == ('b' in q['p']):
                doublon(r, q, True); n2 += 1; break
print('morceaux de ces copies retirés :', n2)
# petites images posées au même endroit par deux cartes voisines, avec une autre couleur (decor_doublons.py compare les pixels)
n3 = 0
PRES = 12 if COURANTE else 2   # sans decor_doublons.py, les copies identiques passent aussi par ici
for L in grille([e for e in dehors if id(e) not in jeter], 128).values():
    for a in L:
        if id(a) in jeter: continue
        for b in L:
            if a is b or id(b) in jeter or a['m'] is b['m'] or ('b' in a['p']) != ('b' in b['p']): continue
            if abs(a['m']['x'] - b['m']['x']) > 1 or abs(a['m']['y'] - b['m']['y']) > 1: continue
            if abs(a['x0'] - b['x0']) > PRES or abs(a['y0'] - b['y0']) > PRES or abs(a['w'] - b['w']) > 3 or abs(a['h'] - b['h']) > 3: continue
            if a['mk'].shape != b['mk'].shape or min((a['mk'] != b['mk']).mean(), (a['mk'] != b['mk'][:, ::-1]).mean()) > 0.1: continue   # même forme, ou en miroir
            da = dehors_cadre(a['m'], a['x0'] + a['w'] / 2, a['y0'] + a['h'] / 2)
            db = dehors_cadre(b['m'], b['x0'] + b['w'] / 2, b['y0'] + b['h'] / 2)
            if 'cc' in a['p'] and b['m']['tag'] in a['p']['cc'] or 'cc' in b['p'] and a['m']['tag'] in b['p']['cc']: continue
            doublon(a, b, da <= db); n3 += 1
            if id(a) in jeter: break
print('images posées deux fois au même endroit' + (' (retirées ou cachées)' if COURANTE else ' retirées'), ':', n3)
if COURANTE: print('débords (montrés seulement sur leur carte) :', sum(e['hc'] for e in E), '; originaux cachés depuis une carte voisine :', sum('cc' in e['p'] for e in E))
E = [e for e in E if id(e) not in jeter]

# --- 2. bâtiments
xs0 = min(e['x0'] for e in E); ys0 = min(e['y0'] for e in E)
xs1 = max(e['x0'] + e['w'] for e in E); ys1 = max(e['y0'] + e['h'] for e in E)
LAB = np.zeros((int((ys1 - ys0) / S) + 2, int((xs1 - xs0) / S) + 2), np.int32)
def zone(e):
    x, y = int((e['x0'] - xs0) / S), int((e['y0'] - ys0) / S)
    h, w = e['mk'].shape
    return LAB[y:y + h, x:x + w], e['mk'][:min(h, LAB.shape[0] - y), :min(w, LAB.shape[1] - x)]
nb = 0; tete = {}
def ranger(L, LAB, zone):
    """Grandes images d'abord (chacune un bâtiment, sauf si elle tient pour moitié sur un autre), puis les petites."""
    global nb; ns = 0
    for e in sorted([e for e in L if decor(e) and e['n'] >= GRAND], key=lambda e: -e['n']):
        z, mk = zone(e); z = z[:mk.shape[0], :mk.shape[1]]
        v = z[mk]; v = v[v > 0]
        if len(v):
            lab, k = collections.Counter(v.tolist()).most_common(1)[0]
            if k * 2 >= mk.sum(): e['bt'] = lab; z[mk & (z == 0)] = lab; continue
        nb += 1; e['bt'] = nb; tete[nb] = e; z[mk & (z == 0)] = nb
    for e in L:
        if 'bt' in e or not decor(e) or not e['mk'].any(): continue
        z, mk = zone(e); z = z[:mk.shape[0], :mk.shape[1]]
        v = z[mk]
        if not len(v): continue
        lab, k = collections.Counter(v.tolist()).most_common(1)[0]
        if lab and k * 3 >= 2 * mk.sum(): e['bt'] = lab; ns += 1
    return ns
ns = ranger([e for e in E if not e['hc']], LAB, zone)
# débords (COURANTE) : vus seulement depuis leur carte, rangés carte par carte sur une copie locale des bâtiments
par_h = collections.defaultdict(list)
for e in E:
    if e['hc']: par_h[e['m']['tag']].append(e)
for t, L in par_h.items():
    bx0 = int((min(e['x0'] for e in L) - xs0) / S); by0 = int((min(e['y0'] for e in L) - ys0) / S)
    bx1 = int((max(e['x0'] + e['w'] for e in L) - xs0) / S) + 2; by1 = int((max(e['y0'] + e['h'] for e in L) - ys0) / S) + 2
    loc = LAB[by0:by1, bx0:bx1].copy()
    def zl(e, loc=loc, bx0=bx0, by0=by0):
        x, y = int((e['x0'] - xs0) / S) - bx0, int((e['y0'] - ys0) / S) - by0
        h, w = e['mk'].shape
        return loc[y:y + h, x:x + w], e['mk'][:min(h, loc.shape[0] - y), :min(w, loc.shape[1] - x)]
    ns += ranger(L, loc, zl)
print('bâtiments :', nb, '; petits morceaux rattachés :', ns)
# débords qui contredisent la voisine (COURANTE) : un bâtiment du débord de C posé sur un AUTRE bâtiment, dessiné par la
# voisine dans son propre cadre (la maison de la carte du dessous sur la terrasse de la Taverne). La voisine a raison chez
# elle : le débord est retiré, avec les morceaux rangés dans son bâtiment.
CONTRE = float(os.environ.get('CONTRE', '0.5'))   # 0 : pas de retrait
LOIN = float(os.environ.get('LOIN', '200'))   # px hors du cadre de sa carte
nc = 0
if COURANTE and CONTRE > 0:
    tetes_h = {e['bt'] for e in E if e['hc'] and 'bt' in e and tete.get(e['bt']) is e}
    faux = set()
    for e in E:
        if not e['hc'] or e.get('copie') or not decor(e) or e['n'] < COPIE: continue
        if dehors_cadre(e['m'], e['x0'] + e['w'] / 2, e['y0'] + e['h'] / 2) < LOIN: continue   # juste au bord : souvent la suite d'un bâtiment de la carte
        z, mk = zone(e); z = z[:mk.shape[0], :mk.shape[1]]
        v = z[mk]; v = v[v > 0]
        # bâtiments de la voisine encore visibles depuis C (pas ceux que le débord de C cache)
        v = [l for l in v.tolist() if e['m']['tag'] not in tete[l]['p'].get('cc', [])]
        if mk.sum() and len(v) >= CONTRE * mk.sum():
            jeter.add(id(e)); nc += 1
            if e.get('bt') in tetes_h and tete[e['bt']] is e: faux.add((e['m']['tag'], e['bt']))
    for e in E:
        if e['hc'] and (e['m']['tag'], e.get('bt')) in faux and id(e) not in jeter: jeter.add(id(e)); nc += 1
    E = [e for e in E if id(e) not in jeter]
    print('débords qui contredisent la voisine, retirés :', nc)
# profondeur des débords sans original (COURANTE) : Dofus range tout le débord sur les cases du bord de sa carte. Seule sur
# son écran, la carte s'en moque ; ici les voisines sont dessinées autour, et l'horloge de [3,-20], rangée sur la dernière
# ligne, passait derrière les remparts de [3,-19]. On la range sur la case de son pied, comme le décor de la voisine.
if COURANTE:
    G = M['grid']; cols, rows = G['cols'], G['rows']
    cy = lambda r: OY + H / 2 + r * H / 2
    ecarts = sorted(e['y0'] + e['h'] - cy(e['p']['c'] // cols) for e in E if not e['hc'] and decor(e) and e['n'] >= GRAND)
    pied = ecarts[len(ecarts) // 2] if ecarts else 40
    nr = 0
    # un bâtiment du débord garde son ordre interne (toit sur les murs) : tout le groupe prend la case du pied le plus bas
    grp = collections.defaultdict(list)
    for e in E:
        if e['hc'] and not e.get('copie') and decor(e): grp[(e['m']['tag'], e.get('bt', -id(e)))].append(e)
    for L in grp.values():
        bas = max(L, key=lambda e: e['y0'] + e['h'])
        if dehors_cadre(bas['m'], bas['p']['x'], bas['y0'] + bas['h'] - pied) <= 0: continue   # pied dans sa carte (toit qui dépasse) : sa case est la bonne
        r = min(rows - 1, max(0, round((bas['y0'] + bas['h'] - pied - OY - H / 2) / (H / 2))))
        k = min(cols - 1, max(0, round((bas['p']['x'] - OX - W / 2 - (r % 2) * W / 2) / W)))
        for i, e in enumerate(sorted(L, key=lambda e: (e['p']['c'] // cols, e['p']['o']))):
            e['p']['c'] = r * cols + k; e['p']['o'] = i; nr += 1
    print('débords rangés sur la case de leur pied :', nr, '(pied à', round(pied), 'px sous la case)')

# --- 3. portes : la case et l'ordre de leur bâtiment
np_ = 0
if CARTES:
    for m in maps:
        if not os.path.exists(f"{CARTES}/map_{m['id']}.json"): continue
        r = json.load(open(f"{CARTES}/map_{m['id']}.json"))
        R = {q['rid']: q.get('data') for q in r.get('references', {}).get('RefIds', [])}
        x0, y0, _, _ = cadre(m)
        dx, dy = x0 - OX - W // 4, y0 - OY - H // 4
        pts = [(R[e['rid']]['transform']['m31'] + dx, -R[e['rid']]['transform']['m32'] + dy) for e in r['mapData'].get('interactiveElements', [])
               if R.get(e['rid']) and R[e['rid']].get('gfxId') in PORTES]
        for q in par_carte[m['tag']]:
            if id(q) in jeter or not any(abs(q['p']['x'] - px) < 1 and abs(q['p']['y'] - py) < 1 for px, py in pts): continue
            if 'bt' not in q: continue
            t = tete[q['bt']]['p']
            q['p']['c'], q['p']['o'] = t['c'], t['o'] + 1; np_ += 1
print('portes rangées avec leur bâtiment :', np_)

for e in E:
    if 'bt' in e: e['p']['bt'] = int(e['bt'])
    if e['hc']: e['p']['h'] = 1
for m in maps:
    m['decor'] = [e['p'] for e in par_carte[m['tag']] if id(e) not in jeter]
    m['batiments'] = 1
json.dump(M, open(f'{D}/monde.json', 'w'))
