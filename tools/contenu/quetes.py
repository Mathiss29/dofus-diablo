# quetes.py : écrit src/data/quetes.json (quêtes d'Incarnam et succès officiels).
# Noms des quêtes, PNJ, lieux, objets et succès = données de Dofus 3 (quests / queststeps / questobjectives /
# queststeprewards / achievements). Le déroulé est pensé pour un ARPG temps réel (pas copié des quêtes du jeu).
# XP d'une quête = ratio officiel × niveau × 50 ; kamas = ratio × niveau × 10 ; XP d'un succès = ratio officiel × 500.
import json, os
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'data', 'quetes.json')

RES = json.load(open(os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'data', 'items.json')))['resources']
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
  # Le tour du monde (maquette Tour 2A) : Metag Robill (PNJ officiel 4370, look {1125}), guerrier posté devant la Grange du Tournesol
  # Affamé comme dans Dofus 3. Répliques inédites (9A) : un fanfaron qui a « déjà tout fait ».
  # Milice d'Astrub (Quêtes roadmap 3A+3C) : le Gardien des Geôles d'Astrub (PNJ officiel 606, look {58|||90}) devant la Prison [5,-19],
  # là où les Avis de recherche officiels envoient les primes. Il tient aussi le tableau des contrats du jour. Répliques inédites.
  'geolier': {'nom': "Gardien des Geôles d'Astrub", 'dofusId': 606, 'zone': 'astrub', 'carte': '5_-19', 'titre': "Milice d'Astrub", 'contrats': True,
    'phrase': "Les geôles d'Astrub ont de la place. Beaucoup de place. Trop de place. Ramène-moi du monde, la Milice paie bien.",
    'discussion': [{'reponse': 'Comment marchent les contrats ?', 'texte': "Trois contrats par jour, tirés au sort à minuit, et un gros contrat chaque semaine. Tu fais le travail, tu reviens me voir, tu repars avec un sac de matériel et des Pépites. Les Avis de recherche, c'est une traque par semaine et par bandit."}]},
  # Chasse au Dopeul (Quêtes roadmap 7B) : le Représentant des Temples (PNJ officiel 2872, look {83|||80}) près du Zaap d'Astrub,
  # tant que les temples de classe ne sont pas dans le jeu. Le Dopeul est le double officiel de ta classe (Dopeul Iop 167, Dopeul Crâ 168).
  'temples': {'nom': 'Représentant des Temples', 'dofusId': 2872, 'zone': 'astrub', 'carte': '4_-18',
    # Almanax (0.3, 15C) : l'offrande du jour se fait auprès de lui (fenêtre Almanax de l'affichage).
    'services': [{'texte': "Faire l'offrande du jour (Almanax).", 'service': 'almanax', 'v03': True}],
    'phrase': "Les temples de Iop et de Crâ sont loin d'Astrub, alors c'est moi qui fais le lien. Et qui envoie les Dopeuls. Ils adorent ça.",
    'discussion': [{'reponse': "C'est quoi, un Dopeul ?", 'texte': "Ton double, en plus violet et en plus vexé. Il connaît tes sorts aussi bien que toi. Une fois par jour, il vient voir si tu as progressé."}]},
  # Quêtes officielles d'Astrub écrites en ARPG (Quêtes roadmap 2C) : leurs PNJ officiels, à l'endroit où l'on rend la quête dans Dofus 3.
  'hazel': {'nom': 'Hazel Ementaire', 'dofusId': 4313, 'zone': 'astrub', 'carte': '6_-17',
    'phrase': "J'avais commandé des chaudrons. On m'a livré des enclumes. Essaie donc de faire une soupe dans une enclume."},
  'nepra': {'nom': 'Nepra Lido', 'dofusId': 4334, 'zone': 'astrub', 'carte': '3_-21',
    'phrase': "L'aventurite, c'est cette manie de foncer dans les monstres sans réfléchir. Très contagieux. Tu en as tous les symptômes."},
  'jim': {'nom': 'Jim Fleps', 'dofusId': 4335, 'zone': 'astrub', 'carte': '3_-16',
    'phrase': "Je ne vole pas, j'emprunte sans prévenir et sans rendre. Nuance."},
  'seldawa': {'nom': 'Sel Dawa', 'dofusId': 4319, 'zone': 'astrub', 'carte': '6_-18',
    'phrase': "De l'eau ! Ma nièce ne boit plus que de l'eau ! Où va la jeunesse d'Astrub ?"},
  'sept': {'nom': 'Disciple de Sêpt', 'dofusId': 4311, 'zone': 'astrub', 'carte': '0_-25',
    'phrase': "Les bûcherons n'osent plus couper un arbre. Quelque chose grogne entre les troncs, et ce n'est pas le vent."},
  'becky': {'nom': 'Becky Gorr', 'dofusId': 4380, 'zone': 'astrub', 'carte': '1_-11',
    'phrase': "Quelqu'un retourne mes tombes la nuit. Moi, je les creuse le jour. On ne va pas s'en sortir."},
  # Fil court « Les Vilinsekts » (Quêtes roadmap 1A) : Cindy Cah (PNJ officiel 4366, look {4960|||90}) donne « Les as de la cambriole » en [5,-17].
  'cindy': {'nom': 'Cindy Cah', 'dofusId': 4366, 'zone': 'astrub', 'carte': '5_-17',
    'phrase': "Ma cuillère en argent a disparu. Puis mon dé à coudre. Puis mon voisin a perdu son jeu de cartes. À Astrub, on ne perd rien : on se fait voler par des Vilinsekts."},
  'metag': {'nom': 'Metag Robill', 'dofusId': 4370, 'zone': 'astrub', 'carte': '7_-24',
    'phrase': "Tous les donjons du monde, je les ai faits. Deux fois. La deuxième, c'était pour vérifier que j'avais bien gagné la première.",
    'discussion': [{'reponse': 'Tu les as vraiment tous faits ?', 'texte': "Évidemment. Enfin, presque. Il y en a un ou deux où je me suis arrêté devant la porte, pour laisser leur chance aux jeunes. Comme toi."}]},
  'emp': {'nom': 'Emp', 'dofusId': 1640, 'zone': 'astrub', 'carte': '5_-18', 'case': EMP_CASE,
    # Maquette Hub (4A) puis Ville : ses guichets sont partis chez Kerubim, au Bastion des Douze ; discussion officielle et phrase inédite
    'phrase': "Mes guichets ? Confiés à Kerubim Crépin, au Bastion des Douze (par n'importe quel Zaap). Moins de queue, moins de gaspillage : Waro lui-même n'a rien trouvé à redire.",
    'discussion': [
      {'reponse': "Le prier d'en dire davantage sur le conflit l'opposant au Méryde de l'écologie.", 'texte': "Il y a fort longtemps, j'étais son plus fervent disciple. Comme nous n'étions pas d'accord sur la manière d'aborder les choses, j'ai décidé de voler de mes propres ailes. Nous sommes restés bons amis mais il nous arrive parfois de nous disputer à cause de nos divergences d'opinion. Par exemple, il est contre l'industrialisation, tandis que moi, je pense qu'elle a ses bons côtés à condition qu'il n'y ait pas de gaspillage."},
      {'reponse': "Écouter la suite.", 'texte': "Ensemble, Waro et moi avons inventé les poubelles, puis le tri sélectif et pour son millième anniversaire, je lui ai présenté le concept des aventuriers recyclés. C'est quelque chose d'assez simple à mettre en place : on récupère un aventurier qui n'a plus grande utilité et on l'envoie dans un lieu où il servira à autre chose qu'à pomper les allocations des anciens mercenaires d'Astrub. Par exemple, il peut finir en ragoût pour Kannibouls, cible d'entraînement pour jeunes Bworks ou compagnon de nuit pour Trooll esseulé."},
      {'reponse': "Émettre des doutes sur le concept et demander à quoi va servir l'offrande.", 'texte': "À rien de plus que ce pour quoi elle a été conçue. C'est un très bon exemple de ce que l'on peut faire avec des ressources de base ou des vieux équipements qui traînent dans les sacs à dos. Je déteste le gaspillage. J'estime que les artisans ne doivent utiliser que le strict nécessaire pour leurs œuvres. Quant au surplus, il faut s'en servir pour de nouvelles créations plutôt que le laisser à l'abandon dans un coin, un coffre ou sur le dos d'un aventurier."}],
    'adieu': "Recycler l'un de vos saluts quotidiens pour dire au revoir au Méryde."},
  # --- Dofus (version 0.3, ligne « Dofus 0.3 : 1A 2B 3A 4C ») : le Gawdien du Dofus (PNJ officiel 148, look {321}) lance les quêtes
  # des Dofus au Bastion ; un PNJ officiel lié au Dofus raconte (4C) : Rathrosk (PNJ 4357, {4930}), qui donne l'œuf d'argent dans
  # Dofus 3 à [4,-19], et l'Énergie du Dofus Cacao (PNJ 4842, {3401|||120}). Répliques inédites.
  'gawdien': {'nom': 'Gawdien du Dofus', 'dofusId': 148, 'zone': 'bastion', 'carte': 'bastion', 'case': BASTION['gawdien'], 'titre': 'Gardien des Dofus', 'v03': True,
    'phrase': "Trente et un œufs de dragon, et presque tous perdus. Les Douze m'ont confié la liste. Moi, je n'ai que deux jambes et beaucoup trop d'œufs.",
    'discussion': [{'reponse': "C'est quoi, un Dofus ?", 'texte': "Un œuf de dragon. Il n'éclot jamais, mais il garde un peu de la force de sa mère. Porte-le, et elle veille sur toi. Six à la fois, pas un de plus : les dragons sont jaloux."}]},
  'rathrosk': {'nom': 'Rathrosk', 'dofusId': 4357, 'zone': 'astrub', 'carte': '4_-19', 'v03': True,
    'phrase': "Cet œuf d'argent, je l'ai couvé dix ans. Dix ans ! Et il a suffi d'un éternuement de Craqueleur pour qu'il vole en éclats."},
  'energie_cacao': {'nom': 'Énergie du Dofus Cacao', 'dofusId': 4842, 'zone': 'astrub', 'carte': '1_-20', 'v03': True,
    'phrase': "Je suis ce qui reste d'un œuf en chocolat. Une odeur, surtout. Et beaucoup de colère."},
  # --- Bastion des Douze (maquette Ville, tranchée le 2026-11-07 : 5A 6B) : les PNJ de service quittent le Havre-Sac pour notre ville.
  # Noms et apparences officiels, dialogues inédits. apres = ils n'emménagent qu'après la première visite de cette zone.
  # Cases : dans le Marché couvert, Kerubim à sa porte (tools/extraction/marche.py, recopiées dans zones.json > bastion > pnj ;
  # les marchands sont sur la carte « marche », cases de la salle).
  'kerubim': {'nom': 'Kerubim Crépin', 'dofusId': 3043, 'zone': 'bastion', 'carte': 'bastion', 'case': BASTION['kerubim'], 'apres': 'astrub', 'titre': 'Antiquaire',
    'phrase': "Entre, entre ! Chez Kerubim, rien n'est inutile : il y a juste des trésors qui ne savent pas encore qu'ils en sont.",
    'services': [{'texte': 'Défaire des objets contre des runes et des kamas.', 'service': 'recycler'}],
    'discussion': [{'reponse': 'Tu rachètes vraiment tout ?', 'texte': "Tout. Une fois, j'ai racheté une chaussette à un Iop… relique sacrée."},
      {'reponse': 'Pourquoi ta boutique est au Bastion ?', 'texte': "Parce que le loyer à Astrub, c'est du vol. Ici, les Douze ont offert le terrain. Et tout le monde passe devant mon comptoir en allant au Marché."}]},
  'tissebelle': {'nom': 'Tissebelle', 'dofusId': 0, 'zone': 'bastion', 'carte': 'marche', 'case': BASTION['tissebelle'], 'titre': 'Couturière',
    'phrase': "Tourne-toi. Non, l'autre côté. Hmm. On va dire que c'est un bon début.",
    'services': [{'texte': 'Voir les apparats.', 'service': 'apparat'}, {'texte': "M'asseoir devant le miroir (garde-robe).", 'service': 'garde-robe'}],
    'discussion': [{'reponse': 'Tu fabriques tes tissus ?', 'texte': "Je les fais pousser. La soie de Sadida, c'est trois saisons de patience et une saison à empêcher les Bouftous de la brouter."},
      {'reponse': 'Je peux changer de tête ?', 'texte': "Assieds-toi devant le miroir. Ta tête, tes couleurs : c'est gratuit. Le style ne devrait jamais coûter un kama."}]},
  'otomai': {'nom': 'Otomaï', 'dofusId': 914, 'zone': 'bastion', 'carte': 'marche', 'case': BASTION['otomai'], 'apres': 'astrub', 'titre': 'Alchimiste',
    'phrase': "Ah, un volontaire ! Je veux dire : un client. Cette potion te ramène au Zaap. Dans 97 % des cas, en un seul morceau.",
    'services': [{'texte': 'Voir ses potions.', 'service': 'boutique'}],
    'discussion': [{'reponse': 'Et les 3 % ?', 'texte': "Ils reviennent aussi. Juste un peu plus tard, et parfois avec une oreille en plus. Je prends des notes."}]},
  'bouillotte': {'nom': 'Mère Bouillotte', 'dofusId': 0, 'zone': 'bastion', 'carte': 'marche', 'case': BASTION['bouillotte'], 'titre': 'Cuisinière',
    'phrase': "Encore toi, et encore tout maigre ! Assieds-toi. Personne ne repart d'ici le ventre vide, même pas les Bouftous.",
    'services': [{'texte': 'Voir ses plats.', 'service': 'boutique'}],
    'discussion': [{'reponse': "C'est quoi ton secret ?", 'texte': "Du lait de Bambou, une pincée de sel et trois heures à crier sur la marmite. Elle n'aime pas qu'on lui parle doucement."}]},
  'goultard': {'nom': 'Goultard', 'dofusId': 1216, 'zone': 'bastion', 'carte': 'marche', 'case': BASTION['goultard'], 'apres': 'astrub', 'titre': 'Clés de donjon',
    'phrase': "Tu veux une clé ? Montre tes bras. Hmm. Ça ira. Les monstres te trouveront appétissant, c'est déjà ça.",
    'services': [{'texte': 'Voir les clés.', 'service': 'boutique'}],
    'discussion': [{'reponse': 'Tu ne viens pas avec moi ?', 'texte': "Si je viens, il ne restera rien à taper pour toi. Je suis gentil, tu vois."},
      {'reponse': 'Pourquoi tu vis ici ?', 'texte': "Au Bastion, chacun a déjà prouvé ce qu'il vaut : personne ne me provoque en duel. J'en avais besoin."}]},
  # Responsable de la boutique (PNJ officiel 5136, Magasin 13E) : confort et thèmes du Havre-Sac, au Marché couvert.
  'responsable': {'nom': 'Responsable de la boutique', 'dofusId': 5136, 'zone': 'bastion', 'carte': 'marche', 'case': BASTION['responsable'], 'titre': 'Confort et Havre-Sac',
    'phrase': "Bienvenue ! Ici, rien ne rend plus fort : juste plus à l'aise. Un sac plus grand, un coffre plus large, un Havre-Sac à ton goût.",
    'services': [{'texte': 'Voir le confort.', 'service': 'confort'}, {'texte': 'Changer le décor de mon Havre-Sac.', 'service': 'havresac'}],
    'discussion': [{'reponse': 'Pourquoi des Pépites, et pas des kamas ?', 'texte': "Les kamas, c'est pour survivre. Les Pépites, c'est pour vivre bien. Et chez moi, on vit très bien."},
      {'reponse': 'Un Havre-Sac en forme de Moon ?', 'texte': "Jungle, plage, taverne, pyramide… Quarante-six décors, tous signés. Ton arche et ton coffre déménagent avec toi, promis."}]},
  # Maquette Ville 5F : gardes et crieur du Bastion. Looks officiels (table npcs), répliques inédites. Un garde de chaque nation
  # attend au départ du pont coupé de son île (bastion.py GARDES) ; deux Gardes d'Amakna encadrent le Zaap.
  'garde_bonta': {'nom': "Soldat d'élite bontarien", 'dofusId': 995, 'zone': 'bastion', 'carte': 'bastion', 'case': BASTION['garde_bonta'], 'titre': 'Garde du pont de Bonta',
    'phrase': "Le pont de Bonta est coupé. Les ordres sont clairs : personne ne passe tant que la cité n'est pas libérée. Même pas moi, et j'ai le mal du pays.",
    'discussion': [{'reponse': "Qu'est-ce qui se passe là-bas ?", 'texte': "Les Enfers ont mordu la cité. Les remparts tiennent, mais les rues grouillent. Quand quelqu'un aura fait le ménage, on rebâtira ce pont planche par planche."}]},
  'garde_brakmar': {'nom': 'Soldat brâkmarien', 'dofusId': 7382, 'zone': 'bastion', 'carte': 'bastion', 'case': BASTION['garde_brakmar'], 'titre': 'Garde du pont de Brâkmar',
    'phrase': "Brâkmar, c'est par là. Enfin, ça le sera. Pour l'instant c'est surtout du vide, et le vide ne paie pas sa tournée.",
    'discussion': [{'reponse': 'Tu ne te bats pas avec le Bontarien ?', 'texte': "Ici, c'est la trêve des Douze. On se regarde de travers, c'est tout. Et le soir on joue aux osselets, mais ça, tu ne l'as pas entendu."}]},
  'garde_pandala': {'nom': 'Garde Pandalien', 'dofusId': 5910, 'zone': 'bastion', 'carte': 'bastion', 'case': BASTION['garde_pandala'], 'titre': 'Garde du pont de Pandala',
    'phrase': "Pandala attend. Le bambou aussi. Le bambou attend toujours, c'est sa force.",
    'discussion': [{'reponse': 'Tu attends quoi, exactement ?', 'texte': "Quelqu'un d'assez solide pour traverser les quatre éléments de l'île. Toi, peut-être. Reviens quand tu tiendras debout après trois verres de lait de Bambou."}]},
  'garde_frigost': {'nom': 'Marin frigostien', 'dofusId': 4175, 'zone': 'bastion', 'carte': 'bastion', 'case': BASTION['garde_frigost'], 'titre': 'Garde du pont de Frigost',
    'phrase': "Frigost est de l'autre côté. Je garde le pont au chaud… façon de parler. Il gèle rien qu'à le regarder.",
    'discussion': [{'reponse': "Pourquoi un marin garde un pont ?", 'texte': "Parce qu'un pont, c'est un bateau qui a peur de l'eau. Et parce que personne d'autre ne supporte ce froid."}]},
  'garde_zaap1': {'nom': "Garde d'Amakna", 'sprite': 'garde_amakna', 'dofusId': 2260, 'zone': 'bastion', 'carte': 'bastion', 'case': BASTION['garde_zaap1'], 'titre': 'Garde du Zaap',
    'phrase': "Bienvenue au Bastion des Douze. Le Zaap est à toi, les bagarres sont pour dehors."},
  'garde_zaap2': {'nom': "Garde d'Amakna", 'sprite': 'garde_amakna', 'dofusId': 2261, 'zone': 'bastion', 'carte': 'bastion', 'case': BASTION['garde_zaap2'], 'titre': 'Garde du Zaap',
    'phrase': "Tout ce qui sort de ce Zaap passe devant moi. Tu as l'air d'un honnête aventurier. Plutôt."},
  'crieur': {'nom': "Héraut d'Ecaflip", 'sprite': 'heraut_ecaflip', 'dofusId': 3098, 'zone': 'bastion', 'carte': 'bastion', 'case': BASTION['crieur'], 'titre': 'Crieur du Bastion',
    'phrase': "Une nouvelle à crier ? Donne-la-moi, je la crie trois fois plus fort et deux fois plus belle. Ecaflip aime les belles histoires.",
    'discussion': [{'reponse': "Pourquoi un héraut d'Ecaflip ?", 'texte': "Les Douze ont tiré au sort qui crierait les nouvelles. Ecaflip a gagné. Bizarrement, il gagne toujours."}],
    'cris': ["Oyez, oyez ! Almanax du jour : {almanax} ! Les offrandes, c'est au Représentant des Temples !",
      "Oyez ! Les ponts sont coupés : Bonta, Brâkmar, Pandala et Frigost attendent ceux qui les libéreront !",
      "Oyez ! Kerubim Crépin rachète tout, même les chaussettes. Surtout les chaussettes !",
      "Oyez ! Malek le Forgemage brise vos objets en runes. Il dit que c'est pour votre bien !",
      "Oyez, oyez ! Mère Bouillotte a encore fait trop de soupe. Ventres creux, au rapport !",
      "Oyez ! Goultard vend des clés de donjon. Le courage, lui, n'est pas en vente : apportez le vôtre !",
      "Oyez ! N'importe quel Zaap mène au Bastion des Douze. Les Douze vous saluent, aventuriers !"]},
  # Maquette « Forgemagie » (1A, 11B) : forgemagie, brisage en runes et fusion, devant la forge de Brâkmar.
  # Look officiel du « Vendeur de runes de Forgemagie » (PNJ 7379, {6201}) ; dialogues inédits.
  'forgemage': {'nom': 'Malek le Forgemage', 'dofusId': 7379, 'zone': 'bastion', 'carte': 'bastion', 'case': BASTION['forgemage'], 'titre': 'Forgemage',
    'phrase': "Chaque objet cache des runes. Je les sors, tu les poses, et le puits garde ce qui se perd. Rien ne se perd vraiment, chez moi.",
    'services': [{'texte': 'Forgemager un objet.', 'service': 'forgemagie'}],
    'discussion': [{'reponse': 'Et si ça rate ?', 'texte': "Alors une autre ligne paie, et son poids tombe dans le puits. Le puits n'oublie rien : la prochaine rune qu'il couvre passera."},
      {'reponse': 'Pourquoi te payer en plus des runes ?', 'texte': "Les runes, c'est la matière. Les kamas, c'est le charbon de la forge. Et si tu me laisses viser à ta place, c'est mes bras que tu paies."}]},
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

