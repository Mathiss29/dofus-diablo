# donjons07.py : range les 7 donjons de la 0.7 (ligne « 0.7 : » 4A-4G, 5A-5D, 27 nov. 2026) dans les données du jeu
# (après export07.py, avant regions_monde.py scinder). Comme arenes06/donjons06.py :
#   src/data/zones.json  : sous-zones officielles des donjons (v07), astrub.open.donjonsV07 (arène, vagues, boss, mécaniques),
#                          portes du dehors vers l'arrivée de chaque arène (clé officielle, paillasson).
#   src/data/items.json  : clés officielles ; src/data/boutique.json : vendues par Goultard en kamas, v07.
# Koulosse (5A) : trois arènes, une par étage ; `etages` = points des étages 2 et 3 (une vague par étage, le boss au fond).
# Relançable sans doublon.   Usage : python3 tools/extraction/arenes07/donjons07.py
import json, os
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..')
HERE = os.path.dirname(os.path.abspath(__file__))
PZ, PI, PB, PM = (os.path.join(R, 'src/data', f) for f in ('zones.json', 'items.json', 'boutique.json', 'monsters.json'))
Z, I, B, M = (json.load(open(p, encoding='utf-8')) for p in (PZ, PI, PB, PM))
PTS = json.load(open(os.path.join(HERE, 'arenes07_points.json')))
MONDE = json.load(open(os.path.join(R, 'public/assets/mondes/astrub/monde.json')))

# arène -> donjon officiel (table dungeons : 30, 3, 41, 125, 46, 49, 54). Porte : carte du dehors de l'entrée officielle
# (Blop Multicolore : entrée officielle [-7,-43] dans les Champs de Cania, pas exportés -> à côté du Clos des Blops).
DJ = {
    'koulosse_1': dict(nom='Caverne du Koulosse', sub=808, niveau=100, region='Montagne des Koalaks', porte='-17_8',
                       cle=('7908', 'Clef de la Caverne du Koulosse', 84005, 100, 9000),
                       monstres=['bouftou_des_cavernes', 'boufcoul'], boss=['koulosse', 'boufcoul', 'boufcoul'],
                       etages=['koulosse_2', 'koulosse_3']),
    'corbac': dict(nom='Bibliothèque du Maître Corbac', sub=211, niveau=110, region='Cania', porte='-15_-62',
                   cle=('7926', 'Clef de la Bibliothèque du Maître Corbac', 84008, 110, 10000),
                   monstres=['buveur_de_sang', 'corbac_chef', 'corbac_dresse', 'capsaaloocke'],
                   boss=['maitre_corbac', 'rono_le_renarbo', 'horace_le_corbac_apprivoise', 'kapotie_le_buveur']),
    'rasboul': dict(nom='Goulet du Rasboul', sub=470, niveau=110, region="Île d'Otomaï", porte='-51_9',
                    cle=('8972', 'Clef du Goulet du Rasboul', 84243, 110, 10000),
                    monstres=['bitouf_des_plaines', 'craqueleur_poli', 'craqueboule_poli', 'mufafah', 'kido', 'kilibriss'],
                    boss=['silf_le_rasboul_majeur', 'kilibriss', 'kido']),
    'damadrya': dict(nom='Bambusaie de Damadrya', sub=946, niveau=110, region='Île de Pandala', porte='26_-30',
                     cle=('12735', 'Clef de la Bambusaie de Damadrya', 84783, 110, 10000),
                     monstres=['bambouto', 'floristile', 'bulbuisson', 'bulbiflore', 'grenufar'], boss=['damadrya', 'bulbiflore', 'bulbuisson']),
    'skeunk': dict(nom='Repaire de Skeunk', sub=254, niveau=120, region='Montagne des Koalaks', porte='-20_10',
                   cle=('8073', 'Clef du Repaire de Skeunk', 84011, 120, 11000),
                   monstres=['koalak_sanguin', 'warko_violet', 'guerrier_koalak', 'koalak_farouche', 'fauchalak', 'poupee_emeraude', 'poupee_affamee'],
                   boss=['skeunk', 'poupee_affamee', 'poupee_emeraude']),
    'blop': dict(nom='Antre du Blop Multicolore Royal', sub=796, niveau=120, region='Cania', porte='-14_-43',
                 cle=('9254', "Clef de l'antre du Blop Multicolore", 84253, 120, 11000),
                 monstres=['blopignon', 'tronkoblop', 'blop_coco_royal', 'blop_griotte_royal', 'blop_indigo_royal', 'blop_reinette_royal'],
                 boss=['blop_multicolore_royal', 'tronkoblop', 'blopignon']),
    'royalmouth': dict(nom='Serre du Royalmouth', sub=617, niveau=120, region='Frigost', porte='-84_-49',
                       cle=('11174', 'Clef de la serre du Royalmouth', 84257, 120, 11000),
                       monstres=['boufmouth', 'boufmouth_de_guerre', 'bouftonmouth'], boss=['royalmouth', 'boufmouth_de_guerre', 'boufmouth_de_guerre']),
}
TAILLES = [12, 12, 14]   # 3 vagues (la suivante part quand il en reste 4) ; un peu plus que la 0.6 (90-100)
# 5B-5D : mécaniques (src/sim/arene07.ts)
MECA = {'corbac': {'grimoires': 3}, 'blop': {'couleurs': True}, 'skeunk': {'voleur': True}}


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
        d = abs(x - 7) + abs(y - 10) + (abs(x - 4) if tag == '-14_-43' else 0)   # Blop Multicolore : à gauche de la porte du Clos
        if d < bd: bd, best = d, c
    return best


S = Z['astrub']['open']['subareas']; dv = []
tags = {v['tag'] for v in PTS.values()}
portes = [p for p in Z['astrub']['open']['portes'] if p['b'][0] not in tags]
for k, d in DJ.items():
    for m in d['monstres'] + d['boss']: assert m in M, m
    p = PTS[k]; tag = p['tag']
    S[str(d['sub'])] = {'name': d['nom'], 'level': d['niveau'], 'monsters': [], 'groupsPerMap': 0, 'groupSize': [0, 0], 'v07': True, 'region': d['region']}
    dd = {'nom': d['nom'], 'salles': {}, 'arene': dict(p), 'vagues': vagues(d['monstres']), 'bossVague': d['boss'], **MECA.get(k, {})}
    if d.get('etages'): dd['etages'] = [dict(PTS[e]) for e in d['etages']]
    dv.append(dd)
    cid, cnom, icone, niv, prix = d['cle']
    I['resources'][cid] = {'name': cnom, 'icon': icone, 'level': niv, 'cle': d['nom']}
    portes.append({'a': [d['porte'], case_porte(d['porte'])], 'b': [tag, 0], 'nom': d['nom'], 'cle': cid, 'marque': True})
    g = B['goultard']
    if not any(a['id'] == cid for a in g): g.append({'id': cid, 'prix': prix, 'v07': True, 'monnaie': 'kamas'})
Z['astrub']['open']['portes'] = portes
Z['astrub']['open']['donjonsV07'] = dv
open(PZ, 'w', encoding='utf-8').write(json.dumps(Z, ensure_ascii=False, indent=1) + '\n')
open(PI, 'w', encoding='utf-8').write(json.dumps(I, ensure_ascii=False, indent=1) + '\n')
json.dump(B, open(PB, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(dv), 'donjons ;', [(p['nom'], p['a']) for p in portes if p['b'][0] in tags])
