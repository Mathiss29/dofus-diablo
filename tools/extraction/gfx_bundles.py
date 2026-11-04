import struct,re,bisect,json,sys
from collections import Counter, defaultdict
d=open('/mnt/user-data/uploads/Content/Map/Textures/1x/catalog_1.0.bin','rb').read()
bund=[(m.start(),m.group().decode()) for m in re.finditer(rb'mapgfx_1x_\d+_assets_all[^.]*\.bundle',d)]
st=[b[0] for b in bund]
def where(g):
    k=b'\x00%d.png'%g; i=d.find(k)
    if i<0: return None
    e=i+len(k); dep=struct.unpack_from('<I',d,e+20)[0]
    rec=struct.unpack_from('<I',d,dep)[0]; j=bisect.bisect_left(st,rec)-1
    return re.sub(r'_[0-9a-f]{32}','',bund[j][1])
if __name__=='__main__':
    t=json.load(open(sys.argv[1])); md=t['mapData']
    gs=set(e['gfxId'] for k in ['backgroundElements','sortableElements','foregroundElements'] for e in md[k])
    by=defaultdict(list)
    for g in gs: by[where(g)].append(g)
    for b,v in sorted(by.items(),key=lambda x:str(x[0])): print(b,len(v),sorted(v)[:6])