# --- Le tour du monde (Metag Robill) : maquette Tour, tranchée le 2026-11-07 (Tour : 1B 2A 3A 4A 5A 6A+6B 7A+7B 8A+8B 9A 10A) ------
# Série officielle (quêtes 2005, 2006, 153 à 157 : 27 donjons du niveau 20 au niveau 180) en 7 chapitres rendus à Metag (3A), donjons
# dans n'importe quel ordre (4A), objectif « vaincre le boss du donjon », victoire d'avant la quête comprise (5A). 1B : nos donjons absents
# de la série (Kardorim, Château Ensablé, Kankreblath) s'y ajoutent. Récompenses : XP et kamas officiels, la ressource de chaque boss (6A),
# une clé du chapitre suivant (6B). Les chapitres dont les donjons ne sont pas encore dans le jeu sont « bientôt » (10A) : visibles dans le
# carnet de route (8B), pas encore proposés. Fin : succès « Le tour du monde en 27 donjons » et le titre Globe-trotteur (7A) ; 7B = la
# suite mènera à nos propres quêtes des Dofus.
T = {'type': 'secondaire', 'pnj': 'metag', 'rendre': 'metag', 'serie': 'Le tour du monde'}
def dj(nom, boss, niveau, region): return {'t': 'donjon', 'texte': f'Vaincre {boss} ({nom})', 'donjon': nom, 'boss': boss, 'niveau': niveau, 'region': region}
TDM = [
  ('tdm_1', 'Le tour du monde', 15, 1.2, False,
   "Metag Robill cherche une relique aux fabuleux pouvoirs. Avant de t'en parler, il veut voir ce que tu vaux : trois donjons pour commencer, près d'Incarnam et d'Astrub.",
   "Une relique qui rend invincible, voilà ce que je cherche. Je ne la partagerai pas avec un débutant. Commence par les petits donjons du coin : j'y suis déjà allé, c'est facile. Enfin, pour moi.",
   "Trois boss, et tu tiens encore debout ? Pas mal. Moi, je les avais faits avant le petit-déjeuner. Tiens, ta paie, et une clé pour la suite : la Cour du Bouftou Royal t'attend.",
   [dj('Crypte de Kardorim', 'Kardorim', 10, 'Incarnam'), dj('Grange du Tournesol Affamé', 'Tournesol Affamé', 20, 'Astrub'), dj('Château Ensablé', "Mob l'Éponge", 20, 'Astrub')],
   [['16525', 1], ['8157', 1], ['8682', 1], ['1568', 1]]),
  ('tdm_2', 'Revenons à nos bouftons', 25, 1.2, False,
   "Metag n'est pas encore convaincu. Il t'envoie chez le Bouftou Royal, puis sous le plancher du Grenier de Kerubim, chez Kankreblath.",
   "Un Bouftou couronné et un cafard qui collectionne les cuillères. Moi, je les ai battus d'une seule main. L'autre tenait mon sandwich.",
   "Le Bouftou Royal et Kankreblath ? Bon, d'accord, tu commences à me plaire. La suite se passe à Amakna. Quand les routes seront ouvertes, je t'y attends.",
   [dj('Cour du Bouftou Royal', 'Bouftou Royal', 30, 'Astrub'), dj('Cache de Kankreblath', 'Kankreblath', 40, 'Astrub')],
   [['880', 1], ['16002', 1]]),
  ('tdm_3', 'Le maître des clefs', 40, 2.4, True, "Deux donjons d'Amakna, gardés par des maîtres des clefs.", '', '',
   [dj('Donjon des Squelettes', 'Chafer Rōnin', 40, 'Amakna'), dj('Donjon des Tofus', 'Batofu', 40, 'Amakna')], []),
  ('tdm_4', 'Les sbires du maître', 50, 7.2, True, "Six donjons d'Amakna et d'ailleurs, jusqu'aux Pitons Rocheux des Craqueleurs.", '', '',
   [dj('Donjon des Scarafeuilles', 'Scarabosse Doré', 40, 'Amakna'), dj('Donjon des Forgerons', 'Coffre des Forgerons', 50, 'Amakna'), dj('Donjon des Bworks', 'Bworkette', 50, 'Amakna'),
    dj('Donjon des Larves', 'Shin Larve', 50, 'Amakna'), dj('Refuge Sylvestre', 'Rakoopeur', 50, '?'), dj('Pitons Rocheux des Craqueleurs', 'Craqueleur Légendaire', 70, 'Amakna')],
   [['8389', 1], ['8386', 1], ['8394', 1], ['8137', 1]]),
  ('tdm_5', 'Un juge hystérique', 90, 7.2, True, "Six donjons du monde entier, de la Forêt des Abraknydes aux égouts de Bonta et de Brâkmar.", '', '',
   [dj('Domaine Ancestral', 'Abraknyde Ancestral', 90, 'Forêt des Abraknydes'), dj('Antre du Dragon Cochon', 'Dragon Cochon', 100, 'Labyrinthe du Dragon Cochon'),
    dj('Caverne du Koulosse', 'Koulosse', 100, 'Montagne des Koalaks'), dj('Tanière du Meulou', 'Meulou', 100, 'Landes de Sidimote'),
    dj('Garde-manger du Rat Blanc', 'Rat Blanc', 110, 'Bonta'), dj('Sousouricière du Rat Noir', 'Rat Noir', 110, 'Brâkmar')], []),
  ('tdm_6', 'Des donjons, encore des donjons', 110, 6.0, True, "Cinq grands donjons, de Cania à Frigost.", '', '',
   [dj('Bibliothèque du Maître Corbac', 'Maître Corbac', 110, 'Plaines de Cania'), dj('Serre du Royalmouth', 'Royalmouth', 120, 'Île de Frigost'),
    dj('Labyrinthe du Minotoror', 'Minotoror', 120, 'Île du Minotoror'), dj('Tofulailler Royal', 'Tofu Royal', 120, 'Amakna'), dj('Sanctuaire des Dragoeufs', 'Crocabulia', 120, 'Amakna')], []),
  ('tdm_7', 'La voie du guerrier', 120, 7.2, True, "Les six derniers, jusqu'à la Grotte du Bworker.", '', '',
   [dj('Repaire de Skeunk', 'Skeunk', 120, 'Montagne des Koalaks'), dj('Atelier du Tanukouï San', 'Tanukouï San', 130, 'Île de Pandala'),
    dj("Fabrique de foux d'artifice", 'Founoroshi', 140, 'Île de Pandala'), dj('Clairière du Chêne Mou', 'Chêne Mou', 140, 'Forêt des Abraknydes'),
    dj('Salle du Minotot', 'Minotot', 160, 'Île du Minotoror'), dj('Grotte du Bworker', 'Bworker', 180, 'Landes de Sidimote')], []),
]
avant = []
for qid, nom, niv, ratio, bientot, texte, bulle, merci, objs, objets in TDM:
    Q[qid] = {**T, 'nom': nom, 'niveau': niv, 'requiert': list(avant[-1:]), 'texte': texte,
              'etapes': [{'nom': nom, **({'bulle': bulle} if bulle else {}), 'objectifs': objs}],
              'recompense': rec(ratio, max(o['niveau'] for o in objs), objets=[o for o in objets if o[0] in RES] or None),
              **({'merci': merci} if merci else {}), **({'bientot': True} if bientot else {})}
    avant.append(qid)

