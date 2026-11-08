# ateliers_sorties.py : écarte des sorties les machines d'atelier posées collées au paillasson (Mathis, 2026-11-08 :
# « ne pas mettre d'atelier collé à la sortie »). Dans les cartes officielles, deux salles d'Astrub ont une machine
# juste à côté de la case de sortie : on déplace son dessin (décor de monde.json), ses cases bloquées (mov) et son poste
# (zones.json, open.ateliers[].postes). tests/ateliers-sorties.test.ts vérifie la règle pour tous les ateliers.
#
# À relancer après tools/extraction/world_export.py (décor) ou tools/contenu/ateliers_postes.py (postes) : ils remettent
# les machines à leur place officielle. Le script ne fait rien sur ce qui est déjà déplacé.
#   python3 tools/contenu/ateliers_sorties.py
import json, os

R = os.path.join(os.path.dirname(__file__), '..', '..')
ZONES = os.path.join(R, 'src', 'data', 'zones.json')

# monde, carte, déplacement (lignes, colonnes de cases Dofus ; lignes en nombre pair : même décalage de colonne),
# dessins du décor à déplacer (image, case de profondeur officielle, ordre), cases bloquées par la machine, postes.
DEPLACEMENTS = [
    # Atelier des mineurs et des forgerons : le concasseur, à gauche du paillasson, recule de deux cases le long du mur.
    ('astrub', 'atelier_mineurs', (-2, -1), [('d68', 331359, 0)], [483], [483]),
    # Atelier des bijoutiers : les deux établis et leurs tabourets, au-dessus du paillasson, remontent au bord du tapis.
    ('astrub', 'atelier_bijoutiers', (-4, 0),
     [('d58', 471245, 0), ('d59', 471497, 0), ('d61', 471749, 0), ('d62', 471749, 1),
      ('d64', 472001, 0), ('d65', 472001, 1), ('d57', 472002, 0)],
     [426, 439, 440, 453, 454, 467], [453, 467]),
]

z = json.load(open(ZONES, encoding='utf-8'))
mondes = {}
for monde, tag, (dr, dk), dessins, bloquees, postes in DEPLACEMENTS:
    assert dr % 2 == 0, 'un nombre pair de lignes garde le même décalage de colonne'
    if monde not in mondes:
        mondes[monde] = json.load(open(os.path.join(R, 'public', 'assets', 'mondes', monde, 'monde.json')))
    M = mondes[monde]
    cols, (X0, Y0) = M['grid']['cols'], M['origin']
    m = next(x for x in M['maps'] if x['tag'] == tag)
    loc = lambda c: c + dr * 14 + dk                                    # case de la carte (0-559) après déplacement
    big = lambda c: ((m['y'] - Y0) * 40 + c // 14) * cols + (m['x'] - X0) * 14 + c % 14
    fait = 0
    for f, c, o in dessins:
        p = next((p for p in m['decor'] if p['f'] == f and p['c'] == c and p['o'] == o), None)
        if not p: continue                                              # déjà déplacé
        p['x'] += dk * 86; p['y'] += dr * 21.5; p['c'] += dr * cols + dk
        fait += 1
    if fait:
        mov = list(M['mov'])
        for c in bloquees: mov[big(c)] = '1'
        for c in bloquees:
            assert mov[big(loc(c))] == '1', f'{tag} : la case {loc(c)} n’est pas libre'
            mov[big(loc(c))] = '0'
        M['mov'] = ''.join(mov)
    for a in z[monde]['open']['ateliers']:
        for po in a.get('postes', []):
            if po[0] == tag and po[1] in postes: po[1] = loc(po[1])
    print(tag, f'{fait} dessins déplacés' if fait else 'déjà fait')

for monde, M in mondes.items():
    json.dump(M, open(os.path.join(R, 'public', 'assets', 'mondes', monde, 'monde.json'), 'w'), separators=(',', ':'))
json.dump(z, open(ZONES, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
