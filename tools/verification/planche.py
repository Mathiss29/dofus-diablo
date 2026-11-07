# planche.py <dossier des photos de tournee.cjs> <monde> : planches de 16 cartes (rangées par sous-zone), dans <dossier>/planches.
import glob, os, json, sys
from PIL import Image, ImageDraw
src, monde = sys.argv[1:3]
M = json.load(open(os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'assets', 'mondes', monde, 'monde.json')))
sub = {m['tag']: m['sub'] for m in M['maps']}
fs = sorted(glob.glob(f'{src}/*.jpg'), key=lambda f: (sub.get(os.path.basename(f)[:-4], 0), f))
out = f'{src}/planches'; os.makedirs(out, exist_ok=True)
for k in range(0, len(fs), 16):
    S = Image.new('RGB', (1920, 1080))
    for i, f in enumerate(fs[k:k + 16]):
        im = Image.open(f).crop((0, 0, 1280, 600)).resize((480, 225)); d = ImageDraw.Draw(im); t = os.path.basename(f)[:-4]
        d.rectangle((0, 0, 110, 14), fill=(0, 0, 0)); d.text((3, 2), f'{t} ({sub.get(t)})', fill=(255, 255, 0))
        S.paste(im, ((i % 4) * 480, (i // 4) * 270))
    S.save(f'{out}/planche_{k // 16:02d}.jpg', quality=85)
print(len(fs), 'cartes,', (len(fs) + 15) // 16, 'planches dans', out)