# --- Fil court « Les Vilinsekts » (Quêtes roadmap 1A : 3 chapitres jusqu'au boss de la zone) --------------------------------
SZ_PLANQUE = 843
Q['vil_1'] = {'nom': "Tournée d'inspection", 'type': 'principale', 'pnj': 'cindy', 'niveau': 30, 'suivante': 'vil_2', 'serie': 'Les Vilinsekts',
  'texte': "Cuillères, dés à coudre, cartes à jouer : tout disparaît dans les maisons d'Astrub. La Milice a trouvé trois trous de sousouris dans les caves de la Cité. Va voir ce qui en sort.",
  'etapes': [{'nom': 'Les trous de sousouris', 'bulle': "Trois caves, trois trous. Il y en a un près du Zaap. Prends une lanterne, et un balai.",
              'objectifs': [aller('Entrer dans une Planque des Vilinsekts', sousZone=SZ_PLANQUE)]},
             {'nom': 'Ça grouille', 'objectifs': [vaincre('Vaincre 10 Vilinsekts', 10, sousZone=SZ_PLANQUE)]}],
  'recompense': rec(2.5, 30)}
Q['vil_2'] = {'nom': 'Tel est pris qui croyait prendre', 'type': 'principale', 'pnj': 'cindy', 'niveau': 35, 'suivante': 'vil_3', 'serie': 'Les Vilinsekts',
  'texte': "Ces Vilinsekts ont des chefs. Trois lieutenants de Kankreblath gardent les planques : sans eux, la bande ne sait plus où cacher son butin.",
  'etapes': [{'nom': 'Les lieutenants', 'bulle': "Un lieutenant par planque. Quand les trois tombent, Kankreblath est tout seul avec ses cuillères.",
              'objectifs': [elite('Vaincre Cafarcher, lieutenant de Kankreblath', 'cafarcher', 'planque_6_-21', pv=3, nom='Cafarcher, lieutenant'),
                            elite('Vaincre Pyrasite, lieutenant de Kankreblath', 'pyrasite', 'planque_4_-19', pv=3, nom='Pyrasite, lieutenant'),
                            elite('Vaincre Sakarien, lieutenant de Kankreblath', 'sakarien', 'planque_1_-16', pv=3, nom='Sakarien, lieutenant')]}],
  'recompense': {**rec(3, 35), 'sac': 'rare'}}
