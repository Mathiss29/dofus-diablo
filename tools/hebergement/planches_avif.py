# Convertit les planches de public/assets/sprites de WebP en AVIF (choix « AVIF : 1A » du 6 nov. 2026 : planches seulement, −37 %).
# Les JSON d'atlas sont mis à jour (pages de multi-atlas renommées avec l'empreinte du nouveau contenu).
# Usage : python3 tools/hebergement/planches_avif.py [qualité=50]   puis   node tools/hebergement/envoi.mjs
import glob, hashlib, io, json, os, re, sys
from concurrent.futures import ProcessPoolExecutor
from PIL import Image

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'assets', 'sprites')
Q = int(sys.argv[1]) if len(sys.argv) > 1 else 50

def avif(src):
    b = io.BytesIO(); Image.open(src).save(b, 'AVIF', quality=Q, speed=6); return b.getvalue()

def un_json(jp):
    j = json.load(open(jp)); gain = [0, 0]
    if 'textures' not in j and 'image' not in j.get('meta', {}): return os.path.basename(jp), gain   # pas un atlas
    pages = j['textures'] if 'textures' in j else [j['meta']]
    for P in pages:
        im = P['image']
        if not im.endswith('.webp'): continue
        src = os.path.join(D, im)
        if 'textures' not in j: src = os.path.join(D, os.path.basename(jp)[:-5] + '.webp')   # atlas simple : chargé sous <nom>.webp
        data = avif(src)
        if 'textures' in j:
            base = re.sub(r'(\.[0-9a-f]{8})?\.webp$', '', im)
            nouveau = f'{base}.{hashlib.md5(data).hexdigest()[:8]}.avif'
        else:
            nouveau = os.path.basename(jp)[:-5] + '.avif'
        open(os.path.join(D, nouveau), 'wb').write(data)
        gain[0] += os.path.getsize(src); gain[1] += len(data)
        os.remove(src); P['image'] = nouveau
    json.dump(j, open(jp, 'w'), separators=(',', ':'))
    return os.path.basename(jp), gain

if __name__ == '__main__':
    with ProcessPoolExecutor() as ex:
        tot = [0, 0]
        for n, g in ex.map(un_json, sorted(glob.glob(os.path.join(D, '*.json')))):
            tot[0] += g[0]; tot[1] += g[1]
            if g[0]: print(f'{n}: {g[0] // 1024} -> {g[1] // 1024} Ko', flush=True)
    print(f'Total : {tot[0] / 1e6:.1f} -> {tot[1] / 1e6:.1f} Mo')
    reste = glob.glob(os.path.join(D, '*.webp'))
    if reste: print('WebP sans JSON (non convertis) :', [os.path.basename(r) for r in reste])
