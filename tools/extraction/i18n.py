import struct
def load(p):
    d=open(p,'rb').read(); n=struct.unpack_from('<I',d,3)[0]; p=7; T={}
    for i in range(n):
        k,o=struct.unpack_from('<II',d,p); p+=8; T[k]=o
    def get(k):
        o=T.get(k)
        if o is None: return None
        # longueur en varint 7 bits
        L=0; s=0
        while True:
            b=d[o]; o+=1; L|=(b&0x7f)<<s; s+=7
            if b<0x80: break
        return d[o:o+L].decode('utf-8','replace')
    return get
