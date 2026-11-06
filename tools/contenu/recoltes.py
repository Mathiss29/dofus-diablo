# recoltes.py : écrit src/data/recoltes.json (métiers de récolte de la 0.2b, maquette Métiers : 2A 5A 6A+6C 13C).
#
# Usage : python recoltes.py <liste.json du monde> <dossier des cartes map_<id>.json> <dossier des tables (data_dump)> <fr.bin> <monde.json> [nom du monde, astrub par défaut]
#   (Astrub : liste.json et cartes/ de l'export du monde, tables de cache-dofus/donnees.tar.gz)
#
# Emplacements : les éléments interactifs animés des cartes officielles (ClientInteractiveAnimatedElementTransform : case + gfx).
# Ressources : la liste officielle de chaque sous-zone (subareas.harvestables) et les compétences des métiers (skills :
# ressource récoltée, niveau minimum, animation). Les animations des ressources (looks {650}, {660}…) ne sont pas dans le client
# de Dofus 3 : le gfx ne dit donc pas quelle ressource c'est. On le déduit (voir GFX) : la famille vient des sous-zones où le gfx
# apparaît (Carrière = minerais, Champs = céréales, Forêt = arbres, Calanques = pêche), puis le gfx le plus fréquent d'une famille
# reçoit la ressource de plus bas niveau, et ainsi de suite (dans Dofus, les ressources de bas niveau sont les plus nombreuses).
import json, sys, os, collections, zlib
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'extraction'))
from i18n import load as i18n

liste, cartes, tables, frbin, monde = sys.argv[1:6]
NOM = sys.argv[6] if len(sys.argv) > 6 else 'astrub'   # clé du monde dans recoltes.json (les autres mondes sont gardés)
T = i18n(frbin)
def table(n):
    d = json.load(open(f'{tables}/{n}.json')); R = {r['rid']: r['data'] for r in d['references']['RefIds']}; o = d['objectsById']
    return {int(k): R.get(v['rid']) for k, v in zip(o['m_keys'], o['m_values'])}
SA, SK, I, J = table('subareas'), table('skillsdataroot'), table('items'), table('jobsdataroot')

METIERS = {2: 'bucheron', 24: 'mineur', 26: 'alchimiste', 28: 'paysan', 36: 'pecheur'}
# ressource -> (métier, niveau minimum, animation officielle de la compétence)
RES = {}
for s in SK.values():
    g, j = s.get('gatheredRessourceItem'), s.get('parentJobId')
    if g and g > 0 and j in METIERS and (g not in RES or s['levelMin'] < RES[g][1]): RES[g] = (METIERS[j], s['levelMin'], s['useAnimation'])
famille_de = {'bucheron': 'arbre', 'paysan': 'cereale', 'mineur': 'minerai', 'alchimiste': 'plante', 'pecheur': 'poisson'}

# Familles des gfx (déduites des sous-zones où ils apparaissent, voir l'en-tête)
FAMILLE = {**{g: 'arbre' for g in [650, 651, 652, 653, 654, 655, 656, 658, 677, 678, 679, 3222, 224, 5249]},
           **{g: 'cereale' for g in [660, 661, 662, 663, 664, 665, 701, 659, 680]},
           **{g: 'minerai' for g in [4918, 4920, 4921, 4922, 1081, 2204, 1063, 2200, 1953, 1077]},
           **{g: 'plante' for g in [3212, 3213, 4938]}, 1018: 'poisson'}

sub = {m['tag']: m['sub'] for m in json.load(open(monde))['maps']}
L = json.load(open(liste))
spots, freq, offerts = [], collections.Counter(), set()
for xy, v in L.items():
    tag = xy.replace(',', '_'); s = sub.get(tag)
    if s is None: continue
    offerts |= {h for h in SA[s].get('harvestables', []) if h in RES}
    r = json.load(open(f'{cartes}/map_{v[0]}.json'))
    for q in r.get('references', {}).get('RefIds', []):
        if q['type']['class'] != 'ClientInteractiveAnimatedElementTransform': continue
        g = q['data']['gfxId']
        if g not in FAMILLE: continue
        # position du dessin (repère Unity de la carte : x = px - 623,5, y = 505,25 - py) : souvent la case, parfois décalée ; m11 < 0 = miroir
        t, c = q['data']['transform'], q['data']['cellId']; row, k = divmod(c, 14)
        dx, dy = round(t['m31'] + 623.5 - (43 + k * 86 + (row % 2) * 43), 1), round(505.25 - t['m32'] - (21.5 + row * 21.5), 1)
        if abs(dx) > 60 or abs(dy) > 60: dx = dy = 0   # grands écarts (multiples de cases, hors carte) : repère non compris, on reste sur la case
        freq[g] += 1; spots.append((tag, c, g, s, dx, dy, 1 if t['m11'] < 0 else 0))

# gfx -> ressource : rang de fréquence dans la famille = rang de niveau parmi les ressources officielles d'Astrub de cette famille
GFX = {}
for fam in set(FAMILLE.values()):
    if fam == 'poisson': continue
    gs = sorted([g for g in freq if FAMILLE[g] == fam], key=lambda g: -freq[g])
    rs = sorted([h for h in offerts if famille_de[RES[h][0]] == fam], key=lambda h: RES[h][1])
    for i, g in enumerate(gs): GFX[g] = rs[min(i, len(rs) - 1)]
# Pêche : un poisson officiel de la sous-zone par coin de pêche, les bas niveaux plus souvent (tirage fixe par case)
def poisson(tag, cell, s):
    l = sorted([h for h in SA[s].get('harvestables', []) if h in RES and RES[h][0] == 'pecheur'], key=lambda h: RES[h][1])
    if not l: return None
    poids = [len(l) - i for i in range(len(l))]; x = zlib.crc32(f'{tag}:{cell}'.encode()) % sum(poids)
    for h, w in zip(l, poids):
        if x < w: return h
        x -= w

out = []
for tag, cell, g, s, dx, dy, miroir in spots:
    h = poisson(tag, cell, s) if FAMILLE[g] == 'poisson' else GFX.get(g)
    if h: out.append([tag, cell, str(h), g, dx, dy, miroir])
nom = lambda h: T(I[h]['nameId'])
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'data', 'recoltes.json')
data = json.load(open(OUT)) if os.path.exists(OUT) else {}
data[NOM] = out
mondes = [k for k in data if not k.startswith('_') and k not in ('metiers', 'ressources')]
tous = {int(x[2]) for k in mondes for x in data[k]}
data.update({
    '_': "Métiers de récolte (0.2b), écrit par tools/contenu/recoltes.py. Ressource d'un emplacement : déduite (voir l'en-tête du script).",
    'metiers': {k: {'id': j, 'nom': T(J[j]['nameId'])} for j, k in METIERS.items()},
    'ressources': {str(h): {'nom': nom(h), 'metier': RES[h][0], 'niveau': RES[h][1], 'anim': RES[h][2], 'icone': I[h]['iconId'], 'niveauObjet': I[h]['level']}
                   for h in sorted(tous)},
    '_monde': "<monde>: [carte, case, ressource, gfx (planche public/assets/sprites/recoltes/<gfx>), décalage x, y du dessin (px Dofus), miroir]",
})
data.pop('_astrub', None)
json.dump(data, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'emplacements ;', ', '.join(f"{v['nom']} ({sum(1 for x in out if x[2] == k)})" for k, v in data['ressources'].items()))
