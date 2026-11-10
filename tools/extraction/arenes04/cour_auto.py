# Arène « façon Astrub » (cour ronde de tools/extraction/arenes.py) avec les pièces des vraies salles d'un donjon.
import sys,os,json,math,random
os.environ.setdefault('TEXDIR','tex')
sys.argv=[sys.argv[0],'cartes','','']+sys.argv[1:]
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))   # tools/extraction/arenes.py
import arenes as A
from groupes import groupes, SOL
from salle import teinte
def pieces(k):
    D=json.load(open('djs.json')); cads=json.load(open(f'grp_{k}.json')); P={}
    allg={}
    for m in D[k]['maps']: allg[m]=groupes(m)
    for i,(m,cad) in enumerate(cads):
        els=next(e for c,e in allg[m] if [round(v,3) for v in c]==[round(v,3) for v in cad])
        out=[]
        for e in els:
            t=e['transform']; fx,fy=A.centre_case(e.get('cellId',0)) if 'cellId' in e and not e.get('fond') else (t['m31'],-t['m32']+20)
            out.append(dict(g=e['gfxId'],x=t['m31'],y=-t['m32'],sx=t['m11'],sy=t['m22'],c=e['color']['value'],fx=fx,fy=fy,o=e.get('innerCellRenderOrder',0),fond=e.get('fond',0)))
        def bord(p):
            im=A.gfx(p['g']); w,h=im.width*abs(p['sx']),im.height*abs(p['sy']); return p['x']-w/2,p['y']-h/2,p['x']+w/2,p['y']+h/2
        bx=[bord(p) for p in out]; ax=(min(b[0] for b in bx)+max(b[2] for b in bx))/2; ay=max(b[3] for b in bx)
        so=[p for p in out if not p['fond']]
        dz=ay-16-max(p['fy'] for p in so) if so else 0
        for p in out:
            p['x']-=ax; p['y']-=ay; p['fx']-=ax; p['fy']+=(dz-ay) if not p['fond'] else -ay
        P[i]=out
    return P
def poser(a,p,x,y,flip=False,bloque=0):
    so=[q for q in p if not q['fond']]
    for q in p:
        if q['fond']: a.bg(q['g'],x+(-q['x'] if flip else q['x']),y+q['y'],(-q['sx'] if flip else q['sx']),lvl=2,c=q['c'])
    if so: a.put(so,x,y,flip,bloque)
def tapis(a,x0,y0,n,sens=1,lvl=3):
    """bande de tapis rouge officielle (39117-39123) qui descend en diagonale ; sens=1 vers la gauche, -1 vers la droite"""
    for t in range(n):
        ux=x0-sens*42.67*t; uy=y0+21.5*t
        a.bg(random.choice([39120,39121,39122]),ux,uy,sens,lvl)
        a.bg(random.choice([39117,39118,39119]),ux+sens*56,uy+34,sens,lvl)
        if t%2==0: a.bg(39123,ux-sens*18,uy+41,sens,lvl+1)
def a_plat(a,p,x,y,flip=False,lvl=1):
    """pose toute la pièce comme du fond (sous les persos) : bords d'île, falaises"""
    for q in p: a.bg(q['g'],x+(-q['x'] if flip else q['x']),y+q['y'],(-q['sx'] if flip else q['sx']),lvl=lvl+q['y']/1e5,c=q['c'])
def haut(p):
    ys=[]
    for q in p:
        im=A.gfx(q['g']); ys.append(q['y']-im.height*abs(q['sy'])/2)
    return -min(ys)
def rendu(a,nom,fond,ciel=None,K=0.3,bord=(12,12,16),points=None):
    import numpy as np
    from PIL import Image,ImageDraw
    im=A.rendre(a.els,A.BOX,fond)
    im=im.resize((int(im.width*K),int(im.height*K)),Image.LANCZOS)
    W,H=im.size; yy,xx=np.mgrid[0:H,0:W]; x=(xx/K+A.BOX[0]); y=(yy/K+A.BOX[1]); v=(x/1450)**2+(y/850)**2
    f=np.clip((v-0.85)/0.4,0,1)[...,None]; arr=np.asarray(im.convert('RGB')).astype(float)
    im=Image.fromarray((arr*(1-f)+np.array(bord)*f).astype('uint8'))
    im.save(f'out2/{nom}.webp',quality=86)
    d=ImageDraw.Draw(im,'RGBA')
    for k,v in (points or A.POINTS).items():
        for (px,py) in (v if k=='entrees' else [v]): X=(px-A.BOX[0])*K;Y=(py-A.BOX[1])*K; d.ellipse([X-10,Y-5,X+10,Y+5],outline=(255,60,60),width=3)
    im.save(f'out2/{nom}_chemin.webp',quality=86); print(nom,im.size)
