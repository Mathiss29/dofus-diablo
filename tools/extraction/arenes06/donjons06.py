# donjons06.py : range les 5 donjons de la 0.6 dans les données du jeu (après export06.py, avant regions_monde.py scinder).
#   src/data/zones.json  : sous-zones officielles des donjons (région de leur entrée, v06), astrub.open.donjonsV06 (arène, vagues,
#                          boss), portes du dehors vers l'arrivée de chaque arène (clé officielle, paillasson).
#   src/data/items.json  : clés officielles (ressources « cle ») ; src/data/boutique.json : vendues par Goultard en kamas, v06.
# Monstres : ceux des sous-zones officielles des donjons (tables subareas), rendus par monster_planche.py (voir LISEZMOI).
# Relançable sans doublon.   Usage : python3 tools/extraction/arenes06/donjons06.py
import json, os
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..')
HERE = os.path.dirname(os.path.abspath(__file__))
PZ, PI, PB, PM = (os.path.join(R, 'src/data', f) for f in ('zones.json', 'items.json', 'boutique.json', 'monsters.json'))
Z, I, B, M = (json.load(open(p, encoding='utf-8')) for p in (PZ, PI, PB, PM))
PTS = json.load(open(os.path.join(HERE, 'arenes06_points.json')))
MONDE = json.load(open(os.path.join(R, 'public/assets/mondes/astrub/monde.json')))

# clé de l'arène -> donjon officiel. Porte : carte du dehors la plus proche de l'entrée officielle
# (Clos des Blops : entrée officielle en [-7,-43], Champs de Cania pas encore exportés -> bord des Pics de Cania ;
#  Dragon Cochon : entrée par les Souterrains des Porcos [5,32], pas encore exportés -> la carte du dehors au-dessus).
DJ = {
    'blops': dict(nom='Clos des Blops', sub=493, niveau=60, region='Cania', porte='-14_-43', cle=('9248', 'Clef du Clos des Blops', 84248, 60, 4500),
                  monstres=['blop_coco', 'blop_indigo', 'blop_griotte', 'blop_reinette', 'gloutoblop', 'blopignon', 'tronkoblop'],
                  boss=['blop_coco_royal', 'blop_indigo_royal', 'blop_reinette_royal', 'blop_griotte_royal']),
    'draeg': dict(nom='Épreuve de Draegnerys', sub=920, niveau=70, region='Amakna', porte='-4_29', cle=('8343', "Clef de l'Épreuve de Draegnerys", 84017, 70, 5500),
                  monstres=['dragoeuf_calcaire', 'dragoeuf_argile', 'dragoeuf_ardoise', 'dragoeuf_charbon', 'dragoeuf_albatre'],
                  boss=['draegnerys', 'dragoeuf_albatre', 'dragoeuf_albatre']),
    'nyee': dict(nom='Antre de la Reine Nyée', sub=844, niveau=90, region='Forêt des Abraknydes', porte='-6_-15', cle=('16179', "Clef de l'Antre de la Reine Nyée", 84744, 90, 7000),
                 monstres=['arapex', 'dardalaine', 'nefileuse', 'saltik', 'gargantul'], boss=['reine_nyee', 'gargantul', 'gargantul']),
    'ancestral': dict(nom='Domaine Ancestral', sub=175, niveau=90, region='Forêt des Abraknydes', porte='-9_-14', cle=('7557', 'Clef du Domaine Ancestral', 84004, 90, 7000),
                      monstres=['abraknyde_sombre', 'abraknyde_venerable', 'abrakne_sombre', 'araknotron'], boss=['abraknyde_ancestral', 'abraknyde_venerable', 'abraknyde_venerable']),
    'labyrinthe': dict(nom='Labyrinthe du Dragon Cochon', sub=154, niveau=100, region='Amakna', porte='5_32', cle=('7511', 'Clef du labyrinthe du Dragon Cochon', 84003, 100, 8000),
                       monstres=['cochon_de_farle', 'porsalu', 'don_duss_ang', 'don_dorgan'], boss=['dragon_cochon', 'don_duss_ang', 'don_dorgan']),
}
TAILLES = [10, 10, 12]   # 3 vagues (comme les donjons de la 0.4), la suivante part quand il en reste 4
ARRIVEE = (0, 330)   # POINTS['arrivee'] d'arenes.py : les positions des mécaniques sont comptées depuis l'arrivée
def depuis_arrivee(l): return [[x - ARRIVEE[0], y - ARRIVEE[1]] for x, y in l]
# 2D : le Blop Royal se choisit à l'entrée (un cercle par Royal) ; ses vagues sont des Blops de sa couleur, son coffre son butin.
# « Les 4 Royaux » : les vagues mêlées, plus nombreuses, les quatre Royaux ensemble, le butin des quatre.
ROYAUX = [('Blop Coco Royal', 'coco', '#eadbb4'), ('Blop Indigo Royal', 'indigo', '#8f7dff'), ('Blop Reinette Royal', 'reinette', '#8fd25a'),
          ('Blop Griotte Royal', 'griotte', '#ff5a6a')]
