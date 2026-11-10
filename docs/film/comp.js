// Turnery · "every number lands" — one composition, every value a function of time.
// The numbers typed in the request are the subject: sentence → dimension on the part → a kernel-measured check.
(() => {
const { clamp, lerp, seg, sstep, spring, ring, ease } = OM;
const LANG = window.LANG === 'zh' ? 'zh' : 'en';
const C = LOOK.color, GOOD = '#2f8f43';
const DUR = 27, FPS = 30, W = 1920, H = 1080;

const STR = {
  en: {
    seg: ['Sensor enclosure: ', ' × ', ' × ', ' mm, ', ' mm walls, ', ' screws.'],
    file: 'enclosure.turnery.json',
    rows: [['sketch', 'outline'], ['extrude', 'body'], ['cut', 'cavity'], ['extrude', 'posts'], ['split', 'lid'], ['hole', 'M3 × 4'], ['pattern', 'vents'], ['cut', 'usb-c']],
    note: 'USB-C port here', noteHdr: 'note 1',
    param: 'wall', checks: 'checks', wall: 'wall ', mm: ' mm',
    m1: 'measured 80.00 × 50.00 × 28.00', m2: v => `measured ${v} mm`, m3: 'found 4 · Ø3.4',
    caps: ['One message.', 'A feature tree, not a mesh.', 'Every number you said, measured by the kernel.', 'Hard to say which face? Point at it.', 'Change one. It tells you.'],
    tag: ['Your agent builds.', 'The kernel checks.', 'You steer.'], url: 'github.com/linjiejim/turnery',
  },
  zh: {
    seg: ['传感器外壳：', ' × ', ' × ', '，壁厚 ', '，', ' 螺钉。'],
    file: 'enclosure.turnery.json',
    rows: [['sketch', '外形'], ['extrude', '实体'], ['cut', '内腔'], ['extrude', '螺丝柱'], ['split', '上盖'], ['hole', 'M3 × 4'], ['pattern', '散热槽'], ['cut', 'USB-C 口']],
    note: '这里开个 USB-C 口', noteHdr: '备注 1',
    param: '壁厚', checks: '核对', wall: '壁厚 ', mm: ' mm',
    m1: '实测 80.00 × 50.00 × 28.00', m2: v => `实测 ${v} mm`, m3: '找到 4 个 · Ø3.4',
    caps: ['一句话。', '得到一棵特征树，不是网格。', '你说的每个数字，由内核量一遍。', '说不清改哪里？指给它看。', '改一个数，它会告诉你。'],
    tag: ['agent 来建。', '内核来核对。', '你来定方向。'], url: 'github.com/linjiejim/turnery',
  },
}[LANG];
const TOK = [['n80', '80'], ['n50', '50'], ['n28', '28'], ['t2', '2'], ['m3', '4 × M3']];

// ───────────────────────────── timeline ─────────────────────────────
const T = {
  type0: 0.7, cps: LANG === 'zh' ? 13 : 27, click: 3.2, bar0: 3.42, bar1: 4.3,
  rows: [4.5, 5.05, 5.6, 6.15, 6.8, 7.45, 8.0, 17.75],
  n: { in: 15.3, click: 15.95, bub: 16.05, type0: 16.28, send: 17.25, row: 17.75, done: 18.3, bubOut: 18.95 },
  d0: { n80: 8.75, n50: 9.02, n28: 9.29, t2: 11.75, m3: 12.1 }, dDur: 0.55,
  lift0: 11.2, lift1: 11.8,
  c0: { n80: 10.3, n50: 10.37, n28: 10.44, t2: 13.1, m3: 13.75 }, cDur: 0.62,
  tick: [11.1, 13.76, 14.41],
  hand1: 19.45, grab: 20.0, drag0: 20.12, drag1: 21.05, back0: 22.05, back1: 22.8, release: 22.95,
  out0: 23.6, out1: 24.7, mark: 24.45,
};
const CAPS = [[0.9, 3.3], [4.9, 8.4], [9.9, 14.95], [15.5, 19.15], [19.7, 23.3]];

// ───────────────────────────── part parameters ─────────────────────────────
const L = 80, Wd = 50, Hb = 20, Hl = 8, R = 6, INSET = 5;
const wallAt = t => 2 + ease.cubicInOut(seg(t, T.drag0, T.drag1)) - ease.cubicInOut(seg(t, T.back0, T.back1));
let FAIL_T = T.drag0, PASS_T = T.back1;
for (let t = T.drag0; t < T.drag1; t += 0.005) if (wallAt(t) > 2.02) { FAIL_T = t; break; }
for (let t = T.back0; t < T.back1 + 0.1; t += 0.005) if (wallAt(t) <= 2.02) { PASS_T = t; break; }

function partAt(t) {
  const r = T.rows, wall = wallAt(t);
  const hBase = Hb * clamp(spring(t - r[1], 0.72, 15), 0, 1.2);
  const cutK = ease.cubicInOut(seg(t, r[2], r[2] + 0.45));
  const lidIn = seg(t, r[4], r[4] + 0.36);
  const lift = 24 * ease.cubicInOut(seg(t, T.lift0, T.lift1)) * (1 - ease.cubicInOut(seg(t, T.out0, T.out0 + 0.8)));
  return {
    wall, hBase, cut: cutK > 0, plugH: lerp(hBase, wall, cutK),
    sketchK: ease.cubicInOut(seg(t, r[0], r[0] + 0.45)), sketchOp: 1 - sstep(r[1] + 0.05, r[1] + 0.3, t),
    postK: clamp(spring(t - r[3], 0.7, 16), 0, 1.15),
    lidOp: seg(t, r[4], r[4] + 0.12), lidZ: Hb + lift + 64 * (1 - ease.quadOut(lidIn)) * (lidIn < 1 ? 1 : 0),
    holeK: clamp(spring(t - r[5], 0.6, 20), 0, 1.2),
    vents: [0, 1, 2, 3, 4].map(i => ease.cubicOut(seg(t, r[6] + i * 0.06, r[6] + i * 0.06 + 0.3))),
    slotK: ease.cubicOut(seg(t, T.n.row + 0.08, T.n.row + 0.5)),
    lift, rim: sstep(T.lift0 + 0.3, T.lift1 + 0.2, t) * (1 - sstep(T.out0 - 0.2, T.out0 + 0.3, t)),
    fail: sstep(2.02, 2.3, wall),
    az: -34 + 12 * (1 - ease.cubicOut(seg(t, r[0], r[6] + 0.7))) - 9 * ease.cubicInOut(seg(t, T.out0, T.out1 + 0.1)),
  };
}

// ───────────────────────────── three: a parametric enclosure ─────────────────────────────
const GLX = 420, GLY = 170, GLW = 980, GLH = 780, HH = 52;
const glEl = document.getElementById('gl');
Object.assign(glEl.style, { left: GLX + 'px', top: GLY + 'px', width: GLW + 'px', height: GLH + 'px' });
const renderer = new THREE.WebGLRenderer({ canvas: glEl, alpha: true, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.max(1, window.devicePixelRatio || 1)); renderer.setSize(GLW, GLH, false); renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const cam = new THREE.OrthographicCamera(-HH * GLW / GLH, HH * GLW / GLH, HH, -HH, 1, 2000); cam.up.set(0, 0, 1);
scene.add(new THREE.AmbientLight(0xffffff, 1.3));
const sun = new THREE.DirectionalLight(0xffffff, 2.9); scene.add(sun); scene.add(sun.target);
const colBody = new THREE.Color('#d9d9d6'), colAcc = new THREE.Color(C.accent), colBad = new THREE.Color(C.accent2);
const mBody = new THREE.MeshLambertMaterial({ color: colBody }), mRim = new THREE.MeshLambertMaterial({ color: colBody.clone() });
const mLid = new THREE.MeshLambertMaterial({ color: colBody, transparent: true }), mEdge = new THREE.LineBasicMaterial({ color: 0x242424 });
const mLidEdge = new THREE.LineBasicMaterial({ color: 0x242424, transparent: true });

function rr(target, w, h, r) {
  const x = -w / 2, y = -h / 2, P = Math.PI; r = Math.max(0.3, Math.min(r, w / 2 - 0.01, h / 2 - 0.01));
  target.moveTo(x + r, y); target.lineTo(x + w - r, y); target.absarc(x + w - r, y + r, r, -P / 2, 0, false);
  target.lineTo(x + w, y + h - r); target.absarc(x + w - r, y + h - r, r, 0, P / 2, false);
  target.lineTo(x + r, y + h); target.absarc(x + r, y + h - r, r, P / 2, P, false);
  target.lineTo(x, y + r); target.absarc(x + r, y + r, r, P, 1.5 * P, false); return target;
}
const circle = (x, y, r) => new THREE.Path().absarc(x, y, r, 0, Math.PI * 2, true);
function slot(cx, cy, len, w) {
  const p = new THREE.Path(), r = w / 2, a = Math.max(0.01, len / 2 - r);
  p.moveTo(cx - a, cy - r); p.lineTo(cx + a, cy - r); p.absarc(cx + a, cy, r, -Math.PI / 2, Math.PI / 2, false);
  p.lineTo(cx - a, cy + r); p.absarc(cx - a, cy, r, Math.PI / 2, 1.5 * Math.PI, false); return p;
}
const extrude = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.02, depth), bevelEnabled: false, curveSegments: 14 });
const POSTS = [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([sx, sy]) => [sx * (L / 2 - INSET), sy * (Wd / 2 - INSET)]);

