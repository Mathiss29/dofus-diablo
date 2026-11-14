"""Musiques et fonds d'ambiance des 14 sous-zones du dehors de la 0.6, ajoutés à src/data/sons.json > lieux.

Usage : python sons06.py <dossier des .bank> <dossier contenant fsb5/> <racine du dépôt> <dossier des cartes map_<id>.json>
  (banques : cache-dofus/astrub, musiques.part0* recollés en Musiques.bank, AMB_Loc.bank dans sons.tar ; fsb5.tar)
Le choix suit la musique officielle des cartes (mapData.playlistSet.musicPlaylist, GUID FMOD) : une sous-zone qui partage son GUID
avec une sous-zone d'Amakna déjà rangée reprend sa musique (Bois des Arak-haï = forêt d'Amakna, Porcos et Dragoeufs = Montagne) ;
pour les GUID propres à la 0.6, le morceau officiel du même nom (Koalaks, Frigost, Bourgade, Forêt Malsaine, Cania).
Le script affiche les GUID trouvés sur les cartes pour vérifier les groupes. Puis : node tools/hebergement/envoi.mjs
"""
import sys, os, json, collections
BANKS, FSB, ROOT, CARTES = sys.argv[1:5]
sys.path.insert(0, os.path.join(ROOT, 'tools', 'extraction'))
sys.argv = [sys.argv[0], BANKS, FSB, ROOT]
# réutilise les fonctions de sons_amakna.py sans relancer son contenu
src = open(os.path.join(ROOT, 'tools/extraction/sons_amakna.py')).read().split("man = json.load")[0]
G = {}; exec(src, G)
convert, ogg = G['convert'], G['ogg']

man = json.load(open(os.path.join(ROOT, 'src/data/sons.json')))
import re
def musique(cle, prefixe):
    """STEM 0 = calme, les autres = renfort (comme sons_amakna.py ; ici « Stem0 » sans séparateur est aussi lu)."""
    noms = sorted((n for n in G['bank']('Musiques') if n.startswith(prefixe)), key=lambda n: int((re.search(r'(?:STEM|Stem)[ _]?(\d)', n) or [0, 0])[1]))
    assert noms, prefixe
    st = [ogg('Musiques', n) for n in noms]
    m = {'calme': convert(st[:1], f'musique/{cle}_calme.mp3')}
    if len(st) > 1: m['renfort'] = convert(st[1:], f'musique/{cle}_renfort.mp3')
    man['musiques'][cle] = m
for cle, debut in [('koalaks', '20112_Mus_Koalaks_Explo_01'), ('frigost', 'Musique_Explo_Frigost_Stem'),
                   ('frigost_bourgade', 'Musique_Frigost_Bourgade_Part2_STEM'), ('foret_malsaine', 'Forêt Malsaine STEM')]:
    musique(cle, debut)
A = lambda *n: [ogg('AMB_Loc', x) for x in n]
man['ambiances']['froid'] = convert(A('AMB_Statique_ColdWind_01'), 'ambiance/froid.mp3', '64k')

LIEUX = {   # sous-zone : (musique, fond, fond de nuit)
    33: ('amakna_1', ['foret'], ['grillons_nuit']),                     # Bois des Arak-haï (même GUID que la forêt d'Amakna)
    168: ('foret_malsaine', ['foret'], ['cimetiere_nuit']),             # Forêt Sombre
    233: ('foret_malsaine', ['foret'], ['grillons_nuit']),              # Marécages sans fond
    231: ('koalaks', ['foret'], ['grillons_nuit']),                     # Lacs enchantés
    234: ('koalaks', ['foret'], ['grillons_nuit']),                     # Forêt de Kaliptus
    235: ('koalaks', ['amakna_campagne'], ['grillons_nuit']),           # Territoire des dragodindes sauvages
    253: ('koalaks', ['montagne_vent'], []),                            # Canyon sauvage
    70: ('cania_2', ['montagne_vent'], []),                             # Plaines Rocheuses
    521: ('cania_2', ['montagne_vent'], []),                            # Pics de Cania
    525: ('cania_1', ['amakna_campagne'], ['grillons_nuit']),           # Routes Rocailleuses
    11: ('amakna_2', ['montagne_vent'], []),                            # Territoire des Porcos (même GUID que la Montagne)
    315: ('amakna_2', ['montagne_vent'], []),                           # Village des Dragoeufs
    600: ('frigost', ['froid', 'mer'], []),                             # Port de givre
    601: ('frigost_bourgade', ['froid'], []),                           # La Bourgade
}
for s, (mus, fond, nuit) in LIEUX.items():
    man['lieux'][str(s)] = {'musique': mus, 'fond': fond, **({'fondNuit': nuit} if nuit else {})}
L = json.load(open(os.path.join(ROOT, 'tools/extraction/regions06/liste.json'))); g = collections.defaultdict(collections.Counter)
for m, s in L.values():
    p = f'{CARTES}/map_{m}.json'
    if os.path.exists(p): g[s][json.load(open(p))['mapData']['playlistSet']['musicPlaylist']['fmodEventGuid'][:8]] += 1
for s in sorted(g): print(s, LIEUX[s][0], dict(g[s]))
open(os.path.join(ROOT, "src/data/sons.json"), "w").write(json.dumps(man, ensure_ascii=False, indent=1) + "\n")
print('musiques', len(man['musiques']), 'lieux', len(man['lieux']))
