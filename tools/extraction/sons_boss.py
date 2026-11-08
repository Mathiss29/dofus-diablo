"""Musiques de boss et de combat d'Amakna (maquette « Musique boss : 7A+7B 8A », Mathis 2026-11-08), ajoutées à src/data/sons.json.

Usage : python sons_boss.py <Musiques.bank> <dossier fsb5> <racine du dépôt>
  Musique_Combat_Amakna_*        : combat d'Astrub (intro, centrale, victoire, défaite) -> musiques.combat_amakna_*
  Musique_Combat_Boss_GenXX_*    : musiques officielles de boss en 4 pistes (stems), une piste de plus par quart de PV perdu
Quels boss jouent quelle musique : BOSS ci-dessous (choix par ambiance du donjon, les listes de lecture des cartes de Dofus 3
ne sont pas décodées) -> sons.json « boss ».
Cache : cat /mnt/project-files/cache-dofus/astrub/musiques.part0* > Musiques.bank ; fsb5.tar dans le même dossier.
"""
import sys, os, re, json, subprocess, tempfile
BANK, FSB, ROOT = sys.argv[1], sys.argv[2], sys.argv[3]
sys.path.insert(0, FSB)
import fsb5  # noqa: E402
OUT = os.path.join(ROOT, 'public/assets/son'); TMP = tempfile.mkdtemp()
d = open(BANK, 'rb').read(); b = fsb5.FSB5(d[d.find(b'FSB5'):]); S = {s.name: s for s in b.samples}

GEN = {'bestial': 'Gen11_Bestial', 'lugubre': 'Gen07_Lugubre', 'feerique': 'Gen06_Feerique', 'magique': 'Gen08_Magique', 'souterrain': 'Gen05_Souter'}
BOSS = {'royal': 'bestial', 'kardorim': 'lugubre', 'tournesol_affame': 'feerique', 'mob_l_eponge': 'magique', 'kankreblath': 'souterrain'}

def mp3(nom, dest, debit='96k'):
    path = os.path.join(OUT, dest); os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path):
        src = os.path.join(TMP, 'x.ogg'); open(src, 'wb').write(b.rebuild_sample(S[nom]))
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-b:a', debit, path], check=True)
    return dest

man = json.load(open(os.path.join(ROOT, 'src/data/sons.json')))
for k, n in (('intro', 'Intro'), ('centrale', 'Centrale'), ('victoire', 'Victoire'), ('defaite', 'Défaite')):
    man['musiques'][f'combat_amakna_{k}'] = mp3(f'Musique_Combat_Amakna_{n}_T120_MBcl', f'musique/combat_amakna_{k}.mp3')
for cle, gen in GEN.items():
    pistes = sorted((n for n in S if n.startswith(f'Musique_Combat_Boss_{gen}_')), key=lambda n: int(re.search(r'(\d+)_?M(Bcl)?$', n).group(1)))
    man['musiques'][f'boss_{cle}'] = {'pistes': [mp3(n, f'musique/boss_{cle}_{i}.mp3', '80k') for i, n in enumerate(pistes)]}
man['boss'] = {m: f'boss_{c}' for m, c in BOSS.items()}
json.dump(man, open(os.path.join(ROOT, 'src/data/sons.json'), 'w'), ensure_ascii=False, indent=1)
print({k: v for k, v in man['musiques'].items() if k.startswith(('boss', 'combat_amakna'))})
