import random,math
from cour_auto import A,pieces,poser,a_plat,haut,rendu
P=pieces('32')
a=A.Arene(32)
NUAGES=[46,86,89,91,92]
for i in range(30):
    ang=random.uniform(0,2*math.pi); r=random.uniform(0.9,1.4)
    a.bg(900009,1200*r*math.cos(ang),720*r*math.sin(ang)+200,random.choice([1,-1]),-6)
for i in range(12):
    t=random.uniform(0.15,math.pi-0.15); a_plat(a,P[random.choice(NUAGES)],1250*math.cos(t),760*math.sin(t)+420,random.random()<.5,lvl=-4)
herbe=A.ell(1080,610)
a.sol(herbe,[900,899,700836],0,edge=0.04)
a.semis(herbe,[20500,20498,20504,20497],40,lvl=1,lo=0.0,hi=0.95)
a.semis(lambda x,y:herbe(x,y) if y<0 else 9,[20504,20497,20500],40,lvl=1,lo=0.86,hi=1.03)
# falaises officielles tout autour (devant et côtés)
FAL=[19,29,43,65,66,118]
for k in range(-2,23):
    t=math.pi*k/20; x=1060*math.cos(t); y=600*math.sin(t)
    if y<-40: continue
    p=P[random.choice(FAL)]; a_plat(a,p,x,y+haut(p)-70,random.random()<.5,lvl=1.5)
# escaliers de pierre : là où arrivent les monstres des côtés
pass
# fond : le nid à l'œuf derrière le boss, trois pitons et deux arbres d'automne, rien d'autre
poser(a,P[71],0,-500)
for n,x,y,f in [(1,-430,-470,False),(1,430,-470,True),(39,-900,-260,False),(52,900,-270,True)]:
    poser(a,P[n],x,y,f)
# obstacles du milieu : rochers seuls
for i,(x,y) in enumerate(A.ABRIS): a.one(20648,x,y,1 if i%2 else -1,bloque=90)
rendu(a,'32_cour',(132,176,214),bord=(110,150,190),points=dict(arrivee=(0,330),entrees=[(-780,80),(780,80),(0,470)],boss=(0,-420),sortie=(0,-330),coffre=(170,-300)))
