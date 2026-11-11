#!/usr/bin/env python3
"""Turnery's mark: a geometric lowercase "t", its top cut at a slant, pulled into depth, the way a sketch
becomes a solid. Builds the glyph with build123d (exact circles and lines), then
the region the face sweeps when it is extruded up and to the right, and writes
both as SVG paths:

  resources/logo/turnery-mark.svg       the mark: `depth` (accent) under `front`
  resources/logo/turnery-wordmark.svg   the name, every letter drawn and pulled the same way
  app/src/components/turnery-mark-paths.ts   the same paths for the inline mark and name
                                           in the site and the desktop window

  ../.venv/bin/python -I resources/logo/make-logo.py      (from desktop/)
"""
import json
import math
import sys
from pathlib import Path

from build123d import Circle, Face, Location, Plane, Polyline, Rectangle, Vector, make_face

OUT = Path(__file__).resolve().parent

S = 20.0  # stroke
STEM_X = 32.0  # left edge of the stem
TOP = 110.0  # the stem's top, above the bar
CUT = 14.0  # how far the slanted cut drops across the stem
BAR = (10.0, 86.0, 66.0)  # crossbar: x from, x to, bottom y
FOOT_C, FOOT_RO = (62.0, 30.0), 30.0  # the foot curls round this centre and runs out flat
FOOT_END = 82.0  # where the flat run ends
DEPTH = (11.0, 8.0)  # the extrusion as seen on paper: up and to the right
STEP = 0.4  # sampling of the outline for the swept faces


def rect(x0, y0, x1, y1) -> Face:
    return Rectangle(x1 - x0, y1 - y0).face().moved(Location(((x0 + x1) / 2, (y0 + y1) / 2, 0)))


def disc(c, r) -> Face:
    return Circle(r).face().moved(Location((c[0], c[1], 0)))


def glyph() -> Face:
    cx, cy = FOOT_C
    ring = disc(FOOT_C, FOOT_RO) - disc(FOOT_C, FOOT_RO - S)
    foot = ring & rect(cx - FOOT_RO - 1, -1, cx, cy)  # the lower-left quarter turn
    run = rect(cx, 0, FOOT_END, S)
    stem = rect(STEM_X, cy, STEM_X + S, TOP)
    bar = rect(BAR[0], BAR[2], BAR[1], BAR[2] + S)
    # One cut across the top of the stem, the way a turning tool leaves it.
    cut = make_face(Polyline(*[Vector(x, y, 0) for x, y in [(STEM_X - 12, TOP + 2), (STEM_X + S + 8, TOP + 2), (STEM_X + S + 8, TOP - CUT), (STEM_X - 12, TOP + 2)]]))
    return ((foot + run + stem + bar) - cut).clean()


# The name: the same stroke and the same geometry as the t (circles, straight runs, ends cut square).
X_HEIGHT = BAR[2] + S  # the crossbar's top
GAP = 18.0  # between letters
DESCENT = 52.0  # how far the y drops below the line


def letter_u(x0, descender=False) -> Face:
    """A bowl and two stems; the right stem runs on below the line and curls back for a y."""
    w = 72.0
    r = w / 2
    c = (x0 + r, r)
    bowl = (disc(c, r) - disc(c, r - S)) & rect(x0 - 1, -1, x0 + w + 1, r)
    left = rect(x0, r, x0 + S, X_HEIGHT)
    if not descender:
        return (bowl + left + rect(x0 + w - S, 0, x0 + w, X_HEIGHT)).clean(), w
    # The tail: down the right stem, round a quarter turn and out flat to the left (the t's foot, turned over).
    tc, tr = (x0 + w - 30.0, -DESCENT + 30.0), 30.0
    tail = (disc(tc, tr) - disc(tc, tr - S)) & rect(tc[0], -DESCENT - 1, tc[0] + tr + 1, tc[1])
    stem = rect(x0 + w - S, tc[1], x0 + w, X_HEIGHT)
    run = rect(x0 + 4, -DESCENT, tc[0], -DESCENT + S)
    return (bowl + left + stem + tail + run).clean(), w


def letter_n(x0) -> Face:
    """A stem and an arch coming down into a second stem."""
    w = 72.0
    r = w / 2
    c = (x0 + r, X_HEIGHT - r)
    arch = (disc(c, r) - disc(c, r - S)) & rect(x0 - 1, c[1], x0 + w + 1, X_HEIGHT + 1)
    return (arch + rect(x0, 0, x0 + S, X_HEIGHT) + rect(x0 + w - S, 0, x0 + w, c[1])).clean(), w


