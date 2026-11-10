"""Pouvoirs légendaires officiels (maquette « Légendaires : 1A 2B 3A 4A 5A 6A », version 0.3) -> src/data/pouvoirs.json.

python pouvoirs.py tools/extraction/panos_classe.json src/data/sorts.json src/data/pouvoirs.json
  panos.json : panoplies officielles de classe (panos.py, effets de sort 281-294 des pièces), copie dans
  /mnt/project-files/panoplies-classe/. Pour chaque classe jouable : les 40 effets de sort officiels de sa panoplie
  (5 pièces x 8). Choix 2B : chaque pièce garde ses 5 premiers effets sur son emplacement, ses 3 derniers vont
  à l'amulette, l'arme et le bouclier. Valeurs officielles fixes (3A). La traduction en temps réel est dans src/sim/pouvoirs.ts."""
import json, re, sys

panos, sorts, out = sys.argv[1:4]
CLASSES = {'Iop': 'iop', 'Crâ': 'cra', 'Osamodas': 'osamodas', 'Sacrieur': 'sacrieur', 'Forgelance': 'forgelance', 'Eniripsa': 'eniripsa'}
SLOT = {'Chapeau': 'chapeau', 'Cape': 'cape', 'Ceinture': 'ceinture', 'Bottes': 'bottes', 'Anneau': 'anneau'}
EXTRA = ['amulette', 'arme', 'bouclier']
S = json.load(open(sorts, encoding='utf-8'))
P = json.load(open(panos, encoding='utf-8'))


def effet(e):
    for pat, k in [(r'^([+-]\d+) Portée maximale', 'po'), (r'^([+-]\d+) Portée minimale', 'pomin'), (r'^-(\d+) PA', 'pa'),
                   (r'^-(\d+) de relance', 'relance'), (r'^\+(\d+) lancer\(s\) par tour', 'parTour'),
                   (r'^\+(\d+) lancer\(s\) par cible', 'parCible'), (r'^\+(\d+) dégâts de base', 'dmg'), (r'^\+(\d+)% Critique', 'crit')]:
        m = re.match(pat, e)
        if m: return k, abs(int(m.group(1)))
    if 'ligne de vue désactivée' in e or 'case occupée nécessaire désactivée' in e: return 'ldv', 1   # Fulgurance : se lance sans cible, comme sans ligne de vue
    if 'lancer en ligne désactivé' in e: return 'ligne', 1
    if 'Portée modifiable' in e: return 'pom', 1
    raise SystemExit('effet inconnu : ' + e)


res = {}
for pano in P:
    cle = CLASSES.get(pano['classe'])
    if not cle: continue
    ids = {s['name']: s['id'] for p in S[cle] for s in p}
    lst = []
    for piece in pano['items']:
        for i, l in enumerate(piece['sorts']):
            nom, e = l.split(' : ', 1)
            k, n = effet(e)
            lst.append({'id': f"{cle}-{len(lst) + 1:02d}", 'slot': SLOT[piece['type']] if i < 5 else EXTRA[i - 5],
                        'piece': piece['nom'], 'sort': nom, 'dofusId': ids.get(nom), 'effet': k, 'n': n, 'officiel': l})
    res[cle] = lst
json.dump(res, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print({k: len(v) for k, v in res.items()}, [p['sort'] for v in res.values() for p in v if not p['dofusId']])
