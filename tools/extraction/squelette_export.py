"""Exporte le squelette d'une classe pour le dessin en direct du perso (choix « Apparence : 3A »).

python squelette_export.py <persos> <donnees> <classe> <sortie>
  persos  : dossier où l'on a décompressé cache-dofus/persos.tar.gz (Characters/Bones, Characters/Skins)
  donnees : dossier des tables sorties par data_dump.py (breeds.json, heads.json, spells.json, spellscripts.json)
  classe  : identifiant Dofus de la classe (8 = Iop, 9 = Crâ)
  sortie  : dossier public/assets/sprites/squelette

Écrit dans <sortie> :
  anims_<classe>.json  animations (mêmes animations et mêmes images que perso_planche.py), communes aux deux sexes ;
                       chaque image = liste de morceaux [g, n, a, b, tx, c, d, ty, alpha, mulR, mulG, mulB, mulA]
                       g = morceau propre au squelette (index dans `graphiques`, -1 sinon),
                       n = nœud exposé (index dans `noeuds`, résolu dans le corps puis la tête du perso, -1 sinon).
  skin_<id>.json       morceaux d'un corps ou d'une tête : { tex, parts: { nœud: [ {z, v, t} ] } }, z = zone de couleur 1..6 (0 = aucune)
  skin_<id>.webp, os_<bone>.webp  textures
  persos.json          pour chaque classe et sexe : corps, têtes de création (ordre officiel), couleurs officielles
"""
import ast, glob, json, os, re, subprocess, sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from anim_parse import parse  # noqa: E402
from skin_mesh import mesh_from  # noqa: E402

persos, donnees, classe, out = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
MAXN = 32
ZONES = [1, 2, 3, 4, 5, 6]   # « couleurs » 1..6 : mesh_from écrit alors le numéro de zone à la place de la teinte
os.makedirs(out, exist_ok=True)
L = lambda v: v if isinstance(v, (list, dict)) else ast.literal_eval(v)


def table(n):
    d = json.load(open(os.path.join(donnees, n + '.json')))
    R = {r['rid']: r['data'] for r in d['references']['RefIds']}
    o = d['objectsById']
    return {int(k): R.get(v['rid']) for k, v in zip(o['m_keys'], o['m_values'])}


B, H, S, SC = table('breeds')[classe], table('heads'), table('spells'), table('spellscripts')
work = os.path.join(out, '..', '..', '..', '..', '.squelette-travail') if os.environ.get('TRAVAIL') is None else os.environ['TRAVAIL']
work = os.path.abspath(work); os.makedirs(work, exist_ok=True)
bones = os.path.join(persos, 'Characters', 'Bones'); skins = os.path.join(persos, 'Characters', 'Skins')


def dump(bundle, d):
    if not os.path.isdir(d) or not glob.glob(d + '/tex_*.png'):
        subprocess.run([sys.executable, os.path.join(HERE, 'b_dump.py'), bundle, d], check=True, capture_output=True)
    return d


def load_dir(d):
    return {f: json.load(open(f)) for f in glob.glob(d + '/mb_*.json')}, glob.glob(d + '/tex_*.png')[0]


_ims = {}
def ombre(tex, m):
    """Morceau « ombre au sol » de Dofus (noir semi-transparent) : le jeu dessine la sienne (même test que drop_shadow.py)."""
    if tex not in _ims: _ims[tex] = Image.open(tex).convert('RGBA')
    im = _ims[tex]; W, Hh = im.size
    mask = Image.new('L', im.size); dr = ImageDraw.Draw(mask)
    for k in range(0, len(m['t']), 3):
        dr.polygon([(m['v'][j][2] * W, (1 - m['v'][j][3]) * Hh) for j in m['t'][k:k + 3]], fill=255)
    bb = mask.getbbox()
    if not bb: return False
    px = [q for q, mm in zip(im.crop(bb).getdata(), mask.crop(bb).getdata()) if mm and q[3] > 8]
    if len(px) < 30: return False
    a = sum(q[3] for q in px) / len(px); lum = sum(q[0] + q[1] + q[2] for q in px) / len(px) / 3
    return lum < 40 and a < 200


def compact(m, tex):
    if 'trou' in m: return {'trou': m['trou'], 'tf': [round(x, 4) for x in m['tf']]}
    if not m['t'] or ombre(tex, m): return None
    v = []
    for x, y, u, w in m['v']: v += [round(x, 2), round(y, 2), round(u, 5), round(w, 5)]
    r = {'z': m['tint'] or 0, 'v': v, 't': m['t']}
    c = PARTIE.get(re.sub(r'_[a-zA-Z]$', '', m.get('grp', '')).lower())
    if c: r['c'] = c
    if m.get('defaut'): r['d'] = m['defaut']   # contenu d'un emplacement, caché quand un objet porté le remplace
    return r


