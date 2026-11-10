# planche des groupes de décor (sortables qui se recouvrent) des salles d'un donjon, numérotés
import json,sys
from PIL import Image,ImageDraw
from salle import tex,teinte,SKIP
D=json.load(open('djs.json'))
import os
SOL=set(int(x) for x in os.environ.get('SOL','').split(',') if x)
def groupes(mid,k=0.3):
    t0=json.load(open(f'cartes/map_{mid}.json')); md=t0['mapData']; bs=[]
    REF={r['rid']:r.get('data') for r in (t0.get('references') or {}).get('RefIds',[])}
    def saute(mk,e):
        if (e['color']['value']>>24)&255==0: return True
        sd=md[mk].get('shaderData',[]); i=e.get('materialIndex',-1)
        if 0<=i<len(sd):
            for p in (REF.get(sd[i]['rid']) or {}).get('shaderParameters',[]):
                d=REF.get(p['rid']) or {}
                if d.get('destinationFactor')==1 and d.get('sourceFactor') in (1,2,3): return True
                if 'waveTexID' in d: return True
                if d.get('destinationFactor') is not None and d.get('sourceFactor')==0: return True
        return False
    for e in [x for x in md['sortableElements'] if not saute('sortableMaterialData',x)]+[dict(x,fond=1) for x in md['backgroundElements'] if not saute('backgroundMaterialData',x)]:
        if e['gfxId'] in SKIP or e['gfxId'] in SOL: continue
        if (e['color']['value']&0xFFFFFF)<0x101010: continue
        im=tex(e['gfxId'])
        if im is None: continue
        t=e['transform']; w,h=im.width*abs(t['m11']),im.height*abs(t['m22']); x,y=t['m31'],-t['m32']
        bs.append(((x-w/2,y-h/2,x+w/2,y+h/2),e))
    n=len(bs); par=list(range(n))
    inner=[((b[0]*(1-k)+b[2]*k),(b[1]*(1-k)+b[3]*k),(b[2]*(1-k)+b[0]*k),(b[3]*(1-k)+b[1]*k)) for b,_ in bs]
    def f(i):
        while par[i]!=i: par[i]=par[par[i]]; i=par[i]
        return i
    for i in range(n):
        a=inner[i]
        for j in range(i+1,n):
            b=inner[j]
            if a[0]+6<b[2] and b[0]+6<a[2] and a[1]+6<b[3] and b[1]+6<a[3]: par[f(i)]=f(j)
    g={}
    for i in range(n): g.setdefault(f(i),[]).append(i)
    out=[]
    for ix in g.values():
        cad=(min(bs[i][0][0] for i in ix),min(bs[i][0][1] for i in ix),max(bs[i][0][2] for i in ix),max(bs[i][0][3] for i in ix))
        out.append((cad,[bs[i][1] for i in ix]))
    return out
def dessine(els,cad,K=0.35):
    w,h=int((cad[2]-cad[0])*K)+2,int((cad[3]-cad[1])*K)+2; cv=Image.new('RGBA',(w,h),(0,0,0,0))
    for e in sorted(els,key=lambda e:(0 if e.get('fond') else 1,e.get('cellId',0),e.get('innerCellRenderOrder',0))):
        im=tex(e['gfxId']); t=e['transform']
        if t['m11']<0: im=im.transpose(0)
        if t['m22']<0: im=im.transpose(1)
        nw,nh=max(1,round(im.width*abs(t['m11'])*K)),max(1,round(im.height*abs(t['m22'])*K))
        im=teinte(im.resize((nw,nh),1),e['color']['value'])
        cv.alpha_composite(im,(max(0,round((t['m31']-cad[0])*K-nw/2)),max(0,round((-t['m32']-cad[1])*K-nh/2)))) if True else 0
    return cv
if __name__=='__main__':
    k=sys.argv[1]; L=[]
    for m in D[k]['maps']:
        for cad,els in groupes(m):
            w,h=cad[2]-cad[0],cad[3]-cad[1]
            if w*h<120*120 or w>1000 or h>1000: continue
            im=dessine(els,cad,0.15); a=im.getchannel('A'); import numpy as np
            A=np.asarray(a)>40; rgb=np.asarray(im.convert('RGB')).mean(2)
            if A.sum()==0 or rgb[A].mean()<float(os.environ.get('SOMBRE',45)) or A.mean()<0.03: continue
            L.append((m,cad,els))
    json.dump([(m,cad) for m,cad,_ in L],open(f'grp_{k}.json','w'))
    T=150; cols=12; rows=(len(L)+cols-1)//cols
    sh=Image.new('RGB',(cols*T,rows*T),(40,40,48)); d=ImageDraw.Draw(sh)
    for i,(m,cad,els) in enumerate(L):
        try: im=dessine(els,cad)
        except Exception: continue
        im.thumbnail((T-6,T-18)); x,y=(i%cols)*T,(i//cols)*T
        sh.paste(im,(x+3,y+16),im); d.text((x+4,y+2),str(i),fill=(255,230,0))
    sh.save(f'grp_{k}.png'); print(k,len(L))
