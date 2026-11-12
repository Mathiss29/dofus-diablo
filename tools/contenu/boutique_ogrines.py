"""Boutique Ogrines (ligne « Apparats : » 9A+9B+9C+9E+9G 13A 14A+14B+14C 15A 16A+16D 17, Mathis 2026-11-12) :
src/data/boutique_ogrines.json.

python tools/contenu/boutique_ogrines.py

Jamais de puissance à vendre (ni équipement, ni familier à bonus, ni Dofus) ; les Ogrines ne s'achètent pas avec de l'argent.
  apparats  (9A) : les apparats « boutique » de apparats_sources.json, prix selon la rareté (15A : 300 / 500 / 800),
                    familier d'apparat 600 ;
  fêtes    (14C) : les apparats de fête, en vente seulement pendant leur fête ;
  costumes  (9B) : coiffe + cape (+ familier) du même nom, 20 % moins cher, 1 500 au plus ;
  style     (9E) : auréoles, effets de Zaap et ornements « ogrines » de style.json ;
  services  (9C) : changement de nom, de tête et de couleurs ;
  abonnements (9G, 16, 17) : trois paliers pour 30 jours ; 12 apparats gardés pour « l'apparat du mois » (17B), pas vendus.
Mises en avant et promotion de la semaine (14B) : calculées par src/sim/boutiqueOgrines.ts."""
import json, os, re, hashlib

R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
lire = lambda f: json.load(open(os.path.join(R, 'src/data', f), encoding='utf-8'))
A = lire('apparat.json')['objets']
F = {k: v for k, v in lire('familiers.json')['familiers'].items() if v.get('apparat')}
S = lire('apparats_sources.json')['sources']
ST = lire('style.json')

PRIX = {'rare': 300, 'epique': 500, 'legendaire': 800}
FAMILIER = 600
nom = lambda i: A[i]['name'] if i in A else F[i]['nom']
sorte = lambda i: A[i]['slot'] if i in A else 'familier'
h = lambda s: int(hashlib.md5(s.encode()).hexdigest(), 16)
prix = lambda i: FAMILIER if sorte(i) == 'familier' else PRIX[S[i]['rarete']]

boutique = sorted((i for i, s in S.items() if s['k'] == 'boutique'), key=int)
# 17B : 12 apparats légendaires (coiffes et capes) réservés à l'abonnement, un par mois
leg = sorted((i for i in boutique if S[i]['rarete'] == 'legendaire' and sorte(i) != 'familier'), key=lambda i: h('mois' + i))
MOIS = leg[:12]
vendus = [i for i in boutique if i not in MOIS]

articles = {}
for i in vendus: articles[f'a{i}'] = {'cat': sorte(i), 'prix': prix(i), 'apparats': [i]}
for i, s in S.items():
    if s['k'] == 'fete': articles[f'a{i}'] = {'cat': sorte(i), 'prix': prix(i), 'apparats': [i], 'fete': s['fete']}

# 9B : costumes = même nom sans le premier mot (« Coiffe du Champion » + « Cape du Champion »)
theme = lambda n: n.split(' ', 1)[1].lower() if ' ' in n else n.lower()
groupes = {}
for i in vendus:
    if sorte(i) != 'familier': groupes.setdefault(theme(nom(i)), []).append(i)
fams = [i for i in vendus if sorte(i) == 'familier']
nus = lambda t: re.sub(r"^(de la |de l'|du |des |de |d')", '', t)
for t, l in sorted(groupes.items()):
    chap = [i for i in l if sorte(i) == 'chapeau'][:1]; cape = [i for i in l if sorte(i) == 'cape'][:1]
    if not chap or not cape: continue
    fam = [i for i in fams if len(nus(t)) > 3 and nus(t) in F[i]['nom'].lower()][:1]
    ids = chap + cape + fam
    total = sum(prix(i) for i in ids)
    articles[f'c{chap[0]}'] = {'cat': 'costume', 'prix': min(1500, int(total * 0.8 / 50) * 50), 'apparats': ids,
                               'nom': 'Costume ' + nom(chap[0]).split(' ', 1)[1]}

for so in ('aureoles', 'zaaps', 'ornements'):
    for d in ST[so]:
        if d.get('ogrines'): articles[f's{so}:{d["id"]}'] = {'cat': 'style', 'prix': d['ogrines'], 'style': f'{so}:{d["id"]}'}

SERVICES = {
    'nom': {'nom': 'Potion de changement de nom', 'texte': 'Renomme un de tes persos en ligne (à l\'accueil, Mes personnages).', 'prix': 500},
    'apparence': {'nom': 'Potion de changement d\'apparence', 'texte': 'Change la tête et les couleurs d\'un perso (à l\'accueil, Mes personnages).', 'prix': 300},
}
for k, d in SERVICES.items(): articles[f'v{k}'] = {'cat': 'service', 'prix': d['prix'], 'service': k}

out = {
    '_': __doc__.split('\n\n')[0] + ' Écrit par tools/contenu/boutique_ogrines.py.',
    'services': SERVICES,
    'semaine': {'avant': 6, 'promo': 0.3},
    'abonnement': {
        'jours': 30, 'essai': {'jours': 7, 'palier': 'heros'},
        'paliers': {
            'aventurier': {'nom': 'Aventurier', 'prix': 300, 'couleur': '#7cc7ff'},
            'heros': {'nom': 'Héros', 'prix': 700, 'couleur': '#c28bff'},
            'legende': {'nom': 'Légende', 'prix': 1500, 'couleur': '#ffb347'},
        },
        'apparatsDuMois': MOIS,
    },
    'articles': articles,
}
p = os.path.join(R, 'src/data/boutique_ogrines.json')
with open(p, 'w', encoding='utf-8') as f:
    f.write('{\n' + ',\n'.join(f' {json.dumps(k, ensure_ascii=False)}: ' + (
        '{\n' + ',\n'.join(f'  {json.dumps(a)}: {json.dumps(b, ensure_ascii=False)}' for a, b in v.items()) + '\n }' if k == 'articles'
        else json.dumps(v, ensure_ascii=False)) for k, v in out.items()) + '\n}\n')
cats = {}
for a in articles.values(): cats[a['cat']] = cats.get(a['cat'], 0) + 1
print(f'{len(articles)} articles', cats, f'{len(MOIS)} apparats du mois')
