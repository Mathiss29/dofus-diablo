"""Sons officiels de Dofus 3 -> public/assets/son/ + src/data/sons.json (maquette « Son », choix de Mathis du 2026-11-06).

Les sons de Dofus 3 sont des banques FMOD (Dofus_Data/StreamingAssets/Content/Audio/Banks/Desktop/*.bank), chacune contient
un FSB5 en Vorbis. Banques utiles :
  UI.bank                  musique du menu (Musique_Menu_T96_MBcl) + sons d'interface 160xx
  Incarnam.bank            musiques d'Incarnam (exploration en pistes « Stem », combat intro/centrale/victoire/défaite)
  Player_Fight_<Classe>    son de chaque animation de sort : Avatar_Fight_Iop_AnimAttaque801 = casterAnimation 801
  Player_Fight_Commun      coups d'arme (AnimArme0…) et impacts hits_dofus_flesh
  <gfxId>.bank             son d'un effet de sort (8025 = Épée Céleste)
  <boneId>.bank            sons d'un monstre (voix et bruitages : Attaque, Hit, Mort)
  GlobalAmbient, AMB_Loc   fonds d'ambiance et sons du décor (eau, feu, Zaap)

Usage : python sons.py <dossier des .bank> <dossier fsb5> <racine du dépôt>
  - fsb5 = la bibliothèque python « fsb5 » (pip download fsb5, puis le dossier fsb5/ du paquet) ; il faut libvorbis.
  - les banques des monstres sont lues d'après src/data/monsters.json (dofusId) et bones.json (dofusId -> squelette, tiré de
    data_assets_monstersdataroot : champ look « {os|…} »), à côté de ce script.
"""
import sys, os, re, json, subprocess, tempfile, hashlib
BANKS, FSB, ROOT = sys.argv[1], sys.argv[2], sys.argv[3]
sys.path.insert(0, FSB)
import fsb5  # noqa: E402

OUT = os.path.join(ROOT, 'public/assets/son')
os.makedirs(OUT, exist_ok=True)
_cache = {}

def bank(name):
    """Échantillons d'une banque : {nom: (fsb, sample)}."""
    if name in _cache: return _cache[name]
    p = os.path.join(BANKS, f'{name}.bank')
    if not os.path.exists(p): _cache[name] = {}; return {}
    d = open(p, 'rb').read()
    b = fsb5.FSB5(d[d.find(b'FSB5'):])
    _cache[name] = {s.name: (b, s) for s in b.samples}
    return _cache[name]

def slug(s):
    return re.sub(r'[^A-Za-z0-9_]+', '', s.replace(' ', '_'))[:80]

def convert(src_ogg_list, dest, bitrate='96k', mono=False, mix=False):
    """Écrit dest (mp3) depuis un ou plusieurs ogg (mix = pistes superposées)."""
    path = os.path.join(OUT, dest)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path): return dest
    args = ['ffmpeg', '-v', 'error', '-y']
    for s in src_ogg_list: args += ['-i', s]
    if mix and len(src_ogg_list) > 1:
        args += ['-filter_complex', f'amix=inputs={len(src_ogg_list)}:normalize=0:duration=longest']
    if mono: args += ['-ac', '1']
    args += ['-b:a', bitrate, path]
    subprocess.run(args, check=True)
    return dest

TMP = tempfile.mkdtemp()
def ogg(bank_name, sample_name):
    b, s = bank(bank_name)[sample_name]
    p = os.path.join(TMP, hashlib.md5((bank_name + sample_name).encode()).hexdigest() + '.ogg')
    if not os.path.exists(p): open(p, 'wb').write(b.rebuild_sample(s))
    return p

def sfx(bank_name, sample_name, folder):
    return convert([ogg(bank_name, sample_name)], f'{folder}/{slug(sample_name)}.mp3', '80k')

manifest = {'musiques': {}, 'ambiances': {}, 'ui': {}, 'sorts': {}, 'gfx': {}, 'monstres': {}, 'impacts': []}

# ---- musiques (1A+1B, 2A+2B, 3A+3B) ----
def stems(nom, n):
    return [ogg('Incarnam', f'Musique_Explo_{nom}_Stem{i}') for i in range(n)]
M = manifest['musiques']
M['menu'] = convert([ogg('UI', 'Musique_Menu_T96_MBcl')], 'musique/menu.mp3', '112k')
for nom, n in (('Incarnam1', 4), ('Incarnam2', 3)):
    st = stems(nom, n)
    M[nom.lower()] = {'calme': convert(st[:1], f'musique/{nom.lower()}_calme.mp3', '96k'),
                      'renfort': convert(st[1:], f'musique/{nom.lower()}_renfort.mp3', '96k', mix=True)}
