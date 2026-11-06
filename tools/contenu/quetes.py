# quetes.py : écrit src/data/quetes.json (quêtes d'Incarnam et succès officiels).
# Noms des quêtes, PNJ, lieux, objets et succès = données de Dofus 3 (quests / queststeps / questobjectives /
# queststeprewards / achievements). Le déroulé est pensé pour un ARPG temps réel (pas copié des quêtes du jeu).
# XP d'une quête = ratio officiel × niveau × 50 ; kamas = ratio × niveau × 10 ; XP d'un succès = ratio officiel × 500.
import json, os
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'data', 'quetes.json')

PNJ = {
  # carte = tag de public/assets/mondes/incarnam/monde.json (carte officielle de départ de leurs quêtes)
  'ganymede': {'nom': 'Ganymède', 'dofusId': 7581, 'carte': '0_-3'},          # Temple Céleste pas encore exporté : au départ
  'lykhen': {'nom': 'Lykhen Lesurviven', 'dofusId': 2892, 'carte': '-2_-3'},
  'fecaline': {'nom': 'Fécaline la Sage', 'dofusId': 1515, 'carte': 'maison_2_-3'},
  'ternette': {'nom': 'Ternette Nhin', 'dofusId': 2905, 'carte': '-1_-3'},
  'berb_nhin': {'nom': 'Berb Nhin', 'dofusId': 2899, 'carte': '0_-3'},
  'capitaine': {'nom': 'Capitaine des Kerubims', 'dofusId': 2880, 'carte': '2_-3'},   # sa carte (153356294) pas exportée : devant chez Fécaline
  'klasmor': {'nom': 'Klasmor le fossoyeur', 'dofusId': 2907, 'carte': '5_-1'},
  'anta_brok': {'nom': 'Anta Brok', 'dofusId': 2886, 'carte': '1_-2'},
  'marylork': {'nom': 'Marylork', 'dofusId': 2888, 'carte': '3_-5'},
}
SZ = {'route': 450, 'champs': 444, 'paturages': 445, 'lac': 442, 'foret': 443, 'cimetiere': 449, 'mine': 778, 'taverne': 448, 'crypte': 447, 'temple': 446}

def rec(ratio, lvl, kamas=None, objets=None, **k):
    r = {'xp': round(ratio * lvl * 50), 'kamas': round((kamas or ratio) * lvl * 10)}
    if objets: r['objets'] = objets
    r.update(k); return r
def aller(texte, **k): return {'t': 'aller', 'texte': texte, **k}
def vaincre(texte, n, **k): return {'t': 'vaincre', 'texte': texte, 'n': n, **k}
def elite(texte, monstre, carte, **k): return {'t': 'elite', 'texte': texte, 'monstre': monstre, 'carte': carte, 'pv': 1, **k}
def parler(texte, pnj, **k): return {'t': 'parler', 'texte': texte, 'pnj': pnj, **k}

Q = {}
# --- Fil principal (Ganymède -> Lykhen -> Fécaline) ---------------------------------------------------------
Q['reponses'] = {'nom': 'Réponses à tout', 'type': 'tutoriel', 'pnj': 'ganymede', 'niveau': 1, 'auDepart': True, 'suivante': 'village',
  'texte': "Avant de quitter le temple céleste, prenez le temps de contempler les Dofus et le Monde des Douze... et n'oubliez pas de saluer votre dieu au passage ! Ganymède vous apprend à vous battre avant de vous laisser descendre sur l'île.",
  'options': {'passable': True, 'sauterSiCompte': True, 'immortel': True, 'groupes': {'sousZones': [SZ['route']], 'taille': [1, 3]}},
  'etapes': [
    {'nom': 'Premiers pas', 'bulle': "Bienvenue sur Incarnam ! Montre-moi ce que tu sais faire : lance un sort, puis esquive.",
     'objectifs': [{'t': 'utiliser', 'quoi': 'sort', 'texte': 'Lancer un sort'}, {'t': 'utiliser', 'quoi': 'mobilite', 'texte': 'Se déplacer avec Espace'}]},
    {'nom': 'Premières armes', 'bulle': "Les esprits de la Route des âmes t'attendent. Va les remettre à leur place !",
     'objectifs': [vaincre('Vaincre des monstres sur la Route des âmes', 5, sousZone=SZ['route'])]},
  ],
  'recompense': {'xp': 150, 'potions': True}}
