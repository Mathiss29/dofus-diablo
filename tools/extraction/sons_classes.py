"""Sons des sorts des classes ajoutées après Iop et Crâ (Osamodas, Sacrieur, Forgelance, Eniripsa…), ajoutés à src/data/sons.json.

Même source que sons.py (4A) : Player_Fight_<Classe>.bank, un son par animation du lanceur (Avatar_Fight_Sacrieur_AnimAttaque1110
= AnimAttaque1110 de la planche). Ajoute aussi les sons d'effets <gfxId>.bank des sorts de spellfx.json qui n'en ont pas encore.

Usage : python sons_classes.py <dossier des .bank> <dossier fsb5> <racine du dépôt> [Classe…]
  Classe = nom de la banque (Osamodas, Sacrieur…) ; la clé dans sons.json est ce nom en minuscules (= id de classes.json).
  Banques sur le PC : Dofus_Data/StreamingAssets/Content/Audio/Banks/Desktop ; fsb5 : /mnt/project-files/cache-dofus/astrub/fsb5.tar.
  Ensuite : node tools/hebergement/envoi.mjs (empreintes + envoi sur R2).
"""
import sys, os, re, json, subprocess, tempfile
BANKS, FSB, ROOT = sys.argv[1], sys.argv[2], sys.argv[3]
CLASSES = sys.argv[4:] or ['Osamodas', 'Sacrieur', 'Forgelance', 'Eniripsa']
sys.path.insert(0, FSB)
import fsb5  # noqa: E402

OUT = os.path.join(ROOT, 'public/assets/son'); TMP = tempfile.mkdtemp()

def bank(name):
    p = os.path.join(BANKS, f'{name}.bank')
    if not os.path.exists(p): return {}
    d = open(p, 'rb').read(); b = fsb5.FSB5(d[d.find(b'FSB5'):])
    return {s.name: (b, s) for s in b.samples}

def sfx(echantillons, nom, dossier):
    dest = f'{dossier}/{re.sub(r"[^A-Za-z0-9_]+", "", nom.replace(" ", "_"))[:80]}.mp3'
    path = os.path.join(OUT, dest); os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path):
        b, s = echantillons[nom]; src = os.path.join(TMP, 'x.ogg'); open(src, 'wb').write(b.rebuild_sample(s))
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-b:a', '80k', path], check=True)
    return dest

man = json.load(open(os.path.join(ROOT, 'src/data/sons.json')))
for cls in CLASSES:
    e = bank(f'Player_Fight_{cls}')
    if not e: print('banque absente :', cls); continue
    S = man['sorts'][cls.lower()] = {}
    for nom in sorted(e):
        m = re.match(r'Avatar_Fight_\w+?_+(Anim(?:Attaque|Arme)\d+)$', nom)
        if m: S[m.group(1)] = sfx(e, nom, f'sorts/{cls.lower()}')
    print(cls, len(S), 'sons')

fx = json.load(open(os.path.join(ROOT, 'src/data/spellfx.json')))['spells']
gfx = sorted({e['gfx'] for v in fx.values() for part in v.values() if isinstance(part, list) for e in part if isinstance(e, dict) and 'gfx' in e})
n = 0
for g in gfx:
    if str(g) in man['gfx']: continue
    e = bank(str(g)); noms = [k for k in e if not re.search(r'Statique|animbon', k, re.I)]
    if noms: man['gfx'][str(g)] = [sfx(e, k, 'gfx') for k in sorted(noms)]; n += 1
print(n, "effets ajoutés")
json.dump(man, open(os.path.join(ROOT, 'src/data/sons.json'), 'w'), ensure_ascii=False, indent=1)
