# Textes écrits à la main du Parangon (choix de Mathis, 2026-11-05 : 1B 2B 3A 4B 5A+5B 6B).
# Le jeu est en temps réel : aucun vocabulaire de tour. 1 tour officiel = 3 s, « au contact » = corps à moins de 12 px.
# Les nœuds de sort n'ont jamais de contrepartie ; seules les clés de voûte (générales, sans sort) ont un prix.

ZONES = ['terre', 'feu', 'eau', 'air', 'soutien']

# Petits nœuds : (stat, valeur) en cycle le long des troncs de chaque zone.
CARACS = {
    'terre': [('force', 5), ('dommages_terre_pct', 3), ('resistance_terre_pct', 4), ('dommages_critiques_pct', 2)],
    'feu': [('intelligence', 5), ('dommages_feu_pct', 3), ('resistance_feu_pct', 4), ('critique_pct', 2)],
    'eau': [('chance', 5), ('dommages_eau_pct', 3), ('resistance_eau_pct', 4), ('prospection', 4)],
    'air': [('agilite', 5), ('dommages_air_pct', 3), ('resistance_air_pct', 4), ('reduction_recharge_pct', 2)],
    'soutien': [('vitalite', 20), ('sagesse', 5), ('soins_pct', 3), ('resistance_toutes_pct', 2)],
}
CARACS_CLASSE = {'osamodas': {'soutien': [('vitalite', 20), ('sagesse', 5), ('dommages_invocations_pct', 3), ('pv_invocations_pct', 4)]}}

# Emplacements de rune (3A : Rune / Pa / Ra = +50 / +100 / +150 % aux petits nœuds de la carac autour).
RUNES = {'terre': ['Fo'], 'feu': ['Ine'], 'eau': ['Cha'], 'air': ['Age'], 'soutien': ['Vi', 'Sa']}
RUNE_BONUS = {'Rune': 50, 'Pa': 100, 'Ra': 150}

NOTABLES = {
    'iop': {
        'terre': [('Érosion', "Pression, Épée Destructrice, Fracture, Fustigation et Vindicte érodent 50 % de plus."),
                  ('Acharnement', "Le bonus de Fureur et de Pugilat (dommages qui montent à chaque lancer) monte deux fois plus vite.")],
        'feu': [('Rassemblement', "Rassemblement et Couperet touchent une case de zone en plus."),
                ('Tempête', "Tempête de Puissance touche aussi les ennemis autour de sa cible.")],
        'eau': [('Rempart', "Tes boucliers (Ferveur, Endurance, Épée du Jugement, Fendoir) sont 25 % plus solides."),
                ('Déferlement', "Après un Déferlement, ton prochain sort Eau coûte 1 PA de moins.")],
        'air': [('Souffle', "Souffle et Intimidation repoussent de 2 cases de plus, et un ennemi qui heurte un mur subit des dommages de poussée."),
                ('Lame céleste', "Épée Céleste et Zénith ont 15 % de zone en plus.")],
        'soutien': [('Puissance', "Le bonus du sort Puissance dure deux fois plus longtemps."),
                    ('Vitalité', "Le sort Vitalité donne aussi +10 % à toutes les résistances.")],
    },
    'cra': {
        'terre': [('Pointe lourde', "+10 % dommages Terre, et tes flèches Terre repoussent d'une case."),
                  ('Archer patient', "+15 % dommages si tu n'as pas bougé depuis 1 s.")],
        'feu': [('Embrasement', "Tes poisons Feu durent 50 % plus longtemps."),
                ('Déflagration', "Flèche Explosive et Flèche Détonante ont 15 % de zone en plus.")],
        'eau': [('Givre', "Tes ralentissements durent 30 % plus longtemps."),
                ('Sangsue', "+5 % de vol de vie sur tes flèches Eau.")],
        'air': [('Pas léger', "+10 % de vitesse de déplacement."),
                ('Volée', "Flèche de Dispersion et Pluie de Flèches ont 15 % de zone en plus.")],
        'soutien': [('Balises', "Tes balises durent 50 % plus longtemps."),
                    ('Œil vif', "+1 case de portée à toutes tes flèches.")],
    },
    'osamodas': {
        'terre': [('Cuir épais', "+15 % de PV pour tes invocations."),
                  ('Ruée', "Charge Bestiale repousse d'une case de plus.")],
        'feu': [('Crocs ardents', "+10 % de critique pour tes invocations."),
                ('Flamme', "Souffle Draconique a 15 % de zone en plus.")],
        'eau': [('Lien vital', "Tes soins sur les invocations sont 20 % plus forts."),
                ('Marécage', "Saute-granouille ralentit les ennemis à l'arrivée.")],
        'air': [('Vol rapide', "+15 % de vitesse de déplacement pour tes invocations."),
                ('Plumage', "Cri du Corbac vole 20 % de vie de plus.")],
        'soutien': [('Dresseur', "Une invocation de base de plus en même temps."),
                    ('Fouet sec', "Fouet et Cravache se rechargent 3 s plus vite.")],
    },
}

