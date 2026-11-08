import sys, UnityPy, json, os, warnings
warnings.filterwarnings('ignore')
UnityPy.config.FALLBACK_UNITY_VERSION="6000.3.16f1"
env = UnityPy.load(sys.argv[1]); out=sys.argv[2]; os.makedirs(out, exist_ok=True)
for o in env.objects:
    n=o.type.name
    if n=='TextAsset':
        d=o.read(); nm=d.m_Name
        b=d.m_Script.encode('utf-8','surrogateescape') if isinstance(d.m_Script,str) else bytes(d.m_Script)
        open(f'{out}/ta_{nm}.bin','wb').write(b); print('TA',nm,len(b), b[:24])
    elif n=='Texture2D':
        d=o.read(); print('TEX', d.m_Name, d.m_Width, d.m_Height, d.m_TextureFormat)
        try: d.image.save(f'{out}/tex_{d.m_Name}.png')
        except Exception as e: print('tex err',e)
    elif n=='MonoBehaviour':
        print('MB', o.path_id, 'has_tt', o.serialized_type.node is not None if o.serialized_type else None)
        try:
            t=o.read_typetree(); json.dump(t, open(f'{out}/mb_{o.path_id}.json','w'), default=str)
            print('  keys', list(t.keys())[:30])
            # Squelettes récents (Lance Immortelle 7139) : animations rangées dans le squelette (dataBytes), pas en TextAsset
            for a in t.get('animations') or []:
                if a.get('dataBytes') and not os.path.exists(f"{out}/ta_x_{a['name']}.bin"):
                    open(f"{out}/ta_x_{a['name']}.bin",'wb').write(bytes(a['dataBytes']))
        except Exception as e:
            print('  tt err', str(e)[:200]); open(f'{out}/mb_{o.path_id}.raw','wb').write(o.get_raw_data())
