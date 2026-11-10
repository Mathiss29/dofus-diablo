"""XP des monstres d'Astrub et d'Amakna (0.4, 2026-11-10) : une seule courbe selon le niveau du monstre.

Avant : presque tous à 20 XP (valeur provisoire, quelques restes du prototype comme le Bouftou à 10), du niveau 11 au 62. Courbe : un monstre de son niveau rapporte de quoi passer
un niveau en K tués, K = 25 jusqu'au niveau 10 (comme à Incarnam), puis jusqu'à 60 tués au niveau 60 (XP du niveau n = 100 × n).
Élites ×3, boss encore à 20 ×15, archimonstres = même rapport à leur monstre qu'avant. Incarnam et les autres boss ne bougent pas.

    python3 tools/contenu/xp_monstres.py          # écrit src/data/monsters.json
"""
import json

PROVISOIRE = 20


def tues_par_niveau(L): return 25 if L <= 10 else 25 + 35 * (min(L, 60) - 10) / 50 + max(0, L - 60) * 0.7


def xp(L): return round(100 * L / tues_par_niveau(L))


M = json.load(open('src/data/monsters.json')); Z = json.load(open('src/data/zones.json'))
def de(z): return {t for s in (Z[z]['open'] or {}).get('subareas', {}).values() for t in s.get('monsters', []) + ([s['elite']] if s.get('elite') else [])}
cibles = de('astrub') - de('incarnam')
vieux = {k: m.get('xp') for k, m in M.items()}
n = 0
for k, m in M.items():   # boss des donjons d'Astrub (Tournesol Affamé, Mob l'Éponge, Kankreblath)
    if m.get('boss') and m.get('xp') == PROVISOIRE: m['xp'] = xp(m['level']) * 15; n += 1; print('boss', k, m['xp'])
for k in sorted(cibles):
    m = M.get(k)
    if not m or m.get('boss') or m.get('archiDe'): continue
    m['xp'] = xp(m['level']) * (3 if m.get('elite') else 1); n += 1
for k, m in M.items():
    b = m.get('archiDe')
    if b in cibles and vieux.get(b) and vieux[k]:
        m['xp'] = round(M[b]['xp'] * vieux[k] / vieux[b]); n += 1
open('src/data/monsters.json', 'w').write(json.dumps(M, ensure_ascii=False, indent=1) + '\n')
print(n, 'monstres')
for L in (11, 16, 22, 32, 42, 54, 62): print(f'niveau {L:>2} : {xp(L):>3} XP, {tues_par_niveau(L):.0f} tués par niveau')
