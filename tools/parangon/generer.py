"""Génère src/data/parangon/<classe>.json depuis les sorts officiels (sorts_officiels.json) et contenu.py.

Règles (choix de Mathis, 2026-11-05) :
- un arbre par classe, ~400 nœuds, cinq zones (Terre, Feu, Eau, Air, Soutien) ;
- chaque sort officiel a un nœud ; sa distance au départ suit son niveau officiel :
  points = round(6 + (niveau - 1) * 34 / 189)  (niveau 1 -> 6, niveau 190 -> 40) ;
- force du nœud : petit (niveau <= 60), moyen (<= 139), transformation (>= 140) ; jamais de contrepartie ;
- clés de voûte générales avec un prix, une seule active ; emplacements de rune (Rune / Pa / Ra).

Usage : python tools/parangon/generer.py
"""
import json, math, os, re, sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
from contenu import ZONES, CARACS, CARACS_CLASSE, RUNES, RUNE_BONUS, NOTABLES, CLES, TRANSFO

SORTIE = os.path.join(ICI, '..', '..', 'src', 'data', 'parangon')
SORTS = json.load(open(os.path.join(ICI, 'sorts_officiels.json'), encoding='utf-8'))
NOMS = {'iop': 'Iop', 'cra': 'Crâ', 'osamodas': 'Osamodas'}


def distance(niveau):
    return round(6 + (niveau - 1) * 34 / 189)


def palier(niveau):
    return 'petit' if niveau <= 60 else 'moyen' if niveau < 140 else 'transformation'


def effet_sort(s):
    """Bonus d'un nœud de sort, tiré de l'effet officiel décrit (érosion, bouclier, poussée…)."""
    d, n, p = s['desc'].lower(), s['nom'], palier(s['niveau'])
    de = ("d'" if n[0].lower() in 'aeiouyéèêâîôœ' else 'de ') + n
    if p == 'transformation':
        return TRANSFO[n]
    fort = p == 'moyen'
    cases = 'de 2 cases' if fort else "d'une case"
    if 'invoque' in d:
        t = f"{n} : l'invocation a {'+25' if fort else '+10'} % de PV et de dommages."
    elif 'érode' in d:
        t = f"{n} érode {'60' if fort else '30'} % de plus."
    elif 'applique un bouclier' in d:
        t = f"Le bouclier {de} est {'40' if fort else '20'} % plus solide."
    elif 'soigne' in d or 'vole de la vie' in d:
        t = f"{n} soigne {'30' if fort else '15'} % de plus."
    elif d.startswith(('augmente', 'rend ', 'sacrifie', 'applique l')):
        t = f"L'effet {de} dure {'50' if fort else '25'} % plus longtemps."
    elif 'repousse' in d or 'éloigne' in d:
        t = f"{n} repousse {cases} de plus."
    elif 'attire' in d or 'rapproche' in d:
        t = f"{n} attire {cases} de plus."
    elif 'retire des pm' in d or 'retire des pa' in d or 'immobilise' in d:
        t = f"{n} ralentit {'40' if fort else '20'} % plus fort."
    elif 'téléporte' in d or 'échange' in d:
        t = f"{n} se recharge {'3' if fort else '1,5'} s plus vite."
    elif 'piège' in d or 'balise' in d:
        t = f"{n} a {'2 cases' if fort else 'une case'} de zone en plus."
    elif 'augmente' in d or 'applique' in d:
        t = f"L'effet {de} dure {'50' if fort else '25'} % plus longtemps."
    else:
        t = f"{n} : {'+20' if fort else '+10'} % de dommages."
    if fort:
        t += ' Le sort se recharge aussi 3 s plus vite.' if 'zone' not in d else ' Le sort a aussi une case de zone en plus.'
    return (n, t)


class Arbre:
    def __init__(self, classe):
        self.classe, self.noeuds, self.liens = classe, [], []

    def ajoute(self, **n):
        n['id'] = len(self.noeuds)
        self.noeuds.append(n)
        return n['id']

    def lie(self, a, b):
        self.liens.append([a, b])


def place(rayon, angle):
    return round(math.cos(angle) * rayon, 4), round(math.sin(angle) * rayon, 4)


