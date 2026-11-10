# « salle officielle agrandie » : les murs de la vraie salle reculent (même art), le sol est recopié pour remplir
import json,sys,math,random
import numpy as np
from PIL import Image,ImageDraw
from salle import tex,teinte,SKIP
W,H,OX,OY,COLS=86,43,-620,-490,14
def charge(mid):
    t=json.load(open(f'cartes/map_{mid}.json')); md=t['mapData']
    REF={r['rid']:r.get('data') for r in (t.get('references') or {}).get('RefIds',[])}
    def saute(mk,e):
        if e['gfxId'] in SKIP or (e['color']['value']>>24)&255==0: return True
        sd=md[mk].get('shaderData',[]); i=e.get('materialIndex',-1)
        if 0<=i<len(sd):
            for p in (REF.get(sd[i]['rid']) or {}).get('shaderParameters',[]):
                d=REF.get(p['rid']) or {}
                if d.get('destinationFactor')==1 and d.get('sourceFactor') in (1,2,3): return True
                if 'waveTexID' in d: return True
        return False
    return md,saute
def img(e):
    im=tex(e['gfxId'])
    if im is None: return None
    t=e['transform']
    if t['m11']<0: im=im.transpose(0)
    if t['m22']<0: im=im.transpose(1)
    nw,nh=max(1,round(im.width*abs(t['m11']))),max(1,round(im.height*abs(t['m22'])))
    return teinte(im.resize((nw,nh),1) if (nw,nh)!=im.size else im,e['color']['value'])
def agrandir(mid,s=1.6,K=0.3,seed=1,sortables=True):
    random.seed(seed)
    md,saute=charge(mid); cd=md['cellsData']
    walk=[c for c,x in enumerate(cd) if x['mov'] and not x.get('nonWalkableDuringFight')]
    def pc(c): r,k=divmod(c,COLS); return OX+W/2+k*W+(r%2)*W/2, OY+H/2+r*H/2
    P=np.array([pc(c) for c in walk]); cx,cy=P.mean(0)
    # forme du sol : distance « elliptique » max des cases marchables, par direction
    def rayon(x,y): return math.hypot(x-cx,(y-cy)*2)
    R=np.percentile([rayon(*p) for p in P],92)
    BOXs=(-1300*s/1.6-200,-1000*s/1.6-100,1300*s/1.6+200,800*s/1.6+100)
    Wc,Hc=int((BOXs[2]-BOXs[0])*K),int((BOXs[3]-BOXs[1])*K)
    bc=md['backgroundColor']['value']
    can=Image.new('RGBA',(Wc,Hc),((bc>>16)&255,(bc>>8)&255,bc&255,255))
    def poser(im,x,y):
        im2=im.resize((max(1,round(im.width*K)),max(1,round(im.height*K))),1)
        can.alpha_composite(im2,(round((x-BOXs[0])*K-im2.width/2),round((y-BOXs[1])*K-im2.height/2))) if 0<=round((x-BOXs[0])*K-im2.width/2) and round((x-BOXs[0])*K+im2.width/2)<=Wc and 0<=round((y-BOXs[1])*K-im2.height/2) and round((y-BOXs[1])*K+im2.height/2)<=Hc else can.paste(im2,(round((x-BOXs[0])*K-im2.width/2),round((y-BOXs[1])*K-im2.height/2)),im2)
    def bouge(x,y,f): return cx+(x-cx)*f, cy+(y-cy)*f
    sol,murs=[],[]
    for e in md['backgroundElements']:
        if saute('backgroundMaterialData',e): continue
        x,y=e['transform']['m31'],-e['transform']['m32']
        im=img(e)
        if im is None: continue
        if im.width>1000 or im.height>800: continue
        (sol if rayon(x,y)<R*0.95 and im.width*im.height<450*450 else murs).append((e,im,x,y))
    # sol : chaque élément recopié aux places agrandies (s² copies, petites secousses)
    # remplissage : sur une grille serrée de la zone agrandie, l'élément de sol le plus proche de la place d'origine
    src=np.array([(x,y) for _,_,x,y in sol])
    for passe in range(2):
        pas=(110,55) if passe==0 else (70,35)
        for gy in np.arange(cy-R*s/2-60,cy+R*s/2+60,pas[1]):
            for gx in np.arange(cx-R*s-80,cx+R*s+80,pas[0]):
                X=gx+random.uniform(-pas[0]/2,pas[0]/2); Y=gy+random.uniform(-pas[1]/2,pas[1]/2)
                if rayon(X,Y)>R*s*1.0: continue
                ox,oy=bouge(X,Y,1/s)
                d=np.hypot(src[:,0]-ox,(src[:,1]-oy)*2); j=int(np.argsort(d)[random.randint(0,2)])
                if d[j]>220: continue
                e,im,x,y=sol[j]
                if passe==1 and im.width*im.height>150*150: continue
                poser(im,X,Y)
    for e,im,x,y in sol:
        X,Y=bouge(x,y,s); poser(im,X,Y)
    for e,im,x,y in murs:
        X,Y=bouge(x,y,s); poser(im,X,Y)
    if sortables:
        L=[]
        for e in md['sortableElements']:
            if saute('sortableMaterialData',e): continue
            x,y=e['transform']['m31'],-e['transform']['m32']; im=img(e)
            if im is None or im.width>1000 or im.height>800: continue
            f=s if rayon(x,y)>R*0.6 else s
            X,Y=bouge(x,y,f); L.append((Y+im.height/2,im,X,Y))
        for _,im,X,Y in sorted(L,key=lambda t:t[0]): poser(im,X,Y)
    return can
if __name__=='__main__':
    mid=int(sys.argv[1]); s=float(sys.argv[2])
    agrandir(mid,s).convert('RGB').save(f'out2/dil_{mid}_{s}.webp',quality=85)
