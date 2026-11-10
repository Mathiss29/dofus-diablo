# Succès officiels ajoutés au menu des succès (ligne « Succès : … 9A+9B+9C+9D+9E », 2026-11-10). Lu par quetes.py (exec, après S) :
# ajoute à S les succès de succes_officiels.json (tiré du jeu par tools/extraction/succes_officiels.py) qui ont un sens chez nous.
#  9A exploration (Astrub ; Amakna en partie de test), 9B un succès par donjon, 9C défis de donjon en temps réel (Duo, Blitzkrieg,
#  Prudent, Sans potion), 9D familles de monstres (sans le challenge), 9E niveaux (Général) et métiers.
# « test » : contenu de la partie de test (0.4 : Amakna, Wabbits, donjons de donjonsTest) ; le jeu le cache ailleurs.
_D = os.path.dirname(__file__)
_OFF = json.load(open(os.path.join(_D, 'succes_officiels.json'), encoding='utf-8'))
_PAR_ID = {a['id']: a for a in _OFF}
_M = json.load(open(os.path.join(_D, '..', '..', 'src', 'data', 'monsters.json'), encoding='utf-8'))
_Z = json.load(open(os.path.join(_D, '..', '..', 'src', 'data', 'zones.json'), encoding='utf-8'))
_PAR_DOFUS = {}
for _k, _m in _M.items():
    if _m.get('dofusId') is not None: _PAR_DOFUS.setdefault(_m['dofusId'], _k)

# sous-zones (nom -> id, essai) et monstres qu'on croise vraiment (sous-zones, élites, donjons), par zone
_SOUS, _VUS, _DONJONS = {}, {}, []
for _zid in ('incarnam', 'astrub'):
    _o = _Z[_zid]['open']
    for _sid, _sa in _o['subareas'].items():
        _SOUS.setdefault((_zid, _sa['name']), (int(_sid), bool(_sa.get('essai'))))
        for _mk in _sa.get('monsters', []) + ([_sa['elite']] if _sa.get('elite') else []):
            _VUS[_mk] = _VUS.get(_mk, True) and bool(_sa.get('essai'))
    for _test, _l in ((False, _o.get('donjons', [])), (True, _o.get('donjonsTest', []))):
        for _d in _l:
            _boss = next((m for m in _d.get('bossVague', []) if _M.get(m, {}).get('boss')), None)
            if not _boss:
                _boss = next((m for gs in _d['salles'].values() for gr in gs for m in gr if _M.get(m, {}).get('boss')), None)
            for gs in _d['salles'].values():
                for gr in gs:
                    for _mk in gr: _VUS[_mk] = _VUS.get(_mk, True) and _test
            if _boss: _DONJONS.append({'nom': _d['nom'], 'boss': _boss, 'test': _test})

def _rec(a, ratio=None):
    r = {}
    x = a['recompense']['xp'] if ratio is None else ratio
    if x: r['xp'] = round(x * 500)
    obj = next((i for i, _ in a['recompense']['objets'] if i in ITEMS['resources'] or i in ITEMS['equipment']), None)
    if obj: r['objet'] = obj
    if a['recompense']['titres']: r['titre'] = a['recompense']['titres'][0]
    if a['recompense']['ornements']:
        o = a['recompense']['ornements'][0]; r['ornement'] = {'id': o['id'], 'nom': o['nom'], 'icone': o['icone']}
    return r

def _off(cle, a, cat, sous, obj, desc=None, test=False, rec=None):
    s = {'nom': a['nom'], 'dofusId': a['id'], 'description': desc or a['description'], 'categorie': cat, 'sousCategorie': sous,
         'points': a['points'], 'icone': a['icone'], 'objectifs': obj}
    r = rec if rec is not None else _rec(a)
    if r: s['recompense'] = r
    if test: s['test'] = True
    S[cle] = s
    return s

def _niveau(a):
    """Objectif « Niveau N » officiel (critère PL>N-1)."""
    for nom, c in a['objectifs']:
        if c.startswith('PL>'): return {'nom': f'Niveau {int(c[3:]) + 1}', 'niveau': int(c[3:]) + 1}
    return None

