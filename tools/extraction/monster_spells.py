# monster_spells.py <dossier des tables (json de data_dump.py)> <fr.bin> [src/data/monsters.json]
# Écrit dans monsters.json les VRAIS sorts de chaque monstre (champ dofusId) d'après les données de Dofus 3 :
# monstersdataroot.spells + spellGrades (grade du sort pour le grade 1 du monstre) -> spelllevelsdataroot (PA, PO,
# effets, délai de relance) ; spellscripts -> animId (AnimAttaque<animId>), missileGfxId (projectile), targetGfxId.
# Le jeu traduit ensuite ces données en temps réel (src/sim/monster.ts) : 1 case = CASE px, 1 tour = TOUR s.
import sys, json, ast, os
sys.path.insert(0, os.path.dirname(__file__))
from i18n import load as i18n

def table(d, n):
    j = json.load(open(os.path.join(d, n + '.json')))
    R = {r['rid']: r['data'] for r in j['references']['RefIds']}
    o = j['objectsById']
    return {int(k): R.get(v['rid']) for k, v in zip(o['m_keys'], o['m_values'])}

P = lambda v: ast.literal_eval(v) if isinstance(v, str) and v[:1] in '[{' else v
EL = {96: 'eau', 97: 'terre', 98: 'air', 99: 'feu', 100: 'neutre', 91: 'eau', 92: 'terre', 93: 'air', 94: 'feu', 95: 'neutre'}
STATES = {218: 'pacifiste'}   # états officiels (spellstates) traduits en temps réel
PA_LOSS = {84, 101, 168, 1079}; PM_LOSS = {77, 127, 169, 1080}

def effect(e):
    i, n, dur = e['effectId'], e['diceNum'], e['duration']
    if i in EL: return {'k': 'dmg', 'element': EL[i], 'min': n, 'max': max(n, e['diceSide']), 'steal': i <= 95}
    if i == 1133: return {'k': 'dmg', 'element': 'feu', 'min': n, 'max': max(n, e['diceSide']), 'perPa': True}
    if i in PA_LOSS: return {'k': 'pa', 'n': -n, 'dur': dur}
    if i in PM_LOSS: return {'k': 'pm', 'n': -n, 'dur': dur}
    if i == 128: return {'k': 'pm', 'n': n, 'dur': dur}
    if i == 186: return {'k': 'puissance', 'n': -n, 'dur': dur}
    if i == 6: return {'k': 'attire', 'n': n}
    if i == 5: return {'k': 'repousse', 'n': n}
    if i == 1042: return {'k': 'avance', 'n': n}
    if i == 108: return {'k': 'soin', 'min': n, 'max': max(n, e['diceSide'])}
    if i == 138: return {'k': 'dommages', 'n': n, 'pct': True, 'dur': dur}    # % Dommages (ex. Frénésie)
    if i == 112: return {'k': 'dommages', 'n': n, 'dur': dur}                 # Dommages fixes (ex. Euphorie malsaine)
    if i == 181: return {'k': 'invoque', 'dofusId': n}                        # invocation : monstre n (clé remplie par main)
    if i == 1163: return {'k': 'subis', 'n': n, 'dur': dur}                   # Dommages subis x n % (ex. Cuirasse Laineuse : 70)
    if i == 1075: return {'k': 'desenvoute', 'n': n}                          # Durée des effets : -n tours (ex. Rinçage)
    if i == 950 and STATES.get(e.get('value')):                               # État (ex. Pacifiste : ne peut plus infliger de dommages)
        z = e.get('zoneDescr') or {}
        return {'k': 'etat', 'etat': STATES[e['value']], 'dur': dur, 'r': int(z.get('param1', 0)) if isinstance(z, dict) else 0}
    return None

def main(d, frbin, out='src/data/monsters.json'):
    T = i18n(frbin)
    M, S, L, SC = (table(d, n) for n in ('monsters', 'spells', 'spelllevels', 'spellscripts'))
    ours = json.load(open(out))
    cle = {md.get('dofusId'): k for k, md in ours.items()}
    for key, md in ours.items():
        m = M.get(md.get('dofusId', -1))
        if not m: continue
        spells = []
        for sid, grades in zip(P(m['spells']), P(m['spellGrades'])):
            s = S.get(int(sid)); g = int(grades.split(';')[0].split(',')[0])
            lv = next((L[x] for x in P(s['spellLevels']) if int(L[x]['grade']) == g), L[P(s['spellLevels'])[0]])
            params = {}
            for b in P(s['boundScriptUsageData']):
                raw = str((SC.get(b['scriptId']) or {}).get('rawParams', ''))
                for kv in raw.split(','):
                    if ':' in kv: k, v = kv.split(':', 1); params.setdefault(k.strip(), v.strip())
            effs = [x for x in (effect(e) for e in P(lv['effects'])) if x]
            for x in effs:
                if x['k'] == 'invoque': x['monster'] = cle.get(x.pop('dofusId'))
            effs = [x for x in effs if x['k'] != 'invoque' or x['monster']]
            z = P(lv['effects'])[0]['zoneDescr'] if P(lv['effects']) else {'shape': 80, 'param1': 0}
            tm = P(lv['effects'])[0]['targetMask'] if P(lv['effects']) else 'A'
            sp = {'id': int(sid), 'name': T(int(s['nameId'])), 'pa': int(lv['apCost']), 'po': [int(lv['minRange']), int(lv['range'])],
                  'relance': int(lv['minCastInterval']), 'anim': int(params.get('animId', 0) or 0),
                  'zone': chr(z['shape']) + str(z['param1']), 'allies': tm[:1] in ('a', 'g'), 'effects': effs}
            if params.get('missileGfxId'): sp['missile'] = int(params['missileGfxId'])
            if params.get('targetGfxId'): sp['gfx'] = int(params['targetGfxId'])
            spells.append(sp)
        md['spells'] = spells
        md.pop('ranged', None)
        print(key, [(x['name'], x['po'], [e['k'] for e in x['effects']]) for x in spells])
    json.dump(ours, open(out, 'w'), ensure_ascii=False, indent=1)

if __name__ == '__main__': main(*sys.argv[1:])
