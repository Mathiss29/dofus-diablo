# quete_ocre.py : la quête du Dofus Ocre, « L'éternelle moisson » (ligne « Archis : 7A 9A+9C 10A 11A+11B+11C », 2026-11-12).
# Officiel (quests 439) : Otomaï donne la liste, son Assistante (PNJ 6693) regarde les âmes capturées, 18 étapes d'environ 20 âmes
# (objectifs « montrer » : les âmes restent dans le sac), puis « L'ultime Épreuve » : l'Âme du Kralamoure (9720) à Otomaï -> Dofus Ocre.
# Chez nous : les âmes du jeu (archimonstres + boss de donjon qui ont leur « Âme capturée » officielle, 9C), rangées par niveau de leur
# sous-zone et coupées en chapitres d'environ 20 ; chaque chapitre se rend à l'Assistante (XP, kamas, Pépites 11A ; pierres d'âme et
# sac à rareté garantie 11B ; titres officiels et un ornement aux étapes clés 11C). L'ultime Épreuve est « bientôt » (10A : l'Ocre
# seulement à la toute fin, avec le Kralamoure, pas encore dans le jeu). À relancer quand de nouveaux archimonstres arrivent.
# Écrit le PNJ et les quêtes dans src/data/quetes.json (sans toucher au reste). Usage : python quete_ocre.py
import json, os
R = os.path.join(os.path.dirname(__file__), '..', '..')
PQ, PM, PZ = (os.path.join(R, 'src/data', f) for f in ('quetes.json', 'monsters.json', 'zones.json'))
Q, M, Z = (json.load(open(p, encoding='utf-8')) for p in (PQ, PM, PZ))

# niveau de chaque âme : la sous-zone la plus basse où vit son monstre (archimonstre), ou le niveau du boss
niv = {}
for z in Z.values():
    for s in (z.get('open') or {}).get('subareas', {}).values():
        for m in s.get('monsters', []) + ([s['elite']] if s.get('elite') else []):
            niv[m] = min(niv.get(m, 999), s['level'])
ames = []
for k, d in M.items():
    if not d.get('ame'): continue
    n = niv.get(d['archiDe']) if d.get('archiDe') else d.get('level')
    ames.append((n or d.get('level') or 1, 0 if d.get('archiDe') else 1, k))
ames.sort()
nb = max(1, round(len(ames) / 20)); taille = len(ames) / nb
chap = [ames[round(i * taille):round((i + 1) * taille)] for i in range(nb)]

PNJ = 'assistante_otomai'
Q['pnj'][PNJ] = {'nom': "Assistante d'Otomaï", 'dofusId': 6693, 'zone': 'bastion', 'carte': 'marche', 'case': Q['pnj'].get(PNJ, {}).get('case', Q['pnj']['otomai']['case'] + 2),
  'apres': 'astrub', 'titre': 'Gardienne des âmes',
  'phrase': "Otomaï classe ses fioles par couleur. Moi, je classe les âmes par caractère. Celle-ci boude, celle-là chante faux.",
  'discussion': [{'reponse': 'Tu gardes les âmes que je capture ?', 'texte': "Non, elles restent dans ta besace. Je les regarde, je les note dans le grand registre, et je te les rends. Elles sont plus calmes près de leur chasseur."},
                 {'reponse': "Et le Dofus Ocre ?", 'texte': "Otomaï en parle à chaque repas. Il faut toutes les âmes du registre, puis celle du Kralamoure Géant. Celle-là, personne ne l'a encore vue passer."}]}

