"""Sons d'Astrub (0.2a) ajoutés à src/data/sons.json, sans tout refaire (les banques d'Incarnam ne sont plus nécessaires).

Usage : python sons_astrub.py <dossier des .bank> <dossier fsb5> <racine du dépôt>
  Musiques.bank : Musique_Explo_Astrub_Stem0..3 (Stem0 = calme, les autres = renfort, comme Incarnam)
  AMB_Loc.bank  : AMB_Astrub_Hub_Birds / AMB_Astrub_Hub_Wind (fond d'ambiance d'Astrub)
  <os>.bank     : voix et bruitages des monstres ajoutés (bones.json : dofusId -> squelette)
  <gfx>.bank    : sons des effets de sorts présents dans spellfx.json et pas encore dans sons.json
Cache des banques : /mnt/project-files/cache-dofus/astrub (sons.tar, musiques.part0*, fsb5.tar).
"""
import sys, os, re, json, subprocess, tempfile, hashlib
BANKS, FSB, ROOT = sys.argv[1], sys.argv[2], sys.argv[3]
sys.path.insert(0, FSB)
import fsb5  # noqa: E402
OUT = os.path.join(ROOT, 'public/assets/son'); TMP = tempfile.mkdtemp(); _cache = {}
def bank(name):
    if name in _cache: return _cache[name]
    p = os.path.join(BANKS, f'{name}.bank')
    if not os.path.exists(p): _cache[name] = {}; return {}
    d = open(p, 'rb').read(); b = fsb5.FSB5(d[d.find(b'FSB5'):])
    _cache[name] = {s.name: (b, s) for s in b.samples}; return _cache[name]
slug = lambda s: re.sub(r'[^A-Za-z0-9_]+', '', s.replace(' ', '_'))[:80]
def convert(srcs, dest, bitrate='96k', mix=False):
    path = os.path.join(OUT, dest); os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path): return dest
    a = ['ffmpeg', '-v', 'error', '-y'] + [x for s in srcs for x in ('-i', s)]
    if mix and len(srcs) > 1: a += ['-filter_complex', f'amix=inputs={len(srcs)}:normalize=0:duration=longest']
    subprocess.run(a + ['-b:a', bitrate, path], check=True); return dest
def ogg(bn, sn):
    b, s = bank(bn)[sn]; p = os.path.join(TMP, hashlib.md5((bn + sn).encode()).hexdigest() + '.ogg')
    if not os.path.exists(p): open(p, 'wb').write(b.rebuild_sample(s))
    return p
sfx = lambda bn, sn, folder: convert([ogg(bn, sn)], f'{folder}/{slug(sn)}.mp3', '80k')

man = json.load(open(os.path.join(ROOT, 'src/data/sons.json')))
st = [ogg('Musiques', f'Musique_Explo_Astrub_Stem{i}') for i in range(4)]
man['musiques']['astrub'] = {'calme': convert(st[:1], 'musique/astrub_calme.mp3'), 'renfort': convert(st[1:], 'musique/astrub_renfort.mp3', mix=True)}
man['ambiances']['astrub_oiseaux'] = convert([ogg('AMB_Loc', 'AMB_Astrub_Hub_Birds')], 'ambiance/astrub_oiseaux.mp3', '64k')
man['ambiances']['astrub_vent'] = convert([ogg('AMB_Loc', 'AMB_Astrub_Hub_Wind')], 'ambiance/astrub_vent.mp3', '64k')
bones = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bones.json')))
mons = json.load(open(os.path.join(ROOT, 'src/data/monsters.json')))
for key, m in mons.items():
    bone = bones.get(str(m.get('dofusId')))
    if not bone or key in man['monstres'] or not bank(str(bone)): continue
    cat = {'attaque': [], 'hit': [], 'mort': []}
    for n in sorted(bank(str(bone))):
        if re.search(r'Marche|Course|Step|Fun|Saut|Fsp', n): continue
        k = 'mort' if re.search(r'Mort|Death', n) else 'hit' if re.search(r'Hit|hits_', n) else 'attaque' if 'Attaque' in n else None
        if k: cat[k].append(sfx(str(bone), n, 'monstres'))
    if any(cat.values()): man['monstres'][key] = cat
fx = json.load(open(os.path.join(ROOT, 'src/data/spellfx.json')))['spells']
for g in sorted({e['gfx'] for v in fx.values() for part in v.values() if isinstance(part, list) for e in part if isinstance(e, dict) and 'gfx' in e}):
    if str(g) in man['gfx']: continue
    noms = [n for n in bank(str(g)) if not re.search(r'Statique|animbon', n, re.I)]
    if noms: man['gfx'][str(g)] = [sfx(str(g), n, 'gfx') for n in sorted(noms)]
json.dump(man, open(os.path.join(ROOT, 'src/data/sons.json'), 'w'), ensure_ascii=False, indent=1)
print('monstres', len(man['monstres']), 'gfx', len(man['gfx']))