# parties de la tête qu'une coiffe peut cacher (skinslotsrules, voir equipement_export.py)
PARTIE = {'cheveux': 'cheveux', 'cheveuxcrane': 'crane', 'oreille': 'oreille', 'oreille0': 'oreille', 'patte': 'patte'}


def webp(src, dst):
    Image.open(src).save(dst, 'WEBP', quality=92, method=6)


# --- Sorts de la classe -> animations (comme perso_planche.py) --------------------------------------------------
wanted_spells = []
for sid in L(B['breedSpellsId']):
    s = S.get(int(sid))
    if not s: continue
    for u in L(s['boundScriptUsageData']):
        r = str((SC.get(int(u['scriptId'])) or {}).get('rawParams', ''))
        wanted_spells += re.findall(r'casterAnimation[^0-9A-Za-z]*([A-Za-z0-9_]+)', r)
        wanted_spells += ['AnimAttaque' + a for a in re.findall(r'animId:(\d+)', r)]  # Sacrieur : « animId:1102 »
# Récolte (maquette Armes 9A) : animations officielles des métiers (bone_1-metier), l'outil est dessiné dans l'animation
METIERS = ['AnimCueillir0', 'AnimFaucher', 'AnimHache', 'AnimPioche', 'AnimPeche']
base = ['AnimStatiqueCombat0', 'AnimStatiqueExplo0', 'AnimCourse', 'AnimArme0', 'AnimHit', 'AnimMort'] + [f'AnimArme{t}' for t in (2, 3, 4, 5, 6, 7, 8, 19, 22, 271)] + METIERS
wanted = list(dict.fromkeys(base + wanted_spells))
EIGHT = {'AnimCourse', 'AnimStatiqueExplo0'}
orients = lambda a: (0, 1, 2, 5, 6) if a in EIGHT else (1, 5)
names = {f'{a}_{o}' for a in wanted for o in orients(a)}

