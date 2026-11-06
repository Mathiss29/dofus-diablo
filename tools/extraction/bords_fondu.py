# bords_fondu.py dossier_du_monde : un seul débord par raccord (sans relire les bundles).
# world_export.py pose le débord d'une carte sur sa voisine avec une opacité 1 pile au raccord, qui descend à 0 sur BORD px.
# Comme chaque voisine en fait autant de son côté, on voyait au raccord le débord de A d'un côté et celui de B de l'autre :
# deux dessins différents, d'où une bande nette entre les cartes (retour de Mathis, 2026-11-06).
# Ici, sur le sol d'une voisine, seule la carte du haut (ou de gauche) garde son débord : son dessin continue sans coupure
# au-delà du raccord, puis s'efface en fondu dans celui de la voisine. Le débord de l'autre sens est retiré là où la carte
# du haut a du sol. Là où la voisine est vide (falaises qui débordent), rien ne change.
# À relancer une fois après chaque world_export.py qui réécrit les bords ; un bord déjà traité est noté « fondu » dans monde.json.
import sys, json
import numpy as np
from PIL import Image
D = sys.argv[1]
M = json.load(open(f'{D}/monde.json'))
outs = [m for m in M['maps'] if not m.get('inside') and not m.get('ciel')]
sols = {m['tag']: np.asarray(Image.open(f"{D}/sol_{m['tag']}.webp").convert('RGBA'))[..., 3] for m in outs}
n = 0
for m in outs:
    b = m.get('bord')
    if not b or b.get('fondu'): continue
    im = np.asarray(Image.open(f"{D}/bord_{m['tag']}.webp").convert('RGBA')).astype(np.float32)
    h, w = im.shape[:2]
    autre = np.zeros((h, w), np.float32)
    for o in outs:
        # seules comptent les voisines « avant » (au-dessus, ou à gauche sur la même rangée) : sur elles, pas de débord
        if o is m or (o['y'], o['x']) > (m['y'], m['x']): continue
        s = o['sol']; x0, y0 = max(b['x'], s['x']), max(b['y'], s['y']); x1, y1 = min(b['x'] + w, s['x'] + s['w']), min(b['y'] + h, s['y'] + s['h'])
        if x0 >= x1 or y0 >= y1: continue
        a2 = sols[o['tag']][y0 - s['y']:y1 - s['y'], x0 - s['x']:x1 - s['x']].astype(np.float32)
        sub = autre[y0 - b['y']:y1 - b['y'], x0 - b['x']:x1 - b['x']]; np.maximum(sub, a2, out=sub)
    # 1 là où la voisine d'avant n'a rien, 0 sur son sol (progressif sur ses bords translucides)
    k = 1 - np.clip(autre / 255, 0, 1)
    im[..., 3] *= k
    Image.fromarray(im.clip(0, 255).astype(np.uint8), 'RGBA').save(f"{D}/bord_{m['tag']}.webp", 'WEBP', quality=80, method=6)
    b['fondu'] = 1; n += 1
json.dump(M, open(f'{D}/monde.json', 'w'))
print('bords traités :', n)
