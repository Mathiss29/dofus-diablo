# contour.py planche.png [épaisseur px] [couleur hex] : ajoute le contour sombre que Dofus 3 dessine autour des personnages
# (les textures des squelettes n'ont pas de trait : c'est le jeu qui l'ajoute au rendu). Le contour est posé SOUS l'image :
# alpha du perso dilaté de `épaisseur` pixels, couleur sombre, puis le perso par-dessus. Réécrit l'image en place.
import sys
from PIL import Image, ImageFilter
Image.MAX_IMAGE_PIXELS = None
p = sys.argv[1]; r = int(sys.argv[2]) if len(sys.argv) > 2 else 2; col = sys.argv[3] if len(sys.argv) > 3 else '1a120c'
im = Image.open(p).convert('RGBA')
a = im.getchannel('A').point(lambda v: 255 if v > 40 else 0).filter(ImageFilter.MaxFilter(2 * r + 1))
a = a.filter(ImageFilter.GaussianBlur(0.6)).point(lambda v: v * 0.92)   # bord à peine adouci, comme le trait du jeu
c = tuple(int(col[i:i + 2], 16) for i in (0, 2, 4))
out = Image.new('RGBA', im.size, c + (0,)); out.putalpha(a)
out.alpha_composite(im); out.save(p)