# Clés de voûte (2B : une seule active). Générales : elles ne touchent à aucun sort, et elles ont un prix.
CLES = {
    'iop': {'terre': ('Colosse', "+30 % dommages.", "Tu ne fais plus de coups critiques."),
            'feu': ('Fournaise', "+20 % dommages et +10 % critique.", "-20 % à toutes tes résistances."),
            'eau': ('Roc', "+25 % à toutes tes résistances.", "-15 % de vitesse de déplacement."),
            'air': ('Fantôme', "+20 % de vitesse de déplacement et d'attaque.", "-25 % de PV max.")},
    'cra': {'terre': ('Œil de faucon', "+25 % dommages sur les ennemis à plus de 5 cases.", "-25 % dommages sur les ennemis à moins de 3 cases."),
            'feu': ('Tir rapide', "+20 % de vitesse d'attaque.", "-15 % dommages."),
            'eau': ('Sang-froid', "+25 % à toutes tes résistances quand tu ne bouges pas.", "-15 % de vitesse de déplacement."),
            'air': ('Fantôme', "+20 % de vitesse de déplacement et d'attaque.", "-25 % de PV max.")},
    'osamodas': {'terre': ('Meneur de meute', "+40 % dommages pour tes invocations.", "-25 % à tes propres dommages."),
                 'feu': ('Brasier', "+20 % dommages et +10 % critique, pour toi et ta meute.", "-20 % à toutes tes résistances."),
                 'eau': ('Gardien', "+25 % à toutes les résistances, pour toi et ta meute.", "-15 % de vitesse de déplacement."),
                 'air': ('Envol', "+20 % de vitesse de déplacement et d'attaque.", "-25 % de PV max.")},
}

