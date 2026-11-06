"""Cut the studio's text-feature fonts out of Noto Sans SC Regular.

The kernel draws sketch text from TrueType outlines (replicad → opentype.js),
so it needs real .ttf files, small enough to fetch on demand:

- text-latin.ttf: ASCII, Latin-1 and the symbols drawings use (± × ° ≤ ①…).
  Fetched for text with no Chinese in it.
- text-sc.ttf: the same, plus CJK punctuation and every GB2312 hanzi (6763).
  Fetched only when a text has Chinese.

Both come from one font, so the same characters get the same outlines.

    python3 -m pip install fonttools
    npm pack @expo-google-fonts/noto-sans-sc@0.4.4 && tar xzf expo-google-fonts-noto-sans-sc-0.4.4.tgz
    python3 scripts/build-fonts.py package/400Regular/NotoSansSC_400Regular.ttf

Licence: SIL OFL 1.1, copied next to the fonts (src/studio/fonts/OFL.txt).
"""

import os
import sys

from fontTools import subset

OUT = os.path.join(os.path.dirname(__file__), "..", "src", "studio", "fonts")

SYMBOLS = "±×÷°·–—‘’“”…•≤≥≈≠√πΩµΦφ™©®→←↑↓" + "".join(chr(c) for c in range(0x2460, 0x2474))


def latin() -> str:
    return "".join(chr(c) for c in range(0x20, 0x7F)) + "".join(chr(c) for c in range(0xA0, 0x100)) + SYMBOLS


def gb2312() -> str:
    out = []
    for hi in range(0xB0, 0xF8):
        for lo in range(0xA1, 0xFF):
            try:
                out.append(bytes([hi, lo]).decode("gb2312"))
            except UnicodeDecodeError:
                pass
    return "".join(out)


def cjk_punctuation() -> str:
    return "".join(chr(c) for c in range(0x3000, 0x3040)) + "".join(chr(c) for c in range(0xFF01, 0xFF5F))


def cut(src: str, text: str, name: str) -> None:
    opts = subset.Options()
    opts.layout_features = ["kern"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    opts.hinting = False
    opts.desubroutinize = True
    font = subset.load_font(src, opts)
    sub = subset.Subsetter(opts)
    sub.populate(text=text)
    sub.subset(font)
    path = os.path.join(OUT, name)
    subset.save_font(font, path, opts)
    print(f"{name}: {len(set(text))} chars, {os.path.getsize(path) / 1024:.0f} KB")


if __name__ == "__main__":
    src = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    cut(src, latin(), "text-latin.ttf")
    cut(src, latin() + cjk_punctuation() + gb2312(), "text-sc.ttf")
