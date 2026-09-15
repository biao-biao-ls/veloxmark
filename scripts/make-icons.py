"""Build transparent app icons from new-logo.jpg (flat blue logo on pure black).

JPEG has no alpha, but a logo flattened onto pure black stores alpha exactly:
observed = alpha * logo_color. So alpha = luminance(observed) / luminance(logo)
and the recovered color is the constant brand blue — edges come out with clean
sub-pixel anti-aliasing straight from the source, no morphology needed.
"""

from PIL import Image, ImageFilter
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'new-logo.jpg')
OUT_DIR = os.path.join(ROOT, 'build')

LOGO_BLUE = (33, 72, 113)
LUM_LOGO = 0.299 * LOGO_BLUE[0] + 0.587 * LOGO_BLUE[1] + 0.114 * LOGO_BLUE[2]

src = Image.open(SRC).convert('RGB')
w, h = src.size
sp = src.load()

# alpha = luma / luma(logo); JPEG noise on the black field peaks at luma ~5.3
# (8% of the logo's 65), so clamp the soft ramp: fully transparent below 9%,
# fully opaque above 98%.
a_lo, a_hi = 0.09, 0.98
alpha = Image.new('L', (w, h))
ap = alpha.load()
for y in range(h):
    for x in range(w):
        pr, pg, pb = sp[x, y]
        a = (0.299 * pr + 0.587 * pg + 0.114 * pb) / LUM_LOGO
        if a <= a_lo:
            a = 0.0
        elif a >= a_hi:
            a = 1.0
        else:  # rescale (a_lo, a_hi) -> (0, 1) so the edge ramp stays intact
            a = (a - a_lo) / (a_hi - a_lo)
        ap[x, y] = int(round(a * 255))

# JPEG chroma-subsampling throws a few colored specks whose luma slips past the
# floor; a 3x3 opening erases them (thinnest stroke is ~15px, so erosion-safe).
alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))

rgba = Image.merge('RGBA', (
    Image.new('L', (w, h), LOGO_BLUE[0]),
    Image.new('L', (w, h), LOGO_BLUE[1]),
    Image.new('L', (w, h), LOGO_BLUE[2]),
    alpha,
))

# Crop to the silhouette, then pad generously (icon safe area).
bbox = alpha.point(lambda v: 255 if v > 8 else 0).getbbox()
pad_ratio = 0.12
x0, y0, x1, y1 = bbox
bw, bh = x1 - x0, y1 - y0
long_side = max(bw, bh)
pad = int(round(long_side * pad_ratio))
canvas_side = long_side + 2 * pad
cx = x0 + bw // 2
cy = y0 + bh // 2
crop_box = (cx - canvas_side // 2, cy - canvas_side // 2,
            cx - canvas_side // 2 + canvas_side, cy - canvas_side // 2 + canvas_side)

master = Image.new('RGBA', (canvas_side, canvas_side), (0, 0, 0, 0))
src_box = (max(0, crop_box[0]), max(0, crop_box[1]),
           min(w, crop_box[2]), min(h, crop_box[3]))
master.paste(rgba.crop(src_box), (src_box[0] - crop_box[0], src_box[1] - crop_box[1]))

os.makedirs(OUT_DIR, exist_ok=True)
ICON = 1024
master.resize((ICON, ICON), Image.LANCZOS).save(os.path.join(OUT_DIR, 'logo.png'))

sizes = [16, 24, 32, 48, 64, 128, 256, 512]
imgs = [master.resize((s, s), Image.LANCZOS) for s in sizes]
# Windows can hold a lock on icon.ico; replace via a temp file.
tmp_ico = os.path.join(OUT_DIR, 'icon.ico.tmp')
imgs[-1].save(tmp_ico, format='ICO', sizes=[(s, s) for s in sizes])
os.replace(tmp_ico, os.path.join(OUT_DIR, 'icon.ico'))
imgs[-1].save(os.path.join(OUT_DIR, 'icon.png'))
for s in (256, 128, 64, 32):
    imgs[sizes.index(s)].save(os.path.join(OUT_DIR, f'icon-{s}.png'))

# Refresh renderer favicon copies.
pub = os.path.join(ROOT, 'src', 'renderer', 'public')
imgs[sizes.index(32)].save(os.path.join(pub, 'favicon.png'))
imgs[sizes.index(256)].save(os.path.join(pub, 'icon.png'))

print('bbox:', bbox, '-> canvas', canvas_side)
print('written:', sorted(os.listdir(OUT_DIR)))
