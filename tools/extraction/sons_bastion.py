"""Musique du Bastion des Douze (maquette Ville 5F) ajoutée à src/data/sons.json.

Usage : python sons_bastion.py <dossier des .bank> <dossier fsb5> <racine du dépôt>
  Musiques.bank : Musique_Explo_HavreGuilde (musique officielle des havres de guilde), en couches :
  STEM_0 + STEM_1 + STEM_4 = base commune ; STEM_2 + STEM_3 de chaque nation = sa couche (Astrub, Bonta, Brâkmar, Pandala, Frigost),
  complétée de silence à la longueur de la base (toutes les pistes partent ensemble et restent calées, src/render/son.ts).
Cache : /mnt/project-files/cache-dofus/astrub (musiques.part0* -> Musiques.bank, fsb5.tar).
"""
import sys, os, json, subprocess, tempfile
BANKS, FSB, ROOT = sys.argv[1], sys.argv[2], sys.argv[3]
sys.path.insert(0, FSB)
import fsb5  # noqa: E402
OUT = os.path.join(ROOT, 'public/assets/son'); TMP = tempfile.mkdtemp()
d = open(os.path.join(BANKS, 'Musiques.bank'), 'rb').read(); b = fsb5.FSB5(d[d.find(b'FSB5'):])
S = {s.name: s for s in b.samples}
def ogg(n):
    p = os.path.join(TMP, n + '.ogg'); open(p, 'wb').write(b.rebuild_sample(S[n])); return p
def mix(noms, dest, bitrate, duree=None):
    path = os.path.join(OUT, dest); os.makedirs(os.path.dirname(path), exist_ok=True)
    a = ['ffmpeg', '-v', 'error', '-y'] + [x for n in noms for x in ('-i', ogg(n))]
    f = f'amix=inputs={len(noms)}:normalize=0:duration=longest' + (f',apad=whole_dur={duree}' if duree else '')
    subprocess.run(a + ['-filter_complex', f, '-b:a', bitrate, path], check=True); return dest
H = 'Musique_Explo_HavreGuilde_STEM_'
base = [f'{H}0_T87_M', f'{H}1_T87_M', f'{H}4_T87_M']
duree = max(S[n].samples / S[n].frequency for n in base)
man = json.load(open(os.path.join(ROOT, 'src/data/sons.json')))
man['musiques']['bastion'] = {'calme': mix(base, 'musique/bastion_base.mp3', '96k'),
    'couches': {n.lower(): mix([f'{H}2_{n}_T87_M', f'{H}3_{n}_T87_M'], f'musique/bastion_{n.lower()}.mp3', '80k', duree)
                for n in ('ASTRUB', 'BONTA', 'BRAKMAR', 'PANDALA', 'FRIGOST')}}
json.dump(man, open(os.path.join(ROOT, 'src/data/sons.json'), 'w'), ensure_ascii=False, indent=1)
print(man['musiques']['bastion'])
