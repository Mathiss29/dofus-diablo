# meubles_tiers.py : complète src/data/meubles.json (après tools/extraction/meubles.py) avec ce qui est à nous (0.6) :
#  rares     (11C) : par thème, le quart des meubles (couches 1 et 2), les plus grands d'abord ; butin des coffres de donjon,
#                    succès et lot du thème en Boutique d'Ogrines (11B). Le reste du thème est « de base » : offert avec le thème.
#  recettes  (« Métiers : » 9A) : 3 meubles par thème se fabriquent : 2 meubles chez le Bricoleur, 1 bibelot ou tapis chez
#                    le Sculpteur, avec les ressources des récoltes officielles (bois, minerais, plantes) ; niveau selon le thème.
#  speciaux  (10B-D) : nos meubles, dessinés avec un meuble officiel : parcelle de potager (carottes qui poussent, gfx 7652),
#                    socle de vitrine (borne de pierre, 7556), mannequin (armure sur pied, 30846).
# python tools/contenu/meubles_tiers.py
import json, os, hashlib
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
P = os.path.join(R, 'src/data/meubles.json')
D = json.load(open(P, encoding='utf-8'))
img = os.path.join(R, 'public/assets/sprites/meubles')
h = lambda s: int(hashlib.md5(s.encode()).hexdigest(), 16)
try:
    from PIL import Image
    taille = lambda g: (lambda im: im.size[0] * im.size[1])(Image.open(f'{img}/{g}.webp'))
except Exception:
    taille = lambda g: 0
REC = json.load(open(os.path.join(R, 'src/data/recoltes.json'), encoding='utf-8'))['ressources']
par = lambda metier: sorted(((v['niveau'], k) for k, v in REC.items() if v['metier'] == metier))
BOIS, MINERAIS, PLANTES, FIBRES = par('bucheron'), par('mineur'), par('alchimiste'), [x for x in par('paysan') if x[1] in ('423', '425', '400', '533')]
def jusqua(l, n): return [k for lv, k in l if lv <= n] or [l[0][1]]

themes = sorted({m[1] for m in D['meubles']})
rares, recettes = [], []
for i, t in enumerate(themes):
    L = [m for m in D['meubles'] if m[1] == t]
    niveau = 5 + round(i * 95 / max(1, len(themes) - 1) / 5) * 5          # 5 à 100 selon le thème
    debout = sorted([m for m in L if m[3] == 1], key=lambda m: h(f'fab{m[0]}'))
    petits = sorted([m for m in L if m[3] in (0, 2)], key=lambda m: h(f'fab{m[0]}'))
    fab = [(m, 'bricoleur') for m in debout[:2]] + [(m, 'sculpteur') for m in petits[:1]]
    pris = {m[0] for m, _ in fab}
    for m, metier in fab:
        b = jusqua(BOIS, niveau); r = h(f'ing{m[0]}')
        ing = [[b[-1 - r % min(2, len(b))], 4 + r % 5]]
        if metier == 'bricoleur': mi = jusqua(MINERAIS, niveau); ing.append([mi[-1 - r % min(2, len(mi))], 2 + r % 4])
        else:
            l2 = jusqua(FIBRES if m[3] == 0 else PLANTES, niveau); ing.append([l2[-1 - r % min(2, len(l2))], 3 + r % 4])
        recettes.append({'id': m[0], 'metier': metier, 'level': niveau, 'ingredients': ing})
    reste = [m for m in L if m[3] in (1, 2) and m[0] not in pris]
    reste.sort(key=lambda m: (-taille(m[2]), h(f'rare{m[0]}')))
    rares += [m[0] for m in reste[:max(1, len(reste) // 4)]]
D['rares'] = sorted(rares)
D['recettes'] = recettes
D['speciaux'] = {'potager': {'id': -1, 'gfx': 7652, 'nom': 'Parcelle de potager'}, 'vitrine': {'id': -2, 'gfx': 7556, 'nom': 'Socle de vitrine'},
                 'mannequin': {'id': -3, 'gfx': 30846, 'nom': 'Mannequin'}}
with open(P, 'w', encoding='utf-8') as fh:
    fh.write('{\n "_": ' + json.dumps(D['_'] if 'meubles_tiers' in D['_'] else D['_'] + ' Rares, recettes et meubles spéciaux : tools/contenu/meubles_tiers.py.', ensure_ascii=False) + ',\n "colonnes": ' + json.dumps(D['colonnes']) + ',\n "meubles": [\n')
    fh.write(',\n'.join('  ' + json.dumps(m, separators=(',', ':')) for m in D['meubles']) + '\n ],\n')
    fh.write(' "rares": ' + json.dumps(D['rares'], separators=(',', ':')) + ',\n')
    fh.write(' "recettes": [\n' + ',\n'.join('  ' + json.dumps(r, separators=(',', ':')) for r in recettes) + '\n ],\n')
    fh.write(' "speciaux": ' + json.dumps(D['speciaux'], ensure_ascii=False) + '\n}\n')
print(len(themes), 'thèmes ;', len(rares), 'rares ;', len(recettes), 'recettes')
