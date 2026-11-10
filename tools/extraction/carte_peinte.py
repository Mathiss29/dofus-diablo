"""Carte peinte officielle de Dofus 3 et données du Monde des Douze pour la carte du monde (maquette « Carte : » 1C, 8B, 6D).

Usage : python carte_peinte.py <worldmap_assets_.bundle> <catalog_1.0.bin du dossier Picto/Worldmaps> <dossier des tables (data_dump.py)> <fr.bin> <choix.json du chemin 60→200>
  - tables : worldmaps.json, subareas.json, mapsinformation.json (data_dump.py sur Content/Data)
  - le bundle (Content/Picto/Worldmaps, 520 Mo) reste sur le PC : on le copie en deux morceaux (split -b 300M) puis on recolle.
Écrit :
  public/assets/cartes/monde/peinte_<id>.webp : fond peint du Monde des Douze (id 1, échelle 0,4) et d'Incarnam (id 2, échelle 0,5)
  src/data/carte.json : réglages des fonds peints, régions de la feuille de route (vue « Monde des Douze », 8B), succès Cartographe (6D)
Les tuiles du bundle portent un numéro (adresse worldmaps/<id>/<échelle>/<n>.jpg, rangées de 1024 px de gauche à droite).
"""
import sys, os, json, re, struct, math, collections, warnings
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from i18n import load as i18n
warnings.filterwarnings('ignore')
import UnityPy
UnityPy.config.FALLBACK_UNITY_VERSION = '6000.3.16f1'

BUNDLE, CATALOG, TABLES, FR, CHOIX = sys.argv[1:6]
RACINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
T = i18n(FR)
def table(n):
    d = json.load(open(f'{TABLES}/{n}.json')); return [r['data'] for r in d['references']['RefIds']]

# --- adresses des tuiles : catalogue Addressables binaire (clés en « chaînes dynamiques » : morceaux reliés, du dernier au premier)
cat = open(CATALOG, 'rb').read()
def chaine(o): n = struct.unpack_from('<I', cat, o - 4)[0]; return cat[o:o + n].decode('latin1')
def dyn(o):
    parts = []
    while o != 0xffffffff and len(parts) < 12:
        so, nx = struct.unpack_from('<II', cat, o); parts.append(chaine(so)); o = nx
    return '/'.join(reversed(parts))
refs = collections.defaultdict(list)
for i in range(len(cat) - 4): refs[struct.unpack_from('<I', cat, i)[0]].append(i)
adresse = {}
for m in re.finditer(rb'[0-9a-f]{32}', cat):
    for r in refs.get(m.start(), []):
        k = struct.unpack_from('<I', cat, r - 4)[0]
        if k & 0x40000000:
            try: a = dyn(k & 0x3fffffff)
            except Exception: continue
            if a.startswith('worldmaps/'): adresse[m.group().decode()] = a; break

WM = {w['id']: w for w in table('worldmaps')}
VOULU = {1: 0.4, 2: 0.5}
env = UnityPy.load(BUNDLE)
tuiles = collections.defaultdict(dict)
for k, obj in env.container.items():
    a = adresse.get(k)
    if not a or obj.type.name != 'Texture2D': continue
    _, w, s, n = a.split('/')
    if int(w) in VOULU and float(s) == VOULU[int(w)]: tuiles[int(w)][int(n.split('.')[0])] = obj.read().image