Q['vil_3'] = {'nom': 'Les as de la cambriole', 'type': 'principale', 'pnj': 'cindy', 'rendre': 'cindy', 'niveau': 40, 'serie': 'Les Vilinsekts',
  'texte': "Tout ce qu'ils volent finit dans la Cache de Kankreblath, sous le grenier de Kerubim. Rapporte-moi des Caissettes de Babioles pour prouver que c'est bien eux, puis va reprendre le reste. Le Cloportier sait comment passer par le trou.",
  'etapes': [{'nom': 'Les preuves', 'objectifs': [{'t': 'recolter', 'texte': 'Récupérer 15 Caissettes de Babioles', 'ressource': '19630', 'n': 15}]},
             {'nom': 'La Cache', 'bulle': "Il est sous le plancher du grenier. Le Cloportier te rapetissera, il adore ça.",
              'objectifs': [{'t': 'donjon', 'texte': 'Vaincre Kankreblath (Cache de Kankreblath)', 'donjon': 'Cache de Kankreblath', 'boss': 'Kankreblath', 'niveau': 40, 'region': 'Astrub'}]}],
  'merci': "Ma cuillère ! Toute tordue, mais c'est la mienne. Astrub te doit une fière chandelle. Et moi, une cuillère.",
  'recompense': {**rec(5, 40), 'sac': 'epique', 'pepites': 60}}

