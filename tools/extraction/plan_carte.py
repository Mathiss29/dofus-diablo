"""Données de la carte du monde (maquette « Carte : » et « Carte suite : », 2026-11-10) pour un monde exporté.

Usage : python plan_carte.py <public/assets/mondes/<monde>> [--plans]
Écrit <monde>/carte_fondu.webp (carte.webp aux bords fondus, 1A) et <monde>/plan.json :
  carte  : repère de carte.webp en unités de carte (case [x, y] = coin haut-gauche ox + x·cw, oy + y·ch, en pixels de l'image)
  maps   : [x, y, sous-zone, essai] des cartes du dehors (brouillard, survol, teinte de danger, onglets des autres mondes)
  reperes: repères officiels (monde.json reperes)
  plans  : avec --plans, plan des intérieurs à plusieurs salles reliées par des portes (13A) : image plan_<groupe>.webp, son coin et sa taille en unités,
           et les salles [tag, x, y]. Les images sont dessinées comme carte.webp (sol puis décor) ; les fichiers lourds manquants
           (sol_*.webp, decor_*.webp) sont d'abord repris sur assets.diablofus.com.
"""
import sys, os, json, re, subprocess
import numpy as np
from PIL import Image

D = sys.argv[1].rstrip('/'); PLANS = '--plans' in sys.argv
NOM = os.path.basename(D)
M = json.load(open(f'{D}/monde.json'))
C = M['carte']; K = C['k']
DEHORS = re.compile(r'-?\d+_-?\d+$')
dehors = [m for m in M['maps'] if not m.get('inside') and DEHORS.fullmatch(m['tag'])]

# repère : les cartes sans débord (sol de 1204 × 860) donnent exactement le coin de chaque case
nets = [m for m in dehors if not m.get('n') and m['sol']['w'] == 1204 and m['sol']['h'] == 860]
ax = np.polyfit([m['x'] for m in nets], [(m['sol']['x'] - C['x']) * K for m in nets], 1)
ay = np.polyfit([m['y'] for m in nets], [(m['sol']['y'] - C['y']) * K for m in nets], 1)
im = Image.open(f'{D}/carte.webp') if os.path.exists(f'{D}/carte.webp') else None
carte = {'ox': round(float(ax[1]), 3), 'oy': round(float(ay[1]), 3), 'cw': round(float(ax[0]), 3), 'ch': round(float(ay[0]), 3)}
if im:
    carte.update(w=im.width, h=im.height)
    # 1A : bords fondus (la carte peinte officielle passe dessous : mer continue au lieu des blocs carrés sur du noir)
    from PIL import ImageFilter
    a = im.getchannel('A').filter(ImageFilter.MinFilter(9)).filter(ImageFilter.GaussianBlur(5))
    f = im.copy(); f.putalpha(Image.fromarray(np.minimum(np.array(im.getchannel('A')), np.array(a))))
    f.save(f'{D}/carte_fondu.webp', 'WEBP', quality=80, method=6)

plan = {'monde': NOM, 'carte': carte,
        'maps': [[m['x'], m['y'], m['sub'], 1 if m.get('essai') else 0] for m in sorted(dehors, key=lambda m: (m['y'], m['x']))],
        'reperes': M.get('reperes', [])}

# --- intérieurs à plusieurs salles (13A) : salles reliées par des portes (zones.json), une composante = un plan ---
ZONES = json.load(open(os.path.join(D, '..', '..', '..', '..', 'src', 'data', 'zones.json')))
PORTES = [po for z in ZONES.values() if (z.get('open') or {}).get('world') == NOM for po in z['open'].get('portes', [])]
PAR_TAG = {m['tag']: m for m in M['maps']}
dedans = lambda t: t in PAR_TAG and not (DEHORS.fullmatch(t) and not PAR_TAG[t].get('inside'))
lien = {}
for po in PORTES:
    a, b = po['a'][0], po['b'][0]
    if po.get('zone') or not (dedans(a) and dedans(b)): continue
    lien.setdefault(a, set()).add(b); lien.setdefault(b, set()).add(a)
groupes, vus = {}, set()
for t in sorted(lien):
    if t in vus: continue
    comp, pile = [], [t]
    while pile:
        x = pile.pop()
        if x in vus: continue
        vus.add(x); comp.append(x); pile.extend(lien.get(x, ()))
    if len(comp) > 1: groupes[sorted(comp)[0]] = [PAR_TAG[x] for x in sorted(comp)]

