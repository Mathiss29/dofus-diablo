"""Musiques officielles de la Baie de Sufokia (0.6.1, « 0.7 : » 3B) ajoutées à src/data/sons.json (musiques + lieux).

Usage : python3 sons061.py <dossier contenant Musiques.bank> <dossier contenant fsb5/> <racine du dépôt>
  (musiques.part0* de cache-dofus/astrub recollés en Musiques.bank ; fsb5.tar)
Morceaux : Sufokia_Explo (rivage, Bassin des Muldos) et Musique_Sufokia_Part2 (la ville). STEM 0 = calme, les autres = renfort.
Puis : node tools/hebergement/envoi.mjs
"""
import sys, os, json
BANKS, FSB, ROOT = sys.argv[1:4]
src = open(os.path.join(ROOT, 'tools/extraction/sons_amakna.py')).read().split("man = json.load")[0]
G = {}; exec(src, G)
man = json.load(open(os.path.join(ROOT, 'src/data/sons.json'))); G['man'] = man
G['musique']('sufokia', 'Sufokia_Explo_STEM')
G['musique']('sufokia_ville', 'Musique_Sufokia_Part2_STEM')
LIEUX = {32: ('sufokia_ville', ['mer'], ['grillons_nuit']),        # Sufokia (la ville)
         490: ('sufokia', ['mer'], []),                             # Rivage sufokien
         1119: ('sufokia', ['amakna_campagne', 'mer'], ['grillons_nuit'])}  # Bassin des Muldos
for s, (mus, fond, nuit) in LIEUX.items():
    man['lieux'][str(s)] = {'musique': mus, 'fond': fond, **({'fondNuit': nuit} if nuit else {})}
open(os.path.join(ROOT, 'src/data/sons.json'), 'w').write(json.dumps(man, ensure_ascii=False, indent=1) + '\n')
print('musiques', len(man['musiques']), 'lieux', len(man['lieux']))
