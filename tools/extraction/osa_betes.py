"""Invocations de l'Osamodas (maquette Osamodas, 2026-11-08) : src/data/betes.json.

python osa_betes.py <tables> <fr.bin> src/data/betes.json
  tables : dossier des tables sorties par data_dump.py (monsters, spells, spelllevels, spellscripts .json)

Pour chaque bête (monstres officiels 8070-8083 et les Épées du Sacrieur 434 et 5192, les invocations des sorts Tofu, Bouftou, Crapipou, Dragoune…) :
nom, squelette (look), PV en part des PV du lanceur (50 % base, 75 % évoluée, 100 % ultime), lignée de l'Éveil (8C)
et ses vrais sorts au grade 1 : PA, portée en cases, animation (AnimAttaque<animId>), zone, effets que le jeu sait jouer :
dmg (vol = vol de vie), soin (soigne l'Osamodas et ses bêtes), repousse, attire, avance, bouclier (% du niveau).
Les autres effets (Tacle, Fuite, téléportations…) restent dans `autres` pour l'infobulle, pas encore joués.
Les réglages (part des dommages, laisse, cadence) sont dans `_regles` : ils ne sont pas réécrits par le script."""
import json, os, sys, ast

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from i18n import load as I18N  # noqa: E402

P = lambda v: ast.literal_eval(v) if isinstance(v, str) and v[:1] in '[{' else v
EL = {96: 'eau', 97: 'terre', 98: 'air', 99: 'feu', 100: 'neutre', 91: 'eau', 92: 'terre', 93: 'air', 94: 'feu', 95: 'neutre'}
SOIN = {2998: 'eau', 2999: 'air', 3000: 'terre', 108: 'feu'}

# clé, id du monstre, rang (1 base, 2 évoluée, 3 ultime), élément de la lignée, rang suivant (Éveil)
BETES = [
    ('tofu', 8070, 1, 'air', 'ventritofu'), ('ventritofu', 8071, 2, 'air', 'scarafoudre'), ('scarafoudre', 8079, 3, 'air', None),
    ('bouftou', 8072, 1, 'terre', 'bouflourd'), ('bouflourd', 8073, 2, 'terre', 'craquolosse'), ('craquolosse', 8078, 3, 'terre', None),
    ('crapipou', 8074, 1, 'eau', 'crapipaud'), ('crapipaud', 8075, 2, 'eau', 'crocoleureux'), ('crocoleureux', 8080, 3, 'eau', None),
    ('dragoune', 8076, 1, 'feu', 'dragonnet'), ('dragonnet', 8077, 2, 'feu', 'sulfenix'), ('sulfenix', 8081, 3, 'feu', None),
    ('gobgob_glouton', 8082, 2, 'neutre', None), ('gobgob_facetieux', 8083, 3, 'neutre', None),
    # Épées du Sacrieur (maquette Sacrieur 7A) : mêmes règles d'alliés que les bêtes, planches sacri_<clé>
    ('epee_vorace', 434, 1, 'neutre', None), ('epee_dansante', 5192, 1, 'neutre', None),
    # Eniripsa (maquette Eniripsa 5B 6B 7A) : Lapino (Mot d'Amitié, os 7599), Fées (os 7600) et Feu Follet (os 7601) des Encouragements
    # et des Moqueries lancés sur une case libre ; planches eni_lapino, eni_fee, eni_feu_follet
    ('lapino', 7370, 1, 'neutre', None), ('fee_stimulante', 7372, 1, 'neutre', None), ('fee_vivifiante', 7374, 1, 'neutre', None),
    ('fee_jouvence', 7373, 1, 'neutre', None), ('feu_accablant', 7378, 1, 'neutre', None),
    # Enutrof (maquette Enutrof, 10 nov. 2026) : Sac Animé (os 4147), Pelle Animée (os 4156) et le coffre au trésor permanent
    # (Coffre Animé, os 4166, 2D) ; planches enu_sac, enu_pelle, enu_coffre
    ('sac_anime', 5830, 1, 'neutre', None), ('pelle_animee', 5834, 1, 'terre', None), ('coffre_tresor', 5840, 1, 'eau', None),
]
ATLAS = {'lapino': 'eni_lapino', 'fee': 'eni_fee', 'feu': 'eni_feu_follet', 'sac': 'enu_sac', 'pelle': 'enu_pelle', 'coffre': 'enu_coffre'}
PV = {1: 0.5, 2: 0.75, 3: 1.0}