Q['village'] = {'nom': 'Le village dans les nuages', 'type': 'principale', 'pnj': 'lykhen', 'niveau': 3, 'suivante': 'espoirs',
  'texte': "Les habitants du village d'Incarnam sont prêts à aider les aventuriers. N'hésitez pas à aller les saluer ! Lykhen Lesurviven vous envoie faire le tour du village avant de rencontrer Fécaline la Sage.",
  'etapes': [
    {'nom': 'Saluer les habitants', 'bulle': "Fais le tour du village : chacun ici a quelque chose à t'apprendre.",
     'objectifs': [aller('Aller voir Ternette Nhin', pnj='ternette'), aller('Aller voir Berb Nhin', pnj='berb_nhin'),
                   aller('Aller voir le Capitaine des Kerubims', pnj='capitaine'), aller('Aller voir Anta Brok', pnj='anta_brok')]},
    {'nom': 'La sage du village', 'objectifs': [parler('Aller voir Fécaline la Sage', 'fecaline')]},
  ],
  'recompense': rec(1.2, 3, objets=[['1984', 5]])}
Q['espoirs'] = {'nom': 'Espoirs et tragédies', 'type': 'principale', 'pnj': 'fecaline', 'niveau': 5, 'suivante': 'milimilou',
  'texte': "Fécaline la Sage semble en connaitre un rayon sur les Dofus : elle vous a conseillé un ouvrage sur le sujet. Les pages de la légende de Rykke Errel se sont envolées dans les Champs, à la merci des esprits qui y rôdent.",
  'etapes': [
    {'nom': 'La légende de Rykke Errel', 'bulle': "Le livre de Rykke Errel ! Ses pages se sont envolées dans les Champs. Ramène-les-moi.",
     'objectifs': [{'t': 'ramasser', 'texte': 'Retrouver les pages de la légende', 'objet': 'Page de la légende de Rykke Errel', 'n': 5, 'chance': 0.35, 'sousZone': SZ['champs']}]},
    {'nom': 'Retour chez Fécaline', 'objectifs': [parler('Retourner voir Fécaline la Sage', 'fecaline')]},
  ],
  'recompense': rec(1.2, 5, objets=[['16515', 5]])}
Q['milimilou'] = {'nom': 'Dans la gueule du Milimilou', 'type': 'principale', 'pnj': 'fecaline', 'niveau': 8, 'suivante': 'astrub',
  'texte': "Pour récupérer les Dofus de Hargnok, vous êtes prêt à tout, y compris à affronter le terrible Milimilou. Waouh. Klasmor le fossoyeur sait où se terre la bête.",
  'etapes': [
    {'nom': 'Le fossoyeur', 'bulle': "Klasmor, au cimetière, sait où se cache le Milimilou. Va le voir.", 'objectifs': [parler('Aller voir Klasmor le fossoyeur', 'klasmor')]},
    {'nom': "L'antre du Milimilou", 'objectifs': [elite('Vaincre le Milimilou', 'milimilou', '3_-1')]},
    {'nom': 'Retour chez Fécaline', 'objectifs': [parler('Retourner voir Fécaline la Sage', 'fecaline')]},
  ],
  'recompense': rec(1.2, 8, objets=[['16526', 1]])}
Q['astrub'] = {'nom': 'Destination Astrub', 'type': 'principale', 'pnj': 'fecaline', 'niveau': 10,
  'texte': "Lorsque l'île d'Incarnam n'aura plus de secrets pour vous, il sera temps de commencer votre long périple vers la gloire, la fortune et les Dofus. Première étape de ce voyage : Astrub, la cité des mercenaires.",
  'etapes': [
    {'nom': 'Prêt pour le grand voyage', 'bulle': "Astrub t'attend, mais pas avant que tu sois prêt. Reviens me voir au niveau 10.",
     'objectifs': [{'t': 'niveau', 'n': 10, 'texte': 'Atteindre le niveau 10'}]},
    {'nom': 'Le portail', 'objectifs': [parler('Retourner voir Fécaline la Sage', 'fecaline')]},
  ],
  'recompense': rec(1.2, 10, objets=[['12660', 1]])}

# --- Milice céleste (Capitaine des Kerubims) : série, rendue au Capitaine ------------------------------------
M = {'type': 'secondaire', 'pnj': 'capitaine', 'rendre': 'capitaine', 'serie': 'Milice céleste'}
Q['epreuve'] = {**M, 'nom': "Mise à l'épreuve", 'niveau': 3, 'requiert': [],
  'texte': "La Caporale Mynerve va vous faire passer un test d'aptitude afin de déterminer si vous êtes digne d'entrer dans la milice céleste.",
  'etapes': [{'nom': "Le test d'aptitude", 'bulle': "La Caporale Mynerve t'attend sur la route. Montre-lui de quoi tu es capable.",
              'objectifs': [elite('Vaincre la Caporale Mynerve', 'caporale_mynerve', '3_-3')]}],
  'recompense': rec(1, 3, objets=[['16518', 5]])}
