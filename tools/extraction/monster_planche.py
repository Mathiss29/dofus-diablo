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
    run(sys.executable, os.path.join(HERE, 'build_scene.py'), b, cwd=HERE)
    tex = sorted(glob.glob(b + '/tex_*.png'))[0]
    run(sys.executable, os.path.join(HERE, 'drop_shadow.py'), b + '/scene.json', tex)
    sc = json.load(open(b + '/scene.json')); A = sc['anims']
    import math   # certains squelettes ont des sommets NaN / infinis : JSON invalide pour le rendu
    fix = lambda v: [fix(x) for x in v] if isinstance(v, list) else ({k: fix(x) for k, x in v.items()} if isinstance(v, dict) else (0 if isinstance(v, float) and not math.isfinite(v) else v))
    sc = fix(sc); json.dump(sc, open(b + '/scene.json', 'w'))
    # PNJ=1 : animation de repos complète (les PNJ ne courent pas), sinon une seule frame de repos
    want = sorted(a for a in A if a.startswith('AnimStatique_')) if os.environ.get('PNJ') else ['AnimStatique_1:1', 'AnimStatique_5:1', 'AnimCourse_1', 'AnimCourse_5']
    shots = {}
    for i in atks.split(','):
        if f'AnimAttaque{i}_1' in A:
            want += [f'AnimAttaque{i}_1', f'AnimAttaque{i}_5']
            n = len(A[f'AnimAttaque{i}_1']); s = sc['shots'].get(f'AnimAttaque{i}_1', n // 2)
            shots[i] = (s, n)
    want += [a for a in ('AnimHit_1', 'AnimHit_5', 'AnimMort_1', 'AnimMort_5') if a in A]
    want = [w for w in want if w.split(':')[0] in A]
    raw = os.path.join(tmp, 'raw')
    run('node', os.path.join(HERE, 'render.cjs'), b + '/scene.json', tex, raw, ','.join(want), '1', SCALE, env={**os.environ, 'BOX': os.environ.get('BOX', 'auto')})
    os.makedirs(out, exist_ok=True)
    run(sys.executable, os.path.join(HERE, 'trim_pack.py'), raw, os.path.join(out, name), '2048', '4096')   # pages de 4096 au plus (taille max des textures)
    png = os.path.join(out, name + '.png')
    if os.path.exists(png): os.remove(png)   # trim_pack écrit aussi la planche en webp
    meta = json.load(open(raw + '.json'))['meta']
    shutil.rmtree(tmp)
    print(name, 'attaques', {k: f'{s} / {n}' for k, (s, n) in shots.items()}, 'cellule', meta['cell'])

if __name__ == '__main__': main(*sys.argv[1:])
