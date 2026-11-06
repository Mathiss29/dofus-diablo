"""Objets d'apparat officiels (coiffes et capes d'apparat, maquette Apparence 5A + 6B) : src/data/apparat.json.

python apparat_export.py <donnees> <fr.bin> <correspondances Kaikina coiffes.json,capes.json> <item_assets_1x.bundle>
Garde les objets d'apparat (types 246 coiffe, 247 cape) dont on connaît le dessin porté, ajoute leurs paires
{ idObjet: idSkin } à equipement_correspondances.json et range leurs icônes sur public/assets/ui/apparat.webp.
Ensuite : equipement_export.py exporte leurs dessins comme ceux des coiffes et capes normales."""
import json, os, sys
from i18n import load as load_i18n

HERE = os.path.dirname(os.path.abspath(__file__))
R = os.path.join(HERE, '..', '..')
donnees, fr, kai, icones = sys.argv[1:5]
T = load_i18n(fr)


def table(n):
    d = json.load(open(os.path.join(donnees, n + '.json')))
    Rf = {r['rid']: r['data'] for r in d['references']['RefIds']}
    o = d['objectsById']
    return {int(k): Rf.get(v['rid']) for k, v in zip(o['m_keys'], o['m_values'])}


I = table('items')
SLOT = {246: 'chapeau', 247: 'cape'}
peau = {}
for f in kai.split(','):
    for x in json.load(open(f)): peau[int(x['itemId'])] = int(x['skinId'])
ap = {}
for i, s in sorted(peau.items()):
    it = I.get(i)
    if not it or int(it['typeId']) not in SLOT: continue
    nom = T(int(it['nameId']))
    if not nom: continue
    ap[str(i)] = {'name': nom, 'slot': SLOT[int(it['typeId'])], 'icon': int(it['iconId'])}
cp = os.path.join(HERE, 'equipement_correspondances.json')
c = json.load(open(cp)); c.update({k: peau[int(k)] for k in ap})
json.dump(dict(sorted(c.items(), key=lambda x: int(x[0]))), open(cp, 'w'), indent=0)
# Planche à part (ui/apparat.webp, chargée par la garde-robe seulement) : une case de 64 px par objet, dans l'ordre de apparat.json
import math, warnings, UnityPy
from PIL import Image
warnings.filterwarnings('ignore'); UnityPy.config.FALLBACK_UNITY_VERSION = '6000.3.16f1'
voulues = {str(v['icon']) for v in ap.values()}; im = {}
for o in UnityPy.load(icones).objects:
    if o.type.name == 'Texture2D':
        t = o.read()
        if t.m_Name in voulues: im[t.m_Name] = t.image.convert('RGBA')
C, cols = 64, 20; ap = {k: v for k, v in ap.items() if str(v['icon']) in im}
sheet = Image.new('RGBA', (cols * C, math.ceil(len(ap) / cols) * C))
for n, v in enumerate(ap.values()):
    i = im[str(v['icon'])].copy(); i.thumbnail((C, C)); v['case'] = n
    sheet.paste(i, ((n % cols) * C + (C - i.width) // 2, (n // cols) * C + (C - i.height) // 2))
sheet.save(os.path.join(R, 'public/assets/ui/apparat.webp'), 'WEBP', quality=85, method=6)
json.dump({'cell': C, 'cols': cols, 'rows': math.ceil(len(ap) / cols), 'objets': ap},
          open(os.path.join(R, 'src/data/apparat.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(ap), 'objets d\'apparat')
