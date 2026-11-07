# ateliers_postes.py <monde> <dossier des map_<id>.json> : ajoute à chaque atelier de src/data/zones.json (<monde>.open.ateliers)
# ses « postes » = les machines officielles de ses cartes (four, scie, enclume, plan de travail…), cliquables en jeu
# (maquette Métiers UI 3A : un clic sur l'atelier ouvre la fenêtre Artisanat).
#
# Les machines sont des éléments interactifs fixes des cartes Dofus 3 (ClientInteractiveElementTransform). Le client ne dit pas
# quelle interaction porte un dessin (c'est le serveur) : les dessins de machines sont listés à la main dans MACHINES, repérés à
# l'œil sur les cartes des ateliers d'Incarnam et d'Astrub (portes, trappes, escaliers et décor laissés de côté).
# Atelier sans machine dessinée (Atelier des alchimistes d'Astrub, ateliers en plein air d'Incarnam) : pas de poste, le jeu pose
# l'icône de l'atelier sur la case la plus dégagée de sa première carte.
#
# Cartes : tools/extraction/map_dump.py <mapdata_assets_world_N.bundle> <dossier> <ids> (N = mapId >> 18 ; ids dans monde.json).
import json, sys, os
monde, cartes = sys.argv[1:3]
MACHINES = {
    32991, 49528, 702107,          # paysans : four, moulin, pétrin
    49494, 49495, 49510,           # mineurs : fonderie, concasseur, enclume
    49491, 49516,                  # alchimistes : alambics
    49496, 49514,                  # bûcherons : scies
    49512, 49513, 49515,           # pêcheurs : plans de travail
    49400, 49401, 49502, 49521,    # chasseurs : plans de travail
    49504,                         # bricoleurs : établi
}
R = os.path.join(os.path.dirname(__file__), '..', '..')
ZONES = os.path.join(R, 'src', 'data', 'zones.json')
z = json.load(open(ZONES, encoding='utf-8'))
ids = {m['tag']: m['id'] for m in json.load(open(os.path.join(R, 'public', 'assets', 'mondes', monde, 'monde.json')))['maps']}
for a in z[monde]['open']['ateliers']:
    postes = []
    for tag in a['cartes']:
        f = f'{cartes}/map_{ids.get(tag)}.json'
        if not os.path.exists(f): continue
        t = json.load(open(f)); Rf = {q['rid']: q for q in t.get('references', {}).get('RefIds', [])}
        for e in t['mapData'].get('interactiveElements', []):
            q = Rf.get(e['rid'])
            if not q or q['type']['class'] != 'ClientInteractiveElementTransform' or q['data']['gfxId'] not in MACHINES: continue
            d, tr = q['data'], q['data']['transform']; c = d['cellId']; row, k = divmod(c, 14)
            # décalage du dessin par rapport au milieu de sa case (même repère que recoltes.py), en pixels Dofus
            dx, dy = round(tr['m31'] + 623.5 - (43 + k * 86 + (row % 2) * 43), 1), round(505.25 - tr['m32'] - (21.5 + row * 21.5), 1)
            if abs(dx) > 60 or abs(dy) > 60: dx = dy = 0
            postes.append([tag, c, d['gfxId'], dx, dy])
    if postes: a['postes'] = postes
    else: a.pop('postes', None)
    print(a['nom'], len(postes))
json.dump(z, open(ZONES, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
