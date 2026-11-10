import random,math
from cour_auto import A,pieces,poser,tapis
from PIL import Image,ImageDraw
P=pieces('52')
a=A.Arene(52); plage=A.ell(1380,800); dalle=A.ell(1120,640)
TERRE=[39270,39271,39272,39273,39274,39275,39276,39277,39278,39279]
a.sol(plage,TERRE,0,edge=0.1)
a.sol(dalle,[14115,14116,14117,14118],1,edge=0.12)
a.semis(plage,[900,899,700836,7590,7592,7585],46,lvl=2,lo=0.85,hi=1.05)
a.semis(dalle,[34456,34455,34457,34454],14,lvl=2,lo=0.2,hi=0.9)
tapis(a,-10,-430,21,1); tapis(a,10,-430,21,-1)
a.estrade(0,-470,2,14116,14118)
# anneau : piliers drapés et socles, entrées libres
a.anneau([P[7],P[43],P[6],P[20],P[19],P[44]],1030,590,12,A.ENT+[(0,-590)],ecart=300)
# fond : statue dorée derrière l'estrade, murs à porte, arbres creux qui brillent, cheminée
poser(a,P[29],0,-690); poser(a,P[1],-430,-700); poser(a,P[1],430,-700,True)
poser(a,P[46],-860,-560); poser(a,P[35],860,-560,True); poser(a,P[39],-1180,-250); poser(a,P[39],1180,-250,True)
poser(a,P[0],-1250,120); poser(a,P[0],1250,120,True)
# abris du milieu : piliers
for i,(x,y) in enumerate(A.ABRIS): poser(a,P[[7,43,43,7][i]],x,y,i%2==1,bloque=90)
# devant : tables et carottes du château, touffes
poser(a,P[48],-760,700); poser(a,P[50],760,700,True); poser(a,P[47],-1100,480); poser(a,P[38],1100,480,True)
poser(a,P[49],-420,860); poser(a,P[12],420,860,True)
for g,x,y in [(16,-1300,-60),(21,1300,-60),(26,-640,-760),(51,640,-760),(23,-1350,560),(53,1350,560)]: poser(a,P[g],x,y,random.random()<.5)
fond=(34,22,14)
im=A.rendre(a.els,A.BOX,fond)
K=0.3; im=im.resize((int(im.width*K),int(im.height*K)),Image.LANCZOS)
# fondu du bord
import numpy as np
W,H=im.size; yy,xx=np.mgrid[0:H,0:W]; x=(xx/K+A.BOX[0]); y=(yy/K+A.BOX[1]); v=(x/1450)**2+(y/850)**2
f=np.clip((v-0.85)/0.4,0,1)[...,None]; arr=np.asarray(im.convert('RGB')).astype(float)
im=Image.fromarray((arr*(1-f)+np.array([12,12,16])*f).astype('uint8'))
im.save('out2/52_cour.webp',quality=86)
d=ImageDraw.Draw(im,'RGBA')
for k,v in A.POINTS.items():
    for (px,py) in (v if k=='entrees' else [v]): X=(px-A.BOX[0])*K;Y=(py-A.BOX[1])*K; d.ellipse([X-10,Y-5,X+10,Y+5],outline=(255,60,60),width=3)
im.save('out2/52_cour_points.webp',quality=86); print(im.size)