M['incarnam_explo01'] = {'calme': convert([ogg('Incarnam', '20111_Mus_Incarnam_Explo_01')], 'musique/incarnam_explo01.mp3', '96k')}
for k, s in (('intro', 'Musique_Combat_Incarnam_Intro_T38_MBcl'), ('centrale', 'Musique_Combat_Incarnam_Centrale_T38_MBcl'),
             ('victoire', 'Musique_Combat_Incarnam_Victoire_T44_MBcl'), ('defaite', 'Musique_Combat_Incarnam_Defaite_T4_MBcl')):
    M[f'combat_{k}'] = convert([ogg('Incarnam', s)], f'musique/combat_{k}.mp3', '96k')

# ---- ambiances (7A) et décor (7B) ----
A = manifest['ambiances']
for k, (b, s) in {
    'incarnam_vent': ('GlobalAmbient', 'AMB_Statique_Incarnam_Wind_Light_01'),
    'incarnam': ('GlobalAmbient', '17201_Amb_Incarnam_01'),
    'interieur': ('GlobalAmbient', 'AMB_Statique_Interieur_Wind_01'),
    'temple_tuto': ('GlobalAmbient', 'AMB_Statique_Incarnam_Tuto'),
    'temple_ethere': ('GlobalAmbient', 'AMB_Statique_TempleEthereal_01'),
    'zaap': ('AMB_Loc', 'AMB_GEN_Layers_Zaap_01'),
    'feu': ('AMB_Loc', 'AMB_Loc_Fire_CampFire_Lp_01'),
    'cascade': ('AMB_Loc', 'AMB_Loc_Waterfall_Light_01'),
    'courant': ('AMB_Loc', 'AMB_Loc_Water_Stream_Light'),
}.items():
    A[k] = convert([ogg(b, s)], f'ambiance/{k}.mp3', '80k')

# ---- interface (6A + 6B) ----
U = manifest['ui']
for k, s in {'niveau': '16062_Int_Level_Up', 'objectif': '16074_Int_Jingle_PetitObjectif', 'succes': '16118_Int_Achievement',
             'checkpoint': '16073_Int_Checkpoint', 'ouvrir': '16012_Int_Fenêtre_Ouverture_01', 'fermer': '16013_Int_Fenêtre_Fermeture_01',
             'ok': '16002_Int_OK_01', 'bouton': '16004_Int_Boutons_Génériques_01', 'onglet': '16009_Int_Onglet_01'}.items():
    U[k] = sfx('UI', s, 'ui')

# kamas (choix Kamas D) : pièces qui tombent, dans la banque du décor
manifest['kamas'] = [sfx('AMB_Loc', f'AMB_Loc_CoinDrop_{n}', 'ui') for n in ('002', '005', '007', '009')]
# Zaap (maquette « Zaap : » 9A) : départ en téléportation, dans la banque du décor
manifest['teleport'] = [sfx('AMB_Loc', f'AMB_Interactive_Teleport_Start_0{n}', 'ambiance') for n in (1, 2, 3)]

# ---- sorts des classes (4A) : son de l'animation du lanceur ----
S = manifest['sorts']
for cls in ('Iop', 'Cra', 'Commun'):
    S[cls.lower()] = {}
    for name in bank(f'Player_Fight_{cls}'):
        m = re.match(r'Avatar_Fight_\w+?_+(Anim(?:Attaque|Arme)\d+)$', name)
        if m: S[cls.lower()][m.group(1)] = sfx(f'Player_Fight_{cls}', name, f'sorts/{cls.lower()}')
manifest['impacts'] = [sfx('Player_Fight_Commun', n, 'impacts') for n in sorted(bank('Player_Fight_Commun')) if 'hits_dofus_flesh' in n]

# ---- effets des sorts (4A) : <gfxId>.bank ----
fx = json.load(open(os.path.join(ROOT, 'src/data/spellfx.json')))['spells']
gfx = sorted({e['gfx'] for v in fx.values() for part in v.values() if isinstance(part, list) for e in part if isinstance(e, dict) and 'gfx' in e})
for g in gfx:
    noms = [n for n in bank(str(g)) if not re.search(r'Statique|animbon', n, re.I)]
    if noms: manifest['gfx'][str(g)] = [sfx(str(g), n, 'gfx') for n in sorted(noms)]

# ---- monstres (5A) : voix et bruitages par squelette ----
bones = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bones.json')))
mons = json.load(open(os.path.join(ROOT, 'src/data/monsters.json')))
for key, m in mons.items():
    bone = bones.get(str(m.get('dofusId')))
    if not bone: continue
    cat = {'attaque': [], 'hit': [], 'mort': []}
    for n in sorted(bank(str(bone))):
        if re.search(r'Marche|Course|Step|Fun|Saut|Fsp', n): continue
        k = 'mort' if re.search(r'Mort|Death', n) else 'hit' if re.search(r'Hit|hits_', n) else 'attaque' if 'Attaque' in n else None
        if k: cat[k].append(sfx(str(bone), n, 'monstres'))
    if any(cat.values()): manifest['monstres'][key] = cat

json.dump(manifest, open(os.path.join(ROOT, 'src/data/sons.json'), 'w'), ensure_ascii=False, indent=1)
print('ok', sum(len(f) for _, _, f in os.walk(OUT)), 'fichiers')
