# quetes.py : écrit src/data/quetes.json (quêtes d'Incarnam et succès officiels).
# Noms des quêtes, PNJ, lieux, objets et succès = données de Dofus 3 (quests / queststeps / questobjectives /
# queststeprewards / achievements). Le déroulé est pensé pour un ARPG temps réel (pas copié des quêtes du jeu).
# XP d'une quête = ratio officiel × niveau × 50 ; kamas = ratio × niveau × 10 ; XP d'un succès = ratio officiel × 500.
import json, os
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'data', 'quetes.json')

EMP_CASE = 300
# Cases des PNJ au Bastion des Douze (posées par tools/extraction/bastion.py)
BASTION = json.load(open(os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'data', 'zones.json'), encoding='utf-8'))['bastion']['open']['bastion']['pnj']
PNJ = {
  # phrase = ce qu'il dit quand on lui parle sans quête (écrite pour l'ARPG, maquette Dialogues 10A)
  # carte = tag de public/assets/mondes/incarnam/monde.json (carte officielle de départ de leurs quêtes)
  'ganymede': {'nom': 'Ganymède', 'dofusId': 7581, 'carte': 'temple_1', 'case': 174, 'phrase': 'Les Dofus dorment ici depuis des siècles. Avant de partir les chercher, apprends à te battre.'},       # Temple Céleste, devant les Dofus (accueil du tutoriel)
  'ganymede_temple': {'nom': 'Ganymède', 'dofusId': 7581, 'carte': 'temple_2', 'sprite': 'ganymede', 'phrase': "Des esprits de feu se sont glissés dans le Temple. Bon entraînement avant de descendre sur l'île."},    # le même, qui entraîne le joueur dans la salle suivante
  'lykhen': {'nom': 'Lykhen Lesurviven', 'dofusId': 2892, 'carte': '-2_-3', 'phrase': "Bienvenue au village d'Incarnam. Chacun ici a quelque chose à t'apprendre.",
    # garde-robe du village (maquette Apparence 6B : gratuite, dans les villes)
    'services': [{'texte': 'Changer de tête ou de couleurs (garde-robe).', 'service': 'garde-robe'}]},
  'fecaline': {'nom': 'Fécaline la Sage', 'dofusId': 1515, 'carte': 'maison_2_-3', 'phrase': "Les Dofus ne sont pas des légendes. J'ai passé ma vie à suivre leur trace."},
  'ternette': {'nom': 'Ternette Nhin', 'dofusId': 2905, 'carte': '-1_-3', 'phrase': 'Zaaps, nuages, vestiges des dieux : Incarnam est pleine de secrets pour qui sait regarder.'},
  'berb_nhin': {'nom': 'Berb Nhin', 'dofusId': 2899, 'carte': '0_-3', 'phrase': 'Un bon artisan fait un bon aventurier. Reviens me voir quand tu voudras apprendre un métier.'},
  'capitaine': {'nom': 'Capitaine des Kerubims', 'dofusId': 2880, 'carte': 'milice_rdc', 'case': 370, 'phrase': "La Milice garde Incarnam. Si ta lame est solide, j'ai du travail pour toi."},   # sa carte officielle 153356294 : rez-de-chaussée de la Tour de la Milice
  # Klasmor garde aussi l'entrée de la Crypte (maquette Gardiens 4A ; dans Dofus 3, c'est lui qui demande la clé). Chez nous, pas de clé.
  'klasmor': {'nom': 'Klasmor le fossoyeur', 'dofusId': 2907, 'carte': '5_-1', 'case': 358,
    'phrase': "Kardorim dort là-dessous. Enfin, il ne dort pas vraiment. Il attend. Et il n'aime pas qu'on le réveille, alors vas-y doucement.",
    'discussion': [{'reponse': 'Il faut une clé ?', 'texte': "Pas ici. La crypte est ouverte à tous : on n'a jamais eu besoin de serrure pour garder les vivants dehors."}],
    'gardien': {'donjon': 'Crypte de Kardorim', 'approche': 'Psst. La crypte, c\'est par ici. Si tu y tiens.',
      'victoire': "Kardorim, à terre ? Je vais devoir creuser un trou de plus. Ça ne me dérange pas : c'est mon métier.",
      'mort': "Remonté tout seul ? Tu as de la chance. D'habitude, c'est moi qui remonte les gens. Avec une pelle."}},
  'anta_brok': {'nom': 'Anta Brok', 'dofusId': 2886, 'carte': '1_-2', 'case': 389, 'phrase': 'Les esprits des Champs sont nerveux ces temps-ci. Garde ton arme à portée de main.'},
  'marylork': {'nom': 'Marylork', 'dofusId': 2888, 'carte': '3_-5', 'phrase': "D'ici, on voit toute l'île. Le vent porte loin, au-dessus des nuages."},
  # Astrub (0.2b) : Emp, le Méryde du Recyclage, à côté du Zaap d'Astrub (maquette 0.2, 7A). Phrase, discussion et adieu = textes
  # officiels du PNJ 1640 (dialogMessages / dialogReplies) ; services = fenêtre Recycler / Boutique de l'affichage.
  # Gardiens des donjons d'Astrub (maquette Gardiens, 2026-11-06 : 1A 2A 3A) : PNJ officiels de ces donjons dans Dofus 3
  # (Mawy Ingalsse ouvre « sa » grange, Capitaine Igloute a affronté Mob l'Éponge, Rotabla pleure ses Bouftous), répliques inédites.
  # Sans case : ils se postent à quelques pas de la porte d'entrée (Quetes.posteDeGarde).
  'mawy': {'nom': 'Mawy Ingalsse', 'dofusId': 780, 'zone': 'astrub', 'carte': '7_-24',
    'phrase': "C'est ma grange ! Enfin, c'était. Maintenant c'est la grange d'un tournesol qui mange tout ce qui bouge. Tu as une clé ? Moi je reste dehors.",
    'discussion': [{'reponse': 'Pourquoi tu ne la reprends pas toi-même ?', 'texte': "Mon oncle a combattu des Wabbits géants. Moi, j'ai hérité de sa moustache, pas de son courage. Heureusement, la moustache, je ne l'ai pas gardée."}],
    'gardien': {'donjon': 'Grange du Tournesol Affamé', 'approche': "Hé ! Tu n'aurais pas une Clef des Champs ?",
      'victoire': "Il est tombé ? Le tournesol ? Je vais enfin pouvoir ranger mon foin ! Bon, je vais d'abord compter les poules.",
      'mort': "Il t'a recraché ? C'est bon signe : il ne t'a pas trouvé à son goût. Retente ta chance.",
      'sansCle': "Sans Clef des Champs, la porte ne bouge pas. {vendeur} en vend."}},
  'igloute': {'nom': 'Capitaine Igloute', 'dofusId': 798, 'zone': 'astrub', 'carte': '13_-28',
    'phrase': "Mob l'Éponge ? Je l'ai déjà battu. Deux fois. Enfin, une fois et demie. La demie, c'est quand il m'a absorbé.",
    'discussion': [{'reponse': 'Tu viens avec moi ?', 'texte': "J'ai encore du sable dans des endroits que je ne te décrirai pas. Vas-y, toi. Je surveille la marée."}],
    'gardien': {'donjon': 'Château Ensablé', 'approche': 'Moussaillon ! Le château, c\'est par là. Attention à la marée.',
      'victoire': "Essoré, le Mob ? Bravo, moussaillon. Je note dans mon journal de bord que je t'ai beaucoup aidé.",
      'mort': "Absorbé, toi aussi ? On en ressort tout fripé, je sais. Bois un coup d'eau douce et retournes-y.",
      'sansCle': "Pas de Clef du Château Ensablé, pas de château. {vendeur} en vend."}},
  'rotabla': {'nom': 'Rotabla le berger', 'dofusId': 173, 'zone': 'astrub', 'carte': '2_-34',
    'phrase': "Mes Bouftous étaient si doux… Et puis un jour, le plus gros s'est mis une couronne sur la tête. Depuis, ils ne m'obéissent plus qu'à lui.",
    'discussion': [{'reponse': 'Je dois tous les battre ?', 'texte': "Seulement le Royal. Les autres suivront. Les Bouftous, ça suit toujours quelqu'un. C'est bien le problème."}],
    'gardien': {'donjon': 'Cour du Bouftou Royal', 'approche': 'Tu n\'aurais pas vu passer un Bouftou avec une couronne ?',
      'victoire': "Le Royal est tombé ? Mes Bouftous vont redevenir gentils. Enfin, un peu. Enfin, j'espère.",
      'mort': "Piétiné ? Ça arrive. Le Royal pèse plus lourd qu'il n'en a l'air, et il en a déjà l'air.",
      'sansCle': "La Cour ne s'ouvre qu'avec sa clé. {vendeur} en vend."}},
  # Cache de Kankreblath : le Cloportier (PNJ officiel 2766, look {3050}). Comme dans Dofus 3, on entre par le trou du Grenier de Kerubim
  # ([3,-17], au-dessus de sa boutique) après un coup de Baguette Rikiki : c'est lui qui la tient, à côté du trou.
  'cloportier': {'nom': 'Cloportier', 'dofusId': 2766, 'zone': 'astrub', 'carte': 'grenier_kerubim',
    'phrase': "Encore un qui veut passer par le trou de sousouris ! Vous proliférez comme des Vilinsekts, vous autres. Ça vous rendrait presque sympathiques.",
    'discussion': [{'reponse': 'Qui est Kankreblath ?', 'texte': "Le chef des Vilinsekts. Tout ce qui disparaît dans les maisons d'Astrub finit dans sa Cache, sous ce plancher : cuillères, dés, cartes à jouer… et parfois les aventuriers trop curieux. Pour la clef, va voir ses Vilinsekts dans les caves : huit antennes et un peu de bricolage."}],
    'gardien': {'donjon': 'Cache de Kankreblath', 'approche': "Psst ! Par ici. Un petit coup de Baguette Rikiki et tu passes par le trou.",
      'victoire': "Kankreblath à terre ? Les cuillères d'Astrub vont enfin rentrer à la maison. Enfin, celles qu'il n'a pas mangées.",
      'mort': "Ressorti par le trou en un seul morceau, à ce que je vois. Allez, je te rapetisse encore quand tu veux.",
      'sansCle': "Rapetisser, je sais faire. Ouvrir sans clef, non. {vendeur} en vend."}},
  'emp': {'nom': 'Emp', 'dofusId': 1640, 'zone': 'astrub', 'carte': '5_-18', 'case': EMP_CASE,
    # Maquette Hub (4A) puis Ville : ses guichets sont partis chez Kerubim, au Bastion des Douze ; discussion officielle et phrase inédite
    'phrase': "Mes guichets ? Confiés à Kerubim Crépin, au Bastion des Douze (par n'importe quel Zaap). Moins de queue, moins de gaspillage : Waro lui-même n'a rien trouvé à redire.",
    'discussion': [
      {'reponse': "Le prier d'en dire davantage sur le conflit l'opposant au Méryde de l'écologie.", 'texte': "Il y a fort longtemps, j'étais son plus fervent disciple. Comme nous n'étions pas d'accord sur la manière d'aborder les choses, j'ai décidé de voler de mes propres ailes. Nous sommes restés bons amis mais il nous arrive parfois de nous disputer à cause de nos divergences d'opinion. Par exemple, il est contre l'industrialisation, tandis que moi, je pense qu'elle a ses bons côtés à condition qu'il n'y ait pas de gaspillage."},
      {'reponse': "Écouter la suite.", 'texte': "Ensemble, Waro et moi avons inventé les poubelles, puis le tri sélectif et pour son millième anniversaire, je lui ai présenté le concept des aventuriers recyclés. C'est quelque chose d'assez simple à mettre en place : on récupère un aventurier qui n'a plus grande utilité et on l'envoie dans un lieu où il servira à autre chose qu'à pomper les allocations des anciens mercenaires d'Astrub. Par exemple, il peut finir en ragoût pour Kannibouls, cible d'entraînement pour jeunes Bworks ou compagnon de nuit pour Trooll esseulé."},
      {'reponse': "Émettre des doutes sur le concept et demander à quoi va servir l'offrande.", 'texte': "À rien de plus que ce pour quoi elle a été conçue. C'est un très bon exemple de ce que l'on peut faire avec des ressources de base ou des vieux équipements qui traînent dans les sacs à dos. Je déteste le gaspillage. J'estime que les artisans ne doivent utiliser que le strict nécessaire pour leurs œuvres. Quant au surplus, il faut s'en servir pour de nouvelles créations plutôt que le laisser à l'abandon dans un coin, un coffre ou sur le dos d'un aventurier."}],
    'adieu': "Recycler l'un de vos saluts quotidiens pour dire au revoir au Méryde."},
  # --- Bastion des Douze (maquette Ville, tranchée le 2026-11-07 : 5A 6B) : les PNJ de service quittent le Havre-Sac pour notre ville.
  # Noms et apparences officiels, dialogues inédits. apres = ils n'emménagent qu'après la première visite de cette zone.
  # Cases : devant leur maison (tools/extraction/bastion.py, recopiées dans zones.json > bastion > pnj).
  'kerubim': {'nom': 'Kerubim Crépin', 'dofusId': 3043, 'zone': 'bastion', 'carte': 'bastion', 'case': BASTION['kerubim'], 'apres': 'astrub', 'titre': 'Antiquaire',
    'phrase': "Entre, entre ! Chez Kerubim, rien n'est inutile : il y a juste des trésors qui ne savent pas encore qu'ils en sont.",
    'services': [{'texte': 'Recycler des objets contre des Pépites.', 'service': 'recycler'}],
    'discussion': [{'reponse': 'Tu rachètes vraiment tout ?', 'texte': "Tout. Une fois, j'ai racheté une chaussette à un Iop… relique sacrée."},
      {'reponse': 'Pourquoi ta boutique est au Bastion ?', 'texte': "Parce que le loyer à Astrub, c'est du vol. Ici, les Douze ont offert le terrain. Et je garde un petit guichet dans ton Havre-Sac, pour les urgences."}]},
  # 6B : un guichet de recyclage reste au Havre-Sac (recyclage seulement)
  'kerubim_guichet': {'nom': 'Kerubim Crépin', 'sprite': 'kerubim', 'dofusId': 3043, 'zone': 'havresac', 'carte': '0_0', 'case': 284, 'apres': 'astrub', 'titre': 'Guichet de recyclage',
    'phrase': "La boutique est au Bastion des Douze, mais pour toi j'ai gardé ce guichet. Recyclage seulement, et pas de marchandage avant le petit-déjeuner.",
    'services': [{'texte': 'Recycler des objets contre des Pépites.', 'service': 'recycler'}],
    'discussion': [{'reponse': 'Tu es à deux endroits à la fois ?', 'texte': "Un bon antiquaire est toujours là où il y a des trésors. Ne pose pas plus de questions, ça porte malheur au commerce."}]},
  'tissebelle': {'nom': 'Tissebelle', 'dofusId': 0, 'zone': 'bastion', 'carte': 'bastion', 'case': BASTION['tissebelle'], 'titre': 'Couturière',
    'phrase': "Tourne-toi. Non, l'autre côté. Hmm. On va dire que c'est un bon début.",
    'services': [{'texte': 'Voir les apparats.', 'service': 'apparat'}, {'texte': "M'asseoir devant le miroir (garde-robe).", 'service': 'garde-robe'}],
    'discussion': [{'reponse': 'Tu fabriques tes tissus ?', 'texte': "Je les fais pousser. La soie de Sadida, c'est trois saisons de patience et une saison à empêcher les Bouftous de la brouter."},
      {'reponse': 'Je peux changer de tête ?', 'texte': "Assieds-toi devant le miroir. Ta tête, tes couleurs : c'est gratuit. Le style ne devrait jamais coûter un kama."}]},
  'otomai': {'nom': 'Otomaï', 'dofusId': 914, 'zone': 'bastion', 'carte': 'bastion', 'case': BASTION['otomai'], 'apres': 'astrub', 'titre': 'Alchimiste',
    'phrase': "Ah, un volontaire ! Je veux dire : un client. Cette potion te ramène au Zaap. Dans 97 % des cas, en un seul morceau.",
    'services': [{'texte': 'Voir ses potions.', 'service': 'boutique'}],
    'discussion': [{'reponse': 'Et les 3 % ?', 'texte': "Ils reviennent aussi. Juste un peu plus tard, et parfois avec une oreille en plus. Je prends des notes."}]},
  'bouillotte': {'nom': 'Mère Bouillotte', 'dofusId': 0, 'zone': 'bastion', 'carte': 'bastion', 'case': BASTION['bouillotte'], 'titre': 'Cuisinière',
    'phrase': "Encore toi, et encore tout maigre ! Assieds-toi. Personne ne repart d'ici le ventre vide, même pas les Bouftous.",
    'services': [{'texte': 'Voir ses plats.', 'service': 'boutique'}],
    'discussion': [{'reponse': "C'est quoi ton secret ?", 'texte': "Du lait de Bambou, une pincée de sel et trois heures à crier sur la marmite. Elle n'aime pas qu'on lui parle doucement."}]},
  'goultard': {'nom': 'Goultard', 'dofusId': 1216, 'zone': 'bastion', 'carte': 'bastion', 'case': BASTION['goultard'], 'apres': 'astrub', 'titre': 'Clés de donjon',
    'phrase': "Tu veux une clé ? Montre tes bras. Hmm. Ça ira. Les monstres te trouveront appétissant, c'est déjà ça.",
    'services': [{'texte': 'Voir les clés.', 'service': 'boutique'}],
    'discussion': [{'reponse': 'Tu ne viens pas avec moi ?', 'texte': "Si je viens, il ne restera rien à taper pour toi. Je suis gentil, tu vois."},
      {'reponse': 'Pourquoi tu vis ici ?', 'texte': "Au Bastion, chacun a déjà prouvé ce qu'il vaut : personne ne me provoque en duel. J'en avais besoin."}]},
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

# Équipement de départ officiel : la Panoplie de l'Intrépide (itemsets Dofus 3 : 10784-10801, niveau 1), que le tutoriel de Dofus
# donne au nouveau perso. L'épée de la panoplie (Épée Tulante) va au Iop ; le Crâ garde un arc, sans le bouclier (arc à deux mains).
INTREPIDE = ['10801', '10800', '10784', '10785', '10799', '10794']   # chapeau, cape, amulette, anneau, ceinture, bottes
def tuto(classe, frappe, sort1, sorts, jauge, mobilite, arme):
    """Trame du tutoriel d'une classe : 10 étapes, une action chacune (départ au Temple Céleste)."""
    return [
      {'nom': 'Premiers pas', 'bulle': f"Bienvenue sur Incarnam, jeune {classe} ! Contemple les Dofus, salue ton dieu, puis clique sur le sol et suis le chemin. Je t'attends dans la salle suivante.",
       'objectifs': [aller('Passer dans la salle suivante (clic gauche)', carte='temple_2')]},
      {'nom': "La salle d'entraînement", 'pnj': 'ganymede_temple',
       'objectifs': [aller('Rejoindre Ganymède', pnj='ganymede_temple')]},
      {'nom': 'Frapper', 'pnj': 'ganymede_temple', 'bulle': f"Des esprits de feu se sont glissés dans le Temple. Clique sur l'un d'eux : {frappe}.",
       'objectifs': [vaincre('Vaincre un monstre (clic dessus)', 1, sousZone=SZ['temple'])]},
      {'nom': 'Ton premier sort', 'pnj': 'ganymede_temple', 'bulle': sort1[1], 'halo': 0, 'objectifs': [{'t': 'utiliser', 'sort': sort1[0], 'texte': 'Lancer ton premier sort (&)'}]},
      {'nom': 'Tes sorts', 'pnj': 'ganymede_temple', 'bulle': sorts, 'halo': 1, 'objectifs': [vaincre('Vaincre des monstres avec tes sorts', 3, sousZone=SZ['temple'])]},
      {'nom': 'La jauge de classe', 'pnj': 'ganymede_temple', 'bulle': jauge, 'halo': 'jauge', 'objectifs': [{'t': 'utiliser', 'quoi': 'jauge', 'texte': 'Lancer un sort avec la jauge pleine'}]},
      {'nom': 'Se déplacer vite', 'pnj': 'ganymede_temple', 'bulle': mobilite, 'halo': 7, 'objectifs': [{'t': 'utiliser', 'quoi': 'mobilite', 'texte': 'Se déplacer avec Espace'}]},
      {'nom': 'La potion', 'pnj': 'ganymede_temple', 'bulle': "Blessé ? E : une potion. Tu en regagnes une à chaque groupe vaincu.", 'halo': 'potion',
       'objectifs': [{'t': 'utiliser', 'quoi': 'potion', 'texte': 'Boire une potion (E) une fois blessé'}]},
      {'nom': 'Premières armes', 'pnj': 'ganymede_temple', 'bulle': arme[1], 'donner': {classe.lower().replace('â', 'a'): [arme[0]] + arme[2]},
       'objectifs': [{'t': 'equiper', 'objet': arme[0], 'texte': 'Équiper ton arme (I)'},
                     {'t': 'equiper', 'objets': arme[2], 'texte': "Équiper la panoplie de l'Intrépide"}]},
      {'nom': 'Descendre sur Incarnam', 'pnj': 'ganymede_temple', 'bulle': "Tu es prêt. Parle-moi et je t'envoie au village, près de Lykhen. Le Zaap de la Route des âmes sera ton point de retour si tu tombes.",
       'objectifs': [parler('Parler à Ganymède pour descendre au village', 'ganymede_temple')]},
    ]

Q = {}
# --- Fil principal (Ganymède -> Lykhen -> Fécaline) ---------------------------------------------------------
Q['reponses'] = {'nom': 'Réponses à tout', 'type': 'tutoriel', 'pnj': 'ganymede', 'niveau': 1, 'auDepart': True, 'depart': 'temple_1', 'arrivee': '-2_-3', 'arriveeCase': 355, 'suivante': 'village',
  'texte': "Avant de quitter le temple céleste, prenez le temps de contempler les Dofus et le Monde des Douze... et n'oubliez pas de saluer votre dieu au passage ! Ganymède vous apprend à vous battre avant de vous laisser descendre sur l'île.",
  'options': {'passable': True, 'sauterSiCompte': True, 'immortel': True, 'jauge': 4, 'groupes': {'sousZones': [SZ['temple']], 'taille': [1, 3], 'etape': 2}},
  # Tutoriel (maquette « Tutoriel d'Incarnam », tranchée le 2026-11-06) : une trame par classe (9B), une action par étape,
  # halo sur la barre + bulle de Ganymède (3A+3B). Les indices des étapes « Premiers pas » (0) et « Premières armes » (8)
  # servent au succès « Premier temps » : garder les deux trames de même longueur.
  'etapes': {'iop': tuto('Iop', 'tu le poursuis et tu frappes',
                 ('pression', 'Tes sorts sont sur & é " \'. Touche & : Pression !'),
                 "Essaie les autres : é Ferveur, \" Couperet, ' Épée Divine. Vide ce groupe !",
                 "Chaque coup remplit ta Rage. Pleine, elle renforce ton sort suivant : remplis-la, puis frappe !",
                 "Espace : Bond. Tu sautes là où pointe ta souris, pour fondre sur un monstre ou te sortir d'un mauvais pas.",
                 ('10797', "Voici ton équipement : l'Épée Tulante et la panoplie de l'Intrépide. I ouvre ton sac : équipe tout, tu seras plus solide.", INTREPIDE + ['10798'])),
             'cra': tuto('Crâ', "sans arc, tu frappes au poing",
                 ('recul', 'Tes flèches sont sur & é " \'. Touche & : Flèche de Recul, elle repousse ta cible !'),
                 "Essaie les autres : é Flèche Glacée, \" Flèche Vagabonde, ' Flèche de Barrage. Reste loin et vide ce groupe !",
                 "Toucher de loin remplit ta Précision : utilise tes flèches (& é \" ') à distance. Pleine, elle renforce ta flèche suivante : remplis-la, puis tire !",
                 "Espace : Pas Chassé. Un pas vif vers ta souris, pour reprendre tes distances quand un monstre te colle.",
                 ('1942', "Voici ton équipement : un Arc de Chasse et la panoplie de l'Intrépide. I ouvre ton sac : équipe tout, tu tireras des flèches au lieu de frapper au poing.", INTREPIDE))},
  'recompense': {'xp': 150, 'potions': True, 'niveau': 2}}
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
              'objectifs': [aller('Entrer dans la crypte de Kardorim', carte='arene_crypte'), vaincre('Vaincre Kardorim', 1, monstres=['kardorim'])]}],
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
     [{'nom': 'Premiers pas', 'etape': ['reponses', 0]}, {'nom': 'Premières armes', 'etape': ['reponses', 8]}, {'nom': 'Première partie du tutoriel', 'quete': 'reponses'}], 0.213),
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
    [{'nom': nom, 'succes': 'zone_' + k} for k, _, nom, _, _ in EXPLO], 1, '1711')   # Chienchien (maquette Familiers 1C)

json.dump({'pnj': PNJ, 'quetes': Q, 'succes': S}, open(OUT, 'w'), ensure_ascii=False, indent=1)
print(len(Q), 'quêtes', len(S), 'succès')
