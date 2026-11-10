import sys, UnityPy, json, os, warnings
warnings.filterwarnings('ignore')
UnityPy.config.FALLBACK_UNITY_VERSION="6000.3.16f1"

def _crc16(b, crc=0):
    crc = (~crc) & 0xffff
    for x in b:
        q = (x ^ (crc >> 8)) & 0xffff; crc = (crc << 8) & 0xffff
        r = ((q >> 4) ^ q) & 0xffff; crc ^= r; r = (r << 5) & 0xffff; crc ^= r; r = (r << 7) & 0xffff; crc ^= r
    return (~crc) & 0xffff

def crunch_tronque(t):
    """Texture « crunchée » (DXT5Crunched) dont le paquet officiel coupe les dernières petites mips (Nono le Wobot, os 323) :
    UnityPy échoue (« Unpacking failed »). On garde les niveaux entiers, on corrige l'en-tête (nombre de niveaux, taille, CRC)
    et on décode le niveau 0 avec le crunch d'Unity."""
    import struct, texture2ddecoder as T
    from PIL import Image
    from UnityPy.helpers.ResourceReader import get_resource_data
    sd = t.m_StreamData
    d = bytearray(bytes(t.image_data) if t.image_data else get_resource_data(sd.path, t.object_reader.assets_file, sd.offset, sd.size))
    hs, lv = struct.unpack('>H', d[2:4])[0], d[16]
    offs = [struct.unpack('>I', d[70 + 4 * i:74 + 4 * i])[0] for i in range(lv)] + [struct.unpack('>I', d[6:10])[0]]
    n = max(i for i in range(1, lv + 1) if offs[i] <= len(d))
    ds = offs[n]; d = d[:ds]; d[16] = n; d[6:10] = struct.pack('>I', ds)
    d[10:12] = struct.pack('>H', _crc16(d[hs:ds])); d[4:6] = struct.pack('>H', _crc16(d[6:hs]))
    raw = T.decode_bc3(T.unpack_unity_crunch(bytes(d)), t.m_Width, t.m_Height)
    return Image.frombytes('RGBA', (t.m_Width, t.m_Height), raw, 'raw', 'BGRA').transpose(Image.FLIP_TOP_BOTTOM)

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
        except Exception as e:
            print('tex err',e)
            try: crunch_tronque(d).save(f'{out}/tex_{d.m_Name}.png'); print('  réparée (crunch tronqué)')
            except Exception as e2: print('  crunch err', e2)
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
