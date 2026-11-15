# arene_ames.py : arène des âmes (ligne « Arène : » du 2026-11-15) dans src/data/quetes.json.
# Ajoute la Gardienne et le Gardien de l'arène (PNJ officiels 1436 et 1435, au Marché couvert du Bastion, de part et d'autre
# de la porte de l'arène) et les succès à titres de l'arène (15B). Dialogues inédits, ton bagarreur des PNJ officiels.
# Relancer après quetes.py (qui réécrit tout le fichier). Cases : grille de la salle `marche` (voir tools/extraction/marche.py).
import json, os
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'data', 'quetes.json')
Q = json.load(open(OUT, encoding='utf-8'))
SERV = [{'texte': 'Invoquer des âmes.', 'service': 'arene'}]
Q['pnj']['gardienne_arene'] = {'nom': "Gardienne de l'arène", 'dofusId': 1436, 'zone': 'bastion', 'carte': 'marche', 'case': 1829, 'titre': 'Arène des âmes',
  'phrase': "Une âme en poche ? Donne-la-moi, je la relâche, et tu la recombats. Personne ne s'en va avant que le sang ait coulé. Le sien, de préférence.",
  'services': SERV,
  'discussion': [
    {'reponse': "Comment ça marche ?", 'texte': "Tu choisis jusqu'à cinq âmes, boss ou archimonstres. Je t'envoie dans l'arène avec ceux qui sont autour de toi, et elles reviennent une par une. Chacun repart avec son butin."},
    {'reponse': "Et si je perds ?", 'texte': "Tu te réveilles ici, devant moi, la honte en plus. L'âme, elle, est partie. On ne relâche pas deux fois la même colère."},
    {'reponse': "Et la quête de l'Ocre ?", 'texte': "Le registre de l'Assistante garde la trace de tout ce que tu as capturé. Relâche sans crainte, ton nom reste écrit."},
    {'reponse': "C'est quoi, une âme corrompue ?", 'texte': "Une sur vingt revient avec un peu d'Enfer dedans. Plus méchante, plus riche. Tu verras bien."},
  ]}
Q['pnj']['gardien_arene'] = {'nom': "Gardien de l'arène", 'dofusId': 1435, 'zone': 'bastion', 'carte': 'marche', 'case': 2042, 'titre': 'Arène des âmes',
  'phrase': "Chaque lundi, j'offre une âme à qui veut bien se faire corriger. La même pour tout le monde. Après, on compare les temps.",
  'services': SERV,
  'discussion': [
    {'reponse': "Le défi, c'est obligatoire ?", 'texte': "Non. Mais le public adore. Réussis-le et je glisse un peu plus de butin à chaque âme. Rate-le et je rirai, gratuitement."},
    {'reponse': "Cinq boss d'affilée, c'est raisonnable ?", 'texte': "Trois au moins, et tu as droit au grand coffre. Raisonnable, non. Mémorable, oui."},
    {'reponse': "On peut échanger des âmes ?", 'texte': "Pas encore. Le jour où les marchands du Bastion feront affaire entre aventuriers, je tiendrai le comptoir des âmes."},
  ]}
TITRES = [(25, 'Gladiateur', "Vingt-cinq âmes relâchées", 10, 2), (100, 'Champion de l\'arène', 'Cent âmes relâchées', 20, 4), (250, 'Maître de l\'arène', 'Deux cent cinquante âmes', 40, 8)]
for n, titre, nom, pts, ratio in TITRES:
    Q['succes'][f'arene_{n}'] = {'nom': nom, 'dofusId': 0, 'description': f"Vaincre {n} âmes relâchées dans l'arène des âmes du Bastion.", 'categorie': 'Monstres',
        'sousCategorie': 'Archimonstres', 'points': pts, 'icone': 161, 'objectifs': [{'nom': f'{n} âmes vaincues', 'arene': n}], 'recompense': {'xp': ratio * 500, 'titre': titre}}
open(OUT, 'w', encoding='utf-8').write(json.dumps(Q, ensure_ascii=False, indent=1) + '\n')
# les PNJ du Bastion sont posés par zones.json (bastion.open.bastion.pnj) : même case, réécrite ici à la main pour ne pas reformater le fichier
ZONES = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'data', 'zones.json')
z = open(ZONES, encoding='utf-8').read()
if '"gardienne_arene"' not in z:
    a = '     "assistante_otomai": 2580\n    },'
    assert z.count(a) == 1, 'zones.json : fin de bastion.pnj introuvable'
    z = z.replace(a, '     "assistante_otomai": 2580,\n     "gardienne_arene": 1829,\n     "gardien_arene": 2042\n    },')
    open(ZONES, 'w', encoding='utf-8').write(z)
print('arène des âmes : 2 PNJ, 3 succès')
