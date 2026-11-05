"""Exporte les objets officiels utiles au jeu dans src/data/items.json, et range leurs icônes sur une planche.

python items_export.py <donnees> <icones_item_1x> <monsters.json du jeu> <src/data/items.json> <public/assets/ui/objets (sans extension)> [niveau_max]
  donnees : tables sorties par data_dump.py (items.json, itemsets.json, itemtypes.json, monsters.json de Dofus)
  icones  : dossier png/item_1x du catalogue (catalogue.py), une icône par iconId
Garde : les équipements jusqu'au niveau max (25 par défaut) avec leurs lignes de caractéristiques (min, max),
leurs panoplies (bonus par nombre d'objets portés), et les ressources lâchées par les monstres du jeu (choix 24E)."""
import ast, json, os, re, shutil, sys
from i18n import load as load_i18n

donnees, icons, game_monsters, out, icon_out = sys.argv[1:6]
LMAX = int(sys.argv[6]) if len(sys.argv) > 6 else 25
T = load_i18n(os.environ.get('FR', os.path.join(donnees, '..', 'fr.bin')))
L = lambda v: v if isinstance(v, (list, dict)) else ast.literal_eval(v)


def table(n):
    d = json.load(open(os.path.join(donnees, n + '.json')))
    R = {r['rid']: r['data'] for r in d['references']['RefIds']}
    o = d['objectsById']
    return {int(k): R.get(v['rid']) for k, v in zip(o['m_keys'], o['m_values'])}, R


I, RI = table('items'); SETS, RS = table('itemsets'); M, _ = table('monsters')

# typeId Dofus -> emplacement du jeu
SLOTS = {1: 'amulette', 9: 'anneau', 10: 'ceinture', 11: 'bottes', 16: 'chapeau', 17: 'cape', 82: 'bouclier',
         2: 'arme', 3: 'arme', 4: 'arme', 5: 'arme', 6: 'arme', 7: 'arme', 8: 'arme', 19: 'arme', 22: 'arme'}
WEAPON = {2: 'Arc', 3: 'Baguette', 4: 'Bâton', 5: 'Dague', 6: 'Épée', 7: 'Marteau', 8: 'Pelle', 19: 'Hache', 22: 'Faux'}
# effectId Dofus -> caractéristique du jeu (signe -1 pour les malus)
STATS = {125: ('vitalite', 1), 153: ('vitalite', -1), 118: ('force', 1), 157: ('force', -1), 126: ('intelligence', 1), 155: ('intelligence', -1),
         123: ('chance', 1), 152: ('chance', -1), 119: ('agilite', 1), 154: ('agilite', -1), 124: ('sagesse', 1), 156: ('sagesse', -1),
         115: ('critique', 1), 138: ('puissance', 1), 112: ('dommages', 1), 178: ('soins', 1), 111: ('pa', 1), 128: ('pm', 1),
         176: ('prospection', 1), 422: ('dommagesTerre', 1), 424: ('dommagesFeu', 1), 426: ('dommagesEau', 1), 428: ('dommagesAir', 1),
         430: ('dommagesNeutre', 1)}
# lignes de dommages des armes -> élément
WEAPON_DMG = {96: 'eau', 97: 'terre', 98: 'air', 99: 'feu', 100: 'neutre'}


def lines(rids):
    st, dmg = {}, []
    for r in rids:
        e = RI.get(r['rid']) or RS.get(r['rid'])
        if not e: continue
        eid, a, b = int(e['effectId']), int(e.get('diceNum', 0)), int(e.get('diceSide', 0))
        lo, hi = a, max(a, b)
        if eid in WEAPON_DMG: dmg.append({'element': WEAPON_DMG[eid], 'min': lo, 'max': hi}); continue
        if eid not in STATS: continue
        k, sign = STATS[eid]
        v = [sign * lo, sign * hi] if sign > 0 else [sign * hi, sign * lo]
        st[k] = [st.get(k, [0, 0])[0] + v[0], st.get(k, [0, 0])[1] + v[1]]
    return st, dmg


items, sets, used_icons = {}, {}, set()
for k, v in I.items():
    if not v or int(v['typeId']) not in SLOTS or int(v['level']) > LMAX: continue
    st, dmg = lines(L(v['possibleEffects']))
    if not st and not dmg: continue
    it = {'name': T(int(v['nameId'])), 'slot': SLOTS[int(v['typeId'])], 'level': int(v['level']), 'icon': int(v['iconId']), 'stats': st}
    if int(v['typeId']) in WEAPON: it['weapon'] = {'type': WEAPON[int(v['typeId'])], 'dmg': dmg}
    if any(int((RI.get(r['rid']) or {}).get('effectId', 0)) == 795 for r in L(v['possibleEffects'])): it['chasse'] = True   # effet « Arme de chasse »
    if int(v['itemSetId']) > 0: it['set'] = int(v['itemSetId'])
    items[str(k)] = it; used_icons.add(it['icon'])
