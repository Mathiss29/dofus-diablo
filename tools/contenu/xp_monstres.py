"""XP des monstres d'Astrub et d'Amakna (0.4, 2026-11-10) : une seule courbe selon le niveau du monstre.

Avant : presque tous à 20 XP (valeur provisoire, quelques restes du prototype comme le Bouftou à 10), du niveau 11 au 62. Courbe : un monstre de son niveau rapporte de quoi passer
un niveau en K tués, K = 25 jusqu'au niveau 10 (comme à Incarnam), puis jusqu'à 60 tués au niveau 60 (XP du niveau n = 100 × n).
Élites ×3, boss encore à 20 ×15, archimonstres = même rapport à leur monstre qu'avant. Incarnam et les autres boss ne bougent pas.

    python3 tools/contenu/xp_monstres.py          # écrit src/data/monsters.json

Ralenti le 2026-11-10 (Mathis : « on XP hyper rapidement ») : XP par niveau doublée dans classes.json (xpBase 200), donc
en vrai 50 tués au début et 120 vers le 60 ; les XP des monstres ne changent pas.
"""
import json

PROVISOIRE = 20


def tues_par_niveau(L):
    """Monstres de son niveau pour passer un niveau, avant le ×2 de xpBase. 0.6 (« 0.6 : » 6B, 2026-11-13) : en vrai 120 tués au 60,
    200 au 90, 400 au 200 (donc 60 → 100 → 200 ici)."""
    if L <= 10: return 25
    if L <= 60: return 25 + 35 * (L - 10) / 50
    if L <= 90: return 60 + 40 * (L - 60) / 30
    return 100 + 100 * (L - 90) / 110


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
for L in (11, 16, 22, 32, 42, 54, 62, 75, 90, 120, 200): print(f'niveau {L:>2} : {xp(L):>3} XP, {tues_par_niveau(L):.0f} tués par niveau')