# Transformations : sorts du niveau 140 et plus (gros nœuds au bord de l'arbre, que du bonus).
TRANSFO = {
    # Iop
    'Rassemblement': ('Tourbillon', "Rassemblement attire tous les ennemis d'un grand rayon vers son centre."),
    'Fustigation': ('Sol érodé', "La zone de Fustigation reste au sol 3 s : les ennemis qui y entrent sont érodés eux aussi."),
    'Vindicte': ('Contagion', "L'érosion de Vindicte saute sur les 2 ennemis les plus proches de la cible."),
    'Tannée': ('Correction', "Les ennemis ralentis par Tannée sont ensuite attirés vers toi."),
    'Pugilat': ('Enchaînement', "Le bonus de Pugilat ne retombe plus tant que tu frappes au moins une fois toutes les 3 s."),
    'Massacre': ('Carnage', "Quand l'ennemi marqué par Massacre meurt, la marque passe à l'ennemi le plus proche."),
    'Fendoir': ('Bastion', "Tes boucliers de Fendoir explosent en dommages Eau autour de toi quand ils se brisent."),
    'Coup pour Coup': ('Riposte', "Pendant 6 s après le lancer, tout ennemi qui te frappe au contact est repoussé."),
    'Zénith': ('Apogée', "Le bonus de Zénith compte toujours tes PM pleins, même après un Bond."),
    'Détermination': ('Inébranlable', "Détermination se lance aussi sur toi : bouclier, et impossible à repousser pendant 4 s."),
    'Tumulte': ('Mêlée générale', "Tumulte compte aussi les ennemis autour de toi, pas seulement ceux de sa zone."),
    'Duel': ('Arène', "Pendant Duel, tu peux encore utiliser Bond, et l'ennemi immobilisé subit +20 % de dommages."),
    'Colère de Iop': ('Colère sans fin', "Colère de Iop part dès que ta Rage est pleine, sans attendre sa recharge."),
    # Crâ
    'Flèche Tyrannique': ('Tyrannie', "Quand la cible meurt, le poison de Flèche Tyrannique saute sur un ennemi proche."),
    'Flèches Amoureuses': ('Cœur fidèle', "Flèches Amoureuses te soigne aussi de la moitié du soin donné."),
    'Flèches Enflammées': ('Traînée de feu', "Ton recul laisse une traînée de feu qui brûle les ennemis qui la traversent."),
    'Flèche Massacrante': ('Hécatombe', "Chaque ennemi tué par Flèche Massacrante déclenche une petite explosion Terre."),
    'Pluie de Flèches': ('Averse', "La seconde vague de Pluie de Flèches tombe sur l'ennemi le plus proche au lieu du même endroit."),
    'Flèche Paralysante': ('Gel', "Flèche Paralysante immobilise 1 s les ennemis déjà ralentis."),
    'Représailles': ('Châtiment', "Représailles frappe aussi tous les ennemis érodés d'un grand rayon autour de la cible."),
    'Vendetta': ('Piège tenace', "Le piège de Vendetta se repose tout seul une fois, 3 s après s'être déclenché."),
    'Flèche du Jugement': ('Verdict', "Flèche du Jugement frappe toujours comme si tes PM étaient pleins."),
    'Flèche de Rédemption': ('Rachat', "Chaque ralentissement réussi par tes autres flèches charge aussi Flèche de Rédemption."),
    'Flèche Boomerang': ('Retour', "Flèche Boomerang revient vers toi et touche une seconde fois tout ce qu'elle traverse."),
    'Flèche Fulminante': ('Foudre en chaîne', "Flèche Fulminante rebondit sans limite tant qu'un ennemi est à 2 cases."),
    'Sentinelle': ('Vigie', "Sentinelle ne s'affaiblit plus quand tu te déplaces."),
    # Osamodas
    'Pacte Bestial': ('Pacte de sang', "Pacte Bestial ne sacrifie plus tes invocations : elles restent, à 50 % de leurs PV."),
    'Communion Animale': ('Âme partagée', "Les dommages partagés par Communion Animale sont réduits de 30 %."),
    'Tornade de Plumes': ('Migration', "Tornade de Plumes emmène tes invocations avec toi à l'arrivée."),
    'Frappe du Craqueleur': ('Sol craquelé', "Frappe du Craqueleur laisse un sol craquelé 3 s qui ralentit les ennemis."),
    'Chant du Phénix': ('Renaissance', "Chant du Phénix relève une invocation morte depuis moins de 10 s, à 30 % de PV."),
    'Tourbillon': ('Chaos', "Tourbillon échange aussi de place les ennemis, ce qui casse leurs groupes."),
    'Martinet': ('Curée', "Avec Martinet, toutes tes invocations attaquent la cible, même hors de portée."),
    'Relais Spirituel': ('Relais vital', "Relais Spirituel soigne l'invocation échangée de 20 % de ses PV."),
    'Craquolosse': ('Provocation', "Le Craquolosse attire l'attention des ennemis proches : ils l'attaquent au lieu de toi."),
    'Crocoléreux': ('Carapace', "Le Crocoléreux réduit les dommages reçus par toute la meute autour de lui."),
    'Sulfénix': ('Cendres', "Le Sulfénix renaît une fois de ses cendres, à 50 % de ses PV."),
    'Scarafoudre': ('Champ électrique', "Quand le Scarafoudre se téléporte, il donne son bouclier à toute la meute."),
    'Esprit Facétieux': ('Farce', "Le Gobgob Facétieux copie une invocation sans se sacrifier."),
}
