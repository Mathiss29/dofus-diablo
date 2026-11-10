"""Monde d'Astrub agrandi à la grille du continent (Astrub + Amakna sans coupure, choix 7A « Monde sans coupure », 2026-11-06 ;
lancé pour la 0.4 le 2026-11-10).

La grille d'un monde commençait à la première carte de son export : impossible d'y coller une carte plus à l'ouest ou plus au
nord sans renuméroter toutes les cases. Ce script la passe UNE FOIS à la taille de tout le continent officiel (cartes worldMap 1 :
x −88 à 43, y −93 à 54), et range les intérieurs (salles, ateliers, égouts, arènes…) dans une bande sous le continent.

    python3 monde_continent.py regrille public/assets/mondes/astrub src/data/zones.json
        Astrub seul : nouvelle origine, cases renumérotées (décor `c`/`bt`, particules, zones.json : arènes, couloirs),
        intérieurs descendus de DY cartes. Les cases marchables passent carte par carte (`movCartes`) : la grille du continent
        fait 13 millions de cases, presque toutes vides. Le centre de la grille (`cx`, `cy`) est gardé : les points du
        dehors (sauvegardes, Zaaps, PNJ en pixels) ne bougent pas.
    python3 monde_continent.py fusion public/assets/mondes/astrub <export d'une zone> [<export> ...]
        Ajoute les cartes d'un export de world_export.py (même méthode qu'Astrub : PARTAGE=1, bords_fondu.py, batiments.py
        COURANTE=1, decor_par_carte.py) : coordonnées ramenées au repère du monde, cases renumérotées, pages de décor
        renumérotées au-dessus de celles du monde, fichiers copiés.
"""
import json, os, re, shutil, sys

MC, MR, W, H = 14, 40, 86, 43            # cases d'une carte, taille d'une case
MW, MH = MC * W, MR * H // 2             # 1204 x 860 px par carte
X0, Y0, X1, Y1 = -88, -93, 43, 54        # cartes du continent (mapsinformation, worldMap 1)
YI = Y1 + 2                              # première ligne des intérieurs (sous le continent)


def lire(p): return json.load(open(p))


def ecrire(p, d): open(p, 'w').write(json.dumps(d, ensure_ascii=False, separators=(',', ':')))


