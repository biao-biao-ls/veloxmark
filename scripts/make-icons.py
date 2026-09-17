"""Export app icons from logo-master.png (full-bleed RGBA artwork).

logo-master.png is the design master: white rounded-tile artwork with the
pen mark, filling the canvas edge to edge. (An earlier pipeline derived alpha
from a blue-on-black new-logo.jpg; that source is gone and the shipped
artwork is this master, so the exporter reads the PNG directly.)

Platform grids differ, so one padded master cannot serve both:
- macOS sizes Dock icons by the bitmap itself and Apple's grid places artwork
  at 824/1024 (~80.5%) of the canvas — full-bleed icons render visibly larger
  than system icons.
- Windows scales the whole .ico into a fixed taskbar slot — transparent
  margins shrink the glyph relative to neighbouring apps.

So .icns and build/logo.png (dev Dock/About, see electron/main.ts) get the
Apple grid, while .ico, build/icon.png, size exports and web bits stay
full-bleed. Commit 5787fa3 padded everything to the Apple grid; that fixed
the Dock but made the Windows taskbar icon look small.
"""

from PIL import Image
import os
import shutil
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'logo-master.png')
OUT_DIR = os.path.join(ROOT, 'build')

master_full = Image.open(SRC).convert('RGBA')

# Normalise: content must fill a square canvas (full-bleed). Cheap insurance
# if the master is ever replaced by a non-tight export.
bbox = master_full.split()[-1].point(lambda v: 255 if v > 8 else 0).getbbox()
x0, y0, x1, y1 = bbox
side = max(x1 - x0, y1 - y0)
if master_full.size != (side, side) or (x0, y0, x1, y1) != (0, 0, side, side):
    cx, cy = x0 + (x1 - x0) // 2, y0 + (y1 - y0) // 2
    crop_box = (cx - side // 2, cy - side // 2,
                cx - side // 2 + side, cy - side // 2 + side)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    src_box = (max(0, crop_box[0]), max(0, crop_box[1]),
               min(master_full.width, crop_box[2]), min(master_full.height, crop_box[3]))
    canvas.paste(master_full.crop(src_box),
                 (src_box[0] - crop_box[0], src_box[1] - crop_box[1]))
    master_full = canvas

os.makedirs(OUT_DIR, exist_ok=True)

# --- Windows / web: full-bleed ---------------------------------------------
sizes = [16, 24, 32, 48, 64, 128, 256, 512]
imgs = [master_full.resize((s, s), Image.LANCZOS) for s in sizes]

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

# --- macOS: Apple 824/1024 grid --------------------------------------------
# build/logo.png is this grid master; dev-mode Dock and About panel point at
# it (electron/main.ts), not at the full-bleed icon.png.
ICON = 1024
CANVAS_CONTENT = 824
scaled = master_full.resize((CANVAS_CONTENT, CANVAS_CONTENT), Image.LANCZOS)
master_mac = Image.new('RGBA', (ICON, ICON), (0, 0, 0, 0))
master_mac.paste(scaled, ((ICON - CANVAS_CONTENT) // 2,) * 2)
master_mac.save(os.path.join(OUT_DIR, 'logo.png'))

# iconutil wants an .iconset of the power-of-two sizes incl. @2x.
# Skipped off-macOS (e.g. on the Windows packaging box) — build/icon.icns is
# committed, so packaging still finds it.
if shutil.which('iconutil'):
    iconset = os.path.join(OUT_DIR, 'icon.iconset')
    if os.path.isdir(iconset):
        shutil.rmtree(iconset)
    os.makedirs(iconset)
    for s in (16, 32, 128, 256, 512):
        master_mac.resize((s, s), Image.LANCZOS).save(
            os.path.join(iconset, f'icon_{s}x{s}.png'))
        master_mac.resize((s * 2, s * 2), Image.LANCZOS).save(
            os.path.join(iconset, f'icon_{s}x{s}@2x.png'))
    tmp_icns = os.path.join(OUT_DIR, 'icon.tmp.icns')  # iconutil requires .icns ext
    subprocess.check_call(
        ['iconutil', '-c', 'icns', iconset, '-o', tmp_icns])
    os.replace(tmp_icns, os.path.join(OUT_DIR, 'icon.icns'))
    shutil.rmtree(iconset)
else:
    print('iconutil not found; skipped build/icon.icns (run on macOS)')

print('master_full:', master_full.size, '| mac grid:', CANVAS_CONTENT, '/', ICON)
print('written:', sorted(os.listdir(OUT_DIR)))
