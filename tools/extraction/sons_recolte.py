"""Sons officiels de la récolte (maquette Armes 9A) -> public/assets/son/recolte/ + clé « recolte » de src/data/sons.json.

python sons_recolte.py <dossier des .bank> <dossier fsb5> <racine du dépôt>
Banque Player_Rp.bank : un son par coup de l'animation de métier (AnimFaucher_Lp_01…08, AnimHache_Lp…, AnimPioche_Lp…,
AnimCueillir0_01…04). La pêche n'a que la transition AnimStatique_to_AnimPeche (lancer de ligne).
Le jeu en tire un au hasard à chaque coup (sonView, toutes les ~0,4 s pendant la récolte)."""
import sys, os, re, json, subprocess, tempfile
BANKS, FSB, ROOT = sys.argv[1:4]
sys.path.insert(0, FSB)
import fsb5  # noqa: E402

d = open(os.path.join(BANKS, 'Player_Rp.bank'), 'rb').read()
b = fsb5.FSB5(d[d.find(b'FSB5'):])
GESTES = {'AnimFaucher': r'AnimFaucher_Lp_\d+$', 'AnimHache': r'AnimHache_Lp_\d+$', 'AnimPioche': r'AnimPioche_Lp_\d+$',
          'AnimCueillir0': r'AnimCueillir0_\d+$', 'AnimPeche': r'AnimStatique_to_AnimPeche_\d+$'}
out = os.path.join(ROOT, 'public/assets/son/recolte'); os.makedirs(out, exist_ok=True)
tmp = tempfile.mkdtemp()
res = {}
for g, motif in GESTES.items():
    for s in sorted(b.samples, key=lambda s: s.name):
        if not re.search(motif, s.name): continue
        nom = re.sub(r'^\d+_', '', s.name) + '.mp3'
        o = os.path.join(tmp, nom + '.ogg'); open(o, 'wb').write(b.rebuild_sample(s))
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', o, '-ac', '1', '-b:a', '64k', os.path.join(out, nom)], check=True)
        res.setdefault(g, []).append(f'recolte/{nom}')
p = os.path.join(ROOT, 'src/data/sons.json')
m = json.load(open(p)); m['recolte'] = res
open(p, 'w').write(json.dumps(m, ensure_ascii=False, indent=1) + '\n')
print({k: len(v) for k, v in res.items()})