for sid in {it['set'] for it in items.values() if 'set' in it}:
    s = SETS.get(sid)
    if not s: continue
    bonus = {}
    for n, step in enumerate(L(s['effects'])):
        st, _ = lines(step.get('values', []))
        if st: bonus[str(n)] = {k: v[1] for k, v in st.items()}   # bonus de panoplie fixes : on garde la valeur haute
    sets[str(sid)] = {'name': T(int(s['nameId'])), 'items': [i for i in L(s['items']) if str(i) in items], 'bonus': bonus}

# Ressources officielles lâchées par les monstres du jeu (percentDropForGrade1, en %)
game = json.load(open(game_monsters))
drops, resources = {}, {}
for key, gm in game.items():
    dm = M.get(int(gm.get('dofusId', 0) or 0))
    if not dm: continue
    lst = []
    for d in L(dm['drops']):
        o = I.get(int(d['objectId']))
        if not o: continue
        e = {'item': str(d['objectId']), 'chance': round(float(d['percentDropForGrade1']), 2)}
        # viandes : « Pj>41,N&CU>0 » = métier Chasseur au-dessus du niveau N et une arme de chasse en main
        mj = re.search(r'Pj>(\d+),(\d+)', d.get('criterions') or '')
        if mj: e['metier'] = {'id': int(mj.group(1)), 'min': int(mj.group(2)) + 1}; e['chasse'] = 'CU>0' in d['criterions']
        lst.append(e)
        resources[str(d['objectId'])] = {'name': T(int(o['nameId'])), 'icon': int(o['iconId']), 'level': int(o['level'])}
        used_icons.add(int(o['iconId']))
    drops[key] = lst

JOBS = {41: 'chasseur'}
J, _ = table('jobs'); REC, _ = table('recipes')
recipes, metiers = [], {}
for jid, key in JOBS.items():
    metiers[key] = {'id': jid, 'name': T(int(J[jid]['nameId'])), 'icon': int(J[jid]['iconId'])}
changed = True
while changed:   # une recette peut utiliser le résultat d'une autre
    changed = False
    for rid, r in REC.items():
        if not r or int(r['jobId']) not in JOBS or str(r['resultId']) in resources: continue
        ing = list(zip(L(r['ingredientIds']), L(r['quantities'])))
        if not all(str(i) in resources for i, _ in ing): continue
        o = I[int(r['resultId'])]
        res = {'name': T(int(o['nameId'])), 'icon': int(o['iconId']), 'level': int(o['level'])}
        for e in L(o['possibleEffects']):
            e = RI.get(e['rid']) or {}
            if int(e.get('effectId', 0)) == 110: res['soin'] = int(e['diceNum'])   # « +N PV » : se mange
        resources[str(r['resultId'])] = res; used_icons.add(res['icon']); changed = True
        recipes.append({'result': str(r['resultId']), 'metier': JOBS[int(r['jobId'])], 'level': int(r['resultLevel']),
                        'ingredients': [[str(i), int(q)] for i, q in ing]})
recipes.sort(key=lambda r: r['level'])

json.dump({'equipment': items, 'sets': sets, 'resources': resources, 'drops': drops, 'recipes': recipes, 'metiers': metiers},
          open(out, 'w'), ensure_ascii=False, indent=1)
# Une seule planche pour toutes les icônes (case de 64 px, ordre des iconId) : <icon_out>.webp + src/data/icones_objets.json
# (des centaines de petits fichiers ralentissent le chargement et dépassent les limites de publication)
from PIL import Image
C, miss, cells = 64, 0, []
for i in sorted(used_icons):
    src = os.path.join(icons, f'{i}.png')
    if os.path.exists(src): cells.append((i, src))
    else: miss += 1
cols = 20; rows = (len(cells) + cols - 1) // cols
sheet = Image.new('RGBA', (cols * C, rows * C))
frames = {}
for n, (i, src) in enumerate(cells):
    im = Image.open(src).convert('RGBA'); im.thumbnail((C, C))
    x, y = (n % cols) * C, (n // cols) * C
    sheet.paste(im, (x + (C - im.width) // 2, y + (C - im.height) // 2))
    frames[str(i)] = n
sheet.save(icon_out + '.webp', 'WEBP', lossless=True, method=6)
json.dump({'cell': C, 'cols': cols, 'rows': rows, 'icons': frames}, open(os.path.join(os.path.dirname(out), 'icones_objets.json'), 'w'))
print(len(items), 'équipements,', len(sets), 'panoplies,', len(resources), 'ressources,', len(cells), 'icônes (', miss, 'manquantes )')
