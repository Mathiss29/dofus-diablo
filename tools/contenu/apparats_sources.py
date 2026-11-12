"""Sources des apparats (maquette « Apparats : » 2026-11-12) : src/data/apparats_sources.json.

python tools/contenu/apparats_sources.py [app_src.json]

Plus aucun apparat ne s'achète au Marché. Chaque apparat (coiffe, cape, familier d'apparat) reçoit une source :
  boss     : 1 à 3 apparats exclusifs par boss de donjon (1B, 1 chance sur 75 par victoire), choisis à la main par thème ;
  classe   : coiffe au niveau 50 et cape au niveau 100 avec la classe (1C, succès « Apparats ») ;
  fete     : fêtes du calendrier (1D), tombent seulement pendant la fête ;
  monde    : boss du monde et invasions (1E), via World.gagnerApparat(evenement) ;
  enutrof  : coffre au trésor de l'Enutrof (classes.json, tresor.apparats) ;
  tiwa     : Tiwa Cawoteuw (Cawottes, 7A) ;
  avenir   : source officielle de Dofus 3 dans une zone pas encore en jeu ;
  boutique : boutique Ogrines (1H, à venir) : les apparats que Dofus 3 vend en Ogrines.
Rareté (3A) : Rare, Épique ou Légendaire (couleur au sol, collection, prix en Ogrines 300 / 500 / 800).
app_src.json (facultatif, /mnt/project-files/apparats/) : sources officielles relevées dans les données de Dofus 3.7
(drops, recettes, succès, étapes de quêtes) ; sans lui, les apparats officiels passent en « boutique »."""
import json, os, sys, hashlib

R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
A = json.load(open(os.path.join(R, 'src/data/apparat.json'), encoding='utf-8'))['objets']
F = json.load(open(os.path.join(R, 'src/data/familiers.json'), encoding='utf-8'))['familiers']
CL = json.load(open(os.path.join(R, 'src/data/classes.json'), encoding='utf-8'))
M = json.load(open(os.path.join(R, 'src/data/monsters.json'), encoding='utf-8'))
OFF = json.load(open(sys.argv[1], encoding='utf-8')) if len(sys.argv) > 1 else {}

NOMS = {}
for k, v in A.items(): NOMS.setdefault(v['name'], k)
for k, v in F.items():
    if v.get('apparat'): NOMS.setdefault(v['nom'], k)


def ids(*noms):
    out = []
    for n in noms:
        if n not in NOMS: sys.exit(f'apparat inconnu : {n}')
        out.append(NOMS[n])
    return out


# 1B : boss de donjon -> apparats exclusifs (rapprochement par le thème, Tutuyutu = drop officiel du Wa Wabbit)
BOSS = {
    'kardorim': ids('Coiffe de la Crypte', 'Cape de la Crypte'),
    'tournesol_affame': ids('Canotier Fleuri', 'Couronne feuillue', 'Voile feuillu'),
    'mob_l_eponge': ids('Coiffe de Popol le Poulpe', 'Cape Amphitrident'),
    'royal': ids('Bonnellaine', 'Chapoduvet', 'Capoduvet'),
    'kankreblath': ids('Casque Mandibulaire', 'Cape Mandibulaire'),
    'scarabosse_dore': ids('Casque du Scarab', 'Cape du Scarab'),
    'chafer_ronin': ids('Casque du Samouraï', 'Masque Nō', 'Cape Nō'),
    'batofu': ids('Bleu Tofu', 'Tofu Ventru', 'Tofus'),
    'directeur_grunob': ids('Cartable du Primate', 'Chapapier', 'Capapier'),
    'bworkette': ids('Casque des Bolrogs', 'Cape des Bolrogs'),
    'coffre_des_forgerons': ids('Kamapo', 'Kamasac'),
    'kwakwa': ids('Chaplume', 'Caplume'),
    'shin_larve': ids('Limasque', 'Limape'),
    'craqueleur_legendaire': ids('Coiffe Cristalline', 'Cape Cristalline'),
    'wa_wobot': ids('Coiffe Droïde', 'Cape Droïde'),
    'wa_wabbit': ids('Oreilles du Wapin', 'Cape du Wapin', 'Tutuyutu'),
    'kanniboul_ebil': ids('Maskananas', 'Capananas', 'Sakananas'),
}
for b in BOSS: assert b in M and M[b].get('boss'), b