function node(mat, edgeMat, parent = scene) {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat), edges = new THREE.LineSegments(new THREE.BufferGeometry(), edgeMat);
  mesh.add(edges); parent.add(mesh);
  return { mesh, edges, key: '', set(key, make) { if (key === this.key) return; this.key = key; this.mesh.geometry.dispose(); this.edges.geometry.dispose(); this.mesh.geometry = make(); this.edges.geometry = new THREE.EdgesGeometry(this.mesh.geometry, 28); } };
}
const nSolid = node(mBody, mEdge), nRing = node([mRim, mBody], mEdge), nPlug = node(mBody, mEdge);
const nPosts = POSTS.map(() => node(mBody, mEdge));
const lid = new THREE.Group(); scene.add(lid);
const nLidTop = node(mLid, mLidEdge, lid), nLidRing = node(mLid, mLidEdge, lid);
const PINP = [-8, -Wd / 2, 9.5];
const slotMesh = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(slot(0, 0, 12.5, 4.8).getPoints(14))), new THREE.MeshBasicMaterial({ color: 0x2e2e2c }));
slotMesh.geometry.rotateX(Math.PI / 2); slotMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(slotMesh.geometry), mEdge)); slotMesh.position.set(PINP[0], -Wd / 2 - 0.06, PINP[2]); scene.add(slotMesh);
const q = v => v.toFixed(3);