# --- Animations du squelette ----------------------------------------------------------------------------------
graphiques, noeuds, anims, shots, textures = [], [], {}, {}, []
nidx = {}
for b in ['1-static', '1-movement', '1-combat', '1-combat-armes', '1-metier', f'1-{classe}-combat', f'1-{classe}-static']:
    f = os.path.join(bones, f'bones_assets_bone_{b}.bundle')
    if not os.path.exists(f): continue
    d = dump(f, os.path.join(work, 'bone_' + b))
    mbs, btex = load_dir(d)
    m = [v for v in mbs.values() if 'animations' in v][0]
    bskin = mbs[d + '/mb_%d.json' % m['boneAsset']['m_PathID']]
    bidx = {k: i for i, k in enumerate(bskin['m_keys'])}
    tex_nom = btex   # remplacé par l'atlas os_<classe>.webp plus bas
    # morceaux propres au squelette (effets, flèches...) : index global dans `graphiques`
    g0 = len(graphiques)
    for g in m['graphics']:
        ms = [compact(x, btex) for x in mesh_from(bskin, bidx[g['part']['name']], btex, [])]
        graphiques.append([dict(x, tex=tex_nom) for x in ms if x])
    exposed = m['exposedNodeNames']
    for fpath in glob.glob(d + '/ta_*.bin'):
        name = os.path.basename(fpath)[3:-4].split('_', 1)[1]
        if name not in names: continue
        raw = open(fpath, 'rb').read(); a = parse(raw)
        i = raw.find(b'SHOT')
        if 0 < i < len(a['header']): shots[name] = int.from_bytes(raw[i - 3:i - 1], 'little')
        state = {}; frames = []
        for fr in a['frames']:
            for r in fr:
                s = state.setdefault(r['idx'], {'sym': -1, 'cus': -1, 'm': [1, 0, 0, 0, 1, 0], 'alpha': 127, 'mul': [127] * 4})
                if 'sym' in r: s['sym'] = r['sym']; s['cus'] = r['par']
                if r['fl'] & 2: s['alpha'] = r['alpha']
                if 'mul' in r: s['mul'] = list(r['mul'])
                if 'm' in r: s['m'] = list(r['m'])
            draws = []
            for k in sorted(state):
                s = state[k]
                g = g0 + s['sym'] if 0 <= s['sym'] < len(m['graphics']) else -1
                if g >= 0 and not graphiques[g]: g = -1
                n = -1
                if 0 <= s['cus'] < len(exposed):
                    nm = exposed[s['cus']]
                    if nm not in nidx: nidx[nm] = len(noeuds); noeuds.append(nm)
                    n = nidx[nm]
                if g < 0 and n < 0: continue
                mm = s['m']
                draws.append([g, n, round(mm[0], 4), round(mm[1], 4), round(mm[2], 2), round(mm[3], 4), round(mm[4], 4), round(mm[5], 2), s['alpha'], *s['mul']])
            frames.append(draws)
        F = len(frames); nb = min(MAXN, F)
        anims[name] = [frames[min(F - 1, (k * F) // nb)] for k in range(nb)]   # mêmes images que la planche (sheetFixed)
        if name in shots: shots[name] = round(shots[name] / F, 3)
# graphiques jamais dessinés : vidés (fichier plus léger)
vus = {d[0] for fr in anims.values() for img in fr for d in img}
graphiques = [g if i in vus else [] for i, g in enumerate(graphiques)]

# Textures des morceaux propres au squelette (effets des sorts, armes) : jusqu'à 8192 x 4096 à 1 texel par unité ;
# le perso est dessiné à l'échelle 0,7, on les garde donc à moitié de taille (les coordonnées de texture ne changent pas).
DEMI = float(os.environ.get('OS_ECHELLE', 0.5))
noms_tex = {}
for g in graphiques:
    for m in g:
        t = m['tex']
        if t not in noms_tex:
            nom = 'os_' + os.path.basename(os.path.dirname(t))[5:] + '.webp'
            im = Image.open(t); im = im.resize((max(1, int(im.width * DEMI)), max(1, int(im.height * DEMI))), Image.LANCZOS)
            im.save(os.path.join(out, nom), 'WEBP', quality=90, method=4); noms_tex[t] = nom
        m['tex'] = noms_tex[t]
textures = sorted(set(noms_tex.values()))
json.dump({'classe': classe, 'echelle': 0.7, 'graphiques': graphiques, 'noeuds': noeuds, 'anims': anims, 'shots': shots},
          open(os.path.join(out, f'anims_{classe}.json'), 'w'), separators=(',', ':'))


# --- Corps et têtes --------------------------------------------------------------------------------------------
def export_skin(sid):
    if not os.environ.get('FORCE') and os.path.exists(os.path.join(out, f'skin_{sid}.json')): return
    d = dump(os.path.join(skins, f'skins_assets_skin_{sid}.bundle'), os.path.join(work, f'skin_{sid}'))
    mbs, tex = load_dir(d)
    sk = list(mbs.values())[0]
    parts = {}
    for i, k in enumerate(sk['m_keys']):
        if k not in nidx: continue
        ms = [compact(x, tex) for x in mesh_from(sk, i, tex, ZONES, trous=True)]
        ms = [x for x in ms if x]
        if ms: parts[k] = ms
    webp(tex, os.path.join(out, f'skin_{sid}.webp'))
    json.dump({'tex': f'skin_{sid}.webp', 'parts': parts}, open(os.path.join(out, f'skin_{sid}.json'), 'w'), separators=(',', ':'))


cle = {8: 'iop', 9: 'cra', 2: 'osamodas', 11: 'sacrieur', 20: 'forgelance', 7: 'eniripsa', 3: 'enutrof'}.get(classe, str(classe))
pj = os.path.join(out, 'persos.json')
P = json.load(open(pj)) if os.path.exists(pj) else {}
for g, sx in ((0, 'm'), (1, 'f')):
    corps = (B['maleLook'] if g == 0 else B['femaleLook']).split('|')[1]
    tetes = sorted((h for h in H.values() if h and int(h['breed']) == classe and int(h['gender']) == g and str(h.get('availableAtCreation')) == '1'),
                   key=lambda h: int(h['order']))
    for sid in [corps] + [h['skins'] for h in tetes]: export_skin(sid)
    P[f'{cle}_{sx}'] = {'classe': classe, 'anims': f'anims_{classe}.json', 'corps': int(corps), 'tetes': [int(h['skins']) for h in tetes],
                        'couleurs': L(B['maleColors' if g == 0 else 'femaleColors']), 'os': textures}
json.dump(P, open(pj, 'w'), indent=1, ensure_ascii=False)
print(cle, 'anims', len(anims), 'images', sum(len(v) for v in anims.values()), 'noeuds', len(noeuds))