# 1C : apparats de classe (coiffe au niveau 50, cape au niveau 100 avec la classe)
CLASSE = {
    'iop': ids('Diadème Iop', 'Cape Iop'), 'cra': ids('Coiffe Crâ', 'Cape Crâ'), 'osamodas': ids('Coiffe Osamodas', 'Cape Osamodas'),
    'sacrieur': ids('Coiffe Sacrieur', 'Cape Sacrieur'), 'eniripsa': ids('Diadème Eniripsa', 'Cape Eniripsa'),
    'enutrof': ids('Heaume Enutrof', 'Cape Enutrof'), 'forgelance': ids('Cape Forgelance'),
    # classes à venir : déjà rangées, leur succès apparaîtra avec la classe
    'feca': ids('Coiffe Féca', 'Cape Féca'), 'sram': ids('Coiffe Sram', 'Cape Sram'), 'xelor': ids('Coiffe Xélor', 'Cape Xélor'),
    'ecaflip': ids('Cape Ecaflip'), 'sadida': ids('Coiffe Sadida'), 'pandawa': ids('Coiffe Pandawa', 'Cape Pandawa'),
    'roublard': ids('Coiffe Roublarde', 'Cape Roublarde'), 'zobal': ids('Coiffe Zobal', 'Cape Zobal'), 'steamer': ids('Coiffe Steamer', 'Cape Steamer'),
    'eliotrope': ids('Bonnet Eliotrope', 'Cape Eliotrope'), 'huppermage': ids('Coiffe Huppermage', 'Cape Huppermage'),
    'ouginak': ids('Bandeau Ouginak', 'Pèlerine Ouginak'),
}
NOM_CLASSE = {'iop': 'Iop', 'cra': 'Crâ', 'osamodas': 'Osamodas', 'sacrieur': 'Sacrieur', 'eniripsa': 'Eniripsa', 'enutrof': 'Enutrof',
              'forgelance': 'Forgelance', 'feca': 'Féca', 'sram': 'Sram', 'xelor': 'Xélor', 'ecaflip': 'Ecaflip', 'sadida': 'Sadida',
              'pandawa': 'Pandawa', 'roublard': 'Roublard', 'zobal': 'Zobal', 'steamer': 'Steamer', 'eliotrope': 'Eliotrope',
              'huppermage': 'Huppermage', 'ouginak': 'Ouginak'}

# 1D : fêtes du calendrier (dates maison, mois-jour, la fin est incluse)
FETES = {
    'nowel': {'nom': 'Nowel', 'debut': '12-15', 'fin': '01-06', 'apparats': ids(
        'Saponnet de Nowel', 'Saponnet de Nowel 648', 'Saponnet de Nowel 649', 'Saponnet de Nowel 650', 'Saponnet de Nowel 651',
        'Saponnet de Nowel 652', 'Saponnet de Nowel 653', 'Saponnet de Nowel 655', 'Hotte de Nowel', 'Boule de Nowel', 'Cape de Nowel',
        'Chapeau de Nowel', 'Chapeau en Pain d\'Épice', 'Cape en Pain d\'Épice', 'Bonnet d\'Emballeur de cadeaux', 'Écharpe d\'Emballeur de cadeaux',
        'Bonnet du Biscuitier', 'Écharpe du Biscuitier', 'Bonnet du Confiseur', 'Écharpe du Confiseur')},
    'halouine': {'nom': 'Halouine', 'debut': '10-20', 'fin': '11-05', 'apparats': ids('Casque d\'Halouine', 'Cape d\'Halouine', 'Coiffe Zombique', 'Cape Zombique', 'Chapeaudron')},
    'ballotin': {'nom': 'Saint-Ballotin', 'debut': '02-07', 'fin': '02-21', 'apparats': ids('Chapeau de la Sain Ballotin', 'Couronne du Ballotin', 'La Brisekœur', 'La Kœurelle')},
    'printemps': {'nom': 'Printemps', 'debut': '03-20', 'fin': '04-20', 'apparats': ids('Chaprintanier', 'Caprintanière')},
    'ete': {'nom': 'Été', 'debut': '07-01', 'fin': '08-31', 'apparats': ids('Coiffleur de l\'Été', 'Cabalnéaire', 'Paill\'Nama du Plagiste')},
}