_DEJA = {s.get('dofusId') for s in S.values() if s.get('dofusId')}
_CLE_OFF = {}   # id officiel -> clé chez nous (succès qui en regroupent d'autres)
for _s_id, _s in S.items():
    if _s.get('dofusId'): _CLE_OFF[_s['dofusId']] = _s_id

# --- 9E Général : niveaux du perso (Novice … Vétéran ; ornements officiels à 100, 160 et 200) --------------------------------
for a in _OFF:
    if a['categorie'] == 'Général' and a['description'].startswith('Atteindre le niveau') and a['id'] not in _DEJA:
        n = int(a['description'].split()[-1].rstrip('.'))
        _CLE_OFF[a['id']] = _off(f'niveau_{n}', a, 'Général', 'Niveaux', [{'nom': f'Niveau {n}', 'niveau': n}]) and f'niveau_{n}'

# --- 9A Exploration : une sous-zone découverte (même nom que la nôtre), puis les succès qui les regroupent --------------------------
_ZONE_DE = {'Incarnam': 'incarnam', 'Astrub': 'astrub', 'Amakna': 'astrub'}
for a in _OFF:
    if a['categorie'] != 'Exploration' or a['id'] in _DEJA or a['objectifs']: continue
    nom = a['description'].split('"')[1] if '"' in a['description'] else a['nom']
    z = _SOUS.get((_ZONE_DE[a['sousCategorie']], nom))
    if not z or (a['sousCategorie'] == 'Amakna') != z[1]: continue   # sous-zone pas (encore) chez nous
    cle = f"zone_{z[0]}"
    _off(cle, a, 'Exploration', a['sousCategorie'], [{'nom': nom, 'sousZone': z[0]}], test=z[1])
    _CLE_OFF[a['id']] = cle

def _metas(categorie, prefixe):
    """Succès officiels « Obtenir les succès suivants » dont tous les succès demandés existent chez nous."""
    for a in _OFF:
        if a['categorie'] != categorie or a['id'] in _DEJA or not a['objectifs'] or not all(c.startswith('(OA=') for _, c in a['objectifs']): continue
        ids = [int(c[4:-1]) for _, c in a['objectifs']]
        if not all(i in _CLE_OFF for i in ids): continue
        obj = [{'nom': S[_CLE_OFF[i]]['nom'], 'succes': _CLE_OFF[i]} for i in ids]
        cle = f'{prefixe}_{a["id"]}'
        _off(cle, a, categorie, a['sousCategorie'], obj, test=any(S[_CLE_OFF[i]].get('test') for i in ids))
        _CLE_OFF[a['id']] = cle
_metas('Exploration', 'explo')

# --- 9D Monstres : familles officielles, vaincre chaque monstre (le challenge du jeu de base n'a pas de sens en temps réel) -------
for a in _OFF:
    if a['categorie'] != 'Monstres' or a['id'] in _DEJA or not a['objectifs'] or a['objectifs'][0][1].startswith('(OA='): continue
    obj, test = [], False
    for nom, c in a['objectifs']:
        if not c.startswith('(Ef>'): continue
        mk = _PAR_DOFUS.get(int(c[4:].split(',')[0]))
        if not mk or mk not in _VUS: continue   # monstre qu'on ne croise pas (encore) : objectif retiré
        obj.append({'nom': _M[mk]['name'], 'monstre': mk}); test = test or _VUS[mk]
    if len(obj) < 2: continue
    niv = _niveau(a)
    sous = a['sousCategorie']
    cle = f'famille_{a["id"]}'
    _off(cle, a, 'Monstres', 'Île des Wabbits' if a['sousCategorie'] == 'Île de la cawotte' else sous, obj + ([niv] if niv else []),
         desc='Vaincre chaque monstre de la famille.', test=test or a['sousCategorie'] != 'Astrub')
    _CLE_OFF[a['id']] = cle
_metas('Monstres', 'monstres')

# --- 9B + 9C Donjons : un succès par boss, et ses défis en temps réel ---------------------------------------------------------------
REGLES = [('duo', 'Duo', 20, 2, 'Vaincre {b} dans son donjon, à deux joueurs au plus.', 'À deux joueurs au plus'),
          ('chrono', 'Blitzkrieg', 10, 1, 'Vaincre {b} moins de 90 secondes après son apparition.', 'En moins de 90 s'),
          ('prudent', 'Prudent', 10, 1, 'Vaincre {b} sans être touché une seule fois après son apparition.', 'Sans être touché'),
          ('sansPotion', 'Sans potion', 10, 1, 'Vaincre {b} sans boire de potion dans le donjon.', 'Sans boire de potion')]
