# havresac_themes.py <cartes> <textures> <public/assets/mondes> : exporte les thèmes officiels du Havre-Sac (Magasin 6B) et écrit
# leurs cases dans src/data/havresac_themes.json.
#  cartes   = dossier des map_{id}.json du bundle mapdata_assets_world_621 (cache-dofus/havre-sac)
#  textures = dossier des mapgfx_1x_* (TEXDIR=dossier de <gfx>.png accepté, comme world_export.py)
# Chaque thème devient le monde havresac_<id> (une carte, tag 0_0). Mercenaire (57) garde le monde « havresac » et nos meubles
# (havresac.py). Cases trouvées dans la carte officielle :
#  arche  = milieu du dessin de l'arche officielle (gfx 38003, ou 42294 + une ligne ; Almanax : la fontaine, case 276), 5 lignes au-dessus
#  arrivee = case marchable la plus proche du devant de l'arche ; coffre = coffre officiel (élément interactif 12367)
#  etabli = établi de forgemagie, à quelques pas du coffre
#  poutch = case marchable la plus dégagée, loin de l'arrivée, du coffre et de la machine à meubles (51031)
import sys, os, json, subprocess
cdir, tdir, mondes = sys.argv[1:4]
HERE = os.path.dirname(os.path.abspath(__file__))
P = os.path.join(HERE, '../../src/data/havresac_themes.json')
D = json.load(open(P))
pos = lambda c: (c % 14 * 2 + (c // 14) % 2, c // 14)   # en demi-cases
def dist(a, b): (x1, y1), (x2, y2) = pos(a), pos(b); return ((x1 - x2) ** 2 + (y1 - y2) ** 2) ** .5
for t in D['themes']:
    f = f'{cdir}/map_{t["carte"]}.json'
    if t['id'] == D['defaut']: continue
    if not os.path.exists(f): t['absent'] = True; continue
    r = json.load(open(f)); md = r['mapData']
    R = {q['rid']: q.get('data') for q in r.get('references', {}).get('RefIds', [])}
    els = [(e['gfxId'], e.get('cellId')) for e in md['sortableElements']] + \
          [(R[e['rid']]['gfxId'], R[e['rid']]['cellId']) for e in md['interactiveElements'] if R.get(e['rid']) and 'gfxId' in R[e['rid']]]
    g = {}
    for a, c in els: g.setdefault(a, c)
    centre = g[38003] if 38003 in g else g[42294] + 14 if 42294 in g else 276
    coffre, machine = g[12367], g[51031]
    mov = [i for i, c in enumerate(md['cellsData']) if c.get('mov')]
    arr = min(mov, key=lambda c: dist(c, centre + 30))
    ouvert = lambda c: sum(1 for d in mov if dist(c, d) <= 4)
    cand = [c for c in mov if dist(c, arr) >= 7 and dist(c, coffre) >= 4 and dist(c, machine) >= 4]
    poutch = max(cand, key=lambda c: (ouvert(c), -dist(c, arr)))
    pres = [c for c in mov if c not in (arr, poutch) and dist(c, arr) >= 2.5 and dist(c, poutch) >= 4]
    etabli = min(pres, key=lambda c: abs(dist(c, coffre) - 3.5))   # établi de forgemagie (Forgemagie v2 2B) : à quelques pas du coffre
    t.update(monde=f'havresac_{t["id"]}', arrivee=arr, arche=centre - 70, poutch=poutch, coffre=coffre, etabli=etabli)
    liste = f'/tmp/havresac_{t["id"]}.json'; json.dump({'0,0': [t['carte'], 851]}, open(liste, 'w'))
    subprocess.run([sys.executable, os.path.join(HERE, 'world_export.py'), liste, cdir, tdir, f'{mondes}/{t["monde"]}'], check=True)
json.dump(D, open(P, 'w'), ensure_ascii=False, indent=1); open(P, 'a').write('\n')
print(sum(1 for t in D['themes'] if not t.get('absent')), 'thèmes')
