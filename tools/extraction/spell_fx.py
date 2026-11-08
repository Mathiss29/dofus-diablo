# spell_fx.py <dossier des tables (json de data_dump.py)> <dossier Content/Characters/Bones> [sortie public/assets/fx]
# Effets visuels OFFICIELS des sorts (choix 8A de Mathis) :
#  1. lit les spellscripts de chaque sort du joueur (classes.json -> dofusId) et des monstres (monsters.json -> spells[].id) :
#     projectile (gfxId du missile), effets sur la cible, effets sur le lanceur (isTargetTreatedAsCaster / type caster),
#     plan « background » (sous les personnages) ;
#  2. rend chaque gfx (squelette bones_assets_bone_<gfx>.bundle, animations FX_0 ou FX_1/3/5/7 orientées) avec les
#     couleurs du jeu (render.html applique mul/add), une image sur deux (15 i/s), puis range la planche (trim_pack) ;
#  3. écrit src/data/spellfx.json (sorts -> gfx, et pour chaque gfx : animations, images par seconde, point d'ancrage).
import sys, os, json, math, subprocess, glob, shutil, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from monster_spells import table, P

SCALE = os.environ.get('SCALE', '0.7')
LOURDS = json.load(open('src/data/fichiers-lourds.json')) if os.path.exists('src/data/fichiers-lourds.json') else {}  # comme les personnages (perso_planche.py)

def legacy(raw):
    kv = dict(x.split(':', 1) for x in raw.split(',') if ':' in x)
    seq = []
    if kv.get('missileGfxId'): seq.append({'type': 'projectile', 'gfxId': int(kv['missileGfxId'])})
    for k in ('targetGfxId', 'targetGfxId2'):
        if kv.get(k): seq.append({'type': 'target', 'gfxId': int(kv[k])})
    if kv.get('casterGfxId'): seq.append({'type': 'caster', 'gfxId': int(kv['casterGfxId'])})
    return seq

def scripts_of(spell, SC):
    """Gfx d'un sort, dans l'ordre des scripts. Les scripts réservés à un état du lanceur (*E) sont ignorés."""
    out = {'target': [], 'caster': []}
    for b in sorted(P(spell['boundScriptUsageData']), key=lambda b: b['order']):
        if '*E' in (b.get('casterMask') or ''): continue
        raw = str((SC.get(b['scriptId']) or {}).get('rawParams', ''))
        if raw.startswith('{'): gfxs = [g for s in json.loads(raw)['main']['sequences'] for g in s['gfxs']]
        else: gfxs = legacy(raw)
        onCaster = b.get('isTargetTreatedAsCaster') == 1
        for g in gfxs:
            if 'gfxId' not in g: continue
            e = {'gfx': int(g['gfxId'])}
            if g.get('strata') == 'background': e['bg'] = True
            if g['type'] == 'trail' and g.get('isEntireSpellZone'): e['zone'] = True   # rejoué sur chaque case de la zone
            if g.get('scaleX', 1) != 1: e['scale'] = g['scaleX']
            if g['type'] == 'projectile':
                out.setdefault('projectile', {'gfx': e['gfx'], 'curvature': g.get('curvature', 0), 'offsetY': g.get('offsetY', 0)})
            elif g['type'] == 'caster' or onCaster: out['caster'].append(e)
            elif g['type'] in ('target', 'trail'): out['target'].append(e)   # trail : traînée orientée le long de la zone (Couperet)
    return {k: v for k, v in out.items() if v}

