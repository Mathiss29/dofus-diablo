import json, sys
from PIL import Image, ImageDraw
SP='/tmp/claude-0/-home-claude/e0761424-ba97-5935-8d8d-50763efc2308/scratchpad/map/'
W,H,ox,oy=[float(v) for v in sys.argv[1:5]]
x0,y0=-2090.8276793956757,-1639.7475817203522
t=json.load(open(SP+'m_189793284.json')); cells=t['mapData']['cellsData']
im=Image.open(SP+'test4.png').convert('RGBA'); ov=Image.new('RGBA',im.size); d=ImageDraw.Draw(ov)
for c in range(560):
    r,k=divmod(c,14); cx=ox+k*W+(r%2)*W/2+W/2; cy=oy+r*H/2+H/2
    X,Y=cx-x0,cy-y0
    pts=[(X-W/2,Y),(X,Y-H/2),(X+W/2,Y),(X,Y+H/2)]
    d.polygon(pts, fill=(255,0,0,110) if not cells[c]['mov'] else None, outline=(255,255,255,90))
im.alpha_composite(ov); bg=Image.new('RGBA',im.size,(40,40,40,255)); bg.alpha_composite(im)
bg.convert('RGB').resize((im.width//2,im.height//2)).crop((300,250,1750,1161)).save(SP+'grid.png')
