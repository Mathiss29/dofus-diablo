# recoltes.py : écrit src/data/recoltes.json (métiers de récolte de la 0.2b, maquette Métiers : 2A 5A 6A+6C 13C).
#
# Usage : python recoltes.py <liste.json du monde> <dossier des cartes map_<id>.json> <dossier des tables (data_dump)> <fr.bin> <monde.json> [nom du monde, astrub par défaut]
#   (Astrub : liste.json et cartes/ de l'export du monde, tables de cache-dofus/donnees.tar.gz)
#
# Emplacements : les éléments interactifs animés des cartes officielles (ClientInteractiveAnimatedElementTransform : case + gfx).
# Ressources : le client ne dit pas quelle ressource porte un dessin ; recoltes_gfx.py relie chaque gfx à la ressource relevée sur
# les mêmes cartes (recoltables_dofusdb.json), et chaque coin de pêche à un poisson relevé sur sa carte. Métier, niveau minimum et
# animation : compétences officielles (skills). Les puits donnent de l'Eau Potable (« Puiser », sans métier).
import json, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'extraction'))
sys.path.insert(0, os.path.dirname(__file__))
from i18n import load as i18n
from recoltes_gfx import GFX, POISSON, ressource

liste, cartes, tables, frbin, monde = sys.argv[1:6]
NOM = sys.argv[6] if len(sys.argv) > 6 else 'astrub'   # clé du monde dans recoltes.json (les autres mondes sont gardés)
T = i18n(frbin)
def table(n):
    d = json.load(open(f'{tables}/{n}.json')); R = {r['rid']: r['data'] for r in d['references']['RefIds']}; o = d['objectsById']
    return {int(k): R.get(v['rid']) for k, v in zip(o['m_keys'], o['m_values'])}
SA, SK, I, J = table('subareas'), table('skillsdataroot'), table('items'), table('jobsdataroot')

METIERS = {1: '', 2: 'bucheron', 24: 'mineur', 26: 'alchimiste', 28: 'paysan', 36: 'pecheur'}
# ressource -> (métier, niveau minimum, animation officielle de la compétence, portée en cases)
RES = {}
for s in SK.values():
    g, j = s.get('gatheredRessourceItem'), s.get('parentJobId')
    if g and g > 0 and j in METIERS and (g not in RES or s['levelMin'] < RES[g][1]): RES[g] = (METIERS[j], s['levelMin'], s['useAnimation'], s.get('range', 1))
sub = {m['tag']: m['sub'] for m in json.load(open(monde))['maps']}
mid = {m['tag']: m.get('id') for m in json.load(open(monde))['maps']}
L = json.load(open(liste))
spots = []
for xy, v in L.items():
    tag = xy.replace(',', '_'); s = sub.get(tag)
    if s is None: continue
    r = json.load(open(f'{cartes}/map_{v[0]}.json'))
    for q in r.get('references', {}).get('RefIds', []):
        if q['type']['class'] != 'ClientInteractiveAnimatedElementTransform': continue
        g = q['data']['gfxId']
        if g not in GFX and g != POISSON: continue
        # position du dessin (repère Unity de la carte : x = px - 623,5, y = 505,25 - py) : souvent la case, parfois décalée ; m11 < 0 = miroir
        t, c = q['data']['transform'], q['data']['cellId']; row, k = divmod(c, 14)
        dx, dy = round(t['m31'] + 623.5 - (43 + k * 86 + (row % 2) * 43), 1), round(505.25 - t['m32'] - (21.5 + row * 21.5), 1)
        if abs(dx) > 60 or abs(dy) > 60: dx = dy = 0   # grands écarts (multiples de cases, hors carte) : repère non compris, on reste sur la case
        spots.append((tag, c, g, s, dx, dy, 1 if t['m11'] < 0 else 0))

out = []
for tag, cell, g, s, dx, dy, miroir in spots:
    h = ressource(g, mid.get(tag), tag, cell, [(x, RES[x][1]) for x in SA[s].get('harvestables', []) if x in RES and RES[x][0] == 'pecheur'])
    if h: out.append([tag, cell, str(h), g, dx, dy, miroir])
nom = lambda h: T(I[h]['nameId'])
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'data', 'recoltes.json')
data = json.load(open(OUT)) if os.path.exists(OUT) else {}
data[NOM] = out
mondes = [k for k in data if not k.startswith('_') and k not in ('metiers', 'ressources')]
tous = {int(x[2]) for k in mondes for x in data[k]}
data.update({
    '_': "Métiers de récolte (0.2b), écrit par tools/contenu/recoltes.py. Ressource d'un emplacement : relevé officiel de sa carte (tools/contenu/recoltes_gfx.py). metier vide = sans métier (puits). portee : portée officielle en cases (pêche 10).",
    'metiers': {k: {'id': j, 'nom': T(J[j]['nameId'])} for j, k in METIERS.items() if k},
    'ressources': {str(h): {'nom': nom(h), 'metier': RES[h][0], 'niveau': RES[h][1], 'anim': RES[h][2], 'icone': I[h]['iconId'], 'niveauObjet': I[h]['level'],
                          **({'portee': RES[h][3]} if RES[h][3] > 1 else {})} for h in sorted(tous)},
    '_monde': "<monde>: [carte, case, ressource, gfx (planche public/assets/sprites/recoltes/<gfx>), décalage x, y du dessin (px Dofus), miroir]",
})
data.pop('_astrub', None)
json.dump(data, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'emplacements ;', ', '.join(f"{v['nom']} ({sum(1 for x in out if x[2] == k)})" for k, v in data['ressources'].items()))
