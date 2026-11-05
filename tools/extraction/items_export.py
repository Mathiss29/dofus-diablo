"""Exporte les objets officiels utiles au jeu dans src/data/items.json, et copie leurs icônes.

python items_export.py <donnees> <icones_item_1x> <monsters.json du jeu> <src/data/items.json> <public/assets/ui/objets> [niveau_max]
  donnees : tables sorties par data_dump.py (items.json, itemsets.json, itemtypes.json, monsters.json de Dofus)
  icones  : dossier png/item_1x du catalogue (catalogue.py), une icône par iconId
Garde : les équipements jusqu'au niveau max (25 par défaut) avec leurs lignes de caractéristiques (min, max),
leurs panoplies (bonus par nombre d'objets portés), et les ressources lâchées par les monstres du jeu (choix 24E)."""
import ast, json, os, shutil, sys
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
        lst.append({'item': str(d['objectId']), 'chance': round(float(d['percentDropForGrade1']), 2)})
        resources[str(d['objectId'])] = {'name': T(int(o['nameId'])), 'icon': int(o['iconId']), 'level': int(o['level'])}
        used_icons.add(int(o['iconId']))
    drops[key] = lst

json.dump({'equipment': items, 'sets': sets, 'resources': resources, 'drops': drops}, open(out, 'w'), ensure_ascii=False, indent=1)
os.makedirs(icon_out, exist_ok=True)
miss = 0
for i in used_icons:
    src = os.path.join(icons, f'{i}.png')
    if os.path.exists(src): shutil.copy(src, os.path.join(icon_out, f'{i}.png'))
    else: miss += 1
print(len(items), 'équipements,', len(sets), 'panoplies,', len(resources), 'ressources,', len(used_icons) - miss, 'icônes (', miss, 'manquantes )')
