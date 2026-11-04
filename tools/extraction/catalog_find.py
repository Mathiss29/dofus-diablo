# catalog_find.py catalog.bin key1 key2... : retrouve le bundle Addressables qui contient chaque clé
import sys, struct, re, bisect
d = open(sys.argv[1], 'rb').read()
bund = [(m.start(), m.group().decode()) for m in re.finditer(rb'[a-z0-9_]+_assets_[a-z0-9_]*?\.bundle', d)]
starts = [b[0] for b in bund]
def find(key):
    i = d.find(b'\x00' + key.encode())
    if i < 0: return None
    e = i + 1 + len(key)
    dep = struct.unpack_from('<I', d, e + 12)[0]
    if dep >= len(d): return None
    rec = struct.unpack_from('<I', d, dep)[0]
    j = bisect.bisect_left(starts, rec) - 1
    return bund[j][1] if j >= 0 else None
if __name__ == '__main__':
    for k in sys.argv[2:]: print(k, find(k))