_BASE = {}   # boss (clé) -> succès officiel « Vaincre X dans son donjon. »
_DEFIS = {}  # (boss, nom du défi) -> succès officiel
for a in _OFF:
    if a['categorie'] != 'Donjons': continue
    for nom, c in a['objectifs']:
        if c.startswith('(EM>') and c.endswith(',d)'):
            mk = _PAR_DOFUS.get(int(c[4:].split(',')[0]))
            if mk: _BASE.setdefault(mk, a)
        if c.startswith('(EH>') and '(' in a['nom']:
            pass
for a in _OFF:
    if a['categorie'] == 'Donjons' and '(' in a['nom']:
        _DEFIS[a['nom']] = a
for d in _DONJONS:
    b = _M[d['boss']]['name']
    base = _BASE.get(d['boss'])
    if base and base['id'] not in _DEJA:
        niv = _niveau(base)
        _off(f'donjon_{base["id"]}', base, 'Donjons', base['sousCategorie'], [{'nom': b, 'donjon': d['nom']}] + ([niv] if niv else []), test=d['test'])
    niv = _niveau(base) if base else None
    le = base['description'][len('Vaincre '):].split(' dans son donjon')[0] if base else b   # « le Bouftou Royal »
    for regle, nom, pts, ratio, desc, court in REGLES:
        o = _DEFIS.get(f'{b} ({nom})')
        a = o or {'id': 0, 'nom': f'{b} ({nom})', 'description': '', 'points': pts, 'icone': base['icone'] if base else 82,
                  'recompense': {'xp': ratio, 'objets': base['recompense']['objets'] if base else [], 'titres': [], 'ornements': []}}
        a = {**a, 'icone': base['icone'] if base else a['icone']}
        _off(f'defi_{regle}_{d["boss"]}', a, 'Donjons', (base['sousCategorie'] if base else 'Niveaux 1 à 50'),
             [{'nom': court, 'defi': [d['nom'], regle]}] + ([niv] if niv else []),
             desc=desc.format(b=le), test=d['test'], rec=_rec(a, ratio))

# --- 9E Métiers : succès officiels (un métier au niveau 10, 100, 200 ; objets fabriqués ; runes) et paliers de chaque métier --------
_METIER_OFF = {14: ('*', 10), 15: ('*', 100), 16: ('*', 200)}
_COMPTE_OFF = {120: ('fabriques', 1), 121: ('fabriques', 100), 122: ('fabriques', 1000), 123: ('fabriques', 10000),
               769: ('runes', 100), 119: ('runes', 1000), 768: ('runes', 10000)}
for a in _OFF:
    if a['categorie'] != 'Métiers': continue
    if a['id'] in _METIER_OFF:
        m, n = _METIER_OFF[a['id']]
        _off(f'metier_tous_{n}', a, 'Métiers', 'Général', [{'nom': f'Un métier au niveau {n}', 'metier': m, 'palier': n}])
    elif a['id'] in _COMPTE_OFF:
        k, n = _COMPTE_OFF[a['id']]
        _off(f'{k}_{n}', a, 'Métiers', 'Général', [{'nom': ('Objets fabriqués' if k == 'fabriques' else 'Runes obtenues'), 'compteur': k, 'n': n}])
_ICONE_PALIER = {10: 167, 50: 167, 100: 168, 150: 168, 200: 77}
for mk, mt in ITEMS['metiers'].items():
    for n, pts in ((10, 5), (50, 5), (100, 10), (150, 10), (200, 20)):
        S[f'metier_{mk}_{n}'] = {'nom': f"{mt['name']} niveau {n}", 'dofusId': 0, 'description': f"Atteindre le niveau {n} dans le métier {mt['name']}.",
            'categorie': 'Métiers', 'sousCategorie': mt['name'], 'points': pts, 'icone': _ICONE_PALIER[n],
            'objectifs': [{'nom': f"Niveau de {mt['name']}", 'metier': mk, 'palier': n}], 'recompense': {'xp': round(n * 5)}}
