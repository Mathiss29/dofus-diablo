"""Particules officielles des cartes (maquette « Vivant », choix 2A de Mathis, 2026-11-06).

Chaque carte de Dofus 3 pose des systèmes de particules Unity (mapData.particlesParameters) : spores, poussière, braises,
brume, étoiles, comètes… Ce script les simplifie pour le jeu (render/particles.ts) et range leurs images dans un atlas.

  python3 tools/extraction/particules.py <liste.json> <dossier des map_*.json> <mapeffects_assets_all.bundle | dossier de .png> <sortie>

Sortie : particules.json (systèmes par carte) + particules.webp / particules_atlas.json (images, réduites à la taille utile).
Les images sont dans Content/Map/Textures/Effects/mapeffects_assets_all.bundle (textures/effects/particles/<gfxId>.png).

Valeurs Unity (MinMaxCurve) écrites en :  nombre = constante ; [a, b] = au hasard entre a et b ;
{"c": [9 valeurs]} = courbe sur la vie de la particule ; {"c": [...], "d": [...]} = au hasard entre deux courbes.
Repère : x à droite, y vers le BAS (Unity a y vers le haut), en px de carte comme le décor (world_export.py).
"""
import sys, json, os, glob, math, warnings
warnings.filterwarnings('ignore')
from PIL import Image

liste, cdir, src, out = sys.argv[1:5]; os.makedirs(out, exist_ok=True)
W, H, COLS, ROWS = 86, 43, 14, 40
MW, MH = COLS * W, ROWS * H // 2
sel = {tuple(map(int, k.split(','))): v for k, v in json.load(open(liste)).items()}
X0, Y0 = min(x for x, _ in sel), min(y for _, y in sel)
NX = max(x for x, _ in sel) - X0 + 1
N = 9   # échantillons par courbe

def hermite(keys, t):
    if not keys: return 1.0
    if t <= keys[0]['time']: return keys[0]['value']
    for a, b in zip(keys, keys[1:]):
        if t <= b['time']:
            dt = b['time'] - a['time']
            if dt <= 0: return b['value']
            s = (t - a['time']) / dt; s2, s3 = s * s, s * s * s
            m0, m1 = a['outTangent'], b['inTangent']
            if not (math.isfinite(m0) and math.isfinite(m1)): return a['value']   # marche d'escalier
            return (2 * s3 - 3 * s2 + 1) * a['value'] + (s3 - 2 * s2 + s) * dt * m0 + (-2 * s3 + 3 * s2) * b['value'] + (s3 - s2) * dt * m1
    return keys[-1]['value']
def samples(curve, mult):
    return [round(hermite(curve['keys'], i / (N - 1)) * mult, 3) for i in range(N)]
def mm(o, k=1.0):
    """MinMaxCurve Unity -> valeur compacte (voir en tête). k = facteur (ex. -1 pour retourner l'axe y)."""
    m, a, b = o['mode'], o['constantMin'] * k, o['constantMax'] * k
    if m == 0: return round(b, 3)
    if m == 3: return [round(min(a, b), 3), round(max(a, b), 3)]
    if m == 1: return {'c': samples(o['curveMax'], b)}
    return {'c': samples(o['curveMin'], b), 'd': samples(o['curveMax'], b)}   # 2 : deux courbes (même multiplicateur)
def peak(v):
    if isinstance(v, (int, float)): return abs(v)
    if isinstance(v, list): return max(abs(x) for x in v)
    return max(abs(x) for k in ('c', 'd') for x in v.get(k, []))
def argb(v): return [v & 0xffffff, round(((v >> 24) & 255) / 255, 3)]
def grad(g):
    """Dégradé Unity -> N échantillons [couleur, alpha]."""
    ck, ak = g['colorKeys'], g['alphaKeys']
    def lerp_keys(keys, t, get):
        if not keys: return None
        if t <= keys[0]['time']: return get(keys[0])
        for a, b in zip(keys, keys[1:]):
            if t <= b['time']:
                f = (t - a['time']) / ((b['time'] - a['time']) or 1); va, vb = get(a), get(b)
                return [x + (y - x) * f for x, y in zip(va, vb)] if isinstance(va, list) else va + (vb - va) * f
        return get(keys[-1])
    rgb = lambda k: [(k['color']['value'] >> s) & 255 for s in (16, 8, 0)]
    res = []
    for i in range(N):
        t = i / (N - 1); c = lerp_keys(ck, t, rgb) or [255, 255, 255]; a = lerp_keys(ak, t, lambda k: k['alpha'])
        res.append([(round(c[0]) << 16) | (round(c[1]) << 8) | round(c[2]), round(1 if a is None else a, 3)])
    return res
