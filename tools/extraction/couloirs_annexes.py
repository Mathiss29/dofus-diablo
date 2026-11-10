# couloirs_annexes.py
# Cases de couloir hors de toute carte (donjons en couloirs : Grange d'Astrub, donjons d'Amakna) : le creux du V descend parfois
# dans un emplacement de carte vide. Sans carte, le jeu ne sait plus où l'on est : l'affichage du donjon s'éteint (écran noir)
# et l'arène croit qu'on est sorti. L'outil pose une petite carte sans image (« annexe ») sur chaque emplacement vide traversé,
# rangée dans les couloirs du donjon (couloirs.tags + couloirs.annexes). Sans effet si tout est déjà couvert.
#   python3 tools/extraction/couloirs_annexes.py      puis : node tools/hebergement/envoi.mjs
import os, json
from PIL import Image

RACINE = os.path.join(os.path.dirname(__file__), '../..')
COLS, ROWS = 14, 40

def main():
    dossier = f'{RACINE}/public/assets/mondes/astrub'
    M = json.load(open(f'{dossier}/monde.json'))
    Zp = f'{RACINE}/src/data/zones.json'; Z = json.load(open(Zp))
    g = M['grid']; W, H, OX, OY, cols = g['w'], g['h'], g['ox'], g['oy'], g['cols']
    MW, MH = COLS * W, ROWS * H // 2
    X0, Y0 = M['origin']
    maps = {m['tag']: m for m in M['maps']}
    occupe = set()
    for m in M['maps']:
        n = m.get('n', [1, 1])
        for i in range(n[0]):
            for j in range(n[1]): occupe.add((m['x'] + i, m['y'] + j))
    o = Z['astrub']['open']; total = 0
    for dj in o.get('donjons', []) + o.get('donjonsTest', []):
        c = dj.get('couloirs')
        if not c: continue
        vides = sorted({(X0 + (x % cols) // COLS, Y0 + (x // cols) // ROWS) for x in c['cases']} - occupe)
        if not vides: continue
        ref = maps[c['tags'][0]]
        c.setdefault('annexes', [])
        for (sx, sy) in vides:
            t2 = f"{c['tags'][0]}_a{len(c['annexes'])}"; c['tags'].append(t2); c['annexes'].append(t2); occupe.add((sx, sy))
            Image.new('RGBA', (2, 2), (0, 0, 0, 0)).save(f'{dossier}/sol_{t2}.webp', lossless=True)
            M['maps'].append({'x': sx, 'y': sy, 'id': ref['id'], 'sub': ref['sub'], 'tag': t2, 'inside': 1, 'batiments': 1,
                'dessus': 1, 'essai': 1, 'pages': [], 'sol': {'x': OX + (sx - X0) * MW, 'y': OY + (sy - Y0) * MH, 'w': 2, 'h': 2}, 'decor': []})
            M['movCartes'][t2] = '0' * (COLS * ROWS)
        total += len(vides)
        print(dj['nom'], ': annexes', vides)
    if total:
        json.dump(M, open(f'{dossier}/monde.json', 'w'))
        json.dump(Z, open(Zp, 'w'), ensure_ascii=False, indent=1)
    print(total, 'annexe(s)')

if __name__ == '__main__':
    main()