function setPart(p) {
  const az = p.az * Math.PI / 180, el = 31 * Math.PI / 180, d = 400;
  cam.position.set(d * Math.cos(el) * Math.sin(az), -d * Math.cos(el) * Math.cos(az), d * Math.sin(el) + 16);
  cam.lookAt(0, 0, 16); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  sun.position.set(cam.position.x * 0.45 - 90, cam.position.y * 0.45, 330); sun.target.position.set(0, 0, 0);
  slotMesh.visible = p.slotK > 0.02; slotMesh.scale.set(Math.max(0.02, p.slotK), 1, 0.35 + 0.65 * p.slotK);
  const t = p.wall, solid = !p.cut, has = p.hBase > 0.05;
  nSolid.mesh.visible = solid && has; nRing.mesh.visible = nPlug.mesh.visible = !solid && has;
  if (solid && has) nSolid.set('s' + q(p.hBase), () => extrude(rr(new THREE.Shape(), L, Wd, R), p.hBase));
  if (!solid && has) {
    nRing.set('r' + q(t) + q(p.hBase), () => { const s = rr(new THREE.Shape(), L, Wd, R); s.holes.push(rr(new THREE.Path(), L - 2 * t, Wd - 2 * t, R - t)); return extrude(s, p.hBase); });
    nPlug.set('p' + q(t) + q(p.plugH), () => extrude(rr(new THREE.Shape(), L - 2 * t, Wd - 2 * t, R - t), p.plugH));
  }
  mRim.color.copy(colBody).lerp(colAcc, p.rim * 0.92).lerp(colBad, p.rim * p.fail);
  nPosts.forEach((n, i) => {
    const h = (Hb - t) * p.postK; n.mesh.visible = h > 0.05;
    if (!n.mesh.visible) return;
    n.set('o' + q(h) + q(p.holeK), () => { const s = new THREE.Shape().absarc(0, 0, 3.5, 0, Math.PI * 2, false); if (p.holeK > 0.05) s.holes.push(circle(0, 0, 2 * Math.min(1, p.holeK))); return extrude(s, h); });
    n.mesh.position.set(POSTS[i][0], POSTS[i][1], t);
  });
  lid.visible = p.lidOp > 0; lid.position.z = p.lidZ; mLid.opacity = mLidEdge.opacity = p.lidOp;
  if (lid.visible) {
    nLidRing.set('lr' + q(t), () => { const s = rr(new THREE.Shape(), L, Wd, R); s.holes.push(rr(new THREE.Path(), L - 2 * t, Wd - 2 * t, R - t)); return extrude(s, Hl - t); });
    nLidTop.set('lt' + q(t) + q(p.holeK) + p.vents.map(q).join(), () => {
      const s = rr(new THREE.Shape(), L, Wd, R);
      if (p.holeK > 0.05) POSTS.forEach(([x, y]) => s.holes.push(circle(x, y, 1.7 * p.holeK)));
      p.vents.forEach((v, i) => { if (v > 0.03) s.holes.push(slot(16, -10 + i * 5, 2 + 20 * v, 2)); });
      return extrude(s, t);
    });
    nLidTop.mesh.position.z = Hl - t;
  }
}
const V = new THREE.Vector3();
const proj = (x, y, z) => { V.set(x, y, z).project(cam); return { x: GLX + (V.x + 1) / 2 * GLW, y: GLY + (1 - V.y) / 2 * GLH }; };