ASSETS = 'https://assets.diablofus.com'
EMPREINTES = json.load(open(os.path.join(D, '..', '..', '..', '..', 'src', 'data', 'fichiers-lourds.json')))
def fichier(nom):
    p = f'{D}/{nom}'
    if not os.path.exists(p):
        rel = os.path.relpath(p, os.path.join(D, '..', '..')).replace(os.sep, '/')
        v = EMPREINTES.get(rel)   # ?v= : l'adresse sans empreinte peut être une vieille copie en cache
        r = subprocess.run(['curl', '-sSf', '-o', p, f'{ASSETS}/{rel}' + (f'?v={v}' if v else '')], capture_output=True)
        if r.returncode:
            print('manque', rel, r.stderr.decode().strip()); return None
    return p

def dessiner(maps, k):
    """Image d'un groupe de cartes (sol puis décor, comme carte_monde.py), et son coin en pixels de carte.webp."""
    x0 = min(m['sol']['x'] for m in maps); y0 = min(m['sol']['y'] for m in maps)
    x1 = max(m['sol']['x'] + m['sol']['w'] for m in maps); y1 = max(m['sol']['y'] + m['sol']['h'] for m in maps)
    W, H = int((x1 - x0) * k) + 1, int((y1 - y0) * k) + 1
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    def pose(img, x, y): out.alpha_composite(img, (max(0, int((x - x0) * k)), max(0, int((y - y0) * k))))
    for m in sorted(maps, key=lambda m: (m['y'], m['x'])):
        s = m['sol']; p = fichier(f"sol_{m['tag']}.webp")
        if p: pose(Image.open(p).convert('RGBA').resize((max(1, int(s['w'] * k)) + 1, max(1, int(s['h'] * k)) + 1), Image.BILINEAR), s['x'], s['y'])
    atl = {}
    def atlas(n):
        if n not in atl:
            pj = f'{D}/{n}.json'; pw = fichier(f'{n}.webp')
            atl[n] = (Image.open(pw).convert('RGBA'), json.load(open(pj))['frames']) if pw and os.path.exists(pj) else None
        return atl[n]
    dec = [(0 if d['c'] < 0 else 1, d['y'], d.get('o', 0), m, d) for m in maps for d in m['decor'] if not (d.get('b') or d.get('h'))]
    for _, _, _, m, d in sorted(dec, key=lambda t: t[:3]):
        a = atlas(f"decor_p{d['p']}" if 'p' in d else f"decor_{m['tag']}")
        if not a or d['f'] not in a[1]: continue
        img, frames = a; f = frames[d['f']]; fr, ss, src = f['frame'], f['spriteSourceSize'], f['sourceSize']
        z = d.get('z', 1); w, h = int(fr['w'] * z * k), int(fr['h'] * z * k)
        if w < 1 or h < 1: continue
        crop = img.crop((fr['x'], fr['y'], fr['x'] + fr['w'], fr['y'] + fr['h'])).resize((w, h), Image.BILINEAR)
        pose(crop, d['x'] - src['w'] * z / 2 + ss['x'] * z, d['y'] - src['h'] * z / 2 + ss['y'] * z)
    return out, x0, y0

if PLANS:
    # 13A : chaque salle dessinée à part (les salles d'un donjon sont rangées loin les unes des autres dans la grille) ;
    # l'affichage les met en plan, reliées par les portes, avec la sortie et la salle du boss
    plan['plans'] = {}
    KP = 0.12
    os.makedirs(f'{D}/plans', exist_ok=True)
    u = lambda px, o, c: round((px - o) / c, 4)
    for g, maps in sorted(groupes.items()):
        salles = []
        for m in maps:
            img, x0, y0 = dessiner([m], KP)
            bb = img.getbbox() or (0, 0, img.width, img.height)
            img = img.crop(bb); x0 += bb[0] / KP; y0 += bb[1] / KP
            nom = f"plans/{m['tag']}.webp"
            img.save(f'{D}/{nom}', 'WEBP', quality=80, method=6)
            salles.append({'tag': m['tag'], 'img': nom,
                           'u': [u((x0 - C['x']) * K, carte['ox'], carte['cw']), u((y0 - C['y']) * K, carte['oy'], carte['ch'])],
                           'du': [round(img.width / KP * K / carte['cw'], 4), round(img.height / KP * K / carte['ch'], 4)]})
        plan['plans'][g] = salles
        print(g, len(maps))
elif os.path.exists(f'{D}/plan.json'):
    plan['plans'] = json.load(open(f'{D}/plan.json')).get('plans', {})

json.dump(plan, open(f'{D}/plan.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(NOM, carte, len(plan['maps']), 'cartes', len(plan.get('plans', {})), 'plans')
