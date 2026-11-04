import sys, UnityPy, json, warnings
warnings.filterwarnings('ignore')
UnityPy.config.FALLBACK_UNITY_VERSION="6000.3.16f1"
env=UnityPy.load(sys.argv[1])
for o in env.objects:
    if o.type.name=='MonoBehaviour':
        try:
            t=o.read_typetree()
            json.dump(t, open(sys.argv[2],'w'), default=str); print('keys',list(t.keys())[:20], len(json.dumps(t,default=str)))
        except Exception as e: print('err',e)