// ───────────────────────────── DOM ─────────────────────────────
const world = document.getElementById('world'), ov = document.getElementById('ov');
const OVS = 1.3 * Math.max(1, window.devicePixelRatio || 1); ov.width = W * OVS; ov.height = H * OVS; const g = ov.getContext('2d');
const mk = (cls, html = '', parent = world, tag = 'div') => { const e = document.createElement(tag); e.className = cls; e.innerHTML = html; parent.appendChild(e); return e; };
const put = (e, x, y, s = 1, op = 1, extra = '') => { if (op <= 0.003) { e.style.display = 'none'; return; } e.style.display = ''; e.style.opacity = op.toFixed(3); e.style.transform = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) scale(${s.toFixed(4)}) ${extra}`; };

// the request card: text segments with a placeholder per token
const card = mk('abs'); card.id = 'card';
const txt = mk('txt', '', card); mk('', '', card).id = 'send';
const SEGS = [];
STR.seg.forEach((s, i) => { SEGS.push({ el: mk('', '', txt, 'span'), text: s }); if (i < TOK.length) SEGS.push({ el: mk('ph', '', txt, 'span'), text: TOK[i][1], tok: TOK[i][0] }); });
const caret = mk('caret', '', txt, 'span');
let acc = 0; SEGS.forEach(s => { s.start = acc; acc += [...s.text].length; }); const NCHAR = acc;
const TYPE1 = T.type0 + NCHAR / T.cps;
const toks = {}; TOK.forEach(([k, s]) => { toks[k] = { el: mk('abs tok', s), text: s }; });

// feature tree (left), parameter slider, check list (right)
const TX = 120, TY = 262, ROW = 52, CX = 1385, CY = 318, CROW = 112;
const hdrL = mk('abs hdr', STR.file), rows = STR.rows.map(([a, b]) => mk('abs row', `<b>${a}</b><i> · ${b}</i>`));
const pLab = mk('abs row', `<b>t</b><i> · ${STR.param}</i>`), knob = mk('abs'); knob.id = 'knob'; const pVal = mk('abs'); pVal.id = 'pval';
const PY = TY + 52 + 8 * ROW + 34, TRK0 = TX + 4, TRK1 = TX + 250, knobX = v => lerp(TRK0, TRK1, (v - 1) / 3);
const hdrR = mk('abs hdr', STR.checks), cnt = mk('abs hdr', '');
const TICK = '<svg viewBox="0 0 30 30"><path d="M8.5 15.5l4.3 4.3 8.7-9.4" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CROSS = '<svg viewBox="0 0 30 30"><path d="M10 10l10 10M20 10L10 20" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>';
const boxes = [0, 1, 2].map(() => mk('abs box'));
const sep1 = mk('abs lab mute', '×'), sep2 = mk('abs lab mute', '×'), wLab = mk('abs lab', STR.wall), wMm = mk('abs lab mute', STR.mm.trim());
const subs = [mk('abs sub', STR.m1), mk('abs sub', ''), mk('abs sub', STR.m3)];
const live = mk('abs sub', '');                                    // the wall's measured value, next to the rim
const pin = mk('abs'); pin.id = 'pin';
const bub = mk('abs', `<div class="h">${STR.noteHdr}</div><div class="t"></div>`); bub.id = 'bub'; const bubT = bub.querySelector('.t');
const NOTE = [...STR.note], NCPS = LANG === 'zh' ? 10 : 17;
const cur = mk('abs', '<svg viewBox="0 0 30 30" width="30" height="30"><path d="M4 3l0 20 5.6-5 3.6 8.2 3.4-1.5-3.6-8 7.4-.5z" fill="#1a1a1a" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'); cur.id = 'cur';
const capEl = document.getElementById('cap'), caps = STR.caps.map(s => mk('', s, capEl, 'span'));
const markEl = document.getElementById('mark'), letters = [...'Turnery'].map(ch => mk('', ch, markEl, 'span'));
const tagEl = document.getElementById('tag'), tagWords = STR.tag.map(s => mk('', s + ' ', tagEl, 'span')); tagWords.forEach(w => { w.style.display = 'inline-block'; w.style.whiteSpace = 'pre'; });
const urlEl = document.getElementById('url'); urlEl.textContent = STR.url;

// measured once fonts are in
const M = { card: { w: 0, h: 104 }, seg: {}, tok: {}, sepW: 0, wLabW: 0 };
function measure() {
  world.style.transform = 'none'; card.style.transform = 'none';
  SEGS.forEach(s => { s.el.textContent = s.text; });
  const tw = txt.getBoundingClientRect().width; M.card.w = Math.ceil(38 + tw + 34 + 54 + 22); card.style.width = M.card.w + 'px'; card.style.height = M.card.h + 'px';
  const cr = card.getBoundingClientRect();
  SEGS.forEach(s => { if (!s.tok) return; const r = s.el.getBoundingClientRect(); M.seg[s.tok] = { x: r.left - cr.left + r.width / 2, y: r.top - cr.top + r.height / 2 }; });
  for (const k in toks) { const r = toks[k].el.getBoundingClientRect(); M.tok[k] = { w: r.width, h: r.height }; }
  M.sepW = sep1.getBoundingClientRect().width; M.wLabW = wLab.getBoundingClientRect().width;
  bubT.textContent = STR.note; bub.style.width = Math.ceil(bubT.getBoundingClientRect().width + 6) + 'px'; bubT.textContent = '';
  M.markW = markEl.getBoundingClientRect().width; M.rowW = rows.map(r => r.getBoundingClientRect().width);
}

// ───────────────────────────── camera, hand ─────────────────────────────
const KEYS = [
  { t: 0, x: 960, y: 505, zoom: 1.2 }, { t: T.bar0, x: 960, y: 505, zoom: 1.2 },
  { t: T.bar1 + 0.15, x: 960, y: 540, zoom: 1, curve: ease.cubicInOut },
  { t: 8.55, x: 960, y: 540, zoom: 1 }, { t: 9.45, x: 972, y: 560, zoom: 1.07, curve: ease.sineInOut },
  { t: 12.9, x: 972, y: 560, zoom: 1.07 }, { t: 13.6, x: 1008, y: 540, zoom: 1.05, curve: ease.sineInOut },
  { t: 15.25, x: 1008, y: 540, zoom: 1.05 }, { t: 15.95, x: 948, y: 552, zoom: 1.08, curve: ease.cubicInOut },
  { t: 19.4, x: 948, y: 552, zoom: 1.08 }, { t: 20.0, x: 942, y: 556, zoom: 1.05, curve: ease.cubicInOut },
  { t: T.out0, x: 942, y: 556, zoom: 1.05 }, { t: T.out1, x: 1300, y: 548, zoom: 1.13, curve: ease.cubicInOut },
];
const HITS = [[T.rows[4] + 0.36, 5, 11], [FAIL_T + 0.02, 4, 12]];
function camAt(t) {
  const c = OM.camera(t, KEYS); let x = c.x, y = c.y, rot = 0;
  for (const [th, amp, decay] of HITS) { const s = OM.shake(t, th, { amp, decay, seed: Math.round(th * 100) }); x += s.x / c.zoom; y += s.y / c.zoom; rot += s.rot * 0.4; }
  return { x, y, zoom: c.zoom, rot };
}
function cardAt(t) {
  const k = ease.quintInOut(seg(t, T.bar0, T.bar1)), s = lerp(1, 0.72, k), cy = lerp(505, 96, k);
  const pr = OM.press(t, T.click, { depth: 0.035 });
  return { x: 960 - M.card.w * s / 2, y: cy - M.card.h * s / 2, s: s * pr.s, k };
}
const sendAt = t => { const c = cardAt(t); return { x: c.x + (M.card.w - 49) * c.s, y: c.y + M.card.h / 2 * c.s }; };
function handAt(t) {                                               // world coordinates; null = off stage
  const e = ease.cubicInOut, N = T.n;
  if (t < 2.5 || (t > 4.5 && t < N.in) || t > T.release + 0.75) return null;
  if (t <= 4.5) {
    const s = sendAt(Math.min(t, T.click + 0.05)), a = { x: 1560, y: 900 }, k = e(seg(t, 2.5, T.click - 0.06)), o = e(seg(t, T.click + 0.2, 4.4));
    return { x: lerp(a.x, s.x, k) + 170 * o, y: lerp(a.y, s.y, k) + 420 * o - Math.sin(k * Math.PI) * 40, s: t >= T.click && t - T.click < 0.14 ? 0.84 : 1, op: 1 - sstep(4.0, 4.4, t) };
  }
  const pp = proj(...PINP), rest = { x: pp.x + 30, y: pp.y + 84 };
  if (t < T.hand1) {                                               // point at the face, click, step aside while the note is written
    const a = { x: 1010, y: 1080 }, k = e(seg(t, N.in, N.click - 0.05)), o = e(seg(t, N.click + 0.14, N.click + 0.6));
    return { x: lerp(a.x, pp.x, k) + (rest.x - pp.x) * o, y: lerp(a.y, pp.y, k) + (rest.y - pp.y) * o, s: t >= N.click && t < N.click + 0.14 ? 0.84 : 1, op: sstep(N.in, N.in + 0.2, t) };
  }
  const kx = knobX(wallAt(t)), ky = PY + 40, k = e(seg(t, T.hand1, T.grab)), o = e(seg(t, T.release, T.release + 0.7));
  const down = t > T.grab + 0.04 && t < T.release;
  return { x: lerp(rest.x, kx, k) + 190 * o, y: lerp(rest.y, ky, k) + 300 * o, s: down ? 0.86 : 1, op: 1 - sstep(T.release + 0.4, T.release + 0.72, t) };
}

// ───────────────────────────── where every token is ─────────────────────────────
function dimGeom(p) {                                              // dimension anchors on the part, in world px
  const top = Hb + Hl, c = proj(0, 0, 14);
  const off = (a, b, d) => { let nx = -(b.y - a.y), ny = b.x - a.x; const n = Math.hypot(nx, ny) || 1; nx /= n; ny /= n; const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; if ((mx - c.x) * nx + (my - c.y) * ny < 0) { nx = -nx; ny = -ny; } return { a, b, nx, ny, d, lx: mx + nx * (d + 30), ly: my + ny * (d + 30) }; };
  const g80 = off(proj(-L / 2, -Wd / 2, 0), proj(L / 2, -Wd / 2, 0), 40), g50 = off(proj(-L / 2, -Wd / 2, 0), proj(-L / 2, Wd / 2, 0), 40);
  const g28 = off(proj(L / 2, -Wd / 2, 0), proj(L / 2, -Wd / 2, top), 44);
  const ra = proj(18, -Wd / 2, Hb), rb = proj(18, -Wd / 2 + p.wall, Hb), rl = { x: ra.x + 150, y: ra.y + 118 };
  const ha = proj(L / 2 - INSET, -Wd / 2 + INSET, p.lidZ + Hl), hl = { x: ha.x + 128, y: ha.y - 92 };
  return { g80, g50, g28, rim: { a: ra, b: rb, l: rl }, hole: { a: ha, l: hl } };
}
function checkSlots() {                                            // token centres in the check list
  const s = 0.86, y0 = CY + 60, x0 = CX + 50, w = k => M.tok[k].w * s, gap = 11, sw = M.sepW;
  const a = x0 + w('n80') / 2, s1 = x0 + w('n80') + gap, b = s1 + sw + gap + w('n50') / 2, s2 = s1 + sw + gap + w('n50') + gap, c = s2 + sw + gap + w('n28') / 2;
  const wx = x0 + M.wLabW + w('t2') / 2 + 2;
  return { s, sep: [s1, s2], n80: { x: a, y: y0 }, n50: { x: b, y: y0 }, n28: { x: c, y: y0 }, t2: { x: wx, y: y0 + CROW }, mmX: wx + w('t2') / 2 + 9, m3: { x: x0 + w('m3') / 2, y: y0 + 2 * CROW } };
}
function tokAt(k, t, D, S) {
  const c = cardAt(t), home = { x: c.x + M.seg[k].x * c.s, y: c.y + M.seg[k].y * c.s, s: c.s };
  const dl = { n80: D.g80, n50: D.g50, n28: D.g28 }[k], dim = dl ? { x: dl.lx, y: dl.ly } : k === 't2' ? { x: D.rim.l.x + 22, y: D.rim.l.y + 6 } : { x: D.hole.l.x + 64, y: D.hole.l.y - 8 };
  const d0 = T.d0[k], d1 = d0 + T.dDur, c0 = T.c0[k], c1 = c0 + T.cDur;
  let x, y, s, sx = 1, sy = 1;
  if (t < d1) { const h = OM.hop(t, d0, d1, home, dim, { height: 120, curve: ease.quartOut }); x = h.x; y = h.y; s = lerp(home.s, 0.9, h.k); }
  else { const h = OM.hop(t, c0, c1, dim, S[k], { height: 96, curve: ease.cubicInOut }); x = h.x; y = h.y; s = lerp(0.9, S.s, h.k); }
  const i1 = OM.impact(t, d1, { decay: 9, omega: 26 }), i2 = OM.impact(t, c1, { decay: 9, omega: 26 });
  if (t >= d1 && t < c0) { sx = i1.sx; sy = i1.sy; } else if (t >= c1) { sx = i2.sx; sy = i2.sy; }
  const shown = t >= T.bar0 ? 1 : 0;                              // before the card moves the placeholder span shows the typed text
  const out = 1 - sstep(T.out0, T.out0 + 0.5, t);
  return { x, y, s, sx, sy, op: shown * out, stage: t < d0 ? 0 : t < d1 ? 0.5 : t < c0 ? 1 : t < c1 ? 1.5 : 2 };
}

// ───────────────────────────── overlay drawing ─────────────────────────────
function line(x0, y0, x1, y1, k) { if (k <= 0) return; g.beginPath(); g.moveTo(x0, y0); g.lineTo(lerp(x0, x1, k), lerp(y0, y1, k)); g.stroke(); }
function drawDim(G, k, alpha, col) {
  if (k <= 0 || alpha <= 0) return;
  const ax = G.a.x + G.nx * G.d, ay = G.a.y + G.ny * G.d, bx = G.b.x + G.nx * G.d, by = G.b.y + G.ny * G.d, e = clamp(k * 2.2), m = clamp(k * 1.6 - 0.5);
  g.globalAlpha = alpha; g.strokeStyle = col; g.lineWidth = 1.6;
  line(G.a.x + G.nx * 8, G.a.y + G.ny * 8, ax + G.nx * 9, ay + G.ny * 9, e); line(G.b.x + G.nx * 8, G.b.y + G.ny * 8, bx + G.nx * 9, by + G.ny * 9, e);
  const mx = (ax + bx) / 2, my = (ay + by) / 2; line(mx, my, ax, ay, m); line(mx, my, bx, by, m);
  if (m > 0.95) { const ux = (bx - ax), uy = (by - ay), n = Math.hypot(ux, uy), tx = ux / n * 6 + G.nx * 6, ty = uy / n * 6 + G.ny * 6; g.lineWidth = 2.2; line(ax - tx, ay - ty, ax + tx, ay + ty, 1); line(bx - tx, by - ty, bx + tx, by + ty, 1); }
  g.globalAlpha = 1;
}
function drawLeader(a, l, k, alpha, col, dot) {
  if (k <= 0 || alpha <= 0) return;
  g.globalAlpha = alpha; g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.6;
  const ex = l.x - Math.sign(l.x - a.x) * 2, k1 = clamp(k * 1.5), k2 = clamp(k * 3 - 2);
  line(a.x, a.y, ex - Math.sign(l.x - a.x) * 26, l.y, k1); line(ex - Math.sign(l.x - a.x) * 26, l.y, ex, l.y, k2);
  if (dot) { g.beginPath(); g.arc(a.x, a.y, 3.4, 0, 6.3); g.fill(); }
  g.globalAlpha = 1;
}

// ───────────────────────────── seek ─────────────────────────────
function seek(t) {
  const camS = camAt(t), VM = OM.view(camS); world.style.transform = `matrix(${VM.map(v => v.toFixed(5)).join(',')})`;
  const p = partAt(t); setPart(p); renderer.render(scene, cam);
  const D = dimGeom(p), S = checkSlots(), out = 1 - sstep(T.out0, T.out0 + 0.55, t), outX = 60 * ease.cubicInOut(seg(t, T.out0, T.out0 + 0.6));
  g.setTransform(OVS, 0, 0, OVS, 0, 0); g.clearRect(0, 0, W, H); g.lineCap = 'round';

  // request card: typing, the press, the move to the top bar
  const c = cardAt(t), n = clamp(Math.floor((t - T.type0) * T.cps), 0, NCHAR), floating = t >= T.bar0;
  SEGS.forEach(s => { const sub = [...s.text].slice(0, clamp(n - s.start, 0, 99)).join(''); if (s.el.textContent !== sub) s.el.textContent = sub; s.el.style.visibility = s.tok && floating ? 'hidden' : 'visible'; });
  if (floating) SEGS.forEach(s => { if (s.tok && s.el.textContent !== s.text) s.el.textContent = s.text; });
  caret.style.opacity = t < TYPE1 + 0.05 ? 1 : (t < T.click && Math.floor((t - TYPE1) * 2.4) % 2 === 0 ? 1 : 0);
  document.getElementById('send').style.background = OM.press(t, T.click).active ? C.accent : C.ink;
  put(card, c.x, c.y - 26 * (1 - out), c.s, OM.popIn(t, 0.12, { rise: 0 }).op * out);

  // sketch outline of the first feature
  if (p.sketchK > 0 && p.sketchOp > 0) {
    const sh = rr(new THREE.Shape(), L, Wd, R).getPoints(18), m = Math.max(2, Math.round(sh.length * p.sketchK));
    g.globalAlpha = p.sketchOp; g.strokeStyle = C.accent; g.lineWidth = 2.4; g.beginPath();
    for (let i = 0; i < m; i++) { const q2 = proj(sh[i].x, sh[i].y, 0); i ? g.lineTo(q2.x, q2.y) : g.moveTo(q2.x, q2.y); }
    if (p.sketchK >= 1) g.closePath(); g.stroke(); g.globalAlpha = 1;
  }

  // feature tree
  const hk = OM.wordRise(t, T.rows[0] - 0.18, { dist: 0 }); put(hdrL, TX - outX, TY, 1, hk.op * out);
  let lastY = TY + 30, grown = 0;
  rows.forEach((el, i) => {
    const w = OM.wordRise(t, T.rows[i], { dist: 16, omega: 26 }), y = TY + 52 + i * ROW, on = t >= T.rows[i];
    put(el, TX + 30 - w.y - outX, y, 1, w.op * out);
    if (on) { lastY = y + 11; grown = i + 1; const active = t < Math.min(T.rows[i + 1] ?? 1e9, T.rows[i] + 0.6) || (i === 7 && t < T.n.done); g.globalAlpha = out; g.fillStyle = active ? C.accent : C.ink; g.beginPath(); g.arc(TX + 9 - outX, y + 11, active ? 5.5 * (1 + 0.5 * ring(t - T.rows[i], 9, 24)) : 4, 0, 6.3); g.fill(); g.globalAlpha = 1; }
  });
  if (grown) { g.globalAlpha = out; g.strokeStyle = C.line; g.lineWidth = 2; g.globalCompositeOperation = 'destination-over'; line(TX + 9 - outX, TY + 34, TX + 9 - outX, lastY, 1); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }

  // parameter slider
  const pk = OM.wordRise(t, T.rows[2] + 0.1, { dist: 14 }), kx = knobX(p.wall), grabbed = t > T.grab && t < T.release;
  put(pLab, TX - outX, PY - pk.y, 1, pk.op * out);
  if (pk.op > 0) { g.globalAlpha = pk.op * out; g.strokeStyle = C.line; g.lineWidth = 4; line(TRK0 - outX, PY + 40, TRK1 - outX, PY + 40, 1); g.strokeStyle = C.ink; line(TRK0 - outX, PY + 40, kx - outX, PY + 40, 1); g.globalAlpha = 1; }
  knob.style.borderColor = grabbed ? C.accent : C.ink; put(knob, kx - 13 - outX, PY + 27, 1, pk.op * out, `scale(${(grabbed ? 1.18 : 1).toFixed(2)})`);
  const vs = p.wall.toFixed(2); if (pVal.textContent !== vs) pVal.textContent = vs; pVal.style.color = p.fail > 0.5 ? C.accent2 : C.ink; put(pVal, TRK1 + 26 - outX, PY + 27, 1, pk.op * out);

  // dimensions on the part: drawn when the token lands, ghosted once the number has gone to the check list
  const dk = k => ease.cubicOut(seg(t, T.d0[k] + T.dDur - 0.12, T.d0[k] + T.dDur + 0.3)), da = k => lerp(1, 0.35, sstep(T.c0[k], T.c0[k] + 0.3, t)) * out;
  drawDim(D.g80, dk('n80'), da('n80'), C.accent); drawDim(D.g50, dk('n50'), da('n50'), C.accent); drawDim(D.g28, dk('n28'), da('n28') * (1 - sstep(T.lift0 - 0.1, T.lift0 + 0.2, t)), C.accent);
  const rimCol = p.fail > 0.5 ? C.accent2 : C.accent;
  drawLeader({ x: (D.rim.a.x + D.rim.b.x) / 2, y: (D.rim.a.y + D.rim.b.y) / 2 }, D.rim.l, dk('t2'), lerp(1, 0.55, sstep(T.c0.t2, T.c0.t2 + 0.3, t)) * out, rimCol, true);
  drawLeader(D.hole.a, D.hole.l, dk('m3'), da('m3'), C.accent, true);
  const lv = sstep(T.grab - 0.3, T.grab, t) * (1 - sstep(T.release + 0.3, T.release + 0.7, t)), ls = `${vs} mm`; if (live.textContent !== ls) live.textContent = ls;
  live.style.color = rimCol; live.style.fontSize = '24px'; put(live, D.rim.l.x + 8, D.rim.l.y - 12, 1, lv * out);

  // tokens
  for (const k in toks) { const s = tokAt(k, t, D, S), m = M.tok[k]; put(toks[k].el, s.x - m.w / 2, s.y - m.h / 2, 1, s.op, `translate(${(m.w / 2).toFixed(2)}px,${(m.h / 2).toFixed(2)}px) scale(${(s.s * s.sx).toFixed(4)},${(s.s * s.sy).toFixed(4)}) translate(${(-m.w / 2).toFixed(2)}px,${(-m.h / 2).toFixed(2)}px)`); }

  // check list
  const ck = OM.wordRise(t, T.c0.n80 - 0.25, { dist: 0 }), fail = p.wall > 2.02, passed = T.tick.filter(x => t >= x).length - (fail ? 1 : 0);
  put(hdrR, CX + outX, CY, 1, ck.op * out); const cs = `${Math.max(0, passed)}/3`; if (cnt.textContent !== cs) cnt.textContent = cs; cnt.style.color = fail ? C.accent2 : C.mute; put(cnt, CX + 300 + outX, CY, 1, ck.op * out);
  boxes.forEach((b, i) => {
    const y = CY + 45 + i * CROW, on = t >= T.tick[i], bad = i === 1 && fail && on, tk = OM.tick(t, T.tick[i]);
    let s = on ? tk.s : 1; if (i === 1 && on) s *= 1 + 0.22 * ring(t - FAIL_T, 9, 26) * (t >= FAIL_T ? 1 : 0) + 0.22 * ring(t - PASS_T, 9, 26) * (t >= PASS_T ? 1 : 0);
    const html = bad ? CROSS : on ? TICK : ''; if (b.dataset.h !== html) { b.dataset.h = html; b.innerHTML = html; }
    b.style.background = bad ? C.accent2 : on ? GOOD : 'transparent'; b.style.borderColor = bad ? C.accent2 : on ? GOOD : '#cfcfca';
    put(b, CX + outX, y, 1, OM.wordRise(t, T.c0[['n80', 't2', 'm3'][i]] - 0.1, { dist: 0 }).op * out, `scale(${s.toFixed(4)})`);
    const sk = OM.wordRise(t, T.tick[i] + 0.06, { dist: 10 }), sub = subs[i];
    if (i === 1) { const ms = STR.m2(vs); if (sub.textContent !== ms) sub.textContent = ms; sub.style.color = fail ? C.accent2 : C.mute; }
    put(sub, CX + 50 + outX, y + 44 + sk.y, 1, sk.op * out);
  });
  const l1 = OM.wordRise(t, T.c0.n28 + T.cDur - 0.05, { dist: 0 }), l2 = OM.wordRise(t, T.c0.t2 + T.cDur - 0.2, { dist: 0 });
  put(sep1, S.sep[0] + outX, S.n80.y - 15, 1, l1.op * out); put(sep2, S.sep[1] + outX, S.n80.y - 15, 1, l1.op * out);
  put(wLab, CX + 50 + outX, S.t2.y - 15, 1, l2.op * out); put(wMm, S.mmX + outX, S.t2.y - 15, 1, l2.op * out);

  // the note pinned on a face: click → pin → typed note → it travels to the tree → the cut appears → resolved
  const N = T.n, pp = proj(...PINP), sent = t >= N.send, done = t >= N.done;
  const pnk = OM.tick(t, N.click), dk2 = OM.tick(t, N.done), pinHtml = done ? TICK.replace('viewBox="0 0 30 30"', 'viewBox="-3 -3 36 36"') : '1';
  if (pin.dataset.h !== pinHtml) { pin.dataset.h = pinHtml; pin.innerHTML = pinHtml; }
  pin.style.background = done ? GOOD : C.accent;
  const pinUp = 34 * clamp(spring(t - N.click, 0.6, 20), 0, 1.2);
  if (t >= N.click) { g.globalAlpha = out; g.strokeStyle = done ? GOOD : C.accent; g.lineWidth = 2.4; line(pp.x, pp.y, pp.x, pp.y - pinUp + 14, 1); g.fillStyle = done ? GOOD : C.accent; g.beginPath(); g.arc(pp.x, pp.y, 3.6, 0, 6.3); g.fill(); g.globalAlpha = 1; }
  put(pin, pp.x - 18, pp.y - 18 - pinUp, 1, (t >= N.click ? 1 : 0) * out, `scale(${((done ? dk2.s : pnk.s) * (1 + 0.3 * ring(t - N.click, 8, 24) * (t >= N.click ? 1 : 0))).toFixed(4)})`);
  const bi = OM.popIn(t, N.bub, { rise: 14 }), bo = OM.liftOut(t, N.bubOut, { dur: 0.3, dist: 26, blur: 0 }), nn = clamp(Math.floor((t - N.type0) * NCPS), 0, NOTE.length);
  const bt = NOTE.slice(0, nn).join('') + (t < N.send ? '<i></i>' : ''); if (bubT.dataset.h !== bt) { bubT.dataset.h = bt; bubT.innerHTML = bt; }
  bub.style.borderColor = sent && t < N.send + 0.4 ? C.accent : C.line;
  put(bub, pp.x + 34, pp.y - 156 + bi.dy + bo.dy, bi.s * (1 + 0.04 * ring(t - N.send, 9, 26) * (sent ? 1 : 0)), bi.op * bo.op * out);
  if (sent && t < N.row + 0.05) { const y8 = TY + 52 + 7 * ROW + 11, h = OM.hop(t, N.send, N.row, { x: pp.x + 60, y: pp.y - 96 }, { x: TX + 9, y: y8 }, { height: 150, curve: ease.cubicInOut }); g.fillStyle = C.accent; g.beginPath(); g.arc(h.x, h.y, 7, 0, 6.3); g.fill(); }

  // the hand
  const h = handAt(t); if (h) put(cur, h.x, h.y, h.s, h.op); else cur.style.display = 'none';

  // captions (screen space)
  caps.forEach((el, i) => { const [a, b] = CAPS[i], w = OM.wordRise(t, a, { dist: 18 }), o = OM.liftOut(t, b, { dur: 0.3, dist: 14, blur: 0 }); el.style.opacity = (w.op * o.op).toFixed(3); el.style.transform = `translateY(${(w.y + o.dy).toFixed(2)}px)`; el.style.display = w.op * o.op > 0.003 ? '' : 'none'; });

  // end lockup (screen space): the part stays, the name drops beside it
  const mx = 1010, my = 372;
  put(markEl, mx, my, 1, t >= T.mark ? 1 : 0);
  letters.forEach((el, i) => { const d = OM.letterDrop(t, T.mark, i, { dist: 54 }); el.style.opacity = d.op.toFixed(3); el.style.transform = `translateY(${(-d.y).toFixed(2)}px) scale(${d.sx.toFixed(4)},${d.sy.toFixed(4)})`; });
  put(tagEl, mx + 6, my + 196, 1, t >= T.mark + 0.3 ? 1 : 0);
  tagWords.forEach((el, i) => { const w = OM.wordRise(t, T.mark + 0.42 + i * 0.24, { dist: 20 }); el.style.opacity = w.op.toFixed(3); el.style.transform = `translateY(${w.y.toFixed(2)}px)`; el.style.color = i === 1 ? GOOD : C.ink; });
  const uk = OM.wordRise(t, T.mark + 1.25, { dist: 10 }); put(urlEl, mx + 8, my + 262 + uk.y, 1, uk.op);
  return { camS, VM, D, S };
}

// ───────────────────────────── contract ─────────────────────────────
window.__meta = { dur: DUR, fps: FPS, w: W, h: H, cuts: [], inFrame: { part: [T.rows[1] + 0.5, DUR] } };
function trackAt(t) {
  const r = seek(t), bx = (x, y, w, h, op = 1) => { const b = OM.projectBox(r.VM, { x, y, w, h }); return { x: b.x, y: b.y, w: b.w, h: b.h, op }; }, o = {};
  for (const k in toks) { const s = tokAt(k, t, r.D, r.S), m = M.tok[k]; if (s.op > 0) o[k] = bx(s.x - m.w * s.s / 2, s.y - m.h * s.s / 2, m.w * s.s, m.h * s.s, s.op); }
  const c = cardAt(t); o.card = bx(c.x, c.y, M.card.w * c.s, M.card.h * c.s, 1 - sstep(T.out0, T.out0 + 0.55, t));
  if (t > T.rows[1]) o.part = bx(650, 330, 520, 420);
  const h = handAt(t); if (h && h.op > 0) o.hand = bx(h.x, h.y, 30, 30, h.op);
  if (t >= T.n.click) { const pp = proj(...PINP); o.pin = bx(pp.x - 18, pp.y - 18, 36, 36, 1 - sstep(T.out0, T.out0 + 0.55, t)); }
  return o;
}
window.__track = trackAt;
window.__motion = (t0, t1) => {
  const a = trackAt(t0), b = trackAt(t1); let m = OM.screenTravel(camAt(t0), camAt(t1), camAt((t0 + t1) / 2));
  for (const k in a) if (b[k]) m = Math.max(m, Math.hypot(b[k].x - a[k].x, b[k].y - a[k].y), Math.hypot(b[k].x + b[k].w - a[k].x - a[k].w, b[k].y + b[k].h - a[k].y - a[k].h));
  return m;
};
window.__events = () => ({ note: T.n, type: [T.type0, TYPE1], click: T.click, rows: T.rows, lidLand: T.rows[4] + 0.36, dims: Object.values(T.d0).map(v => v + T.dDur), ticks: T.tick, fail: FAIL_T, pass: PASS_T, mark: T.mark, dur: DUR });
window.__seek = async t => { seek(t); return true; };
window.__ready = Promise.all([LOOK.ready, document.fonts.ready]).then(() => { measure(); seek(0); return true; });
const Q = new URLSearchParams(location.search);
if (Q.has('t')) __ready.then(() => seek(parseFloat(Q.get('t'))));
if (Q.has('play')) __ready.then(() => { const t0 = performance.now(); (function loop() { seek(((performance.now() - t0) / 1000) % DUR); requestAnimationFrame(loop); })(); });
})();
