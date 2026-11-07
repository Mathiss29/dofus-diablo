# map_dump.py <bundle mapdata_assets_world_N> <dossier de sortie> [id1,id2,...] : écrit map_<id>.json (MonoBehaviour de la carte)
# pour chaque carte du paquet (ou seulement celles demandées). N = mapId >> 18. Sert à ateliers_postes.py, recoltes.py…
import sys, json, os, warnings
warnings.filterwarnings('ignore')
import UnityPy
UnityPy.config.FALLBACK_UNITY_VERSION = "6000.3.16f1"
bundle, out = sys.argv[1:3]; os.makedirs(out, exist_ok=True)
want = set(map(int, sys.argv[3].split(','))) if len(sys.argv) > 3 else None
for o in UnityPy.load(bundle).objects:
    if o.type.name != 'MonoBehaviour': continue
    try: t = o.read_typetree()
    except Exception: continue
    nm = t.get('m_Name', '') if isinstance(t, dict) else ''
    i = int(nm[4:]) if nm.startswith('map_') and nm[4:].isdigit() else None
    if i is not None and (want is None or i in want):
        json.dump(t, open(f'{out}/map_{i}.json', 'w'), default=str); print('map', i)
