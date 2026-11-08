# sols_fusion.py <export à part> <dossier du monde> : reprend les sols et les raccords (calque « bord ») d'un export fait à part
# (NO_DECOR=1 world_export.py <liste du dehors> … <export à part>), sans toucher au décor, aux portes ni aux cases du monde.
# Copie sol_<tag>.webp et bord_<tag>.webp, remplace "sol" et "bord" des cartes dans monde.json (un bord disparu est retiré,
# ainsi que l'ancienne marque "fondu" de bords_fondu.py). Les deux mondes doivent avoir la même origine (sinon les positions sont décalées).
# Ensuite : mer.py (rivage), puis node tools/hebergement/envoi.mjs. (Maquette Raccords, 2026-11-08.)
import json, sys, shutil, os
A, D = sys.argv[1:3]
E = json.load(open(f'{A}/monde.json')); M = json.load(open(f'{D}/monde.json'))
assert E['origin'] == M['origin'] and E['grid']['w'] == M['grid']['w'], 'origines différentes'
neuf = {m['tag']: m for m in E['maps']}
n = 0
for m in M['maps']:
    e = neuf.get(m['tag'])
    if not e or m.get('inside'): continue
    shutil.copyfile(f"{A}/sol_{m['tag']}.webp", f"{D}/sol_{m['tag']}.webp"); m['sol'] = e['sol']
    if 'bord' in e: shutil.copyfile(f"{A}/bord_{m['tag']}.webp", f"{D}/bord_{m['tag']}.webp"); m['bord'] = e['bord']
    else:
        m.pop('bord', None)
        if os.path.exists(f"{D}/bord_{m['tag']}.webp"): os.remove(f"{D}/bord_{m['tag']}.webp")
    m.pop('fondu', None); n += 1
json.dump(M, open(f'{D}/monde.json', 'w'), separators=(',', ':'))
print(n, 'cartes')