def choix_blops(d):
    c = [{'nom': nom, 'couleur': coul, 'vagues': vagues([f'blop_{k}'] * 3 + ['gloutoblop', f'blop_{k}', f'blop_{k}', 'blopignon', f'blop_{k}', f'blop_{k}', 'tronkoblop']),
          'bossVague': [f'blop_{k}_royal', f'blop_{k}', f'blop_{k}']} for nom, k, coul in ROYAUX]
    return c + [{'nom': 'Les 4 Royaux', 'couleur': '#f2d36b', 'vagues': vagues(d['monstres'], [12, 12, 14]), 'bossVague': d['boss']}]
# 4C : les quatre œufs-abris (ABRIS d'arenes.py) ; 6B : toiles au sol, 6C : Mitraille de soie (zone C2) ; 8B : Branche Paralysante
MECA = {
    'draeg': {'oeufs': {'pos': depuis_arrivee([(-430, -120), (430, -120), (-300, 220), (300, 220)]),
                        'eclot': ['dragoeuf_calcaire', 'dragoeuf_argile', 'dragoeuf_ardoise', 'dragoeuf_charbon']}},
    'nyee': {'toiles': depuis_arrivee([(-700, -200), (700, -200), (0, -150), (-600, 330), (600, 330), (-170, 40), (170, 40), (-850, 120), (850, 120)]),
             'tisse': 5514},
    'ancestral': {'fixe': True, 'racines': 240},
}


def vagues(l, tailles=TAILLES):
    out = []
    for n in tailles:
        out.append({'m': [l[i % len(l)] for i in range(len(out) * 3, len(out) * 3 + n)]})
    return out


def case_porte(tag):
    """Case marchable la plus proche du milieu de la carte (cases locales 14 x 40)."""
    s = MONDE['movCartes'][tag]; best, bd = None, 9e9
    for c, ch in enumerate(s):
        if ch != '1': continue
        r, k = divmod(c, 14); x, y = k + (r % 2) * 0.5, r / 2
        d = abs(x - 7) + abs(y - 10)
        if d < bd: bd, best = d, c
    return best


S = Z['astrub']['open']['subareas']; dv = []
portes = [p for p in Z['astrub']['open']['portes'] if not str(p['b'][0]).startswith('arene_') or p['b'][0] not in {v['tag'] for v in PTS.values()}]
for k, d in DJ.items():
    for m in d['monstres'] + d['boss']: assert m in M, m
    p = PTS[k]; tag = p['tag']
    S[str(d['sub'])] = {'name': d['nom'], 'level': d['niveau'], 'monsters': [], 'groupsPerMap': 0, 'groupSize': [0, 0], 'v06': True, 'region': d['region']}
    dv.append({'nom': d['nom'], 'salles': {}, 'arene': {kk: v for kk, v in p.items()}, 'vagues': vagues(d['monstres']), 'bossVague': d['boss'],
               **({'choix': choix_blops(d)} if k == 'blops' else {}), **MECA.get(k, {})})
    cid, cnom, icone, niv, prix = d['cle']
    I['resources'][cid] = {'name': cnom, 'icon': icone, 'level': niv, 'cle': d['nom']}
    portes.append({'a': [d['porte'], case_porte(d['porte'])], 'b': [tag, 0], 'nom': d['nom'], 'cle': cid, 'marque': True})
    g = B['goultard']
    if not any(a['id'] == cid for a in g): g.append({'id': cid, 'prix': prix, 'v06': True, 'monnaie': 'kamas'})
Z['astrub']['open']['portes'] = portes
Z['astrub']['open']['donjonsV06'] = dv
open(PZ, 'w', encoding='utf-8').write(json.dumps(Z, ensure_ascii=False, indent=1) + '\n')
json.dump(I, open(PI, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump(B, open(PB, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(dv), 'donjons ;', [(p['nom'], p['a']) for p in portes if p['b'][0] in {v['tag'] for v in PTS.values()}])