os.makedirs(f'{RACINE}/public/assets/cartes/monde', exist_ok=True)
peintes = {}
for w, ech in VOULU.items():
    d = WM[w]; W, H = round(d['totalWidth'] * ech), round(d['totalHeight'] * ech); cols = math.ceil(W / 1024)
    im = Image.new('RGB', (W, H))
    for n, t in tuiles[w].items(): im.paste(t.convert('RGB'), (((n - 1) % cols) * 1024, ((n - 1) // cols) * 1024))
    im.save(f'{RACINE}/public/assets/cartes/monde/peinte_{w}.webp', 'WEBP', quality=78, method=6)
    # case [x, y] de la carte = coin (origineX + x·mapWidth, origineY + y·mapHeight) à l'échelle 1
    peintes[str(w)] = {'nom': T(d['nameId']), 'img': f'cartes/monde/peinte_{w}.webp', 'w': W, 'h': H, 'k': ech,
                       'ox': d['origineX'], 'oy': d['origineY'], 'mw': round(d['mapWidth'], 3), 'mh': round(d['mapHeight'], 3)}
    print('peinte', w, W, H, len(tuiles[w]), 'tuiles')

# --- régions du Monde des Douze (8B) : cases de chaque région, et la version prévue
SUBS = {int(s['id']): s for s in table('subareas')}
NOMSUB = collections.defaultdict(list)
for s in SUBS.values(): NOMSUB[T(int(s['nameId']))].append(int(s['id']))
CASES = collections.defaultdict(set)
for m in table('mapsinformation'):
    if int(m['worldMap']) == 1: CASES[int(m['subAreaId'])].add((int(m['posX']), int(m['posY'])))
ZONES = json.load(open(f'{RACINE}/src/data/zones.json'))
def cases(subs): return sorted({c for s in subs for c in CASES[s]})
regions = []
ast = ZONES['astrub']['open']['subareas']
pub = [int(k) for k, v in ast.items() if not v.get('essai') and CASES[int(k)]]
ess = [int(k) for k, v in ast.items() if v.get('essai') and CASES[int(k)]]
regions.append({'lab': 'Astrub', 'ver': 'jouable', 'cases': cases(pub)})
regions.append({'lab': 'Amakna', 'ver': '0.4', 'niv': '10 → 60', 'cases': cases(ess)})
wab = [i for n, l in NOMSUB.items() if re.search(r'Wabbit|Cawotte', n) for i in l]
regions.append({'lab': 'Île des Wabbits', 'ver': '0.4', 'niv': '40 → 60', 'cases': cases(wab)})
for v in json.load(open(CHOIX)):
    for r in v['regions']:
        ids = [i for n in r['subs'] for i in NOMSUB.get(n, [])]
        c = cases(ids)
        if c: regions.append({'lab': r['lab'], 'ver': v['ver'], 'niv': v['niv'], 'cases': c})
deja = set()
for r in regions:   # une case n'appartient qu'à la première région qui la cite
    r['cases'] = [c for c in r['cases'] if c not in deja]; deja.update(map(tuple, r['cases']))
regions = [r for r in regions if r['cases']]

# --- succès Cartographe (6D) : 90 % des cartes du dehors de chaque région jouable
def dehors(monde, essai=None):
    M = json.load(open(f'{RACINE}/public/assets/mondes/{monde}/plan.json'))
    return [f'{x}_{y}' for x, y, _, e in M['maps'] if essai is None or bool(e) == essai]
succes = {
  'cartographe_incarnam': {'nom': 'Cartographe d\'Incarnam', 'dofusId': 0, 'description': 'Explorer 90 % des cartes d\'Incarnam.', 'categorie': 'Exploration',
    'sousCategorie': 'Incarnam', 'points': 10, 'icone': 82, 'objectifs': [{'nom': 'Incarnam explorée', 'exploration': 'incarnam', 'part': 0.9, 'cartes': dehors('incarnam')}],
    'recompense': {'xp': 400}},
  'cartographe_astrub': {'nom': 'Cartographe d\'Astrub', 'dofusId': 0, 'description': 'Explorer 90 % des cartes d\'Astrub.', 'categorie': 'Exploration',
    'sousCategorie': 'Astrub', 'points': 15, 'icone': 82, 'objectifs': [{'nom': 'Astrub explorée', 'exploration': 'astrub', 'part': 0.9, 'cartes': dehors('astrub', False)}],
    'recompense': {'xp': 2500, 'titre': 'Cartographe'}},
  'cartographe_amakna': {'nom': 'Cartographe d\'Amakna', 'dofusId': 0, 'description': 'Explorer 90 % des cartes d\'Amakna.', 'categorie': 'Exploration',
    'sousCategorie': 'Amakna', 'points': 20, 'icone': 82, 'objectifs': [{'nom': 'Amakna explorée', 'exploration': 'astrub', 'part': 0.9, 'cartes': dehors('astrub', True)}],
    'recompense': {'xp': 9000, 'titre': 'Grand cartographe'}, 'test': True},
}
out = {'_': 'Carte du monde (maquette « Carte : » 2026-11-10) : fonds peints officiels, régions de la feuille de route (vue Monde des Douze), '
            'succès Cartographe. Écrit par tools/extraction/carte_peinte.py.',
       'peintes': peintes, 'mondes': {'incarnam': {'peinte': 2, 'nom': 'Incarnam'}, 'astrub': {'peinte': 1, 'nom': 'Astrub et Amakna'}},
       'regions': regions, 'succes': succes}
json.dump(out, open(f'{RACINE}/src/data/carte.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(regions), 'régions', sum(len(r['cases']) for r in regions), 'cases')
