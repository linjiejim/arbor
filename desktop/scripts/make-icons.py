#!/usr/bin/env python3
"""Turn the generated logo (a full-bleed rounded tile on white) into app icons.

Finds the tile, cuts it out with a rounded-rect mask, places it on Apple's
icon grid (an 824 px tile on a 1024 px transparent canvas, with a soft shadow),
and writes:
  resources/icon.png     1024 px, for electron-builder and the window
  resources/icon.icns    macOS app icon
  resources/icon-64.png  small mark for docs

  python3 -I scripts/make-icons.py [resources/logo/arbor-icon-a.png]
"""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "resources/logo/arbor-icon-a.png"
OUT = ROOT / "resources"

CANVAS = 1024
TILE = 824


def is_page(p):
    return all(abs(c - 254) <= 6 for c in p[:3])


def tile_box(im: Image.Image):
    """Bounding box of everything that isn't the white page around the tile."""
    bg = Image.new("RGB", im.size, (254, 254, 254))
    diff = ImageChops.difference(im.convert("RGB"), bg).convert("L").point(lambda v: 255 if v > 6 else 0)
    return diff.getbbox()


def corner_radius(im: Image.Image, box):
    """The tile's own corner radius: where the diagonal from its corner first leaves the page."""
    x0, y0 = box[0], box[1]
    for t in range(0, min(box[2] - x0, box[3] - y0) // 2):
        if not is_page(im.getpixel((x0 + t, y0 + t))):
            return t / (1 - 2**-0.5)
    return 0


def rounded_mask(size, radius, scale=4):
    w, h = size
    big = Image.new("L", (w * scale, h * scale), 0)
    ImageDraw.Draw(big).rounded_rectangle([0, 0, w * scale - 1, h * scale - 1], radius=radius * scale, fill=255)
    return big.resize(size, Image.LANCZOS)


def main():
    im = Image.open(SRC).convert("RGBA")
    box = tile_box(im)
    # Keep the tile's own roundness (the model draws it rounder than Apple's 22.5%), so no page shows in the corners.
    radius = corner_radius(im, box) * TILE / (box[2] - box[0]) + 4
    tile = im.crop(box)
    inset = max(2, round(tile.width * 0.004))
    tile = tile.crop((inset, inset, tile.width - inset, tile.height - inset)).resize((TILE, TILE), Image.LANCZOS)
    RADIUS = round(radius)
    tile.putalpha(rounded_mask((TILE, TILE), RADIUS))

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    off = (CANVAS - TILE) // 2
    shadow = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    shadow_mask = Image.new("L", (CANVAS, CANVAS), 0)
    shadow_mask.paste(rounded_mask((TILE, TILE), RADIUS), (off, off + 10))
    shadow.putalpha(shadow_mask.point(lambda v: int(v * 0.28)).filter(ImageFilter.GaussianBlur(14)))
    canvas = Image.alpha_composite(canvas, shadow)
    canvas.alpha_composite(tile, (off, off))

    OUT.mkdir(exist_ok=True)
    canvas.save(OUT / "icon.png")
    canvas.resize((64, 64), Image.LANCZOS).save(OUT / "icon-64.png")

    if shutil.which("iconutil"):
        with tempfile.TemporaryDirectory() as tmp:
            iconset = Path(tmp) / "icon.iconset"
            iconset.mkdir()
            for s in (16, 32, 128, 256, 512):
                canvas.resize((s, s), Image.LANCZOS).save(iconset / f"icon_{s}x{s}.png")
                canvas.resize((s * 2, s * 2), Image.LANCZOS).save(iconset / f"icon_{s}x{s}@2x.png")
            subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o", str(OUT / "icon.icns")], check=True)
    print(f"tile {box} → {OUT}/icon.png, icon.icns, icon-64.png")


if __name__ == "__main__":
    main()