Q['champs_bataille'] = {**M, 'nom': 'Champs de bataille', 'niveau': 4, 'requiert': ['epreuve'],
  'texte': "Le capitaine vous a confié une tâche simple mais utile : montrer aux esprits rebelles qui peuplent les champs qu'il est temps pour eux de s'incarner. L'utilisation de la violence pour les convaincre est hautement recommandée.",
  'etapes': [{'nom': 'Les esprits des champs', 'bulle': "Les esprits des Champs refusent de s'incarner. Convaincs-les... à ta manière.",
              'objectifs': [vaincre('Vaincre des Tofus Chimériques', 3, monstres=['tofu_chimerique']), vaincre('Vaincre des Pissenlits Miroitants', 3, monstres=['pissenlit_miroitant']),
                            vaincre('Vaincre des Roses Vaporeuses', 3, monstres=['rose_vaporeuse']), vaincre('Vaincre des Tournesols Nébuleux', 3, monstres=['tournesol_nebuleux'])]}],
  'recompense': rec(1, 4, objets=[['16513', 5]])}
Q['gloots'] = {**M, 'nom': "Coups d'épée dans l'eau", 'niveau': 5, 'requiert': ['champs_bataille'],
  'texte': "Le capitaine des Kerubims vous a demandé de mouiller la chemise et de chasser des gloots pour faire un exemple.",
  'etapes': [{'nom': 'Chasse aux gloots', 'bulle': "Les gloots du Lac se croient tout permis. Fais un exemple.",
              'objectifs': [vaincre('Vaincre des Petits Gloots', 5, monstres=['petit_gloot']), vaincre('Vaincre des Plikploks', 5, monstres=['plikplok'])]}],
  'recompense': rec(1, 5, objets=[['16522', 5]])}
Q['bouftous'] = {**M, 'nom': 'Décime-moi des bouftous', 'niveau': 6, 'requiert': ['gloots'],
  'texte': "Votre mission : inciter les esprits des bouftous à abandonner les pâturages célestes pour commencer une nouvelle vie. Avec un peu de chance, si vous parvenez à en faire partir quelques-uns, les autres suivront.",
  'etapes': [{'nom': 'Les pâturages célestes', 'bulle': "Les bouftous des Pâturages doivent partir. Le Bouftor Éthéré mène le troupeau.",
              'objectifs': [vaincre('Vaincre des Bouftons Pâlichons', 3, monstres=['boufton_palichon']), vaincre('Vaincre des Bouftons Orageux', 3, monstres=['boufton_orageux']),
                            vaincre('Vaincre des Bouftous Nuageux', 3, monstres=['bouftou_nuageux']), vaincre('Vaincre un Bouftor Éthéré', 1, monstres=['bouftor_ethere'])]}],
  'recompense': rec(1, 6, objets=[['16511', 5]])}
Q['chapardams'] = {**M, 'nom': 'Chasse aux chapardams', 'niveau': 7, 'requiert': ['bouftous'],
  'texte': "Les esprits félins de la forêt d'Incarnam ont besoin d'être réprimandés, sans quoi ils risquent de dépasser les limites. En tant que suppléant de la milice céleste, vous êtes habilité à leur tirer les oreilles.",
  'etapes': [{'nom': 'Les félins de la forêt', 'bulle': "Les chapardams de la Forêt dépassent les bornes. Tire-leur les oreilles.",
              'objectifs': [vaincre('Vaincre des Ronronchons', 5, monstres=['ronronchon']), vaincre('Vaincre des Tigrimas', 5, monstres=['tigrimas'])]}],
  'recompense': rec(1, 7, objets=[['16515', 5]])}
Q['kruella'] = {**M, 'nom': "Leçon d'humilité", 'niveau': 8, 'requiert': ['chapardams'],
  'texte': "Cette Kruella mérite une bonne correction ! Kruella Freuz terrorise la forêt avec ses invocations.",
  'etapes': [{'nom': 'Kruella Freuz', 'bulle': "Kruella Freuz se cache dans la Forêt. Donne-lui une leçon.",
              'objectifs': [elite('Vaincre Kruella Freuz', 'kruella_freuz', '2_-1')]}],
  'recompense': rec(1, 8, objets=[['16523', 5]])}