def letter_r(x0) -> Face:
    """A stem and a shoulder: a quarter turn out to the right, cut square."""
    r = 32.0
    c = (x0 + r, X_HEIGHT - r)
    shoulder = (disc(c, r) - disc(c, r - S)) & rect(x0 - 1, c[1], c[0], X_HEIGHT + 1)
    run = rect(c[0], X_HEIGHT - S, c[0] + 14.0, X_HEIGHT)
    return (shoulder + run + rect(x0, 0, x0 + S, X_HEIGHT)).clean(), r + 14.0


def letter_e(x0) -> Face:
    """A ring with a bar through its middle, opened below the bar on the right."""
    r = X_HEIGHT / 2
    c = (x0 + r, r)
    ring = disc(c, r) - disc(c, r - S)
    low = c[1] - S / 2 + 2  # the bar's underside
    bar = rect(x0 + S / 2, low, x0 + 2 * r, low + S)
    # The opening: from the bar's underside down to a cut at 48° below it.
    a1, far = math.radians(-48), 2 * r
    cut = make_face(Polyline(*[Vector(*p, 0) for p in [(c[0], low), (c[0] + far, low), (c[0] + far * math.cos(a1), low + far * math.sin(a1)), (c[0], low)]]))
    return ((ring - cut) + bar).clean(), 2 * r


def name_faces() -> list[Face]:
    """「turnery」 letter by letter, left to right, sharing the t's baseline."""
    t = glyph()
    x = FOOT_END + GAP - BAR[0]
    faces = [t.moved(Location((-BAR[0], 0, 0)))]
    for make in [lambda x0: letter_u(x0), letter_r, letter_n, letter_e, letter_r, lambda x0: letter_u(x0, descender=True)]:
        f, w = make(x)
        faces.append(f)
        x += w + GAP
    return faces


def outline(face) -> list[list[tuple[float, float]]]:
    """Every wire of the face as a closed list of points, curves sampled finely."""
    loops = []
    for wire in face.wires():
        pts: list[tuple[float, float]] = []
        for edge in wire.order_edges():
            n = max(2, math.ceil(edge.length / STEP) + 1)
            seg = [edge.position_at(i / (n - 1)) for i in range(n)]
            pts += [(p.X, p.Y) for p in (seg if not pts else seg[1:])]
        loops.append(pts)
    return loops


def swept(face) -> Face:
    """The face plus everything it passes through when moved by DEPTH."""
    dx, dy = DEPTH
    parts = [face, face.moved(Location((dx, dy, 0)))]
    seen = set()
    for loop in outline(face):
        for (x0, y0), (x1, y1) in zip(loop, loop[1:] + loop[:1]):
            key = tuple(sorted([(round(x0, 3), round(y0, 3)), (round(x1, 3), round(y1, 3))]))
            # Skip repeats and edges along the sweep (they sweep no area).
            if key in seen or abs((x1 - x0) * dy - (y1 - y0) * dx) < 1e-6:
                continue
            seen.add(key)
            quad = [(x0, y0), (x1, y1), (x1 + dx, y1 + dy), (x0 + dx, y0 + dy), (x0, y0)]
            parts.append(make_face(Polyline(*[Vector(x, y, 0) for x, y in quad])))
    out = parts[0]
    batch = 64
    for i in range(1, len(parts), batch):
        out = out.fuse(*parts[i : i + batch]).clean()
    # Everything is one connected region; anything left over is a sliver the fuse
    # didn't merge, lying inside the main face.
    faces = sorted(out.faces(), key=lambda f: -f.area)
    if len(faces) > 1:
        print(f"warning: {len(faces) - 1} faces left over, largest {faces[1].area:.3f}", file=sys.stderr)
    return faces[0]


def simplify(loop, eps=0.015):
    """Douglas–Peucker on the closed loop: keeps the outline within eps of the sampled one."""

    def dp(pts):
        a, b = pts[0], pts[-1]
        ln = math.hypot(b[0] - a[0], b[1] - a[1]) or 1e-9
        far, at = 0.0, 0
        for i in range(1, len(pts) - 1):
            p = pts[i]
            d = abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) / ln
            if d > far:
                far, at = d, i
        if far <= eps:
            return [a, b]
        return dp(pts[: at + 1])[:-1] + dp(pts[at:])

    # Split at the point farthest from the first, so both halves are open runs.
    start = loop[0]
    k = max(range(len(loop)), key=lambda i: math.hypot(loop[i][0] - start[0], loop[i][1] - start[1]))
    return dp(loop[: k + 1])[:-1] + dp(loop[k:] + [start])[:-1]


