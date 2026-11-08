# equipement_ajout.py : ajoute à src/data/items.json les équipements officiels d'un export plus haut (version 0.3, objets 26 à 40),
# avec leurs panoplies, sans réécrire le reste du fichier (recettes, butin, runes… ajoutés par les autres outils).
# Les objets déjà dans le butin officiel des monstres (drops) tombent alors comme équipement (avant : rangés par erreur
# avec les ressources, ex. Boufcoiffe Royale du Bouftou Royal).
# Usage : FR=<fr.bin> python tools/extraction/items_export.py <tables> <icônes> src/data/monsters.json /tmp/x/items.json /tmp/x/objets 40
#         python tools/contenu/equipement_ajout.py /tmp/x/items.json   puis   icones_ajout.py <item_assets_2x.bundle> <iconId…> (affichés)
import json, os, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
P = os.path.join(ROOT, 'src/data/items.json')
N = json.load(open(sys.argv[1])); O = json.load(open(P))
neufs = {k: v for k, v in N['equipment'].items() if k not in O['equipment']}
O['equipment'].update(neufs)
for k in neufs: O['resources'].pop(k, None)
for sid, s in N['sets'].items():
    if sid in O['sets']: O['sets'][sid]['items'] = sorted(set(O['sets'][sid]['items']) | set(s['items']))
    elif any(str(i) in neufs for i in s['items']): O['sets'][sid] = s
json.dump(O, open(P, 'w'), ensure_ascii=False, indent=1)
icones = sorted({v['icon'] for v in neufs.values()})
print(len(neufs), 'équipements ajoutés ; icônes :', ' '.join(map(str, icones)))