TITRES = {2: 'Chasseur assidu', 4: 'Traqueur Implacable', nb: 'Moissonneur des Âmes'}   # titles 429, 166, 115
ORNEMENT = {nb: {'id': 57, 'nom': 'Quêteur', 'icone': 2}}
NOMS = ['La liste d\'Otomaï', 'Les petites âmes', 'Le registre s\'épaissit', 'Âmes de caractère', 'Les chasses lointaines', 'Les âmes rebelles', 'La grande moisson']
BULLES = ["Une âme, ça se capture quand la bête tombe, avec une Petite pierre d'âme dans le sac. Ensuite, viens me la montrer.",
          "Le registre a faim. Vingt âmes de plus, et je tourne la page.",
          "Certaines ne se montrent qu'une fois sur cent cinquante. La patience est une arme, elle aussi.",
          "Les boss aussi ont une âme. Petite, souvent. Mais une âme quand même.",
          "Plus on monte, plus elles mordent. Garde des pierres sur toi.",
          "Celles-là se cachent loin des Zaaps. La carte du monde t'indique où il en reste.",
          "Presque tout le registre. Otomaï n'en dort plus, il prépare déjà le Kralamoure."]
for k in [k for k in Q['quetes'] if k.startswith('moisson_')]: del Q['quetes'][k]
avant = None
for i, c in enumerate(chap, 1):
    lvl = max(10, c[0][0]); haut = max(x[0] for x in c); qid = f'moisson_{i}'
    archis = sum(1 for x in c if not x[1]); boss = len(c) - archis
    quoi = f"{archis} archimonstre{'s' * (archis > 1)}" + (f" et {boss} boss de donjon" if boss else '')
    rec = {'xp': round(3 * haut * 50), 'kamas': round(3 * haut * 10), 'pepites': 20 + 5 * i, 'objets': [['9686', 3]], 'sac': 'epique' if i % 2 == 0 else 'rare'}
    if i in TITRES: rec['titre'] = TITRES[i]
    if i in ORNEMENT: rec['ornement'] = ORNEMENT[i]
    Q['quetes'][qid] = {'type': 'secondaire', 'serie': "L'éternelle moisson", 'pnj': 'otomai' if i == 1 else PNJ, 'rendre': PNJ,
      'nom': f"L'éternelle moisson ({i}/{nb}) : {NOMS[min(i, len(NOMS)) - 1]}", 'niveau': lvl, **({'requiert': [avant]} if avant else {}),
      'texte': (f"Otomaï veut le Dofus Ocre, et pour ça il lui faut les âmes de tous les archimonstres du monde. Capture-les avec une Petite pierre d'âme, puis montre-les à son Assistante, au Marché couvert. Cette page du registre : {quoi}."
                if i == 1 else f"Une nouvelle page du registre de l'Assistante d'Otomaï : {quoi}, de niveau {lvl} à {haut}. Le Bestiaire (onglet Archimonstres) et la carte du monde montrent où les trouver."),
      'etapes': [{'nom': f'Page {i} du registre', 'bulle': BULLES[min(i, len(BULLES)) - 1],
                  'objectifs': [{'t': 'ames', 'texte': f'Capturer et montrer {len(c)} âmes ({quoi})', 'monstres': [x[2] for x in c]}]}],
      'recompense': rec, 'merci': "Belle page. Je la recopie au propre, Otomaï ne sait pas lire mon écriture." if i < nb else
        "Tout le registre ! Il ne manque plus que l'âme du Kralamoure Géant. Quand la route vers son antre sera ouverte, Otomaï t'attendra."}
    avant = qid
Q['quetes']['moisson_fin'] = {'type': 'secondaire', 'serie': "L'éternelle moisson", 'pnj': 'otomai', 'rendre': 'otomai', 'bientot': True, 'requiert': [avant],
  'nom': "L'ultime Épreuve", 'niveau': 160,
  'texte': "La dernière âme : celle du Kralamoure Géant. Otomaï la changera en Dofus Ocre. Bientôt : le Kralamoure n'est pas encore dans le jeu.",
  'etapes': [{'nom': "L'âme du Kralamoure", 'objectifs': [{'t': 'parler', 'texte': "Apporter l'Âme du Kralamoure à Otomaï", 'pnj': 'otomai'}]}],
  'recompense': {'xp': 160 * 50 * 6, 'dofus': '7754'}}
json.dump(Q, open(PQ, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(ames), 'âmes,', nb, 'chapitres :', [len(c) for c in chap], [(c[0][0], c[-1][0]) for c in chap])
