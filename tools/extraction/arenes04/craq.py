import random,math
from cour_auto import A,pieces,poser,a_plat,haut,rendu
P=pieces('18')
a=A.Arene(18)
NU=[138,141,180,184,205,222,223,119]
for i in range(30):
    ang=random.uniform(0,2*math.pi); r=random.uniform(0.9,1.4)
    a.bg(900009,1200*r*math.cos(ang),720*r*math.sin(ang)+200,random.choice([1,-1]),-6)
for i in range(14):
    t=random.uniform(-0.1,math.pi+0.1); a_plat(a,P[random.choice(NU)],1250*math.cos(t),760*math.sin(t)+380,random.random()<.5,lvl=-4)
herbe=A.ell(1080,610)
a.sol(herbe,[900,899,700836],0,edge=0.06)
# sentiers de terre (dalles de terre officielles, case par case) : des trois entrées vers la brèche du boss, + un cercle au centre
TER=[38903,38904,38905,700053,12]
cases=set()
def trait(x0,y0,x1,y1,larg):
    n=int(math.hypot(x1-x0,y1-y0)/30)+1
    for t in range(n+1):
        x=x0+(x1-x0)*t/n+math.sin(t*0.35)*40; y=y0+(y1-y0)*t/n
        r=round(y/21.5)
        for rr in range(r-larg,r+larg+1):
            k=round((x-(rr%2)*43)/86)
            for kk in range(k-larg//2-1,k+larg//2+2):
                cx,cy=kk*86+(rr%2)*43,rr*21.5
                if abs(cx-x)/86+abs(cy-y)/43<=larg*0.55+random.uniform(0,0.4): cases.add((kk,rr))
for (ex,ey) in A.ENT: trait(ex*0.9,ey*0.9,0,-470,2)
for (kk,rr) in cases:
    cx,cy=kk*86+(rr%2)*43,rr*21.5
    if herbe(cx,cy)<=0.97: a.bg(random.choice(TER),cx,cy,random.choice([1,-1]),1)
a.semis(herbe,[20498,20500,20501,20499,20504,20497,7590,7585,17053,20458],80,lvl=2,lo=0.0,hi=0.97)
# fond : terrasses de falaise (mur du fond) avec une brèche vers le boss
HAUT=[27,29,30,31,51,52,54,55,74,124,155]
for k in range(1,20):
    t=-math.pi*k/20; x=1080*math.cos(t); y=610*math.sin(t)
    if abs(x)<260: continue
    a.put(P[random.choice(HAUT)],x,y+40,random.random()<.5)
# pitons rocheux derrière les terrasses (les Craqueleurs vivent là)
for n,x,y,f in [(139,-560,-880,False),(181,560,-880,True),(1,-980,-760,False),(40,980,-760,True),(105,-260,-960,False),(216,260,-960,True),(175,-1300,-420,False),(218,1300,-420,True)]:
    a_plat(a,P[n],x,y,f,lvl=-1)
BAS=[25,26,28,58,66,123,178,186,188,190,230]
for k in range(-2,23):
    t=math.pi*k/20; x=1060*math.cos(t); y=600*math.sin(t)
    if y<-60: continue
    p=P[random.choice(BAS)]; a_plat(a,p,x,y+haut(p)-70,random.random()<.5,lvl=1.5)
pass
for x,y,n in [(0,-450,163),(-140,-510,164),(140,-510,165)]: a_plat(a,P[n],x,y,lvl=1.3)
for n,x,y,f in [(78,-1180,-60,False),(100,1180,-60,True),(46,-900,-430,False),(12,900,-430,True),(237,-700,600,False),(237,700,600,True)]:
    poser(a,P[n],x,y,f)
for i,(x,y) in enumerate(A.ABRIS): poser(a,P[[267,73,73,267][i]],x,y,i%2==1,bloque=90)
for i in range(10):
    ang=random.uniform(0,2*math.pi); r=random.uniform(0.35,0.85); x,y=1000*r*math.cos(ang),560*r*math.sin(ang)
    if min(math.hypot(x-bx,(y-by)*2) for bx,by in A.ABRIS+[(0,-470),(0,330)])>230: poser(a,P[random.choice([61,84,99,168,169,48,72,79,107])],x,y,random.random()<.5)
rendu(a,'18_cour',(132,176,214),bord=(110,150,190),points=dict(arrivee=(0,330),entrees=[(-780,80),(780,80),(0,470)],boss=(0,-420),sortie=(0,-330),coffre=(170,-300)))
