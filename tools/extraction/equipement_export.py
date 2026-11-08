"""Dessins des objets portés (coiffes, capes, boucliers) pour le perso dessiné en direct (maquette Apparence 4A+4B).

python equipement_export.py <Skins> <items.json du jeu> <correspondances.json> <sortie> [tables du jeu]
  Skins            : dossier Characters/Skins complet (cache-dofus/skins, copié du PC de Mathis)
  correspondances  : { "idObjet": idSkin } ; le client de Dofus ne garde pas ce lien (le serveur l'envoie),
                     il est déduit en comparant l'icône de l'objet aux dessins (voir LISEZMOI, « Objets portés »)
Écrit skin_<id>.json/.webp (tous les morceaux du skin : Chapeau_1, Cape_1, Bouclier_1...) et equipement.json { idObjet: idSkin }.
Les coiffes se posent dans les emplacements vides de la tête (Chapeau_1, ChapeauB_1...), les capes et boucliers sur les nœuds du squelette."""
import glob, json, os, subprocess, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from skin_mesh import mesh_from  # noqa: E402

skins, items, corr, out = sys.argv[1:5]
donnees = sys.argv[5] if len(sys.argv) > 5 else None   # tables du jeu (skinslotsrules.json) : parties de la tête cachées par une coiffe
work = os.environ.get('TRAVAIL') or os.path.join(out, '..', '..', '..', '..', '.squelette-travail')
work = os.path.abspath(work); os.makedirs(work, exist_ok=True)
E = {**json.load(open(items))['equipment'], **json.load(open(os.path.join(os.path.dirname(os.path.abspath(items)), 'apparat.json')))['objets']}   # + apparat (apparat_export.py)
C = {k: int(v) for k, v in json.load(open(corr)).items() if k in E}


def compact(m):
    if 'trou' in m: return None
    if not m['t']: return None
    v = []
    for x, y, u, w in m['v']: v += [round(x, 2), round(y, 2), round(u, 5), round(w, 5)]
    return {'z': 0, 'v': v, 't': m['t']}


fait = set()
ids = sorted(set(C.values()) | {3650})   # + 3650 : Lance du Forgelance tenue en main (LANCE_EN_MAIN, squelette.ts)
if os.environ.get('PART'): i, n = map(int, os.environ['PART'].split('/')); ids = ids[i::n]   # plusieurs exports en parallèle (TRAVAIL différents)
for sid in ids:
    if not os.environ.get('FORCE') and os.path.exists(os.path.join(out, f'skin_{sid}.json')): fait.add(sid); continue
    d = os.path.join(work, f'skin_{sid}')
    if not glob.glob(d + '/tex_*.png'):
        subprocess.run([sys.executable, os.path.join(HERE, 'b_dump.py'), os.path.join(skins, f'skins_assets_skin_{sid}.bundle'), d], check=True, capture_output=True)
    mb = [json.load(open(f)) for f in glob.glob(d + '/mb_*.json')]
    tex = glob.glob(d + '/tex_*.png')
    if not mb or not tex: print('skin vide', sid); continue
    sk, tex = mb[0], tex[0]
    parts = {}
    for i, k in enumerate(sk['m_keys']):
        ms = [x for x in (compact(m) for m in mesh_from(sk, i, tex, [])) if x]
        if ms: parts[k] = ms
    Image.open(tex).save(os.path.join(out, f'skin_{sid}.webp'), 'WEBP', quality=92, method=6)
    json.dump({'tex': f'skin_{sid}.webp', 'parts': parts}, open(os.path.join(out, f'skin_{sid}.json'), 'w'), separators=(',', ':'))
    fait.add(sid)
# Parties de la tête qu'une coiffe cache (skinslotsrules) : règle par défaut (« 0 »), par classe (« b8 ») ou par tête (« t2124 »).
# Numéros d'emplacement -> parties déduits des coiffes (13 et 5 sur presque toutes : les cheveux), le client ne les nomme pas.
SLOT = {13: 'cheveux', 5: 'crane', 0: 'oreille', 1: 'oreille', 11: 'patte', 12: 'patte'}
caches = {}
if donnees:
    d = json.load(open(os.path.join(donnees, 'skinslotsrules.json')))
    Rf = {r['rid']: r['data'] for r in d['references']['RefIds']}
    o = d['objectsById']
    for k, v in zip(o['m_keys'], o['m_values']):
        k = int(k); r = Rf.get(v['rid'])
        if k not in fait or not r: continue
        if not any(p.startswith(('Chapeau', 'Masque', 'Bandeau')) for p in json.load(open(os.path.join(out, f'skin_{k}.json')))['parts']): continue   # coiffes seulement
        c = {}
        for rl in r['slotRulesList']:
            cle = {0: '0', 1: f"b{rl['slotRuleInfo']}", 3: f"t{rl['slotRuleInfo']}"}.get(rl['slotRuleType'])
            if cle: c[cle] = sorted({SLOT[x['id']] for x in rl['slotsRules'] if x['id'] in SLOT and x['mask']})
        if c: caches[str(k)] = c
json.dump({'objets': {k: v for k, v in sorted(C.items(), key=lambda x: int(x[0])) if v in fait}, 'caches': caches},
          open(os.path.join(out, 'equipement.json'), 'w'), separators=(',', ':'))
print(len(fait), 'dessins,', len(C), 'objets')
# apparats sans dessin porté (skin vide dans le jeu, ex. Cape Airgot) : retirés du catalogue de la garde-robe
ap = os.path.join(HERE, '..', '..', 'src/data/apparat.json')
A = json.load(open(ap)); A['objets'] = {k: v for k, v in A['objets'].items() if C.get(k) in fait}
json.dump(A, open(ap, 'w'), ensure_ascii=False, separators=(',', ':'))
