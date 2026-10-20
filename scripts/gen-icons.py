#!/usr/bin/env python3
"""Regenerate all app icon assets from the pen-glyph artwork.

Why this exists: the original icons baked a drop shadow into the bitmap and
shrank the white plate, so the Dock/Finder icon looked "one ring smaller"
than standard macOS icons (the system draws its own shadow; icon artwork must
be a clean squircle on the 1024/824 grid — plate = 824x824 centered in a
1024x1024 canvas, matching TextEdit/Typora).

Outputs:
  build/icon.icns                     macOS app + file-association icon
  build/logo.png                      dev dock/About icon (same 824 grid)
  build/icon.png  icon-*.png          window icon / Linux icon (full-bleed)
  build/icon.ico                      Windows icon (full-bleed)
  src/renderer/src/assets/logo.png    in-app MenuBar logo (full-bleed)
  src/renderer/public/favicon.png     favicon (full-bleed)

Requires: Pillow (pip install pillow). Run: python3 scripts/gen-icons.py
"""

import math
import os
import shutil
import subprocess

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GLYPH_SOURCE = os.path.join(ROOT, 'build', 'logo.png')

# Squircle superellipse exponent fitted to real macOS icons (Typora/TextEdit):
# |x/a|^n + |y/a|^n = 1 with n = 5.2 reproduces their corner profile.
SUPERELLIPSE_N = 5.2

# macOS icon grid: white plate is 824/1024 of the canvas (100px margin per
# side at 1024) — system draws the drop shadow in that margin.
MAC_PLATE_RATIO = 824 / 1024

# Glyph width relative to plate width, from the original artwork.
GLYPH_RATIO = 0.731

PLATE_COLOR = (255, 255, 255)


def extract_glyph() -> Image.Image:
    """Extract the black pen glyph as RGBA (black with coverage alpha).

    Composites the source over white first so a re-run on an already-clean
    logo.png (transparent outside the plate) extracts identically.
    """
    src = Image.open(GLYPH_SOURCE).convert('RGBA')
    flat = Image.new('RGBA', src.size, (255, 255, 255, 255))
    flat.alpha_composite(src)
    gray = flat.convert('L')
    w, h = gray.size
    px = gray.load()
    gx0, gy0, gx1, gy1 = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            if px[x, y] < 100:
                gx0, gy0 = min(gx0, x), min(gy0, y)
                gx1, gy1 = max(gx1, x), max(gy1, y)
    if gx1 < 0:
        raise SystemExit('no glyph found in %s' % GLYPH_SOURCE)
    crop = gray.crop((gx0, gy0, gx1 + 1, gy1 + 1))
    # black-on-white -> black with coverage alpha
    alpha = crop.point(lambda v: 255 - v)
    glyph = Image.new('RGBA', crop.size, (0, 0, 0, 255))
    glyph.putalpha(alpha)
    return glyph


def squircle_mask(size: int, ss: int = 4) -> Image.Image:
    """Antialiased superellipse mask (L mode) for a plate of `size` px."""
    big = size * ss
    mask = Image.new('L', (big, big), 0)
    draw = ImageDraw.Draw(mask)
    a = big / 2.0
    n = SUPERELLIPSE_N
    e = 2.0 / n
    pts = []
    steps = 2048
    for i in range(steps):
        t = 2 * math.pi * i / steps
        c, s = math.cos(t), math.sin(t)
        x = math.copysign(abs(c) ** e, c) * a
        y = math.copysign(abs(s) ** e, s) * a
        pts.append((a + x, a + y))
    draw.polygon(pts, fill=255)
    return mask.resize((size, size), Image.LANCZOS)


def render_master(canvas: int, glyph: Image.Image, mac_grid: bool = False) -> Image.Image:
    """White squircle plate + centered glyph on a transparent canvas.

    mac_grid=True reserves the system-shadow margin (824 plate on 1024
    canvas); otherwise the plate is full-bleed for Windows/Linux/favicon.
    """
    plate = int(round(canvas * MAC_PLATE_RATIO)) if mac_grid else canvas

    img = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
    mask = squircle_mask(plate)
    plate_img = Image.new('RGBA', (plate, plate), PLATE_COLOR + (255,))
    plate_img.putalpha(mask)
    off = (canvas - plate) // 2
    img.alpha_composite(plate_img, (off, off))

    gw = int(round(plate * GLYPH_RATIO))
    gh = max(1, int(round(gw * glyph.size[1] / glyph.size[0])))
    g = glyph.resize((gw, gh), Image.LANCZOS)
    img.alpha_composite(g, ((canvas - gw) // 2, (canvas - gh) // 2))
    return img


def build_icns(master: Image.Image) -> None:
    iconset = os.path.join(ROOT, 'build', 'icon.iconset')
    if os.path.isdir(iconset):
        shutil.rmtree(iconset)
    os.makedirs(iconset)
    mapping = [
        (16, 'icon_16x16.png'),
        (32, 'icon_16x16@2x.png'),
        (32, 'icon_32x32.png'),
        (64, 'icon_32x32@2x.png'),
        (128, 'icon_128x128.png'),
        (256, 'icon_128x128@2x.png'),
        (256, 'icon_256x256.png'),
        (512, 'icon_256x256@2x.png'),
        (512, 'icon_512x512.png'),
        (1024, 'icon_512x512@2x.png'),
    ]
    for size, name in mapping:
        master.resize((size, size), Image.LANCZOS).save(os.path.join(iconset, name))
    out = os.path.join(ROOT, 'build', 'icon.icns')
    subprocess.run(['iconutil', '-c', 'icns', iconset, '-o', out], check=True)
    shutil.rmtree(iconset)
    print('wrote', out)


def build_ico(full: Image.Image) -> None:
    path = os.path.join(ROOT, 'build', 'icon.ico')
    sizes = [16, 24, 32, 48, 64, 128, 256]
    imgs = [full.resize((s, s), Image.LANCZOS) for s in sizes]
    imgs[-1].save(path, format='ICO', sizes=[(s, s) for s in sizes], append_images=imgs[:-1])
    print('wrote', path)


def main() -> None:
    glyph = extract_glyph()
    print(f'glyph: {glyph.size[0]}x{glyph.size[1]}')

    mac_master = render_master(1024, glyph, mac_grid=True)  # 824 plate + shadow margin
    full_master = render_master(512, glyph)                 # plate fills the canvas

    build_icns(mac_master)

    build_logo = os.path.join(ROOT, 'build', 'logo.png')
    mac_master.save(build_logo)
    print('wrote', build_logo)

    # window/Linux icons: full-bleed (no shadow margin on those platforms)
    icon_png = os.path.join(ROOT, 'build', 'icon.png')
    full_master.save(icon_png)
    print('wrote', icon_png)
    for s in (32, 64, 128, 256):
        p = os.path.join(ROOT, 'build', f'icon-{s}.png')
        full_master.resize((s, s), Image.LANCZOS).save(p)
        print('wrote', p)

    build_ico(full_master)

    assets_logo = os.path.join(ROOT, 'src', 'renderer', 'src', 'assets', 'logo.png')
    full_master.resize((256, 256), Image.LANCZOS).save(assets_logo)
    print('wrote', assets_logo)

    favicon = os.path.join(ROOT, 'src', 'renderer', 'public', 'favicon.png')
    full_master.resize((32, 32), Image.LANCZOS).save(favicon)
    print('wrote', favicon)


if __name__ == '__main__':
    main()
