# succes_vivant.py : succès de la 0.5 « monde vivant » (maquette « 0.5 : 4D »), ajoutés à src/data/quetes.json sans rien réécrire d'autre.
# Un succès par boss du monde, avec le titre officiel choisi dans la table titles de Dofus 3 (aucun titre officiel n'existe pour ces
# boss : on prend le plus proche), et deux succès d'invasions. Relancer après une modification de src/data/monde_vivant.json.
import json, os
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
MV = json.load(open(os.path.join(R, 'src/data/monde_vivant.json')))
F = os.path.join(R, 'src/data/quetes.json')
Q = json.load(open(F))
S = Q['succes']
# titres officiels (table titles) : Maître de guerre (281), Marcheur Dimensionnel (68), Vampyre (2), Dékrokilliseur (21), Gardien de la Paix (149)
for cle, b in MV['boss']['liste'].items():
    S[f'boss_monde_{cle}'] = {'dofusId': 0, 'categorie': 'Événements', 'sousCategorie': 'Boss du monde', 'icone': 140,
        'nom': b['nom'], 'description': f"Vaincre {'les ' if b['nom'].startswith('Gelées') else 'le '}{b['nom']} quand {'elles sortent' if b['nom'].startswith('Gelées') else 'il sort'} en boss du monde.",
        'points': 20, 'objectifs': [{'nom': b['nom'], 'bossMonde': cle}], 'recompense': {'xp': b['niveau'] * 100, 'titre': b['titre']}}
S['invasion_1'] = {'dofusId': 0, 'categorie': 'Événements', 'sousCategorie': 'Invasions', 'icone': 140, 'nom': 'Première invasion repoussée',
    'description': "Remplir la jauge d'une invasion.", 'points': 10, 'objectifs': [{'nom': 'Invasions repoussées', 'invasions': 1}], 'recompense': {'xp': 1000}}
S['invasion_10'] = {'dofusId': 0, 'categorie': 'Événements', 'sousCategorie': 'Invasions', 'icone': 140, 'nom': 'Gardien de la Paix',
    'description': "Remplir la jauge de 10 invasions.", 'points': 30, 'objectifs': [{'nom': 'Invasions repoussées', 'invasions': 10}], 'recompense': {'xp': 5000, 'titre': 'Gardien de la Paix'}}
json.dump(Q, open(F, 'w'), ensure_ascii=False, indent=1)
print(len([k for k in S if k.startswith(('boss_monde_', 'invasion_'))]), 'succès')