# --- Quêtes officielles d'Astrub écrites en ARPG (Quêtes roadmap 2C : 5-6 parmi les plus drôles, titres et PNJ officiels) ---------
def ram(texte, objet, n, chance, **k): return {'t': 'ramasser', 'texte': texte, 'objet': objet, 'n': n, 'chance': chance, **k}
SZA = {'cite': 95, 'champs': 98, 'prairies': 173, 'calanques': 335, 'carriere': 96, 'foret': 97, 'tainela': 30, 'cimetiere': 102}
def sec(qid, pnj, nom, niv, texte, etapes, merci, sac='rare'):
    Q[qid] = {'nom': nom, 'type': 'secondaire', 'pnj': pnj, 'rendre': pnj, 'niveau': niv, 'serie': 'Astrub', 'texte': texte,
              'etapes': etapes, 'merci': merci, 'recompense': {**rec(3, niv), 'sac': sac, 'pepites': niv // 2}}
sec('aigris', 'hazel', "Les paroles s'envolent, les aigris restent", 12,
    "Hazel a commandé des chaudrons, on lui a livré des enclumes. Les Pious du quartier ont tout vu, et ils n'arrêtent pas d'en piailler. Fais-les parler, ou au moins taire.",
    [{'nom': 'Les témoins', 'objectifs': [vaincre('Faire taire 8 Pious bavards', 8, sousZone=SZA['cite']),
                                          ram('Retrouver le bon de livraison', 'Bon de livraison froissé', 1, 0.2, sousZone=SZA['cite'])]}],
    "Signé « Pierrette » ? Je ne connais aucune Pierrette. Enfin, maintenant je sais à qui renvoyer les enclumes.")
sec('piques', 'nepra', 'Piques de solution', 20,
    "Nepra Lido a un remède contre l'aventurite. Il lui manque des piquants bien frais, et les Prespics de la Forêt d'Astrub ne les prêtent pas.",
    [{'nom': 'Les piquants', 'objectifs': [ram('Rapporter 6 piquants de Prespic', 'Piquant de Prespic', 6, 0.35, monstres=['prespic'])]}],
    "Parfait. Je pique, ils guérissent. Enfin, ils arrêtent de foncer partout. C'est déjà ça.")
sec('crime', 'jim', 'Crime et châtiment', 20,
    "Jim Fleps veut une bourse, un os et un diamant. Il appelle ça un examen d'entrée. La Milice appellerait ça autrement, mais elle n'est pas là.",
    [{'nom': 'Le butin', 'objectifs': [ram('Une bourse (Cité d\'Astrub)', 'Bourse rebondie', 1, 0.2, sousZone=SZA['cite']),
                                       ram('Un os (Tainéla)', 'Os de Bouftou', 1, 0.2, sousZone=SZA['tainela']),
                                       ram('Un diamant (Carrière d\'Astrub)', 'Diamant brut', 1, 0.15, sousZone=SZA['carriere'])]}],
    "Tout y est. Tu as l'étoffe d'un grand voleur. Ou d'un grand idiot, ça dépend qui t'attrape.")
sec('trempette', 'seldawa', "Trempette dans un verre d'eau", 20,
    "Regane, la nièce de Sel Dawa, ne boit plus que de l'eau. Elle est partie aux Calanques pour en boire à la source, et les Pichons l'ont encerclée.",
    [{'nom': 'Les Calanques', 'objectifs': [aller("Aller aux Calanques d'Astrub", sousZone=SZA['calanques'])]},
     {'nom': 'Regane', 'bulle': "Ils sont partout ! Je ne boirai plus jamais d'eau ! … Enfin, plus jamais d'eau de mer.",
      'objectifs': [{'t': 'defense', 'texte': 'Protéger Regane pendant 45 s', 'carte': '10_-27', 's': 45},
                    elite("Vaincre l'Eau Rageuse", 'pichon_bleu', '10_-27', pv=4, nom='Eau Rageuse')]}],
    "Elle est rentrée trempée et elle a demandé une limonade. Une limonade ! Tu es un héros.")
sec('bucherons', 'sept', 'Bûcherons en détresse', 30,
    "Une bête sauvage sème la terreur parmi les bûcherons de la Forêt d'Astrub. Le disciple de Sêpt te demande de tenir le temps qu'ils rentrent, puis de la traquer.",
    [{'nom': 'Les bûcherons', 'objectifs': [{'t': 'defense', 'texte': 'Couvrir la retraite des bûcherons pendant 60 s', 'carte': '0_-26', 's': 60}]},
     {'nom': 'La bête', 'objectifs': [elite('Vaincre la Bête sauvage', 'sanglier', '-1_-27', pv=5, nom='Bête sauvage')]}],
    "Plus de grognements. Les haches vont pouvoir reprendre. Les arbres sont un peu moins contents, mais on ne peut pas plaire à tout le monde.", 'epique')
sec('profanateurs', 'becky', "L'invasion des profanateurs de sépultures", 35,
    "Becky, la fossoyeuse du Cimetière d'Astrub, retrouve ses tombes retournées chaque matin. Trois créatures en colère rôdent entre les stèles, et quelqu'un les commande.",
    [{'nom': 'Les créatures en colère', 'objectifs': [elite('Vaincre la Gargrouille en colère', 'gargrouille', '-2_-13', pv=3, nom='Gargrouille en colère'),
                                                      elite('Vaincre le Garglyphe en colère', 'garglyphe', '0_-12', pv=3, nom='Garglyphe en colère'),
                                                      elite('Vaincre La Ouassingue en colère', 'la_ouassingue', '-1_-11', pv=3, nom='La Ouassingue en colère')]},
     {'nom': 'Le cimetière', 'objectifs': [{'t': 'chrono', 'texte': 'Vider la carte [2,-12] en moins de 90 s', 'carte': '2_-12', 's': 90}]}],
    "Mes tombes vont enfin rester fermées. Enfin, celles qui doivent rester fermées.", 'epique')

# --- « Le premier pouvoir » (version 0.3, 8C) : Malek ouvre le Codex des pouvoirs. Une élite d'Astrub, puis un boss de donjon ;
# récompense : un Légendaire au pouvoir de ta classe, garanti. Le Codex s'ouvre aussi au premier Légendaire trouvé (world.ouvrirCodex).
Q['premier_pouvoir'] = {'nom': 'Le premier pouvoir', 'type': 'secondaire', 'pnj': 'forgemage', 'rendre': 'forgemage', 'niveau': 25, 'serie': 'Codex des pouvoirs',
  'v03': True, 'codex': True,
  'texte': "Malek parle d'un livre où la forge garde les pouvoirs des objets brisés. Pour l'ouvrir, il lui faut un vrai pouvoir sous le marteau. Le Chef de Guerre Bouftou de Tainéla en porte un, mal accroché, et le Bouftou Royal un autre, bien accroché.",
  'etapes': [{'nom': 'Le pouvoir mal accroché', 'bulle': "Le Chef de Guerre Bouftou garde Tainéla. Il porte une corne qui brille un peu trop pour une corne. Rapporte-la.",
              'objectifs': [elite('Vaincre le Chef de Guerre Bouftou de Tainéla', 'chef_de_guerre_bouftou', '1_-33', pv=3, nom='Chef de Guerre Bouftou, porte-pouvoir')]},
             {'nom': 'Le pouvoir bien accroché', 'bulle': "La corne a chanté sous mon marteau, puis elle s'est tue. Il en faut une plus grosse. Le Bouftou Royal en a une, sur la tête.",
              'objectifs': [dj('Cour du Bouftou Royal', 'Bouftou Royal', 30, 'Astrub')]}],
  'merci': "La couronne a parlé : le Codex est ouvert. Brise-moi un Légendaire et son pouvoir reste écrit dedans, pour toujours. Tiens, celui-là porte un pouvoir de ta classe. Ne le brise pas tout de suite, porte-le d'abord.",
  'recompense': {**rec(4, 30), 'sac': 'legendaire', 'pouvoirClasse': True, 'pepites': 30}}

# --- Quêtes des petits Dofus (version 0.3, ligne « Dofus 0.3 : 1A 2B 3A 4C ») : « œuf à reconstituer » = 3 fragments gardés par
# 3 élites de zones différentes, puis la coquille gardée par un boss officiel de la zone en version gardien. Le Gawdien du Dofus lance
# et reçoit ; le PNJ officiel du Dofus raconte. Récompense : le Dofus (src/sim/dofus.ts).
Q['oeuf_argent'] = {'nom': "L'œuf d'argent", 'type': 'secondaire', 'pnj': 'gawdien', 'rendre': 'gawdien', 'niveau': 20, 'serie': 'Les Dofus', 'v03': True,
  'texte': "Un œuf d'argent s'est brisé au-dessus d'Astrub. Trois morceaux, trois voleurs, et une coquille que personne n'ose approcher. Rathrosk, qui le couvait, en sait plus que moi.",
  'etapes': [{'nom': "Le couveur d'œufs", 'bulle': "Rathrosk attend près de la Cité d'Astrub. Il a couvé l'œuf. Il va pleurer, sois patient.",
              'objectifs': [parler('Parler à Rathrosk', 'rathrosk')]},
             {'nom': 'Les trois fragments', 'bulle': "Trois fragments, trois chapardeurs : un Épouvanteur des Champs, une larve des Prairies, un Pichon des Calanques. Ils brillent, tu ne peux pas les rater.",
              'objectifs': [elite("Reprendre le fragment de l'Épouvanteur (Champs d'Astrub)", 'epouvanteur', '5_-28', pv=3, nom="Épouvanteur à l'éclat d'argent"),
                            elite("Reprendre le fragment de la Larve (Prairies d'Astrub)", 'larve_orange', '7_-13', pv=3, nom="Larve à l'éclat d'argent"),
                            elite("Reprendre le fragment du Pichon (Calanques d'Astrub)", 'pichon_orange', '11_-26', pv=3, nom="Pichon à l'éclat d'argent")]},
             {'nom': 'La coquille', 'bulle': "Les fragments chantent quand on les approche de la coquille. Le Tournesol Affamé l'a enroulée dans ses racines, au fond des Champs.",
              'objectifs': [elite('Vaincre le Tournesol Affamé, gardien de la coquille', 'tournesol_affame', '6_-26', pv=2, nom='Tournesol Affamé, gardien de la coquille')]}],
  'merci': "La coquille et ses trois morceaux. L'œuf ne vivra jamais, mais il se souviendra de toi : quand tout va mal, il te rendra un peu de force. Le Dofus Argenté est à toi.",
  'recompense': {**rec(4, 20), 'dofus': '19629', 'pepites': 20}}
Q['oeuf_cacao'] = {'nom': "L'œuf en chocolat", 'type': 'secondaire', 'pnj': 'gawdien', 'rendre': 'gawdien', 'niveau': 35, 'serie': 'Les Dofus', 'v03': True, 'requiert': ['oeuf_argent'],
  'texte': "Un œuf en chocolat a fondu près d'Astrub. Ce qu'il en reste, une drôle d'énergie, refuse de partir sans lui. Trois gourmands ont emporté les morceaux.",
  'etapes': [{'nom': "L'énergie du Dofus", 'bulle': "L'Énergie du Dofus Cacao flotte dans la Cité d'Astrub. Elle sent bon et elle est furieuse.",
              'objectifs': [parler("Parler à l'Énergie du Dofus Cacao", 'energie_cacao')]},
             {'nom': 'Les trois gourmands', 'bulle': "Un Milimulou de la Forêt, un Douzdoa de la Carrière et un Garglyphe du Cimetière. Ils ont du chocolat plein les dents.",
              'objectifs': [elite('Reprendre le morceau du Milimulou (Forêt d\'Astrub)', 'milimulou', '-2_-26', pv=3, nom='Milimulou chocolaté'),
                            elite('Reprendre le morceau du Douzdoa (Carrière d\'Astrub)', 'douzdoa', '10_-19', pv=3, nom='Douzdoa chocolaté'),
                            elite('Reprendre le morceau du Garglyphe (Cimetière d\'Astrub)', 'garglyphe', '1_-13', pv=3, nom='Garglyphe chocolaté')]},
             {'nom': 'La coquille', 'bulle': "La coquille a roulé dans les Égouts. Kankreblath l'a trouvée avant toi, et il n'aime pas partager.",
              'objectifs': [elite('Vaincre Kankreblath, gardien de la coquille', 'kankreblath', 'egout_7', pv=2, nom='Kankreblath, gardien de la coquille')]}],
  'merci': "L'énergie est rentrée dans sa coquille. Le Dofus Cacao te protégera quand on te tire dessus au milieu de la mêlée. Et il sent toujours le chocolat.",
  'recompense': {**rec(4, 35), 'dofus': '20987', 'pepites': 30}}

# --- Chasse au Dopeul (officielle, répétable une fois par jour, Quêtes roadmap 7B) --------------------------------------------------
Q['dopeul'] = {'nom': 'Chasse au Dopeul', 'type': 'prime', 'pnj': 'temples', 'rendre': 'temples', 'niveau': 12, 'repetable': 'jour', 'serie': 'Temples',
  'texte': "Ton Dopeul t'attend aux portes des Champs d'Astrub. Il connaît tous tes sorts. Bats-le, et reviens me voir : le maître des combats paie toujours sa dette.\n\nUne fois par jour.",
  'etapes': {c: [{'nom': 'Vaincre le Dopeul', 'objectifs': [elite(f'Vaincre le Dopeul {n}', f'dopeul_{c}', '5_-25', pv=2)]}] for c, n in (('iop', 'Iop'), ('cra', 'Crâ'))},
  'merci': "Ton Dopeul est rentré au temple en boudant. C'est bon signe.",
  'recompense': {**rec(3, 15), 'sac': 'rare', 'pepites': 10}}

# --- Avis de recherche d'Astrub (officiels, 3A) : une traque par semaine, rendue aux Geôles (Gardien des Geôles d'Astrub) -------------
G = {'type': 'prime', 'pnj': 'geolier', 'rendre': 'geolier', 'serie': 'Avis de recherche', 'repetable': 'semaine'}
for qid, nom, niv, monstre, carte, texte in [
    ('avis_fouduglen', "On recherche Fouduglen l'écureuil", 20, 'fouduglen_l_ecureuil', '2_-18', "Fouduglen parcourt la ville d'Astrub à la recherche des glands succulents à se mettre sous la dent."),
    ('avis_sam', 'On recherche Sam Sagaz', 20, 'sam_sagaz', '7_-12', "Sam Sagaz a été aperçu dans les prairies d'Astrub.\nIl est condamné à l'emprisonnement dans les geôles de la milice."),
    ('avis_frakacia', 'On recherche Frakacia Leukocytine', 30, 'frakacia_leukocytine', '0_-25', "Certains disent avoir vu Frakacia Leukocytine du côté de la Forêt d'Astrub.\nElle est recherchée pour ponctions illégales d'hémoglobine.\nCondamnée à l'emprisonnement à Astrub.")]:
    Q[qid] = {**G, 'nom': nom, 'niveau': niv, 'texte': texte + "\n\nUne traque par semaine : l'avis revient le lundi.",
              'etapes': [{'nom': nom, 'objectifs': [elite(f"Capturer {nom.replace('On recherche ', '')}", monstre, carte)]}],
              'merci': "Au trou ! La Milice te remercie, et la prime est à toi.",
              'recompense': {**rec(4, niv), 'sac': 'epique', 'pepites': niv}}

# --- Contrats du jour (Quêtes roadmap 2A) : titres officiels des quêtes d'Astrub et une ligne de contexte par sous-zone -------------
CONTRATS = {'titres': {
  '95': [("Les paroles s'envolent, les aigris restent", "Des Pious se battent pour une miette sur la place du Zaap. La Milice compte sur toi pour ramener le calme."),
         ('Combat de rue', "Les ruelles de la Cité sont devenues un ring. Fais le ménage avant que les marchands ne ferment boutique."),
         ('Crise sanitaire', "Les Pious nichent partout et les toits d'Astrub ne s'en remettent pas. Nettoie, la Milice paiera le savon.")],
  '98': [('Le repos est dans le champ', "Les fleurs des Champs d'Astrub ont décidé de mordre. Les paysans voudraient faire la sieste en paix."),
         ("Qui sème le vent récolte l'Artempeth", "Les Tournesols et leurs amis envahissent les récoltes. Coupe-les court."),
         ("C'est pourtant naturel", "Une Rose qui attaque, ce n'est pas naturel. Va expliquer ça aux Champs.")],
  '173': [('La petite mission dans la prairie', "Les Larves pullulent dans les Prairies d'Astrub. Une petite mission, qu'ils disaient."),
          ('On marche sur des œufs', "Les Larves pondent partout. Avance doucement, frappe fort."),
          ('Série animalière', "Les naturalistes d'Astrub veulent moins de Larves dans leurs croquis. Aide-les.")],
  '335': [("Comme un pichon hors de l'eau", "Les Pichons des Calanques sortent de l'eau pour mordre les baigneurs. Renvoie-les au fond."),
          ("Ça tombe à l'eau", "Les pêcheurs des Calanques n'attrapent plus rien : les Pichons les attrapent d'abord."),
          ("Trempette dans un verre d'eau", "Une baignade tranquille aux Calanques ? Pas tant que les Pichons font la loi.")],
  '96': [('Golémancien', "Les Doas de la Carrière d'Astrub ont pris goût aux mineurs. Remets-les à leur place : dans la roche."),
         ('Ça sent le gaz', "Quelque chose remue au fond de la Carrière. Ce n'est sûrement pas un mineur."),
         ('Le génie se meut', "Les pierres de la Carrière bougent toutes seules. La Milice préférerait qu'elles arrêtent.")],
  '97': [('Balade en forêt', "La Forêt d'Astrub n'est plus une promenade. Les Sangliers chargent tout ce qui bouge."),
         ('Le rebelle de la forêt', "Les bûcherons n'osent plus entrer dans la Forêt d'Astrub. Ouvre-leur le chemin."),
         ("Légende d'automne", "Les feuilles tombent, les Prespics aussi si tu t'y prends bien.")],
  '30': [('Les touffes des héros', "Les Bouftous de Tainéla piétinent tout. Un héros, ça se reconnaît à sa laine sur les bottes."),
         ('Déjeuner à la fourchette', "Les bergers de Tainéla ont faim et les Bouftous ne se laissent pas faire. Donne-leur un coup de main."),
         ('Restauration rapide', "Les auberges d'Astrub manquent de gigot. Tainéla en déborde. Fais le lien.")],
  '102': [("L'invasion des profanateurs de sépultures", "Le Cimetière d'Astrub ne dort plus. Recouche ses habitants, de force s'il le faut."),
          ('Six pieds sous terre', "Les Ouassingues creusent, les Gargrouilles volent. Le gardien du Cimetière n'en dort plus."),
          ('La coupe des vices', "Des pierres tombales qui marchent, ce n'est pas bon pour le commerce des fleurs.")],
  '843': [('De vrais rats de bibliothèque', "Les Vilinsekts ont vidé une bibliothèque entière dans leurs planques. Va chercher les livres, et les voleurs."),
          ("Les deux font l'impair", "Les Vilinsekts volent toujours par deux. Les attraper par deux, c'est mieux.")],
}}

# --- Succès officiels (achievements) ----------------------------------------------------------------------
def suc(nom, did, desc, cat, sous, pts, icone, obj, ratio=0, objet=None):
    s = {'nom': nom, 'dofusId': did, 'description': desc, 'categorie': cat, 'sousCategorie': sous, 'points': pts, 'icone': icone, 'objectifs': obj}
    r = {}
    if ratio: r['xp'] = round(ratio * 500)
    if objet: r['objet'] = objet
    if r: s['recompense'] = r
    return s
S = {
  'premier_temps': suc('Premier temps', 8518, 'Terminer la première partie du tutoriel.', 'Quêtes', 'Incarnam', 1, 203,
     [{'nom': 'Premiers pas', 'etape': ['reponses', 0]}, {'nom': 'Premières armes', 'etape': ['reponses', 8]}, {'nom': 'Première partie du tutoriel', 'quete': 'reponses'}], 0.213),
  'second_temps': suc('Second temps', 8519, 'Terminer la seconde partie du tutoriel.', 'Quêtes', 'Incarnam', 1, 203, [{'nom': 'Seconde partie du tutoriel', 'quete': 'village'}], 0.213),
  'bonnes_bases': suc('Sur de bonnes bases', 8520, 'Terminer les succès du tutoriel.', 'Quêtes', 'Incarnam', 3, 273,
     [{'nom': 'Premier temps', 'succes': 'premier_temps'}, {'nom': 'Second temps', 'succes': 'second_temps'}], 0.287, '10207'),
  'debutant': suc('Débutant', 3, 'Atteindre le niveau 10.', 'Général', 'Niveaux', 1, 58, [{'nom': 'Niveau 10', 'niveau': 10}]),
  'crypte': suc('Crypte de Kardorim', 33, 'Vaincre Kardorim dans son donjon.', 'Donjons', 'Niveaux 1 à 50', 10, 299,
     [{'nom': 'Kardorim', 'monstre': 'kardorim'}, {'nom': 'Niveau 10', 'niveau': 10}], 1, '16525'),
  # Dofus (0.3, ligne « Onglet Dofus : … 5A ») : compteur de la fenêtre Dofus ; le dernier reprend le succès officiel « L'héritage des Dofus »
  'dofus_2': suc('Deux œufs au nid', 0, 'Posséder 2 Dofus.', 'Général', 'Dofus', 10, 458, [{'nom': '2 Dofus', 'dofus': 2}], 1),
  'dofus_6': suc('Six emplacements', 0, 'Posséder 6 Dofus.', 'Général', 'Dofus', 20, 458, [{'nom': '6 Dofus', 'dofus': 6}], 2),
  'dofus_12': suc('Un œuf par dieu', 0, 'Posséder 12 Dofus.', 'Général', 'Dofus', 30, 458, [{'nom': '12 Dofus', 'dofus': 12}], 4),
  'dofus_31': {**suc("L'héritage des Dofus", 8989, 'Posséder les 31 Dofus.', 'Général', 'Dofus', 50, 82, [{'nom': '31 Dofus', 'dofus': 31}], 8), },
}
S['dofus_6'].setdefault('recompense', {})['titre'] = 'Couveur de Dofus'
S['dofus_31'].setdefault('recompense', {})['titre'] = 'Héritier des Dofus'
EXPLO = [('lac', 414, 'Lac', 'lac', 0.1), ('champs', 415, 'Champs', 'champs', 0.1), ('cimetiere', 416, 'Cimetière', 'cimetiere', 0.1), ('foret', 417, 'Forêt', 'foret', 0.1),
         ('mine', 419, 'Mine', 'mine', 0.1), ('paturages', 420, 'Pâturages', 'paturages', 0.1), ('route', 422, 'Route des âmes', 'route', 0.05),
         ('taverne', 423, 'Taverne', 'taverne', 0.1), ('temple', 424, 'Temple Céleste', 'temple', 0.05)]
for k, did, nom, sz, ratio in EXPLO:
    S['zone_' + k] = suc(nom, did, f'Découvrir la zone "{nom}".', 'Exploration', 'Incarnam', 1, 176, [{'nom': nom, 'sousZone': SZ[sz]}], ratio)
S['dans_les_nuages'] = suc('Dans les nuages', 840, 'Obtenir les Succès suivants.', 'Exploration', 'Incarnam', 10, 82,
    [{'nom': nom, 'succes': 'zone_' + k} for k, _, nom, _, _ in EXPLO], 1, '1711')   # Chienchien (maquette Familiers 1C)

S['tour_du_monde'] = suc('Le tour du monde en 27 donjons', 559, 'Terminer la série des quêtes du tour du monde.', 'Donjons', 'Le tour du monde', 50, 203,
    [{'nom': q[1], 'quete': q[0]} for q in TDM], 5)
S['tour_du_monde']['recompense']['titre'] = 'Globe-trotteur'
# Archimonstres (ligne « Archis : » 8C, 2026-11-12) : paliers du carnet des âmes, titres officiels liés à Otomaï et aux âmes
ARCHIS = [(10, 'Apprenti d\'Otomaï', 'Dix âmes', 10, 1), (25, 'Farfouilleur d\'Otomaï', 'Vingt-cinq âmes', 20, 2), (50, 'Chasseur d\'Âmes', 'Cinquante âmes', 30, 4),
          (110, 'Chasseur de Légendes', 'Toutes les âmes', 50, 8)]
for n, titre, nom, pts, ratio in ARCHIS:
    S[f'archis_{n}'] = suc(nom, 0, f'Capturer {n} archimonstres différents dans une Petite pierre d\'âme.', 'Monstres', 'Archimonstres', pts, 161,
        [{'nom': f'{n} archimonstres', 'archis': n}], ratio)
    S[f'archis_{n}']['recompense']['titre'] = titre

# Collection d'apparences (maquette « Équipement en trop » 1C) : un succès par panoplie dont on a collectionné
# toutes les pièces visibles (coiffe, cape, bouclier ; au moins deux), en les brisant ou en les recyclant
ITEMS = json.load(open(os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'data', 'items.json'), encoding='utf-8'))
for sid, pano in ITEMS['sets'].items():
    vis = [str(i) for i in pano['items'] if ITEMS['equipment'].get(str(i), {}).get('slot') in ('chapeau', 'cape', 'bouclier')]
    if len(vis) < 2: continue
    S['garde_robe_' + sid] = suc(pano['name'], 0, f"Collectionner l'apparence de chaque pièce visible : {pano['name']}.", 'Général', 'Garde-robe',
        5 * len(vis), 82, [{'nom': ITEMS['equipment'][i]['name'], 'apparence': i} for i in vis])
exec(open(os.path.join(os.path.dirname(__file__), 'succes_officiels.py'), encoding='utf-8').read())
if os.environ.get('SUCCES_SEULS'):
    # SUCCES_SEULS=1 : ne réécrit que les succès (les quêtes du JSON ont été retouchées à la main depuis, ex. trames de classes)
    _J = json.load(open(OUT, encoding='utf-8')); _J['succes'] = S
    json.dump(_J, open(OUT, 'w'), ensure_ascii=False, indent=1)
else:
    json.dump({'pnj': PNJ, 'quetes': Q, 'succes': S, 'contrats': CONTRATS}, open(OUT, 'w'), ensure_ascii=False, indent=1)
print(len(Q), 'quêtes', len(S), 'succès')
