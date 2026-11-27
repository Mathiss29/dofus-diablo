"""Musiques officielles des régions de la 0.7 (ligne « 0.7 : » 1A-1E, 2026-11-27) ajoutées à src/data/sons.json (musiques + lieux).

Usage : python3 sons07.py <dossier contenant Musiques.bank> <dossier contenant fsb5/> <racine du dépôt>
  (musiques.part0* de cache-dofus/astrub recollés en Musiques.bank ; fsb5.tar)
Dofus 3 n'a pas de morceau d'exploration propre à Otomaï ni à Pandala : Otomaï prend la musique des donjons de la jungle,
Pandala celle des donjons « asiatiques ». Cania, Koalaks et Frigost reprennent leurs musiques. Chaque lieu reçoit aussi sa
musique de COMBAT officielle (Musique_Combat_<Région>_* -> musiques.combat_<région>_*, champ « combat » du lieu, lu par son.ts).
Puis : node tools/hebergement/envoi.mjs
"""
import sys, os, json
BANKS, FSB, ROOT = sys.argv[1:4]
src = open(os.path.join(ROOT, 'tools/extraction/sons_amakna.py')).read().split("man = json.load")[0]
G = {}; exec(src, G)
man = json.load(open(os.path.join(ROOT, 'src/data/sons.json'))); G['man'] = man
noms = list(G['bank']('Musiques'))
G['musique']('otomai', 'Musique_Explo_Donjons_Jungle_T69_STEM')
un = lambda cle, n: man['musiques'].__setitem__(cle, {'calme': G['convert']([G['ogg']('Musiques', n)], f'musique/{cle}_calme.mp3')})
un('pandala', next(n for n in noms if n.startswith('20410_ExploDonjon_Asiatique')))
for reg, pre in (('otomai', 'Musique_Combat_Otomai_'), ('pandala', 'Musique_Combat_Pandala_'), ('cania', 'Musique_Combat_Cania_'),
                 ('koalaks', 'Musique_Combat_Koalaks_'), ('frigost', 'Musique_Combat_Frigost_')):
    for k, mot in (('intro', 'Intro'), ('centrale', 'Centrale'), ('victoire', 'Victoire'), ('defaite', 'D')):
        n = next(x for x in noms if x.startswith(pre) and x[len(pre):].lstrip('_').startswith(mot))
        man['musiques'][f'combat_{reg}_{k}'] = G['convert']([G['ogg']('Musiques', n)], f'musique/combat_{reg}_{k}.mp3')
LIEUX = {454: ('otomai', ['foret'], ['grillons_nuit'], 'otomai'),      # Plaines herbeuses
         457: ('otomai', ['foret'], ['grillons_nuit'], 'otomai'),      # Tourbière sans fond
         471: ('otomai', ['foret'], ['grillons_nuit'], 'otomai'),      # Tourbière nauséabonde
         468: ('otomai', ['foret'], ['grillons_nuit'], 'otomai'),      # Village des Zoths
         55: ('cania_3', ['montagne_vent'], [], 'cania'),             # Pénates du Corbac
         69: ('cania_1', ['foret'], ['grillons_nuit'], 'cania'),       # Bois de Litneg
         523: ('cania_2', ['montagne_vent'], [], 'cania'),            # Cirque
         230: ('koalaks', ['foret'], ['cimetiere_nuit'], 'koalaks'),   # Cimetière primitif
         275: ('koalaks', ['montagne_vent'], [], 'koalaks'),          # Morh'Kitu
         942: ('pandala', ['foret'], ['grillons_nuit'], 'pandala'),    # Plantala
         941: ('pandala', ['mer'], ['grillons_nuit'], 'pandala'),      # Akwadala
         944: ('pandala', ['montagne_vent'], [], 'pandala'),          # Terrdala
         602: ('frigost', ['froid'], [], 'frigost')}                  # Champs de glace
for s, (mus, fond, nuit, combat) in LIEUX.items():
    man['lieux'][str(s)] = {'musique': mus, 'fond': fond, **({'fondNuit': nuit} if nuit else {}), 'combat': combat}
open(os.path.join(ROOT, 'src/data/sons.json'), 'w').write(json.dumps(man, ensure_ascii=False, indent=1) + '\n')
print('musiques', len(man['musiques']), 'lieux', len(man['lieux']))