Q['chafers'] = {**M, 'nom': 'Des chafers qui marchent', 'niveau': 9, 'requiert': ['kruella'],
  'texte': "Le capitaine vous a chargé de retrouver un sac de bijoux volé par un chafer. Profitez-en pour faire un peu de nettoyage dans le cimetière.",
  'etapes': [
    {'nom': 'Nettoyage au cimetière', 'bulle': "Un chafer a volé un sac de bijoux. Nettoie le Cimetière et trouve le voleur.",
     'objectifs': [vaincre('Vaincre des Chafers Débutants', 3, monstres=['chafer_debutant']), vaincre('Vaincre des Chafers Furtifs', 3, monstres=['chafer_furtif']),
                   vaincre('Vaincre des Chafers Éclaireurs', 3, monstres=['chafer_eclaireur']), vaincre('Vaincre des Chafers Piquiers', 3, monstres=['chafer_piquier'])]},
    {'nom': 'Le tombeau de Percy Klop', 'objectifs': [elite('Vaincre Percy Klop', 'percy_klop', '4_0'),
     {'t': 'ramasser', 'texte': 'Reprendre le Sac de Bijoux', 'objet': 'Sac de Bijoux', 'n': 1, 'chance': 1, 'monstres': ['percy_klop']}]},
  ],
  'recompense': rec(1, 9, objets=[['310', 5]])}

# --- Exploration (Ternette Nhin) : série, rendue à Ternette ------------------------------------------------
E = {'type': 'secondaire', 'pnj': 'ternette', 'rendre': 'ternette', 'serie': 'Exploration'}
Q['transport'] = {**E, 'nom': 'Transport peu commun', 'niveau': 3,
  'texte': "Pour en apprendre un peu plus sur la nature des zaaps, ces étranges portes magiques, Ternette Nhin vous envoie examiner le zaap des pâturages.",
  'etapes': [{'nom': 'Le zaap des pâturages', 'bulle': "Le zaap des Pâturages renferme bien des mystères. Va voir de plus près.",
              'objectifs': [aller('Se rendre aux Pâturages', sousZone=SZ['paturages']), vaincre('Vaincre des monstres des Pâturages', 6, sousZone=SZ['paturages'])]}],
  'recompense': rec(1, 3, kamas=2, objets=[['16513', 5]])}
Q['vestiges'] = {**E, 'nom': 'Des vestiges de légende', 'niveau': 5, 'requiert': ['transport'],
  'texte': "Les dieux ont parfois tendance à laisser traîner leurs affaires sur Incarnam. Sans doute est-ce pour marquer les esprits et attiser la ferveur de leurs disciples. Ou peut-être sont-ils simplement distraits, allez savoir.",
  'etapes': [{'nom': 'Les stèles', 'bulle': "Cinq vestiges sont éparpillés sur l'île. Va tous les voir.",
              'objectifs': [aller("Examiner la stèle d'un vestige sur la route des âmes", sousZone=SZ['route']), aller("Examiner la stèle d'un vestige dans les champs", sousZone=SZ['champs']),
                            aller("Examiner la stèle d'un vestige près du lac", sousZone=SZ['lac']), aller("Examiner la stèle d'un vestige dans les pâturages", sousZone=SZ['paturages']),
                            aller("Examiner la stèle d'un vestige dans la forêt", sousZone=SZ['foret'])]}],
  'recompense': rec(1, 5, objets=[['385', 5]])}
Q['vu_du_ciel'] = {**E, 'nom': 'Vu du ciel', 'niveau': 6, 'requiert': ['vestiges'],
  'texte': "Vous êtes du genre à prendre les choses de haut ? Jetez donc un coup d'œil aux longues-vues installées sur les bords de l'île céleste, vous ne serez pas déçu.",
  'etapes': [{'nom': "Les bords de l'île", 'bulle': "Les longues-vues sont au bord de l'île, aux deux bouts. Admire la vue !",
              'objectifs': [aller('Utiliser la longue-vue de Matu Vuh', carte='-3_-6'), aller('Utiliser la longue-vue de Galilea', carte='5_0')]}],
  'recompense': rec(1, 6, objets=[['16515', 5]])}