def render(gfx, bones, outdir, tmp):
    b = os.path.join(tmp, f'b{gfx}')
    subprocess.run([sys.executable, os.path.join(HERE, 'b_dump.py'), os.path.join(bones, f'bones_assets_bone_{gfx}.bundle'), b], check=True, capture_output=True)
    subprocess.run([sys.executable, os.path.join(HERE, 'build_scene.py'), b], check=True, capture_output=True, cwd=HERE, env={**os.environ, 'SKIP_MASKS': '1'})
    sc = json.load(open(b + '/scene.json'))
    anims = {k: len(v) for k, v in sc['anims'].items() if k.startswith('FX_') and len(v)}
    if not anims: print('  pas d\'animation FX lisible', gfx); return None
    fps = 30
    for f in glob.glob(b + '/mb_*.json'):
        j = json.load(open(f))
        if 'defaultFrameRate' in j: fps = j['defaultFrameRate'] or 30
    step = 2 if fps >= 25 else 1
    spec = ','.join(f'{k}:{math.ceil(n / step)}' for k, n in anims.items())
    tex = sorted(glob.glob(b + '/tex_*.png'))[0]
    raw = os.path.join(tmp, f'raw{gfx}')
    subprocess.run(['node', os.path.join(HERE, 'render.cjs'), b + '/scene.json', tex, raw, spec, '1', SCALE], check=True, capture_output=True, env={**os.environ, 'BOX': 'auto'})
    out = os.path.join(outdir, f'fx_{gfx}')
    subprocess.run([sys.executable, os.path.join(HERE, 'trim_pack.py'), raw, out, '2048'], check=True, capture_output=True)
    os.remove(out + '.png')
    meta = json.load(open(raw + '.json'))['meta']
    cw, ch = meta['cell']; ox, oy = meta['origin']
    return {'anims': {k: math.ceil(n / step) for k, n in anims.items()}, 'fps': fps / step, 'origin': [round(ox / cw, 4), round(oy / ch, 4)]}

def main(d, bones, outdir='public/assets/fx'):
    S, SC = table(d, 'spells'), table(d, 'spellscripts')
    spells = {}
    for cls in json.load(open('src/data/classes.json')).values():
        for k, s in cls['spells'].items():
            if s.get('dofusId'): spells[k] = scripts_of(S[s['dofusId']], SC)
    # bêtes de l'Osamodas (src/data/betes.json) : b<id du sort>
    for k, b in json.load(open('src/data/betes.json')).items():
        if k == '_regles': continue
        for s in b['sorts']: spells[f"b{s['id']}"] = scripts_of(S[s['id']], SC)
    for m in json.load(open('src/data/monsters.json')).values():
        for s in m.get('spells', []):
            spells[f"m{s['id']}"] = scripts_of(S[s['id']], SC)
    spells = {k: v for k, v in spells.items() if v}
    ids = sorted({e['gfx'] for v in spells.values() for e in v.get('target', []) + v.get('caster', []) + ([v['projectile']] if 'projectile' in v else [])})
    os.makedirs(outdir, exist_ok=True); tmp = tempfile.mkdtemp()
    gfx = {}
    old = json.load(open('src/data/spellfx.json'))['gfx'] if os.path.exists('src/data/spellfx.json') else {}
    for g in ids:
        # déjà rendu : présent en local, ou déjà sur R2 (empreinte dans fichiers-lourds.json, clone neuf sans fichiers lourds)
        if str(g) in old and (os.path.exists(os.path.join(outdir, f'fx_{g}.webp')) or f'fx/fx_{g}.webp' in LOURDS) and not os.environ.get('FORCE'):
            gfx[g] = old[str(g)]; continue   # déjà rendu (FORCE=1 pour tout refaire)
        if not os.path.exists(os.path.join(bones, f'bones_assets_bone_{g}.bundle')): print('  manquant', g); continue
        r = render(g, bones, outdir, tmp)
        if r: gfx[g] = r; print(g, r)
    shutil.rmtree(tmp)
    for v in spells.values():   # retire les gfx qu'on n'a pas pu rendre
        for k in ('target', 'caster'):
            if k in v: v[k] = [e for e in v[k] if e['gfx'] in gfx]
        if 'projectile' in v and v['projectile']['gfx'] not in gfx: del v['projectile']
    json.dump({'spells': spells, 'gfx': gfx}, open('src/data/spellfx.json', 'w'), ensure_ascii=False, indent=1)

if __name__ == '__main__': main(*sys.argv[1:])