def generer(classe):
    a = Arbre(classe)
    depart = a.ajoute(type='depart', zone=None, x=0, y=0, nom=f'Départ du {NOMS[classe]}')
    sorts = SORTS[classe]
    par_zone = {z: [s for s in sorts if (s['element'] or 'soutien') == z] for z in ZONES}
    largeur = 2 * math.pi / len(ZONES)
    rmax = max(distance(s['niveau']) for s in sorts) + 4
    for zi, z in enumerate(ZONES):
        centre = -math.pi / 2 + zi * largeur + largeur / 2
        caracs = CARACS_CLASSE.get(classe, {}).get(z, CARACS[z])
        zs = sorted(par_zone[z], key=lambda s: s['niveau'])
        troncs = [[], []]
        prof = [0, 0]
        for i, s in enumerate(zs):
            prof[i % 2] = max(prof[i % 2], distance(s['niveau']) - 1)
        prof[0] = max(prof[0], 36)  # la clé de voûte est au bout du premier tronc
        k = 0
        for t in (0, 1):
            ang = centre + (-0.22 if t == 0 else 0.22) * largeur
            prec = depart
            for p in range(1, prof[t] + 1):
                stat, val = caracs[k % len(caracs)]
                k += 1
                x, y = place(p / rmax, ang)
                n = a.ajoute(type='carac', zone=z, x=x, y=y, profondeur=p, stat=stat, valeur=val)
                a.lie(prec, n)
                troncs[t].append(n)
                prec = n
        for p in range(8, min(prof) + 1, 8):  # passages entre les deux troncs
            a.lie(troncs[0][p - 1], troncs[1][p - 1])

        def branche(t, p, decal, *chaine):
            prec = troncs[t][min(p, len(troncs[t])) - 1]
            base = a.noeuds[prec]['profondeur']
            ang = centre + (-0.22 if t == 0 else 0.22) * largeur + decal
            for j, n in enumerate(chaine):
                x, y = place((base + j + 1) / rmax, ang)
                nid = a.ajoute(x=x, y=y, zone=z, profondeur=base + j + 1, **n)
                a.lie(prec, nid)
                prec = nid
            return prec

        for i, s in enumerate(zs):
            t, d = i % 2, distance(s['niveau'])
            nom, texte = effet_sort(s)
            decal = (0.09 if t == 0 else -0.09) * (1 if (i // 2) % 2 == 0 else -1)
            prec = troncs[t][d - 2] if d >= 2 else depart
            base = a.noeuds[prec]['profondeur'] if d >= 2 else 0
            x, y = place((base + 1) / rmax, centre + (-0.22 if t == 0 else 0.22) * largeur + decal)
            nid = a.ajoute(type='sort', zone=z, x=x, y=y, profondeur=base + 1, nom=nom, texte=texte,
                           sort={'id': s['id'], 'nom': s['nom'], 'niveau': s['niveau'], 'palier': palier(s['niveau'])})
            a.lie(prec, nid)

        stat, val = caracs[0]
        (n1, t1), (n2, t2) = NOTABLES[classe][z]
        branche(0, 12, -0.12, dict(type='carac', stat=stat, valeur=val), dict(type='notable', nom=n1, texte=t1))
        branche(1, 26, 0.12, dict(type='carac', stat=stat, valeur=val), dict(type='notable', nom=n2, texte=t2))
        branche(1, 15, -0.12, dict(type='rune', nom='Emplacement de rune', runes=RUNES[z]))
        if z in CLES[classe]:
            nom, gain, prix = CLES[classe][z]
            branche(0, 34, 0.12, dict(type='carac', stat=stat, valeur=val), dict(type='carac', stat=stat, valeur=val),
                    dict(type='cle', nom=nom, texte=gain, prix=prix))
    return {
        'classe': classe,
        'nom': f'Parangon du {NOMS[classe]}',
        'regles': {
            'ouverture': 200, 'pointParNiveau': 1, 'plafondDepart': 100, 'plafondParGrandeZone': 'à fixer zone par zone',
            'clesDeVouteMax': 1, 'distanceSort': '6 + (niveau - 1) * 34 / 189',
            'paliers': {'petit': '<= 60', 'moyen': '61-139', 'transformation': '>= 140'},
            'runes': RUNE_BONUS, 'reinitialisation': 'nœud par nœud contre des kamas',
        },
        'noeuds': a.noeuds,
        'liens': a.liens,
    }


if __name__ == '__main__':
    os.makedirs(SORTIE, exist_ok=True)
    for c in SORTS:
        arbre = generer(c)
        with open(os.path.join(SORTIE, f'{c}.json'), 'w', encoding='utf-8') as f:
            json.dump(arbre, f, ensure_ascii=False, indent=1)
        types = {}
        for n in arbre['noeuds']:
            types[n['type']] = types.get(n['type'], 0) + 1
        print(c, len(arbre['noeuds']), types)
