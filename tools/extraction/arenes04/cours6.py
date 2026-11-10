import random,math,sys,os
from cour_auto import A,pieces,poser,a_plat,rendu
def cour(k,seed,dedans,dehors,anneau,fond_l,abris,devant,semis=(),pas_in=(86,43),pas_out=(86,43),fond=(20,16,12),n_anneau=12,teinte_out=None,teinte_in=None,sombre=45,eclaircir=False):
    os.environ['SOMBRE']=str(sombre)
    P=pieces(k); a=A.Arene(seed)
    terre=A.ell(1380,800); dalle=A.ell(1120,640)
    a.sol(terre,dehors,0,edge=0.1,pas=pas_out)
    if teinte_out:
        for e in a.els: e['c']=teinte_out
    n0=len(a.els); a.sol(dalle,dedans,1,edge=0.1,pas=pas_in)
    if teinte_in:
        for e in a.els[n0:]: e['c']=teinte_in
    if semis: a.semis(dalle,list(semis),26,lvl=2,lo=0.2,hi=0.97)
    a.anneau([P[i] for i in anneau],1030,590,n_anneau,A.ENT+[(0,-590)],ecart=300)
    for n,x,y,f in fond_l: poser(a,P[n],x,y,f)
    for i,(x,y) in enumerate(A.ABRIS): poser(a,P[abris[i%len(abris)]],x,y,i%2==1,bloque=90)
    for n,x,y,f in devant: poser(a,P[n],x,y,f)
    if eclaircir:
        for e in a.els:
            c=e.get('c',0xFFFFFFFF); r,g,b=(c>>16)&255,(c>>8)&255,c&255
            if max(r,g,b)<110: e['c']=0xFFB0A090
    rendu(a,f'{k}_cour',fond)
D=sys.argv[-1]
if D=='48': cour('48',48,[15367],[700053,12],[13,13,13],
    [(17,0,-720,False),(1,-470,-660,False),(4,470,-660,True),(14,-860,-520,False),(19,860,-520,True),(23,-1180,-220,False),(22,1180,-220,True)],
    [3,15,15,3],[(2,-800,660,False),(22,800,660,True),(8,-1140,440,False),(21,1140,440,True),(10,-450,830,False),(9,450,830,True)],fond=(40,28,14),teinte_out=0xFF6A5A40)
if D=='138': cour('138',138,[39271,39279,39275,39272,39273],[39271,39279,39275],[1,1,1],
    [(3,0,-700,False),(0,-470,-660,False),(2,470,-660,True),(6,-860,-520,False),(0,860,-520,True),(3,-1180,-220,False),(3,1180,-220,True)],
    [7,3,7,3],[(5,-800,660,False),(4,800,660,True),(7,-1140,440,False),(7,1140,440,True),(5,-450,830,False),(4,450,830,True)],fond=(22,14,10),teinte_out=0xFF5A4A3A,sombre=12)
if D=='13': cour('13',13,[39270,39271,39272,39273,39274,39275,39276,39277,39278,39279],[39270,39271,39272,39273,39274],[10,49,50,54,56],
    [(51,0,-700,False),(35,-520,-660,False),(40,520,-660,True),(47,-900,-500,False),(26,900,-500,True),(29,-1180,-220,False),(14,1180,-220,True)],
    [49,10,10,49],[(13,-800,660,False),(53,800,660,True),(16,-1140,440,False),(48,1140,440,True),(2,-450,830,False),(31,450,830,True)],fond=(30,18,10),teinte_out=0xFF6A5040)
if D=='21': cour('21',21,[19887,19888,19889,19890,19891,19892],[19887,19888,19889,19890,19891,19892],[7,13,10,22],
    [(19,0,-700,False),(0,-520,-660,False),(26,520,-660,True),(31,-900,-500,False),(28,900,-500,True),(11,-1180,-220,False),(12,1180,-220,True)],
    [7,13,13,7],[(6,-800,660,False),(9,800,660,True),(18,-1140,440,False),(35,1140,440,True),(23,-450,830,False),(14,450,830,True)],fond=(16,16,14),teinte_out=0xFF606060)
if D=='33': cour('33',33,[19887,19888,19889,19890,19891,19892],[19887,19888,19889,19890,19891,19892],[1,13,19,25,8],
    [(21,0,-720,False),(4,-520,-660,False),(27,520,-660,True),(14,-900,-500,False),(22,900,-500,True),(20,-1180,-220,False),(5,1180,-220,True)],
    [1,13,13,1],[(16,-800,660,False),(28,800,660,True),(17,-1140,440,False),(2,1140,440,True),(7,-450,830,False),(26,450,830,True)],semis=[32050,22521,22523],fond=(14,18,10),teinte_out=0xFF5A6050)
if D=='17': cour('17',17,[39270,39271,39272,39273,39274,39275,39276,39277,39278,39279],[39270,39271,39272,39273,39274],[0,2,5,13,17,19,31],
    [(26,0,-560,False),(27,-200,-640,False),(24,-560,-660,False),(32,560,-660,True),(7,-900,-500,False),(22,900,-500,True),(15,-1180,-220,False),(12,1180,-220,True)],
    [4,9,18,4],[(16,-800,660,False),(25,800,660,True),(28,-1140,440,False),(29,1140,440,True),(30,-450,830,False),(11,450,830,True)],fond=(30,16,8),teinte_out=0xFF6A5040)
