"""Musiques, ambiances et sons des donjons d'Amakna (« 0.4 suite : 13A + 13B + 13C », 10 nov. 2026), ajoutés à src/data/sons.json.

Usage : python sons_amakna.py <dossier des .bank> <dossier fsb5> <racine du dépôt>
  Musiques.bank : Musique_Amakna_1..3, Musique_Amakna_Village_Part2, Gen Cimetieres (STEM 0 = calme, les autres = renfort),
                  Musique_Explo_Donjons_<thème> (salles et couloirs des donjons), Cania / Moon / Wabbits (plus tard : 9A, 10A).
  AMB_Loc.bank  : fonds d'ambiance (campagne, forêt, vent de la Montagne, mer, lave des Bworks, grillons et bourdon du Cimetière
                  la nuit) et sons des donjons (grilles de l'arène, arrivée du boss, vague, portail, porte qui grince).
Les cartes ont leurs musiques officielles (mapData.playlistSet) mais par GUID FMOD non décodé : chaque sous-zone d'Amakna reçoit
ici la musique officielle de sa partie (Village, forêt, Montagne, côte, Cimetière) — choix fait à la main, tableau LIEUX ci-dessous.
Cache des banques : /mnt/project-files/cache-dofus/astrub (musiques.part0* à recoller, sons.tar > AMB_Loc.bank, fsb5.tar).
Puis : node tools/hebergement/envoi.mjs
"""
import sys, os, re, json, subprocess, tempfile, hashlib
BANKS, FSB, ROOT = sys.argv[1], sys.argv[2], sys.argv[3]
sys.path.insert(0, FSB)
import fsb5  # noqa: E402
OUT = os.path.join(ROOT, 'public/assets/son'); TMP = tempfile.mkdtemp(); _cache = {}

def bank(name):
    if name not in _cache:
        d = open(os.path.join(BANKS, f'{name}.bank'), 'rb').read(); b = fsb5.FSB5(d[d.find(b'FSB5'):])
        _cache[name] = {s.name: (b, s) for s in b.samples}
    return _cache[name]
def ogg(bn, sn):
    b, s = bank(bn)[sn]; p = os.path.join(TMP, hashlib.md5((bn + sn).encode()).hexdigest() + '.ogg')
    if not os.path.exists(p): open(p, 'wb').write(b.rebuild_sample(s))
    return p
def convert(srcs, dest, bitrate='96k'):
    path = os.path.join(OUT, dest); os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path):
        a = ['ffmpeg', '-v', 'error', '-y'] + [x for s in srcs for x in ('-i', s)]
        if len(srcs) > 1: a += ['-filter_complex', f'amix=inputs={len(srcs)}:normalize=0:duration=longest']
        subprocess.run(a + ['-b:a', bitrate, path], check=True)
    return dest
def stems(prefixe):
    """Pistes d'un morceau, dans l'ordre (STEM 0, 1, 2…)."""
    noms = sorted(n for n in bank('Musiques') if n.startswith(prefixe))
    return sorted(noms, key=lambda n: int(re.search(r'(?:STEM|Stem)[ _](\d)', n).group(1)))
def musique(cle, prefixe):
    st = [ogg('Musiques', n) for n in stems(prefixe)]
    m = {'calme': convert(st[:1], f'musique/{cle}_calme.mp3')}
    if len(st) > 1: m['renfort'] = convert(st[1:], f'musique/{cle}_renfort.mp3')
    man['musiques'][cle] = m

man = json.load(open(os.path.join(ROOT, 'src/data/sons.json')))
# 13A : musiques d'exploration
for cle, pre in [('amakna_village', 'Musique_Amakna_Village_Part2_STEM'), ('amakna_1', 'Musique_Amakna_1_STEM'), ('amakna_2', 'Musique_Amakna_2_STEM'),
                 ('amakna_3', 'Musique_Amakna_3_STEM'), ('cimetieres', 'Gen Cimetieres Stem'), ('moon', 'Moon Stem'), ('wabbits', 'Wabbits Stem'),
                 ('cania_1', 'Cania_Explo1_STEM'), ('cania_2', 'Cania_Explo2_STEM'), ('cania_3', 'Cania_Explo3_STEM')]:
    musique(cle, pre)