def path(face, box) -> str:
    """SVG path data, y flipped so the glyph stands up, numbers to 0.01."""
    x0, y1 = box[0], box[3]
    parts = []
    faces = face.faces() if hasattr(face, "faces") else [face]
    for f in faces:
        for loop in outline(f):
            pts = simplify(loop)
            d = "M" + " L".join(f"{round(x - x0, 2):g} {round(y1 - y, 2):g}" for x, y in pts) + "Z"
            parts.append(d)
    return "".join(parts)


def main():
    front = glyph()
    depth = swept(front)
    bb = depth.bounding_box()
    pad = 6.0
    w, h = bb.size.X, bb.size.Y
    side = max(w, h) + 2 * pad
    # Square view box with the mark centred; the paths are written in its coordinates.
    box = (bb.min.X - (side - w) / 2, bb.min.Y - (side - h) / 2, 0, bb.max.Y + (side - h) / 2)
    d_depth, d_front = path(depth, box), path(front, box)
    view = f"0 0 {round(side, 2):g} {round(side, 2):g}"
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}">\n'
        f'  <path id="depth" fill="#2759E0" fill-rule="evenodd" d="{d_depth}"/>\n'
        f'  <path id="front" fill="#141414" fill-rule="evenodd" d="{d_front}"/>\n'
        "</svg>\n"
    )
    (OUT / "turnery-mark.svg").write_text(svg)
    ts = OUT.parents[2] / "app/src/components/turnery-mark-paths.ts"
    ts.write_text(
        "// Generated by desktop/resources/logo/make-logo.py — don't edit by hand.\n"
        f"export const MARK_VIEWBOX = {json.dumps(view)}\n"
        f"export const MARK_DEPTH = {json.dumps(d_depth)}\n"
        f"export const MARK_FRONT = {json.dumps(d_front)}\n"
    )
    favicon = OUT.parents[2] / "app/public/favicon.svg"
    favicon.write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}">'
        "<style>.f{fill:#141414}@media (prefers-color-scheme:dark){.f{fill:#ECECEC}}</style>"
        f'<path fill="#2759E0" d="{d_depth}"/><path class="f" d="{d_front}"/></svg>\n'
    )
    print(f"view box {view}; depth {len(d_depth)} chars, front {len(d_front)} chars", file=sys.stderr)

    # The name: each letter pulled on its own, so no letter's depth runs into the next.
    letters = name_faces()
    depths = [swept(f) for f in letters]
    lo = [min(d.bounding_box().min.X for d in depths), min(d.bounding_box().min.Y for d in depths)]
    hi = [max(d.bounding_box().max.X for d in depths), max(d.bounding_box().max.Y for d in depths)]
    p = 2.0
    wbox = (lo[0] - p, lo[1] - p, 0, hi[1] + p)
    w_depth = "".join(path(d, wbox) for d in depths)
    w_front = "".join(path(f, wbox) for f in letters)
    wview = f"0 0 {round(hi[0] - lo[0] + 2 * p, 2):g} {round(hi[1] - lo[1] + 2 * p, 2):g}"
    # Where the x-height and the baseline fall, from the top: to line the name up with text beside it.
    base = round(hi[1] + p, 2)
    (OUT / "turnery-wordmark.svg").write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{wview}">\n'
        f'  <path id="depth" fill="#2759E0" fill-rule="evenodd" d="{w_depth}"/>\n'
        f'  <path id="front" fill="#141414" fill-rule="evenodd" d="{w_front}"/>\n'
        "</svg>\n"
    )
    with ts.open("a") as out:
        out.write(
            f"export const WORD_VIEWBOX = {json.dumps(wview)}\n"
            f"/** From the top of the view box: the baseline. */\n"
            f"export const WORD_BASELINE = {base:g}\n"
            f"export const WORD_DEPTH = {json.dumps(w_depth)}\n"
            f"export const WORD_FRONT = {json.dumps(w_front)}\n"
        )
    print(f"name: view box {wview}", file=sys.stderr)


if __name__ == "__main__":
    main()
