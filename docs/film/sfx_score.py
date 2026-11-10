#!/usr/bin/env python3
"""Sound for "every number lands": one room, five materials, fewer events than beats.
Run with the onetake venv:  python3 sfx_score.py  → sfx.wav. Times mirror T in comp.js."""
import os, sys
sys.path.insert(0, os.environ.get("ONETAKE_SCRIPTS") or os.path.expanduser("~/.claude/skills/onetake/scripts"))
from sfx_palette import Score, air, glass, wood, sub, bubble, wobble, pan_of
import numpy as np

rng = np.random.default_rng(11)
s = Score(dur=27.0, T60=1.0)
place = s.place

# 1 · the request: muted keys (about one in three), then a real click
for i in range(60):
    if rng.uniform() < 0.62: continue
    place(wood(165 + rng.uniform(-18, 18), 0.08), 0.72 + i / 27 + rng.uniform(0, 0.004), 0.085 * rng.uniform(0.7, 1.3), -0.05, 0.15)
place(wood(240, 0.08), 3.2, 0.30, pan_of(1380), 0.2); place(wood(190, 0.07), 3.26, 0.20, pan_of(1380), 0.2)
place(air(0.55, 1800, 320, 1.3), 3.45, 0.20, 0.0, 0.45)                          # the card rises to the top

# 2 · the tree grows: soft taps that climb, one felt landing for the lid
for i, t in enumerate((4.5, 5.05, 5.6, 6.15, 7.45, 8.0)):
    place(wood(150 + i * 14, 0.07), t, 0.12, pan_of(300), 0.25)
place(air(0.4, 240, 1500, 1.2, 0.5), 5.05, 0.20, 0.0, 0.5)                       # the body is pulled up
place(air(0.3, 1500, 300, 1.3), 6.8, 0.16, 0.0, 0.4); place(sub(64, 0.5), 7.16, 0.36, 0.0, 0.3); place(wood(120, 0.1), 7.16, 0.22, 0.0, 0.3)

# 3 · the numbers land on the part: three glass touches, then they go to be measured
for t, f, x in ((9.3, 523, 950), (9.57, 659, 800), (9.84, 784, 1300)):
    place(glass(f, 0.7, 0.6), t, 0.15, pan_of(x), 0.45)
place(air(0.42, 500, 2600, 1.4, 0.4), 10.36, 0.20, 0.0, 0.45, pan_to=0.5)
place(bubble(520, 0.22), 11.1, 0.28, pan_of(1500), 0.3)
place(air(0.6, 200, 1700, 1.1, 0.5), 11.2, 0.26, 0.0, 0.55)                      # the lid lifts
place(glass(587, 0.7, 0.6), 12.3, 0.14, pan_of(1250), 0.45); place(glass(880, 0.7, 0.6), 12.65, 0.14, pan_of(1350), 0.45)
place(bubble(560, 0.22), 13.76, 0.28, pan_of(1500), 0.3); place(bubble(610, 0.22), 14.41, 0.28, pan_of(1500), 0.3)
place(glass(1046, 1.4, 0.45), 14.48, 0.13, 0.25, 0.65); place(glass(1568, 1.4, 0.35), 14.5, 0.09, 0.35, 0.65)   # 3/3

# 4 · point at it: a click on the face, the note typed, it goes to the tree, the cut opens, resolved
place(wood(240, 0.08), 15.95, 0.26, 0.1, 0.2); place(bubble(470, 0.2), 15.97, 0.22, 0.1, 0.3)
for i in range(16):
    if rng.uniform() < 0.5: continue
    place(wood(170 + rng.uniform(-16, 16), 0.08), 16.3 + i / 17, 0.075 * rng.uniform(0.7, 1.3), 0.12, 0.15)
place(air(0.5, 600, 2400, 1.3, 0.4), 17.25, 0.20, 0.1, 0.45, pan_to=-0.5)
place(wood(262, 0.07), 17.75, 0.14, pan_of(300), 0.25); place(air(0.35, 1400, 320, 1.3), 17.85, 0.18, 0.1, 0.4)
place(glass(988, 1.1, 0.5), 18.3, 0.15, 0.1, 0.6)

# 5 · change one: grab, the wall thickens, the check objects; back again, it agrees
D = 4.0
place(wood(220, 0.07), 16.0 + D, 0.24, pan_of(250), 0.2)
place(air(0.9, 300, 1300, 1.2, 0.6), 16.12 + D, 0.22, -0.45, 0.4, pan_to=-0.25)
place(sub(52, 0.9), 16.3 + D, 0.44, 0.2, 0.35); place(wobble(118, 0.55), 16.3 + D, 0.30, pan_of(1500), 0.35)
place(air(0.75, 1300, 300, 1.2, 0.6), 18.05 + D, 0.20, -0.25, 0.4, pan_to=-0.45)
place(glass(784, 1.2, 0.5), 18.74 + D, 0.16, 0.3, 0.6); place(glass(1175, 1.2, 0.4), 18.76 + D, 0.11, 0.35, 0.6)
place(wood(190, 0.07), 18.95 + D, 0.16, pan_of(250), 0.2)

# 6 · the lid closes, the name drops in
place(air(0.8, 1600, 220, 1.1, 0.5), 19.6 + D, 0.26, 0.2, 0.55, pan_to=-0.2)
place(sub(60, 0.6), 20.38 + D, 0.30, -0.2, 0.35)
place(sub(48, 1.3), 20.62 + D, 0.42, 0.0, 0.45); place(glass(392, 1.8, 0.3), 20.66 + D, 0.10, 0.2, 0.7)

s.write(os.path.join(os.path.dirname(os.path.abspath(__file__)), "sfx.wav"))