# 13C : musique des salles de donjon, par thème (celui de la musique du boss : boss_<thème> -> donjon_<thème>)
for cle, pre in [('donjon_bestial', 'Musique_Explo_Donjons_Guerriers'), ('donjon_feerique', 'Musique_Explo_Donjons_ Enfantins'),
                 ('donjon_lugubre', 'Musique_Explo_Donjons_Lugubres'), ('donjon_magique', 'Musique_Explo_Donjons_Magiques'),
                 ('donjon_souterrain', 'Musique_Explo_Donjons_Souterrains')]:
    musique(cle, pre)
# 13B : fonds d'ambiance
A = lambda *n: [ogg('AMB_Loc', x) for x in n]
for cle, src in [('amakna_campagne', A('AMB_Tofu_Hub_Birds&Insects', 'AMB_Tofu_Hub_Wind')), ('foret', A('AMB_Statique_Bois_WindAndBirds_01')),
                 ('montagne_vent', A('AMB_GEN_Wind_Low_01', 'AMB_Bwork_Hub_WaterVolcano_Wind')), ('mer', A('AMB_Bouftou_Hub_WaterHarbour_Water')),
                 ('lave', A('AMB_Bwork_Hub_Lava_01')), ('grillons_nuit', A('AMB_Statique_Insecte_CricketNight_01')),
                 ('cimetiere_nuit', A('AMB_GEN_Texture_HorrorDrone_01')), ('cimetiere', A('AMB_GEN_Wind_Low_01'))]:
    man['ambiances'][cle] = convert(src, f'ambiance/{cle}.mp3', '64k')
# 13C : sons des donjons (joués une fois)
man['donjon'] = {k: convert(A(n), f'ambiance/{n}.mp3', '80k') for k, n in [
    ('fermeture', 'AMB_MeS_Grille_Fermeture'), ('ouverture', 'AMB_MeS_Grille_Ouverture'), ('boss', 'AMB_MeS_BossSpawn'),
    ('vague', 'AMB_MeS_Torch_Start'), ('portail', 'AMB_MeS_Portail_01'), ('porte', 'AMB_GEN_Action_DoorsCreakClose_01'),
    ('salleVide', 'AMB_MeS_Grille_Out')]}
# musique et fond de chaque sous-zone d'Amakna (fondNuit : en plus, du soir à l'aube)
LIEUX = {
    'amakna_village': ([10, 180, 485, 3], ['amakna_campagne'], []),
    'amakna_1': ([4, 22, 482, 481, 479, 5, 170], ['foret'], ['grillons_nuit']),
    'amakna_2': ([2, 480, 103, 8, 277, 276], ['montagne_vent'], []),
    'amakna_3': ([1, 27, 12, 23, 31], ['mer'], ['grillons_nuit']),
    'cimetieres': ([6, 179], ['cimetiere'], ['cimetiere_nuit', 'grillons_nuit']),
    # île des Wabbits (0.4 suite : 10A) : Cawotte, Waldo, Couronne ; Tombeaux à part (nuit lugubre, Wabbits 12A)
    'wabbits': ([161, 162, 164], ['mer', 'amakna_campagne'], ['grillons_nuit']),
}
man['lieux'] = {}
for mus, (subs, fond, nuit) in LIEUX.items():
    for s in subs: man['lieux'][str(s)] = {'musique': mus, 'fond': fond, **({'fondNuit': nuit} if nuit else {})}
for s in (8, 277): man['lieux'][str(s)]['fond'] = ['montagne_vent', 'lave']   # Bworks : la lave du campement
man['lieux']['163'] = {'musique': 'wabbits', 'fond': ['mer', 'cimetiere'], 'fondNuit': ['cimetiere_nuit']}   # îlot des Tombeaux
man['lieux']['1600'] = {'musique': 'wabbits', 'fond': ['mer'], 'fondNuit': ['grillons_nuit']}   # passerelles de l'île
json.dump(man, open(os.path.join(ROOT, 'src/data/sons.json'), 'w'), ensure_ascii=False, indent=1)
print('musiques', len(man['musiques']), 'ambiances', len(man['ambiances']), 'lieux', len(man['lieux']))
