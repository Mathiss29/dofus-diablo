# recoltes_gfx.py : quelle ressource pousse sur quel dessin (gfx) d'élément interactif de Dofus 3.
#
# Le client de Dofus ne dit pas quelle ressource porte un élément interactif (c'est le serveur qui l'envoie). Avant, recoltes.py
# le devinait (le dessin le plus fréquent d'une famille = la ressource de plus bas niveau) : 24 dessins sur 40 avaient la mauvaise
# ressource (un puits était du Frêne, le Merisier du Charme, les fleurs de l'Orme ou du Chanvre…, retour de Mathis 2026-11-07).
# Ici, chaque dessin est relié à la ressource relevée sur les mêmes cartes officielles (recoltables_dofusdb.json : quantité de chaque
# ressource par carte) : pour chaque gfx, la ressource présente sur (presque) toutes les cartes où il est dessiné. Les rares minerais
# sans relevé (Carrière d'Astrub refaite dans Dofus 3) sont reliés par leur couleur officielle. Vérifié à l'œil sur les planches.
import json, os, zlib

GFX = {
    # Bûcheron
    650: 303,    # Frêne (188/191 cartes)
    651: 473,    # Châtaignier (166/167)
    652: 476,    # Noyer (47/48)
    653: 460,    # Chêne (21/22)
    654: 471,    # Érable (31/35, feuilles rouges)
    655: 461,    # If (12/12)
    656: 474,    # Merisier (15/15, fleurs roses)
    658: 472,    # Charme (8/8)
    659: 470,    # Orme (3/3)
    3222: 16488, # Noisetier (25/25)
    # Paysan
    660: 289,    # Blé (171/171)
    661: 401,    # Houblon (82/84)
    662: 423,    # Lin (56/59)
    663: 425,    # Chanvre (8/8)
    664: 400,    # Orge (153/154)
    665: 532,    # Seigle (17/17)
    701: 533,    # Avoine (80/81)
    # Alchimiste
    3212: 421,   # Ortie (120/122)
    3213: 428,   # Sauge (81/81)
    677: 395,    # Trèfle à 5 feuilles (52/52)
    678: 380,    # Menthe Sauvage (45/45)
    679: 593,    # Orchidée Freyesque (5/5, fleur rose)
    680: 594,    # Edelweiss (9/9, fleur blanche)
    # Mineur (Carrière d'Astrub)
    4918: 312,   # Fer (13/13, gris)
    4920: 441,   # Cuivre (orangé)
    4921: 442,   # Bronze (brun)
    4922: 443,   # Kobalte (3/3, bleu)
    1081: 312,   # Fer (veine grise, 2/2)
    1063: 443,   # Kobalte (veine bleue)
    1077: 444,   # Étain (veine verdâtre)
    2200: 441,   # Cuivre (cailloux bruns, 2/2)
    2204: 312,   # Fer (cailloux gris, 2/2)
    # Puits : Eau Potable, « Puiser » (compétence de base, sans métier)
    224: 311, 4938: 311,
}
# Pas des ressources : 5249 (un effet bleu, pas de dessin « prête ») ; 1953 (coquillage sans relevé officiel).
POISSON = 1018   # remous de pêche : le poisson vient du relevé de la carte (sinon de la liste de la sous-zone)

_REL = json.load(open(os.path.join(os.path.dirname(__file__), 'recoltables_dofusdb.json')))['cartes']

def poisson(map_id, tag, cell, peche_sous_zone):
    """Poisson d'un coin de pêche : tirage fixe par case, pondéré par les quantités relevées sur la carte ;
    sans relevé, les poissons officiels de la sous-zone (bas niveaux plus souvent). peche_sous_zone : [(objet, niveau)]."""
    rel = {int(h): q for h, q in _REL.get(str(map_id), {}).items() if int(h) in dict(peche_sous_zone)}
    if rel: l = sorted(rel.items())
    else:
        s = sorted(peche_sous_zone, key=lambda t: t[1]); l = [(h, len(s) - i) for i, (h, _) in enumerate(s)]
    if not l: return None
    x = zlib.crc32(f'{tag}:{cell}'.encode()) % sum(w for _, w in l)
    for h, w in l:
        if x < w: return h
        x -= w

def ressource(gfx, map_id, tag, cell, peche_sous_zone):
    return poisson(map_id, tag, cell, peche_sous_zone) if gfx == POISSON else GFX.get(gfx)
