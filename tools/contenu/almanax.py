# almanax.py : version 0.3 (choix 15C) : l'Almanax du jour. Calendrier officiel (almanaxcalendars) et offrande de chaque jour
# (objectif « Ramener à … : xN objet ») lus sur api.dofusdb.fr (mêmes données que le client Dofus 3), écrits dans src/data/almanax.json.
# Le bonus officiel est traduit en un effet du jeu en temps réel (EFFETS) ; les bonus sans équivalent (challenges, percepteurs,
# enclos, montures…) deviennent « Pépites » : l'offrande rapporte alors le double de Pépites.
# Offrande : l'objet officiel s'il est dans le jeu, sinon une ressource du jeu de niveau proche (choisie d'après la date, toujours
# la même) : on doit pouvoir faire l'offrande du jour avec ce qu'on trouve déjà (noté « officielle : false »).
# Usage : python almanax.py [almanax_brut.json]   (sans fichier : téléchargé)
import json, os, re, subprocess, sys, hashlib
R = os.path.join(os.path.dirname(__file__), '..', '..')
def get(url): return json.loads(subprocess.run(['curl', '-sSg', url], capture_output=True, text=True, check=True).stdout)
if len(sys.argv) > 1: brut = json.load(open(sys.argv[1]))
else:
    cal = []
    for skip in range(0, 500, 50): cal += get(f'https://api.dofusdb.fr/almanax-calendars?$limit=50&$skip={skip}')['data']
    ids, obj = sorted({c['objectiveId'] for c in cal}), {}
    for i in range(0, len(ids), 40):
        for o in get('https://api.dofusdb.fr/quest-objectives?$limit=50&' + '&'.join(f'id[$in][]={x}' for x in ids[i:i + 40]))['data']: obj[o['id']] = o
    brut = {'cal': cal, 'obj': obj}
obj = {int(k): v for k, v in brut['obj'].items()}
I = json.load(open(os.path.join(R, 'src/data/items.json')))
rec = json.load(open(os.path.join(R, 'src/data/recoltes.json')))
EFFETS = [   # (mot du nom officiel, effet du jeu)
    ('métiers', 'metier'), ('Fabrication', 'metier'), ("Économie d'ingrédients", 'metier'), ('Objets de qualité', 'fabrication'),
    ('Forgemagie', 'fabrication'), ('Gibier', 'gibier'), ('Bois', 'recolte'), ('Minerai', 'recolte'), ('Pêche', 'recolte'),
    ('Récolte', 'recolte'), ('Cueillette', 'recolte'), ('Apparition des ressources', 'recolte'), ('expérience', 'xp'), ('Expérience', 'xp'),
    ('Butin', 'butin'), ('butin', 'butin'), ('Cadeaux', 'butin'), ('Coffre au trésor', 'butin'),
]
def effet(nom):
    for mot, e in EFFETS:
        if mot in nom: return e
    return 'pepites'
nettoie = lambda t: re.sub(r'\{\{[^:}]*,?\d*::([^}]*)\}\}', r'\1', re.sub(r'</?[^>]+>', '', t or '')).strip()
# offrandes de remplacement : ressources lâchées par les monstres du jeu ou récoltées, sans les objets d'événement ni de quête
jeu = {x['item'] for l in I['drops'].values() for x in l if not x.get('cond') and x['item'] in I['resources']} | set(rec['ressources'])
obtenable = jeu | {r['result'] for r in I['recipes'] if r['result'] in I['resources']}
pool = sorted((k for k in jeu if k in I['resources'] and not I['resources'][k].get('cle') and I['resources'][k]['level'] <= 40), key=int)
jours = {}
for c in sorted(brut['cal'], key=lambda c: c['id']):
    for dt in c['dates']:
        j, m = dt.split('/')[:2]
        if '*' in j or '*' in m: continue
        cle = f'{m}-{j}'
        if cle in jours: continue
        o = obj.get(c['objectiveId']); g = (o or {}).get('need', {}).get('generated', {})
        it, n = (str(g['items'][0]), int(g['quantities'][0])) if g.get('items') else (None, 1)
        officielle = bool(it and it in obtenable)   # l'objet officiel, s'il peut se trouver dans le jeu
        if not officielle:
            lvl = min(40, int((I['resources'].get(it) or {}).get('level', 20)))
            proches = [k for k in pool if abs(I['resources'][k]['level'] - lvl) <= 10] or pool
            it = proches[int(hashlib.md5(cle.encode()).hexdigest(), 16) % len(proches)]
        jours[cle] = {'bonus': c['name']['fr'], 'texte': nettoie(c['desc']['fr']), 'effet': effet(c['name']['fr']), 'offrande': it,
                      'n': max(1, min(n, 10)), **({} if officielle else {'officielle': False})}
out = {'_': "Almanax du jour (0.3, 15C, tools/contenu/almanax.py) : calendrier officiel, bonus traduit en effet du jeu, offrande (officielle si elle est dans le jeu).",
       'jours': dict(sorted(jours.items()))}
json.dump(out, open(os.path.join(R, 'src/data/almanax.json'), 'w'), ensure_ascii=False, indent=1)
from collections import Counter
print(len(jours), 'jours ;', sum(1 for v in jours.values() if v.get('officielle', True)), 'offrandes officielles ;', Counter(v['effet'] for v in jours.values()))