def couleur(o):
    """MinMaxGradient : 0 couleur, 1 dégradé, 2 deux couleurs, 3 deux dégradés, 4 couleur au hasard dans le dégradé."""
    m = o['mode']
    if m == 0: return {'k': argb(o['colorMax']['value'])}
    if m == 2: return {'k': argb(o['colorMin']['value']), 'l': argb(o['colorMax']['value'])}
    if m == 3: return {'g': grad(o['gradientMin']), 'h': grad(o['gradientMax'])}
    return {'g': grad(o['gradientMax'])}
def rot(e):
    """Rotation Unity (degrés, ordre Z puis X puis Y) -> matrice 3x3."""
    x, y, z = (math.radians(e[k]) for k in 'xyz')
    cx, sx, cy, sy, cz, sz = math.cos(x), math.sin(x), math.cos(y), math.sin(y), math.cos(z), math.sin(z)
    Rz = [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]]; Rx = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]]; Ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]
    mul = lambda A, B: [[sum(A[i][k] * B[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
    return mul(Ry, mul(Rx, Rz))
LAYERS = {2: 'backgroundMaterialData', 4: 'backgroundMaterialData', 5: 'sortableMaterialData'}

usage = {}     # gfxId -> (taille d'affichage max, tuiles)
cartes = {}
for (x, y), v in sorted(sel.items()):
    tag = (v[2] if len(v) > 2 else {}).get('tag', f'{x}_{y}')
    raw = json.load(open(f'{cdir}/map_{v[0]}.json')); md = raw['mapData']
    R = {q['rid']: q.get('data') for q in raw.get('references', {}).get('RefIds', [])}
    dx, dy = (x - X0) * MW, (y - Y0) * MH
    lst = []
    for p in md.get('particlesParameters', []):
        m, mo = p['particlesMainParameters'], p['particlesModulesParameters']
        # systèmes déclenchés par le jeu (émotes, coups) ou enfants d'un autre : pas des ambiances de carte
        if p.get('isStagingTarget') or m.get('stopped') or not m['looping'] or p['particlesSubEmittersParameters'].get('parentId'): continue
        if not mo['isRendererModuleActivated']: continue
        sd = md[LAYERS.get(p['layer'], 'foregroundMaterialData')].get('shaderData', []); i = p['materialIndex']
        if not 0 <= i < len(sd): continue
        D = R.get(sd[i]['rid']) or {}; tex = D.get('gfxId'); bl = None
        for q in D.get('shaderParameters', []):
            d = R.get(q['rid']) or {}
            if 'sourceFactor' in d: bl = (d['sourceFactor'], d['destinationFactor'])
        if tex is None or bl == (0, 1): continue   # (Zero, One) : n'ajoute rien à l'image
        # mélange : One/SrcAlpha/SrcColor + One = additif ; DstColor + One = éclaircit ; sans réglage ou One/1-SrcAlpha = normal
        b = 'n' if bl in (None, (1, 10), (5, 10)) else 's' if bl[0] == 2 else 'a'
        sh = p['particlesShapeParameters']; st = sh['particleSystemShape']['shapeType'] if mo['isShapeModuleActivated'] else -1
        tr = p['transform']; M = rot(tr['rot']); Ms = rot(sh['shapeRotation'])
        A = [[sum(M[i][k] * Ms[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
        sc = sh['shapeScale']; ts = tr['scale']
        # axes locaux X, Y, Z de la forme projetés à l'écran (y retourné, profondeur jetée)
        ax = [[round(A[0][j], 4), round(-A[1][j], 4)] for j in range(3)]
        e = p['particlesEmissionParameters']
        s = {
            'x': round(tr['pos']['x'] + dx + sh['shapePosition']['x'], 1), 'y': round(-tr['pos']['y'] + dy - sh['shapePosition']['y'], 1),
            'l': 'f' if p['layer'] >= 6 else 'g' if p['layer'] in (2, 4) else 's',
            'c': ((y - Y0) * ROWS + p['cellId'] // COLS) * COLS * NX + (x - X0) * COLS + p['cellId'] % COLS if p['layer'] == 5 else -1, 'o': p['renderOrder'], 'n': p['id'],
            'tx': tex, 'b': b, 'dur': m['duration'], 'pw': m['prewarm'],
            'life': mm(m['startLifetime']), 'spd': mm(m['startSpeed']), 'size': mm(m['startSize']),
            'rot': mm(m['startRotation']), 'col': couleur(m['startColor']),
            'grav': round(m['gravityModifier']['constantMax'] * 9.81, 3), 'sim': m['simulationSpeed'],
            'rate': mm(e['rateOverTime']) if mo['isEmissionModuleActivated'] else 0,
            'burst': [[bu['time'], mm(bu['count']), bu['cycleCount'], bu['repeatInterval'], bu['probability']] for bu in e['bursts']] if mo['isEmissionModuleActivated'] else [],
            'sh': [st, round(sh['radius'], 3), round(sh['radiusThickness'], 3), round(sh['angle'], 2), round(sh['arc'], 1)],
            'sc': [round(sc['x'] * ts['x'], 2), round(sc['y'] * ts['y'], 2), round(sc['z'] * ts['z'], 2)],
            'ax': ax,
        }
        if mo['isVelocityOverLifetimeModuleActivated']:
            vl = p['particlesVelocityOverLifetimeParameters']
            s['vx'], s['vy'], s['rad'] = mm(vl['linearX']), mm(vl['linearY'], -1), mm(vl['radial'])
        if mo['isColorOverLifetimeModuleActivated']: s['cl'] = couleur(p['particlesColorOverLifetimeParameters']['colorOverLifetimeColor'])
        if mo['isSizeOverLifetimeModuleActivated']: s['sl'] = mm(p['particlesSizeOverLifetimeParameters']['sizeOverLifetimeSize'])
        if mo['isRotationOverLifetimeModuleActivated']: s['av'] = mm(p['particlesRotationOverLifetimeParameters']['angularVelocity'])
        if mo['isNoiseModuleActivated']:
            nz = p['particlesNoiseParameters']
            s['nz'] = [peak(mm(nz['noiseStrength'])), round(nz['noiseFrequency'], 4), peak(mm(nz['noisePositionAmount'])), peak(mm(nz['noiseScrollSpeed']))]
        tiles = (1, 1)
        if mo['isSpritesheetModuleActivated']:
            ss = p['particleSpritesheetParameters']; tiles = (max(1, ss['tiles']['x']), max(1, ss['tiles']['y']))
            if tiles != (1, 1): s['ss'] = [tiles[0], tiles[1], mm(ss['frameOverTime']), mm(ss['startFrame']), ss['cycles']]
        rp = p['particlesRendererParameters']
        if rp['renderMode']['renderMode'] == 1: s['str'] = [rp['lengthScale'], rp['velocityScale']]
        s = {k: v for k, v in s.items() if v not in (None, 0, [], {}) or k in ('x', 'y', 'c', 'o')}
        disp = peak(s['size']) * (peak(s['sl']) if 'sl' in s else 1) * (s['str'][0] if 'str' in s else 1)
        u = usage.get(tex, (0, tiles)); usage[tex] = (max(u[0], disp), tiles)
        lst.append(s)
    if lst: cartes[tag] = lst

# Images : réduites à la taille où le jeu les affiche (x2 pour la netteté), 256 px au plus par case
if src.endswith('.bundle'):
    import UnityPy
    UnityPy.config.FALLBACK_UNITY_VERSION = "6000.3.16f1"
    env = UnityPy.load(src)
    def lire(g):
        for pth, o in env.container.items():
            if pth.endswith(f'/particles/{g}.png'): return o.read().image.convert('RGBA')
else:
    def lire(g):
        f = f'{src}/{g}.png'
        return Image.open(f).convert('RGBA') if os.path.exists(f) else None
frames, ims = {}, []
for g, (disp, (tx, ty)) in sorted(usage.items()):
    im = lire(g)
    if im is None: print('image absente', g); continue
    fw, fh = im.width // tx, im.height // ty
    k = min(1, max(16, min(256, disp * 2)) / max(fw, fh))
    for j in range(ty):
        for i in range(tx):
            c = im.crop((i * fw, j * fh, (i + 1) * fw, (j + 1) * fh))
            if k < 1: c = c.resize((max(1, round(fw * k)), max(1, round(fh * k))), Image.LANCZOS)
            ims.append((f'{g}' if tx * ty == 1 else f'{g}_{j * tx + i}', c))
# atlas en étagères
ims.sort(key=lambda t: -t[1].height)
maxW = 1024; px = py = rowH = 0; pos = {}
for n, im in ims:
    if px + im.width + 2 > maxW: px, py, rowH = 0, py + rowH + 2, 0
    pos[n] = (px + 1, py + 1); px += im.width + 2; rowH = max(rowH, im.height)
atlas = Image.new('RGBA', (maxW, py + rowH + 2))
for n, im in ims:
    atlas.paste(im, pos[n]); frames[n] = {'frame': {'x': pos[n][0], 'y': pos[n][1], 'w': im.width, 'h': im.height}}
atlas.save(f'{out}/particules.webp', 'WEBP', quality=90, method=6)
json.dump({'frames': frames, 'meta': {'image': 'particules.webp', 'size': {'w': atlas.width, 'h': atlas.height}}}, open(f'{out}/particules_atlas.json', 'w'))
json.dump(cartes, open(f'{out}/particules.json', 'w'), separators=(',', ':'))
print('systèmes', sum(len(l) for l in cartes.values()), 'cartes', len(cartes), 'images', len(ims), 'atlas', atlas.size,
      'json', os.path.getsize(f'{out}/particules.json') // 1024, 'Ko')
