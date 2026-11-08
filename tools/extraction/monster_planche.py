# monster_planche.py <squelette> <nom> <dossier Bones> [sortie public/assets/sprites] [attaques 0,1]
# Planche d'un monstre (repos, course, attaques, coup reçu, mort ; diagonales 1 et 5) depuis son squelette officiel :
# b_dump.py -> build_scene.py -> drop_shadow.py -> render.cjs (BOX=auto) -> trim_pack.py.
# Affiche, pour chaque attaque, le repère SHOT (frame d'impact) / nombre de frames à mettre dans looks.ts (MONSTER_MAP).
import sys, os, json, glob, subprocess, tempfile, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
SCALE = os.environ.get('SCALE', '2.5')

def main(bone, name, bones, out='public/assets/sprites', atks='0,1'):
    tmp = tempfile.mkdtemp(); b = os.path.join(tmp, 'b')
    def run(*a, **k):
        r = subprocess.run(list(a), capture_output=True, text=True, **k)
        if r.returncode: sys.exit(f"{os.path.basename(a[1])} : {r.stderr[:400]} ... {r.stderr[-200:]}")
    run(sys.executable, os.path.join(HERE, 'b_dump.py'), os.path.join(bones, f'bones_assets_bone_{bone}.bundle'), b)
    # SKINS=chemin1.bundle,... et COUleurs=1=15788464,... : look « {squelette|skin|1=couleur} » des PNJ (Emp : bulle 1979 + skin 1981).
    # La scène est alors faite par build_char.py (squelette + skins + couleurs), comme les classes.
    if os.environ.get('SKINS') or os.environ.get('COULEURS'):   # COULEURS seules : squelette teint (familier aux couleurs du porteur)
        import re
        sk = []
        for i, f in enumerate(x for x in os.environ.get('SKINS', '').split(',') if x):
            d = os.path.join(tmp, f's{i}'); run(sys.executable, os.path.join(HERE, 'b_dump.py'), f, d); sk.append(d)
        cols = {int(k): int(v) for k, v in (c.split('=') for c in os.environ.get('COULEURS', '').split(',') if c)}
        colors = ','.join(str(cols.get(i, 0)) for i in range(1, max(cols, default=0) + 1)) or '-'
        names = sorted({re.match(r'ta_.+?_(Anim\w+?_\d)\.bin$', f).group(1) for f in os.listdir(b) if re.match(r'ta_.+?_(Anim\w+?_\d)\.bin$', f)})
        run(sys.executable, os.path.join(HERE, 'build_char.py'), b + '/scene.json', b, ','.join(sk) or '-', colors, ','.join(names))
        tex = '-'
    else:
        run(sys.executable, os.path.join(HERE, 'build_scene.py'), b, cwd=HERE)
        tex = sorted(glob.glob(b + '/tex_*.png'))[0]
    run(sys.executable, os.path.join(HERE, 'drop_shadow.py'), b + '/scene.json', *([] if tex == '-' else [tex]))
    sc = json.load(open(b + '/scene.json')); A = sc['anims']
    import math   # certains squelettes ont des sommets NaN / infinis : JSON invalide pour le rendu
    fix = lambda v: [fix(x) for x in v] if isinstance(v, list) else ({k: fix(x) for k, x in v.items()} if isinstance(v, dict) else (0 if isinstance(v, float) and not math.isfinite(v) else v))
    sc = fix(sc); json.dump(sc, open(b + '/scene.json', 'w'))
    # PNJ=1 : repos complet + animations « fun » de face (AnimAttaque*_1, que le jeu joue au hasard selon npcsdataroot.animFunList),
    # pas de course ni de coup reçu ; sinon une seule frame de repos
    pnj = bool(os.environ.get('PNJ'))
    want = sorted(a for a in A if a.startswith('AnimStatique_') or (a.startswith('AnimAttaque') and a.endswith('_1'))) if pnj \
        else ['AnimStatique_1:1', 'AnimStatique_5:1', 'AnimCourse_1', 'AnimCourse_5']
    shots = {}
    for i in ([] if pnj else atks.split(',')):
        if f'AnimAttaque{i}_1' in A:
            want += [f'AnimAttaque{i}_1', f'AnimAttaque{i}_5']
            n = len(A[f'AnimAttaque{i}_1']); s = sc['shots'].get(f'AnimAttaque{i}_1', n // 2)
            shots[i] = (s, n)
    if not pnj: want += [a for a in ('AnimHit_1', 'AnimHit_5', 'AnimMort_1', 'AnimMort_5') if a in A]
    # ANIMS=a,b,... : liste imposée (familiers : repos + marche, voir familiers_export.py)
    if os.environ.get('ANIMS'): want = os.environ['ANIMS'].split(',')
    want = [w for w in want if w.split(':')[0] in A]
    raw = os.path.join(tmp, 'raw')
    run('node', os.path.join(HERE, 'render.cjs'), b + '/scene.json', tex, raw, ','.join(want), '1', SCALE, env={**os.environ, 'BOX': os.environ.get('BOX', 'auto'), 'PAD': str(3 * int(os.environ.get('CONTOUR') or 0) / float(SCALE))})
    # CONTOUR=n : trait sombre de n pixels autour du perso, comme Dofus 3 (fait pour les PNJ)
    if os.environ.get('CONTOUR'): run(sys.executable, os.path.join(HERE, 'contour.py'), raw + '.png', os.environ['CONTOUR'])
    os.makedirs(out, exist_ok=True)
    run(sys.executable, os.path.join(HERE, 'trim_pack.py'), raw, os.path.join(out, name), '2048', '4096', env={**os.environ, 'FORMAT': os.environ.get('FORMAT_PLANCHE', 'AVIF')})   # pages de 4096 au plus (taille max des textures)
    png = os.path.join(out, name + '.png')
    if os.path.exists(png): os.remove(png)   # trim_pack écrit aussi la planche (AVIF)
    meta = json.load(open(raw + '.json'))['meta']
    shutil.rmtree(tmp)
    print(name, 'attaques', {k: f'{s} / {n}' for k, (s, n) in shots.items()}, 'cellule', meta['cell'])

if __name__ == '__main__': main(*sys.argv[1:])
