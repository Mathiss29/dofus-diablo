import json, glob, sys, os
from anim_parse import parse
out=sys.argv[1]
# SKIP_MASKS=1 : ne dessine pas les noeuds marqués 0x40 (masques, ex. grand rectangle rouge de la Colère de Iop 8036)
MASKS=os.environ.get('SKIP_MASKS')=='1'
mbs={f:json.load(open(f)) for f in glob.glob(out+'/mb_*.json')}
m=[v for v in mbs.values() if 'animations' in v][0]
skin=mbs[out+'/mb_%d.json'%m['boneAsset']['m_PathID']]
V=skin['vertices']; T=skin['triangles']
meshes=[]
for g in m['graphics']:
    ch=g['part']['skinChunks'][0]
    sv=ch['startVertexIndex']; vc=ch['vertexCount']
    verts=[[V[sv+i]['pos']['x'],V[sv+i]['pos']['y'],V[sv+i]['uv']['x'],V[sv+i]['uv']['y']] for i in range(vc)]
    tris=T[ch['startIndexIndex']:ch['startIndexIndex']+ch['indexCount']]
    meshes.append({'name':g['part']['name'],'v':verts,'t':tris})
anims={}; shots={}
for f in sorted(glob.glob(out+'/ta_*.bin')):
    name=os.path.basename(f)[3:-4].split('_',1)[1]
    raw=open(f,'rb').read()
    try: a=parse(raw)
    except Exception as ex: print('skip',name,ex); continue
    i=raw.find(b'SHOT')
    if 0<i<len(a['header']): shots[name]=int.from_bytes(raw[i-3:i-1],'little')
    state={}; frames=[]
    for fr in a['frames']:
        for r in fr:
            s=state.setdefault(r['idx'],{'sym':-1,'m':[1,0,0,0,1,0],'alpha':127,'mul':[127,127,127,127],'add':[0,0,0,0]})
            if 'sym' in r: s['sym']=r['sym']; s['par']=r['par']; s['mask']=bool(r['fl']&0x40) and MASKS
            if r['fl']&2: s['alpha']=r['alpha']
            if 'mul' in r: s['mul']=list(r['mul'])
            if 'add' in r: s['add']=list(r['add'])
            if 'm' in r: s['m']=list(r['m'])
        draws=[]
        for idx in sorted(state):
            s=state[idx]
            if 0<=s['sym']<len(meshes) and not s.get('mask'): draws.append([s['sym'],s['m'],s['alpha'],s['mul'],s['add'],idx])
        frames.append(draws)
    anims[name]=frames
json.dump({'meshes':meshes,'anims':anims,'shots':shots},open(out+'/scene.json','w'))
print({k:len(v) for k,v in anims.items()}); print('SHOT',shots)
