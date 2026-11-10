# rend une salle officielle (sans lumières additives) -> PIL image à l'échelle K
import json
from PIL import Image
SKIP={62942,63044,305396,404317,57871,57971,806080,305477,60327,36648,39767,42481,44653,805552,402668,806081}
_t={}
def tex(g):
    if g not in _t:
        try: _t[g]=Image.open(f'tex/{g}.png').convert('RGBA')
        except Exception: _t[g]=None
    return _t[g]
def teinte(im,c):
    r,gg,b,a=(c>>16)&255,(c>>8)&255,c&255,(c>>24)&255
    if (r,gg,b,a) in ((128,128,128,255),(255,255,255,255)): return im
    ch=im.split(); f=[r/128,gg/128,b/128]
    ch=[q.point(lambda v,k=k:min(255,int(v*k))) for q,k in zip(ch[:3],f)]+[ch[3].point(lambda v:v*a//255)]
    return Image.merge('RGBA',ch)
def rendre(mid,K=0.35,box=(-1250,-1000,1250,800),fond=True,avant=True,triables=True,liste=None,garder=None,garder_pos=None):
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
    W=int((box[2]-box[0])*K); H=int((box[3]-box[1])*K)
    bc=md['backgroundColor']['value']
    can=Image.new('RGBA',(W,H),((bc>>16)&255,(bc>>8)&255,bc&255,255 if fond else 0))
    els=[('backgroundMaterialData',e) for e in md['backgroundElements']]+([('sortableMaterialData',e) for e in sorted(md['sortableElements'],key=lambda e:(e['cellId'],e['innerCellRenderOrder']))] if triables or liste is not None else [])+([('foregroundMaterialData',e) for e in md['foregroundElements']] if avant else [])
    for mk,e in els:
        if saute(mk,e): continue
        im=tex(e['gfxId'])
        if im is None: continue
        tr=e['transform']; sx,sy=tr['m11'],tr['m22']
        if sx<0: im=im.transpose(0)
        if sy<0: im=im.transpose(1)
        nw,nh=max(1,round(im.width*abs(sx)*K)),max(1,round(im.height*abs(sy)*K))
        im=teinte(im.resize((nw,nh),1),e['color']['value'])
        x=round((tr['m31']-box[0])*K-nw/2); y=round((-tr['m32']-box[1])*K-nh/2)
        if garder is not None and mk=='sortableMaterialData' and not garder(e['cellId']): continue
        if garder_pos is not None and mk!='sortableMaterialData' and nw*nh>(200*K)**2 and not garder_pos(tr['m31'],-tr['m32']+im.height*abs(sy)/2-20): continue
        if liste is not None and mk=='sortableMaterialData' and nw*nh<=(260*K)**2:
            liste.append((e['cellId'],e['innerCellRenderOrder'],im,tr['m31'],-tr['m32'])); continue
        can.paste(im,(x,y),im) if True else None
    return can
