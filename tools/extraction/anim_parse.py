import struct
def table(d):
    F,N=struct.unpack_from('<HH',d,0)
    for p in range(6,400):
        if p+4*F>len(d): break
        offs=struct.unpack_from('<%dI'%F,d,p)
        if offs[0]==p+4*F and all(offs[i]<offs[i+1] for i in range(F-1)) and offs[-1]<len(d):
            return F,N,list(offs),p
    raise Exception('no table')
def parse(d):
    F,N,offs,tp=table(d); offs=offs+[len(d)]
    frames=[]
    for i in range(F):
        p=offs[i]; e=offs[i+1]; recs=[]
        while p<e:
            idx,fl,al=struct.unpack_from('<HBB',d,p); p+=4; r={'idx':idx,'fl':fl,'alpha':al}
            if fl&0x21: r['sym'],r['par'],r['u']=struct.unpack_from('<hhI',d,p); p+=8
            if fl&4: r['mul']=tuple(d[p:p+4]); p+=4
            if fl&8: r['add']=tuple(d[p:p+4]); p+=4
            if fl&0x10: r['m']=struct.unpack_from('<6f',d,p); p+=24
            recs.append(r)
        frames.append(recs)
    return {'F':F,'N':N,'header':d[:tp],'frames':frames}
