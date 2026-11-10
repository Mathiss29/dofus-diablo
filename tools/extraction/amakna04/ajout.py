# ajoute les monstres d'Amakna rendus dans am/pl : monsters.json (gabarit) + entrées looks.ts
import json, re, sys, os
S = sys.argv[1]; R = '/home/user/dofus-diablo'
meta = json.load(open(f'{S}/am/meta.json')); M = json.load(open(f'{R}/src/data/monsters.json'))
shots = {}
for l in open(f'{S}/am/planches.log'):
    m = re.match(r'\S+ (\S+) \| \S+ attaques (\{.*?\})', l)
    if m: shots[m[1]] = eval(m[2])
scales = dict(l.split() for l in open(f'{S}/am/scales.txt')) if os.path.exists(f'{S}/am/scales.txt') else {}
looks = []
for key, (did, name, look) in meta.items():
    if key not in shots or not os.path.exists(f'{S}/am/pl/{key}.json'): print('pas de planche', key); continue
    j = json.load(open(f'{S}/am/pl/{key}.json'))
    h = max(fr['frame']['h'] for t in j['textures'] for fr in t['frames'] if fr['filename'].startswith('AnimStatique_1_'))
    ech = int((re.match(r'\{\d+\|[^|]*\|[^|]*\|(\d+)', look) or [0, 100])[1]) / 100
    sc = round(1.6 / float(scales.get(key, 2.5)) * ech, 2)
    taille = h * sc
    M[key] = {'dofusId': did, 'name': name, 'hp': 1000, 'speed': 95, 'radius': max(16, min(34, round(taille * 0.2))),
              'mass': 3 if taille > 160 else 1.2, 'dmg': 14, 'attackRange': 60, 'windup': 0.5, 'lungeSpeed': 420, 'lungeTime': 0.18,
              'recover': 0.65, 'look': key, 'color': '#d8d0b8', 'xp': 20}
    a = shots[key]; a0 = sorted(a)[0]
    fr = lambda s: s.replace(' ', '')
    mp = ', '.join(f'{k}: {fr(v)}' for k, v in sorted(a.items()))
    looks.append(f"  {key}: {{ atlas: '{key}', scale: {sc}, map: MONSTER_MAP({fr(a[a0])}, 'AnimAttaque{a0}', {{ {mp} }}), height: {h}, multi: true }},")
json.dump(M, open(f'{R}/src/data/monsters.json', 'w'), ensure_ascii=False, indent=1)
open(f'{S}/am/looks.txt', 'w').write('\n'.join(looks) + '\n'); print(len(looks), 'monstres')