# 1E : boss du monde et invasions (0.5) : sources officielles (Gelées Royales, Gargandyas) et thème (invasions)
MONDE = {
    'gelees': {'nom': 'Gelées Royales', 'apparats': ids('Couwonne du Wa Dunow', 'Cape du Wa Dunow', 'Couwonne de la Weine Dussud', 'Cape de la Weine Dussud', 'Minowang', 'Bouloute d\'Halouine')},
    'gargandyas': {'nom': 'Gargandyas', 'apparats': ids('Osacoche d\'Osavora', 'Cornes d\'Osavora', 'Cornes Gargandyesques', 'Gargandynou perturbé')},
    'invasion_cuirasses': {'nom': 'Invasion des Cuirassés', 'apparats': ids('Kasque ranforcé', 'Kape karapacé')},
    'invasion_mansots': {'nom': 'Invasion des Mansots', 'apparats': ids('Bob de Manchic', 'Sacarête de Manchic')},
}

ENUTROF = CL['enutrof']['coffre']['tresor']['apparats'] if 'coffre' in CL.get('enutrof', {}) else []
if not ENUTROF:
    def chercher(o):
        if isinstance(o, dict):
            if 'tresor' in o and isinstance(o['tresor'], dict) and 'apparats' in o['tresor']: return o['tresor']['apparats']
            for v in o.values():
                r = chercher(v)
                if r: return r
        return None
    ENUTROF = chercher(CL) or []
B = json.load(open(os.path.join(R, 'src/data/boutique.json'), encoding='utf-8'))
TIWA = [a['id'] for a in B.get('tiwa_cawoteuw', []) if a.get('apparat')]

out = {}
def poser(i, src, rarete):
    if i in out: sys.exit(f'apparat en double : {i} ({out[i]} / {src})')
    out[i] = {**src, 'rarete': rarete}

for b, l in BOSS.items():
    niv = M[b]['level']
    for i in l: poser(i, {'k': 'boss', 'boss': b}, 'rare' if niv < 40 else 'epique' if niv < 60 else 'legendaire')
for c, l in CLASSE.items():
    for i in l: poser(i, {'k': 'classe', 'classe': c, 'niveau': 100 if A.get(i, {}).get('slot') == 'cape' else 50}, 'epique' if A.get(i, {}).get('slot') == 'cape' else 'rare')
for f, d in FETES.items():
    for i in d['apparats']: poser(i, {'k': 'fete', 'fete': f}, 'epique')
for e, d in MONDE.items():
    for i in d['apparats']: poser(i, {'k': 'monde', 'evenement': e}, 'legendaire')
for i in ENUTROF:   # le coffre au trésor de l'Enutrof donne aussi les apparats de sa classe
    if i not in out: poser(i, {'k': 'enutrof'}, 'epique')
for i in TIWA: poser(i, {'k': 'tiwa'}, 'epique')
TOUS = list(A) + [k for k, v in F.items() if v.get('apparat')]
for i in TOUS:
    if i in out: continue
    if OFF.get(i, {}).get('src'): poser(i, {'k': 'avenir'}, 'epique'); continue
    h = int(hashlib.md5(i.encode()).hexdigest(), 16) % 100   # 1H : boutique Ogrines, rareté = prix 300 / 500 / 800
    poser(i, {'k': 'boutique'}, 'rare' if h < 50 else 'epique' if h < 85 else 'legendaire')

# 1C : un succès par apparat de classe (catégorie Général, sous-catégorie « Apparats »)
succes = {}
for c, l in CLASSE.items():
    for i in l:
        niv = out[i]['niveau']; nom = A.get(i, {}).get('name') or F[i]['nom']
        succes[f'apparat_{c}_{niv}'] = {
            'nom': f'{NOM_CLASSE[c]} de niveau {niv}', 'dofusId': 0, 'description': f'Atteindre le niveau {niv} avec un {NOM_CLASSE[c]}.',
            'categorie': 'Général', 'sousCategorie': 'Apparats', 'points': 10 if niv == 50 else 20, 'icone': 82,
            'objectifs': [{'nom': f'{NOM_CLASSE[c]} niveau {niv}', 'classe': c, 'niveau': niv}],
            'recompense': {'apparat': i}, **({} if c in CL else {'classe': c})}

json.dump({
    '_': 'Sources des apparats (maquette « Apparats : » 2026-11-12), écrit par tools/contenu/apparats_sources.py. Plus aucun apparat au Marché.',
    'chances': {'_': '1 chance sur N', 'boss': 75, 'fete': {'normal': 4000, 'elite': 400, 'boss': 40}},
    'fetes': {k: {'nom': v['nom'], 'debut': v['debut'], 'fin': v['fin']} for k, v in FETES.items()},
    'monde': {k: {'nom': v['nom']} for k, v in MONDE.items()},
    'sources': out, 'succes': succes,
}, open(os.path.join(R, 'src/data/apparats_sources.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
import collections
print(len(out), collections.Counter(v['k'] for v in out.values()), len(succes), 'succès')
