#!/usr/bin/env python3
"""Put the brand on the link-preview image (public/og.png): the Turnery mark and
name at the top left, the site's address at the bottom left. The headline and
the mug stay as they are. Idempotent: it paints over the same two places.

  python3 -I scripts/make-og.py        (from app/; needs Pillow and rsvg-convert)
"""
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

APP = Path(__file__).resolve().parent.parent
OG = APP / "public/og.png"
MARK = APP.parent / "desktop/resources/logo/turnery-mark.svg"
HOST = "arbor.linjiejim.com"

BG = (18, 18, 18)
TILE = (26, 26, 26)
TEXT = (236, 236, 236)
ACCENT = (126, 166, 255)  # the dark theme's primary, as the site shows it in dark mode
SANS = "/System/Library/Fonts/SFNS.ttf"
MONO = "/System/Library/Fonts/SFNSMono.ttf"


def mark(size: int) -> Image.Image:
    svg = MARK.read_text().replace("#141414", "#ECECEC").replace("#2759E0", "#7EA6FF")
    with tempfile.TemporaryDirectory() as tmp:
        src, out = Path(tmp) / "m.svg", Path(tmp) / "m.png"
        src.write_text(svg)
        subprocess.run(["rsvg-convert", "-w", str(size * 4), "-h", str(size * 4), str(src), "-o", str(out)], check=True)
        return Image.open(out).convert("RGBA").resize((size, size), Image.LANCZOS)


def tile(size: int, radius: int) -> Image.Image:
    scale = 4
    big = Image.new("RGBA", (size * scale, size * scale), (0, 0, 0, 0))
    ImageDraw.Draw(big).rounded_rectangle([0, 0, size * scale - 1, size * scale - 1], radius=radius * scale, fill=TILE)
    return big.resize((size, size), Image.LANCZOS)


def main():
    im = Image.open(OG).convert("RGB")
    d = ImageDraw.Draw(im)
    # Old brand row and address: paint them out.
    d.rectangle([66, 110, 340, 170], fill=BG)
    d.rectangle([66, 484, 470, 518], fill=BG)

    t = tile(44, 10)
    t.alpha_composite(mark(36), (4, 4))
    im.paste(t, (72, 118), t)

    sans = ImageFont.truetype(SANS, 32)
    try:
        sans.set_variation_by_name("Semibold")
    except Exception:
        pass
    d.text((132, 140), "Turnery", font=sans, fill=TEXT, anchor="lm")

    mono = ImageFont.truetype(MONO, 22)
    d.text((73, 507), HOST, font=mono, fill=ACCENT, anchor="ls")
    im.save(OG, optimize=True)
    print(f"{OG}: brand and {HOST} redrawn")


if __name__ == "__main__":
    main()
