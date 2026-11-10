#!/usr/bin/env python3
"""Turnery's mark: a geometric lowercase "t" pulled into depth, the way a sketch
becomes a solid. Builds the glyph with build123d (exact circles and lines), then
the region the face sweeps when it is extruded up and to the right, and writes
both as SVG paths:

  resources/logo/turnery-mark.svg   the mark: `depth` (accent) under `front`
  app/src/components/turnery-mark-paths.ts   the same paths for the inline mark
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
TOP = 110.0  # the stem's flat top, above the bar
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
    return (foot + run + stem + bar).clean()


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


if __name__ == "__main__":
    main()