# --- Quêtes seules (validées sur place) -------------------------------------------------------------------
Q['mort_au_rat'] = {'nom': 'Mort au rat !', 'type': 'secondaire', 'zone': SZ['taverne'], 'niveau': 7,
  'texte': "Le tavernier semble avoir un hôte indésirable dans sa cave. Expulsez le rat pour toucher votre récompense.",
  'etapes': [{'nom': 'Le rat de la cave', 'objectifs': [elite('Vaincre le Rat Soiffé', 'rat_soiffe', 'taverne')]}],
  'recompense': rec(1, 7, objets=[['519', 2], ['16513', 2]])}
Q['cryptologie'] = {'nom': 'Cryptologie', 'type': 'secondaire', 'pnj': 'klasmor', 'niveau': 10,
  'texte': "Kardorim sera probablement très mécontent de vous voir vous promener dans sa crypte... raison de plus pour le réduire au silence, lui et sa bande de chafers.",
  'etapes': [{'nom': 'Salle du tombeau de Kardorim', 'bulle': "Kardorim dort sous le cimetière. Réduis-le au silence, lui et ses chafers.",
              'objectifs': [aller('Découvrir la salle du tombeau de Kardorim', carte='crypte_5'), vaincre('Vaincre Kardorim', 1, monstres=['kardorim'])]}],
  'recompense': rec(1, 10, objets=[['16524', 5]])}

# --- Succès officiels (achievements) ----------------------------------------------------------------------
def suc(nom, did, desc, cat, sous, pts, icone, obj, ratio=0, objet=None):
    s = {'nom': nom, 'dofusId': did, 'description': desc, 'categorie': cat, 'sousCategorie': sous, 'points': pts, 'icone': icone, 'objectifs': obj}
    r = {}
    if ratio: r['xp'] = round(ratio * 500)
    if objet: r['objet'] = objet
    if r: s['recompense'] = r
    return s
S = {
  'premier_temps': suc('Premier temps', 8518, 'Terminer la première partie du tutoriel.', 'Quêtes', 'Général', 1, 203,
     [{'nom': 'Premiers pas', 'etape': ['reponses', 0]}, {'nom': 'Premières armes', 'etape': ['reponses', 1]}, {'nom': 'Première partie du tutoriel', 'quete': 'reponses'}], 0.213),
  'second_temps': suc('Second temps', 8519, 'Terminer la seconde partie du tutoriel.', 'Quêtes', 'Général', 1, 203, [{'nom': 'Seconde partie du tutoriel', 'quete': 'village'}], 0.213),
  'bonnes_bases': suc('Sur de bonnes bases', 8520, 'Terminer les succès du tutoriel.', 'Quêtes', 'Général', 3, 273,
     [{'nom': 'Premier temps', 'succes': 'premier_temps'}, {'nom': 'Second temps', 'succes': 'second_temps'}], 0.287, '10207'),
  'debutant': suc('Débutant', 3, 'Atteindre le niveau 10.', 'Général', 'Général', 1, 58, [{'nom': 'Niveau 10', 'niveau': 10}]),
  'crypte': suc('Crypte de Kardorim', 33, 'Vaincre Kardorim dans son donjon.', 'Donjons', 'Niveaux 1 à 50', 10, 299,
     [{'nom': 'Kardorim', 'monstre': 'kardorim'}, {'nom': 'Niveau 10', 'niveau': 10}], 1, '16525'),
}
EXPLO = [('lac', 414, 'Lac', 'lac', 0.1), ('champs', 415, 'Champs', 'champs', 0.1), ('cimetiere', 416, 'Cimetière', 'cimetiere', 0.1), ('foret', 417, 'Forêt', 'foret', 0.1),
         ('mine', 419, 'Mine', 'mine', 0.1), ('paturages', 420, 'Pâturages', 'paturages', 0.1), ('route', 422, 'Route des âmes', 'route', 0.05),
         ('taverne', 423, 'Taverne', 'taverne', 0.1), ('temple', 424, 'Temple Céleste', 'temple', 0.05)]
for k, did, nom, sz, ratio in EXPLO:
    S['zone_' + k] = suc(nom, did, f'Découvrir la zone "{nom}".', 'Exploration', 'Incarnam', 1, 176, [{'nom': nom, 'sousZone': SZ[sz]}], ratio)
S['dans_les_nuages'] = suc('Dans les nuages', 840, 'Obtenir les Succès suivants.', 'Exploration', 'Incarnam', 10, 82,
    [{'nom': nom, 'succes': 'zone_' + k} for k, _, nom, _, _ in EXPLO], 1)

json.dump({'pnj': PNJ, 'quetes': Q, 'succes': S}, open(OUT, 'w'), ensure_ascii=False, indent=1)
print(len(Q), 'quêtes', len(S), 'succès')
