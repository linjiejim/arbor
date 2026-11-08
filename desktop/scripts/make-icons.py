#!/usr/bin/env python3
"""App icons from the mark (resources/logo/arbor-mark.svg, made by make-logo.py):
the mark on a light rounded tile, placed on Apple's icon grid (an 824 px tile on
a 1024 px transparent canvas, with a soft shadow). Writes:
  resources/icon.png     1024 px, for electron-builder and the window
  resources/icon.icns    macOS app icon
  resources/icon-64.png  small icon for docs

  python3 -I scripts/make-icons.py      (needs Pillow and rsvg-convert)
"""
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
MARK = ROOT / "resources/logo/arbor-mark.svg"
OUT = ROOT / "resources"

CANVAS = 1024
TILE = 824
RADIUS = 185  # Apple's ~22.5 %
MARK_SIZE = 580  # the mark's view box has its own margin


def rounded_mask(size, radius, scale=4):
    w, h = size
    big = Image.new("L", (w * scale, h * scale), 0)
    ImageDraw.Draw(big).rounded_rectangle([0, 0, w * scale - 1, h * scale - 1], radius=radius * scale, fill=255)
    return big.resize(size, Image.LANCZOS)


def render_mark(size: int) -> Image.Image:
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "mark.png"
        subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size), str(MARK), "-o", str(out)], check=True)
        return Image.open(out).convert("RGBA")


def tile() -> Image.Image:
    # A quiet vertical gradient, white to a cool light grey, with a hairline edge.
    t = Image.new("RGBA", (TILE, TILE))
    top, bottom = (255, 255, 255), (236, 238, 242)
    px = t.load()
    for y in range(TILE):
        k = y / (TILE - 1)
        c = tuple(round(a + (b - a) * k) for a, b in zip(top, bottom)) + (255,)
        for x in range(TILE):
            px[x, y] = c
    edge = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
    ImageDraw.Draw(edge).rounded_rectangle([1, 1, TILE - 2, TILE - 2], radius=RADIUS - 1, outline=(0, 0, 0, 22), width=2)
    t.alpha_composite(edge)
    m = render_mark(MARK_SIZE)
    t.alpha_composite(m, ((TILE - MARK_SIZE) // 2, (TILE - MARK_SIZE) // 2))
    t.putalpha(rounded_mask((TILE, TILE), RADIUS))
    return t


def main():
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    off = (CANVAS - TILE) // 2
    shadow = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    shadow_mask = Image.new("L", (CANVAS, CANVAS), 0)
    shadow_mask.paste(rounded_mask((TILE, TILE), RADIUS), (off, off + 10))
    shadow.putalpha(shadow_mask.point(lambda v: int(v * 0.28)).filter(ImageFilter.GaussianBlur(14)))
    canvas = Image.alpha_composite(canvas, shadow)
    canvas.alpha_composite(tile(), (off, off))

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
    print(f"{OUT}/icon.png, icon.icns, icon-64.png")


if __name__ == "__main__":
    main()