def table(d, n):
    j = json.load(open(os.path.join(d, n + '.json')))
    R = {r['rid']: r['data'] for r in j['references']['RefIds']}
    o = j['objectsById']
    return {int(k): R.get(v['rid']) for k, v in zip(o['m_keys'], o['m_values'])}


def effet(e):
    i, n, s = e['effectId'], e['diceNum'], e['diceSide']
    if i in EL: return {'k': 'dmg', 'element': EL[i], 'min': n, 'max': max(n, s), **({'vol': True} if i <= 95 else {})}
    if i in SOIN: return {'k': 'soin', 'min': n, 'max': max(n, s)}
    if i in (5, 1103): return {'k': 'repousse', 'n': n}
    if i == 6: return {'k': 'attire', 'n': n}
    if i == 1042: return {'k': 'avance', 'n': n}
    if i == 1020: return {'k': 'bouclier', 'n': n}
    return None


def main(tables, frbin, out):
    T = I18N(frbin)
    M, S, L, SC = (table(tables, n) for n in ('monsters', 'spells', 'spelllevels', 'spellscripts'))
    old = json.load(open(out)) if os.path.exists(out) else {}
    res = {'_regles': old.get('_regles', {})}
    for key, mid, rang, el, suivant in BETES:
        m = M[mid]
        look = str(m['look']).strip('{}').split('|')[0]
        sorts = []
        for sid, grades in zip(P(m['spells']), P(m['spellGrades'])):
            s = S.get(int(sid)); g = int(str(grades).split(';')[0].split(',')[0])
            lv = next((L[x] for x in P(s['spellLevels']) if int(L[x]['grade']) == g), L[P(s['spellLevels'])[0]])
            params = {}
            for b in P(s['boundScriptUsageData']):
                for kv in str((SC.get(b['scriptId']) or {}).get('rawParams', '')).split(','):
                    if ':' in kv: k, v = kv.split(':', 1); params.setdefault(k.strip(), v.strip())
            E = P(lv['effects'])
            effs = [x for x in (effet(e) for e in E) if x]
            # un même jet en double (Crapoison : poison Eau rejoué) : on garde le premier
            vus, uniq = set(), []
            for x in effs:
                sig = json.dumps(x, sort_keys=True)
                if sig not in vus: vus.add(sig); uniq.append(x)
            z = E[0]['zoneDescr'] if E else {'shape': 80, 'param1': 0}
            sp = {'id': int(sid), 'name': T(int(s['nameId'])), 'pa': int(lv['apCost']), 'po': [int(lv['minRange']), int(lv['range'])],
                  'anim': int(params.get('animId', 0) or 0), 'zone': chr(z['shape']) + str(z['param1']), 'effets': uniq,
                  'desc': T(int(s['descriptionId'])) if s.get('descriptionId') else ''}
            if params.get('missileGfxId'): sp['missile'] = int(params['missileGfxId'])
            if params.get('targetGfxId'): sp['gfx'] = int(params['targetGfxId'])
            sorts.append(sp)
        res[key] = {'dofusId': mid, 'name': T(int(m['nameId'])), 'look': int(look), 'atlas': (f'sacri_{key}' if key.startswith('epee') else ATLAS.get(key.split('_')[0], f'osa_{key}')), 'rang': rang,
                    'element': el, 'suivant': suivant, 'pv': PV[rang], 'sorts': sorts}
        print(key, res[key]['name'], [(x['name'], x['po'], [e['k'] for e in x['effets']]) for x in sorts])
    json.dump(res, open(out, 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__': main(*sys.argv[1:])