def regrille(dossier, zones_p):
    M = lire(f'{dossier}/monde.json'); g = M['grid']
    ox0, oy0 = M['origin']; cols0, rows0 = g['cols'], g['rows']
    if ox0 == X0 and oy0 == Y0: sys.exit('déjà à la grille du continent')
    ins = [m for m in M['maps'] if m.get('inside')]
    DY = YI - min(m['y'] for m in ins) if ins else 0
    ymax = max([m['y'] + (m.get('n') or [1, 1])[1] - 1 + (DY if m.get('inside') else 0) for m in M['maps']] + [Y1])
    cols, rows = (X1 - X0 + 1) * MC, (ymax - Y0 + 1) * MR
    dk, dr = (ox0 - X0) * MC, (oy0 - Y0) * MR
    print(f'grille {cols0}x{rows0} -> {cols}x{rows}, intérieurs descendus de {DY} cartes')
    # carte de chaque ancienne case (pour savoir si elle est dans un intérieur)
    par = {}
    for m in M['maps']:
        nx, ny = m.get('n') or [1, 1]
        for i in range(nx):
            for j in range(ny): par[(m['x'] - ox0 + i, m['y'] - oy0 + j)] = m

    yi = min(m['y'] for m in ins) - oy0 if ins else 10**9   # bande des intérieurs (sous le dehors), couloirs entre salles compris

    def case(c):
        if c is None or c < 0: return c
        r, k = divmod(c, cols0)
        return (r + dr + (DY * MR if r // MR >= yi else 0)) * cols + k + dk

    # cases marchables carte par carte
    mov = M.pop('mov'); mc = {}
    for m in M['maps']:
        nx, ny = m.get('n') or [1, 1]; k0, r0 = (m['x'] - ox0) * MC, (m['y'] - oy0) * MR
        mc[m['tag']] = ''.join(mov[(r0 + r) * cols0 + k0:(r0 + r) * cols0 + k0 + nx * MC] for r in range(ny * MR))
    # centre gardé (repère carte) : les points du dehors ne bougent pas
    cx = g['ox'] + (cols0 + 0.5) * W / 2; cy = g['oy'] + (rows0 * H / 2 + H / 2) / 2
    M['grid'] = {**g, 'ox': g['ox'] - dk * W, 'oy': g['oy'] - dr * H // 2, 'cols': cols, 'rows': rows, 'cx': g.get('cx', cx), 'cy': g.get('cy', cy)}
    M['origin'] = [X0, Y0]
    dyp = DY * MH
    for m in M['maps']:
        dedans = m.get('inside')
        for d in m['decor']:
            d['c'] = case(d['c'])
            if 'bt' in d: d['bt'] = case(d['bt'])
            if dedans: d['y'] = round(d['y'] + dyp, 1)
        if dedans:
            m['y'] += DY
            for k in ('sol', 'fond', 'bord'):
                if k in m: m[k]['y'] += dyp
            for s in m.get('survols', []): s['y'] = round(s['y'] + dyp, 1)
    M['movCartes'] = mc
    ecrire(f'{dossier}/monde.json', M)
    # particules (case + position)
    pp = f'{dossier}/particules.json'
    if os.path.exists(pp):
        P = lire(pp); tags = {m['tag'] for m in ins}
        for t, l in P.items():
            for e in l:
                if 'c' in e: e['c'] = case(e['c'])
                if t in tags: e['y'] = round(e['y'] + dyp, 1)
        ecrire(pp, P)
    # zones.json : cases du monde (arènes, couloirs)
    Z = lire(zones_p)
    for z in Z.values():
        o = z.get('open') or {}
        if o.get('world') != os.path.basename(dossier.rstrip('/')): continue
        for d in (o.get('donjons') or []) + (o.get('donjonsTest') or []):
            a = d.get('arene')
            if a:
                for k in ('arrivee', 'boss', 'sortie', 'coffre'):
                    if k in a: a[k] = case(a[k])
                a['entrees'] = [case(c) for c in a.get('entrees', [])]
            co = d.get('couloirs')
            if co:
                co['cases'] = [case(c) for c in co.get('cases', [])]
                co['errants'] = [case(c) for c in co.get('errants', [])]
    open(zones_p, 'w').write(json.dumps(Z, ensure_ascii=False, indent=1) + '\n')
    print('fait :', len(M['maps']), 'cartes,', sum(s.count('1') for s in mc.values()), 'cases marchables')


def fusion(dossier, exports):
    M = lire(f'{dossier}/monde.json'); g = M['grid']; cols = g['cols']
    if M['origin'] != [X0, Y0]: sys.exit('lancer regrille d\'abord')
    # repère carte du monde : la carte (x, y) commence à ox + (x - X0) * MW
    pages = max([p for m in M['maps'] for p in m.get('pages', [])] + [-1]) + 1
    deja = {m['tag'] for m in M['maps']}
    P = lire(f'{dossier}/particules.json') if os.path.exists(f'{dossier}/particules.json') else {}
    for ex in exports:
        E = lire(f'{ex}/monde.json'); ge = E['grid']; ex0, ey0 = E['origin']; ce = ge['cols']
        dx = g['ox'] + (ex0 - X0) * MW - ge['ox']; dy = g['oy'] + (ey0 - Y0) * MH - ge['oy']
        dk, dr = (ex0 - X0) * MC, (ey0 - Y0) * MR

        def case(c):
            if c is None or c < 0: return c
            r, k = divmod(c, ce); return (r + dr) * cols + k + dk
        renum = {}
        for m in E['maps']:
            if m['tag'] in deja: print('déjà dans le monde :', m['tag']); continue
            nx, ny = m.get('n') or [1, 1]; k0, r0 = (m['x'] - ex0) * MC, (m['y'] - ey0) * MR
            M.setdefault('movCartes', {})[m['tag']] = ''.join(E['mov'][(r0 + r) * ce + k0:(r0 + r) * ce + k0 + nx * MC] for r in range(ny * MR))
            for k in ('sol', 'fond', 'bord'):
                if k in m: m[k]['x'] += dx; m[k]['y'] += dy
            for s in m.get('survols', []): s['x'] = round(s['x'] + dx, 1); s['y'] = round(s['y'] + dy, 1)
            for d in m['decor']:
                d['x'] = round(d['x'] + dx, 1); d['y'] = round(d['y'] + dy, 1); d['c'] = case(d['c'])
                if 'bt' in d: d['bt'] = case(d['bt'])
                if 'p' in d: d['p'] = renum.setdefault(d['p'], pages + len(renum))
            m['pages'] = [renum.setdefault(p, pages + len(renum)) for p in m.get('pages', [])]
            M['maps'].append(m); deja.add(m['tag'])
            for f in os.listdir(ex):
                if re.match(rf'(sol|fond|bord)_{re.escape(m["tag"])}\.(webp|json)$', f): shutil.copy(f'{ex}/{f}', f'{dossier}/{f}')
        for a, b in renum.items():
            for ext in ('webp', 'json'):
                src = f'{ex}/decor_p{a}.{ext}'
                if not os.path.exists(src): continue
                if ext == 'json':
                    j = lire(src); j['meta']['image'] = f'decor_p{b}.webp'; ecrire(f'{dossier}/decor_p{b}.json', j)
                else: shutil.copy(src, f'{dossier}/decor_p{b}.webp')
        pages += len(renum)
        if os.path.exists(f'{ex}/particules.json'):
            for t, l in lire(f'{ex}/particules.json').items():
                for e in l:
                    e['x'] = round(e['x'] + dx, 1); e['y'] = round(e['y'] + dy, 1)
                    if 'c' in e: e['c'] = case(e['c'])
                P[t] = l
        for k in ('reperes', 'voiles'):
            if E.get(k): M[k] = (M.get(k) or []) + [v for v in E[k] if v not in (M.get(k) or [])]
        print(ex, ':', len(E['maps']), 'cartes,', len(renum), 'pages')
    ecrire(f'{dossier}/monde.json', M)
    if P: ecrire(f'{dossier}/particules.json', P)


if __name__ == '__main__':
    if sys.argv[1] == 'regrille': regrille(sys.argv[2], sys.argv[3])
    elif sys.argv[1] == 'fusion': fusion(sys.argv[2], sys.argv[3:])
