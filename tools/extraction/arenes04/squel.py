import random,math
from cour_auto import A,pieces,poser,a_plat,rendu
P=pieces('47')
a=A.Arene(47); terre=A.ell(1380,800); dalle=A.ell(1120,640)
a.sol(terre,[30,700053,12],0,edge=0.1)
for e in a.els: e['c']=0xFF6A6450
a.sol(dalle,[700202,700227,700205,10636,1542,700203],1,edge=0.1)
a.semis(dalle,[34453,34456,34455,34457,34454],24,lvl=2,lo=0.2,hi=0.95)
# anneau : colonnes des ruines, entrées libres
a.anneau([P[6],P[13],P[27],P[31],P[46],P[54]],1030,590,12,A.ENT+[(0,-590)],ecart=300)
# fond : grande arche derrière le boss, arches et autel aux bougies
poser(a,P[50],0,-720); poser(a,P[28],-470,-660); poser(a,P[28],470,-660,True)
poser(a,P[2],-860,-520); poser(a,P[4],860,-520,True); poser(a,P[18],-1180,-220); poser(a,P[30],1180,-220,True)
poser(a,P[39],-230,-560); poser(a,P[39],230,-560,True)
for i,(x,y) in enumerate(A.ABRIS): poser(a,P[[13,27,27,13][i]],x,y,i%2==1,bloque=90)
# coins de devant : tombes et gravats
for n,x,y,f in [(9,-800,660,False),(25,800,660,True),(29,-1140,440,False),(42,1140,440,True),(51,-450,830,False),(44,450,830,True),(1,-1250,120,False),(53,1250,120,True)]:
    poser(a,P[n],x,y,f)
for i in range(10):
    t=random.uniform(0,2*math.pi); r=random.uniform(0.88,0.98); poser(a,P[random.choice([3,23,35,52,8,32])],1120*r*math.cos(t),640*r*math.sin(t),random.random()<.5)
rendu(a,'47_cour',(24,22,14))
