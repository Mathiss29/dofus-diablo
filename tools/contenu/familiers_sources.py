"""D'où viennent les familiers (maquette « Revoir l'obtention des familiers », ligne de Mathis du 2026-11-12 :
« Familiers : 1A+1B+1C+1D 2D 3A 4A+4C 5A+5C+5D 6A+6B+6C 7A 8A »).

Écrit src/data/familiers_sources.json :
- familles (1A, 1C) : familier -> monstres de sa famille qui le lâchent (tirage pur, 2D : taux de butin.json). Les boss du monde de la 0.5
  passent par ici aussi (leur victoire tire le butin du boss) ; les archimonstres de la famille comptent.
- invasion (1C) : familiers du coffre d'invasion.
- animalerie (1B, 4A) : familiers domestiques, toujours en vente au Marché, en kamas (150 000 à 400 000 selon leurs bonus).
- depart (4C) : familier offert au niveau 10, au choix.
- succes (1D, 6C) : succès de la Ménagerie (5, 15, 30, 50 familiers), dont les familiers officiels de succès et de quêtes.
- avenir (8A) : les autres, « arrivent avec leur zone ».

Lancer : python3 tools/contenu/familiers_sources.py
"""
import json, os

R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
F = json.load(open(os.path.join(R, 'src/data/familiers.json'), encoding='utf-8'))['familiers']
M = json.load(open(os.path.join(R, 'src/data/monsters.json'), encoding='utf-8'))

FAMILLES = {
    7713: ['piou_violet'], 7708: ['piou_bleu'], 7709: ['piou_jaune'], 7710: ['piou_rose'], 7711: ['piou_rouge'], 7712: ['piou_vert'],
    12177: ['tofu_chimerique', 'tofu_malade'],
    27431: ['bouftou_nuageux', 'bouftor_ethere', 'boufton_palichon', 'boufton_orageux'],
    7518: ['kardorim'],
    10865: ['tofu_amakna', 'tofu_noir', 'tofukaz', 'tofu_mutant', 'tofu_agressif', 'tofu_noir_agressif', 'tofu_malefique', 'batofu'],
    11858: ['tofu_ventripotent'],
    12988: ['scarafeuille_rouge', 'scarafeuille_bleu', 'scarafeuille_vert', 'scarafeuille_blanc', 'scarafeuille_noir', 'scarafeuille_immature'],
    8154: ['scarabosse_dore'],
    14433: ['moskito'],
    12982: ['scelerat_strubien', 'milirat_strubien', 'rat_soiffe', 'campagnoll'],
    7707: ['sanglier', 'sanglier_des_plaines', 'cavalier_porkass', 'berger_porkass'],
    7704: ['ecurouille'],
    8000: ['bwork', 'bwork_mage', 'bwork_archer', 'bworkette'],
    7524: ['tigrimas'], 9617: ['ronronchon'],
    7519: ['dragoeuf_calcaire', 'dragoeuf_argile'], 9624: ['dragoeuf_ardoise', 'dragoeuf_charbon'],
    10802: ['dragoeuf_calcaire', 'dragoeuf_argile', 'dragoeuf_ardoise', 'dragoeuf_charbon'],
    1748: ['wabbit', 'black_wabbit', 'wo_wabbit', 'grand_pa_wabbit', 'wabbit_squelette', 'black_wabbit_squelette'],
    9619: ['tiwabbit_kiafin', 'tiwabbit'], 15133: ['black_tiwabbit'],
    13673: ['kokoko'],
    13679: ['tortue_rouge', 'tortue_bleue', 'tortue_verte', 'tortue_jaune', 'kanniboul_ark', 'kanniboul_eth', 'kanniboul_jav', 'kanniboul_sarbak', 'kanniboul_tam', 'kanniboul_ebil'],
    8693: ['feu_vif', 'feu_de_joie', 'feu_furieux', 'feu_follet'],
    13099: ['pichon_orange', 'pichon_bleu', 'pichon_blanc', 'pichon_vert', 'pichon_kloune'],
    # boss (1C) : boss du monde de la 0.5 et boss de donjon
    9623: ['chef_crocodaille'], 10106: ['maitre_vampire'], 10107: ['maitre_vampire'], 8151: ['chef_de_guerre_bouftou'],
    10544: ['gelee_royale_bleuet', 'gelee_royale_menthe', 'gelee_royale_fraise', 'gelee_royale_citron'], 7891: ['wa_wabbit'],
}
INVASION = [11777]
ANIMALERIE = [1728, 6718, 7414, 11012, 6717, 7415, 2074, 2075, 2076, 2077, 6978, 7520, 7706, 7714, 12009, 8211, 8677]
DEPART = [1728, 11012, 2074, 2075, 2076, 2077]
# 6C : succès de la Ménagerie ; 1D : Molosk (succès officiel), Nomoon et Chachyène (quêtes officielles) en récompense
SUCCES = [(5, 'Petite ménagerie', 'Dresseur', None), (15, 'Ménagerie', None, 19531), (30, 'Grande ménagerie', None, 6716),
          (50, 'Arche des Douze', 'Gardien de l\'Arche', 15110)]
# 8A : zones à venir (les autres : « avec une zone à venir »)
AVENIR = {7522: 'Labyrinthe du Minotoror', 9620: 'Labyrinthe du Minotoror', 7911: 'Koalaks', 8561: 'Pandala',
          11783: 'Frigost', 11771: 'Frigost', 10985: 'Frigost', 12975: 'Frigost', 11950: 'Frigost', 9785: 'Enfers'}

for p, l in FAMILLES.items():
    assert str(p) in F, p
    for m in l: assert m in M, (p, m)
familles = {}
for p, l in FAMILLES.items():
    ms = []
    for m in l:
        ms.append(m)
        if f'archi_{m}' in M: ms.append(f'archi_{m}')
    familles[str(p)] = ms


def prix(p):   # 1B : 150 000 à 400 000 kamas selon le nombre de bonus
    n = len(F[str(p)].get('stats', []))
    return [150000, 250000, 400000][min(2, n)]


animalerie = {str(p): prix(p) for p in ANIMALERIE}
succes = {}
for n, nom, titre, objet in SUCCES:
    rec = {'xp': 500 * n}
    if titre: rec['titre'] = titre
    if objet: rec['objet'] = str(objet)
    succes[f'menagerie_{n}'] = {'nom': nom, 'dofusId': 0, 'description': f'Avoir {n} familiers dans sa Ménagerie.', 'categorie': 'Général',
                                'sousCategorie': 'Ménagerie', 'points': 10 if n < 30 else 20, 'icone': 82,
                                'objectifs': [{'nom': f'{n} familiers', 'familiers': n}], 'recompense': rec}
pris = set(familles) | {str(p) for p in INVASION} | set(animalerie) | {str(o) for *_, o in SUCCES if o} | {'1711'}
avenir = {k: AVENIR.get(int(k), '') for k, v in F.items() if not v.get('apparat') and k not in pris}
out = {'_': __doc__.split('\n\n')[0].strip() + ' Écrit par tools/contenu/familiers_sources.py.',
       'familles': familles, 'invasion': [str(p) for p in INVASION], 'chances': {'invasion': 40}, 'animalerie': animalerie,
       'depart': {'niveau': 10, 'familiers': [str(p) for p in DEPART]}, 'repasDouble': 10, 'succes': succes, 'avenir': avenir}
open(os.path.join(R, 'src/data/familiers_sources.json'), 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, indent=1) + '\n')
print(len(familles), 'par famille,', len(animalerie), 'à l\'Animalerie,', len(avenir), 'à venir')
