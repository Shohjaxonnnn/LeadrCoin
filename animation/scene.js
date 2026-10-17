// "Tonga yaqin" — 9:16 stickman motion animation.
// Everything is drawn procedurally on a 1080x1920 canvas; renderFrame(t) is deterministic,
// so render.mjs can capture any frame in any order.

const W = 1080, H = 1920, FPS = 30, DURATION = 21.6;

// ---------------------------------------------------------------- math
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const inv = (a, b, v) => clamp((v - a) / (b - a));
const E = {
  lin: t => t,
  inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: t => 1 - Math.pow(1 - t, 3),
  in: t => t * t * t,
  in2: t => t * t,
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  sine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: t => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: t => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
};
const seg = (t, a, b, e = E.inOut) => e(inv(a, b, t));
const TAU = Math.PI * 2;

function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; }
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mod = (a, n) => ((a % n) + n) % n;

const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(a)})`;

// recursive blend of pose objects
function blend(a, b, k) {
  if (typeof a === 'number') return lerp(a, b, k);
  const o = {};
  for (const key in a) o[key] = key in b ? blend(a[key], b[key], k) : a[key];
  return o;
}

// ---------------------------------------------------------------- captions (timed to the original video)
const CAPS = [
  [0.42, 1.57, 'HAYOTINGIZDA'],
  [1.68, 2.37, 'ENG QORONG‘I', 'cold'],
  [2.45, 3.93, 'KUNLAR KELIB'],
  [4.05, 5.03, 'IPLAR TARANG', 'tense'],
  [5.08, 6.63, 'TORTILGAN PAYTI', 'tense'],
  [6.68, 7.27, 'HECH KIM YORDAM'],
  [7.31, 8.55, 'BERMAGAN PAYTI'],
  [8.60, 9.83, 'O‘SHA BO‘SH QO‘YIB'],
  [9.88, 10.23, 'YUBORAMAN', 'drop'],
  [10.28, 10.95, 'TASLIM BO‘LAMAN', 'faint'],
  [11.00, 12.27, 'DEB TURGAN PAYTINGIZ', 'faint'],
  [12.31, 14.07, 'OZGINA SABR QILING', 'warm'],
  [14.11, 15.63, 'CHUNKI TUNDA'],
  [15.68, 16.95, 'ENG QORONG‘U QISMI', 'cold'],
  [17.00, 17.80, 'TONGA BIR SOAT', 'warm'],
  [17.82, 18.30, 'QOLGANDA BO‘LAR', 'warm'],
  [18.35, 19.20, 'EKANDA', 'warm'],
  [19.30, 21.30, 'TONGA YAQIN', 'hero'],
];

// ---------------------------------------------------------------- world
function groundY(x) { return 170 * (1 - Math.exp(-Math.pow((x - 60) / 760, 2))) + 5 * Math.sin(x * 0.013); }

// environment state over time
function envAt(t) {
  const darkest = seg(t, 14.3, 15.9) * (1 - seg(t, 16.7, 18.2));
  const preDawn = seg(t, 16.8, 19.3, E.sine);
  const dawn = seg(t, 18.9, 20.6, E.sine);
  const rain = 1 - seg(t, 14.1, 15.6);
  const moon = 1 - seg(t, 14.4, 15.8);
  const wind = t < 4.33 ? 1 : t < 6.65 ? 1.25 : t < 8.58 ? 0.9 : t < 14.1 ? lerp(0.6, 0.15, seg(t, 8.6, 10.6)) : lerp(0.25, 1.1, seg(t, 17.0, 20.0));
  const despair = seg(t, 10.2, 11.0) * (1 - seg(t, 12.6, 14.2));
  return { darkest, preDawn, dawn, rain, moon, wind, despair };
}

// integrated tables (rain time, walk distance, walk phase)
const TBL_HZ = 240;
function rainRate(t) { return lerp(1, 0.012, seg(t, 10.95, 11.7, E.out)) + 0.05 * seg(t, 14.1, 15.5); }
function walkSpeed(t) {
  if (t < 3.95) return 150;
  if (t < 4.35) return 150 * (1 - (t - 3.95) / 0.4);
  if (t >= 17.6 && t < 18.0) return 72 * (t - 17.6) / 0.4;
  if (t >= 18.0 && t < 19.15) return 72;
  if (t >= 19.15 && t < 19.5) return 72 * (1 - (t - 19.15) / 0.35);
  return 0;
}
const cycleLen = t => (t < 10 ? 160 : 108);
const TBL = { rain: [], dist: [], phase: [] };
(function buildTables() {
  let r = 0, d = 0, p = 0;
  for (let i = 0; i <= (DURATION + 1) * TBL_HZ; i++) {
    const t = i / TBL_HZ;
    TBL.rain.push(r); TBL.dist.push(d); TBL.phase.push(p);
    r += rainRate(t) / TBL_HZ;
    d += walkSpeed(t) / TBL_HZ;
    p += walkSpeed(t) / cycleLen(t) / TBL_HZ;
  }
})();
function tbl(name, t) {
  const a = TBL[name], f = clamp(t, 0, DURATION + 0.9) * TBL_HZ, i = Math.floor(f);
  return lerp(a[i], a[Math.min(i + 1, a.length - 1)], f - i);
}

// ---------------------------------------------------------------- character rig
const L = { thigh: 74, shin: 72, up: 60, fore: 56, torso: 108, neck: 12, head: 34 };

function ik(ax, ay, tx, ty, l1, l2, bend) {
  let dx = tx - ax, dy = ty - ay;
  let d = Math.hypot(dx, dy);
  const maxd = l1 + l2 - 0.5;
  if (d > maxd) { dx *= maxd / d; dy *= maxd / d; d = maxd; }
  d = Math.max(d, Math.abs(l1 - l2) + 1);
  const a = Math.atan2(dy, dx);
  const A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const ang = a + bend * A;
  return { jx: ax + Math.cos(ang) * l1, jy: ay + Math.sin(ang) * l1, ex: ax + dx, ey: ay + dy };
}

const BASE = {
  hy: 140, lean: 0.06, head: 0.08,
  fL: { x: -10, y: 0 }, fR: { x: 12, y: 0 },
  hL: { x: -6, y: 108 }, hR: { x: 22, y: 92 },
  eye: 0.85, lookX: 0.6, lookY: 0.1, brow: -0.25, mouth: -0.2, face: 0.75,
};
const P_CAUGHT = { ...BASE, hy: 134, lean: 0.2, head: -0.15, fL: { x: -40, y: 0 }, fR: { x: 32, y: 0 }, hL: { x: -20, y: 80 }, hR: { x: -6, y: 70 }, eye: 1, brow: -0.6, mouth: -0.3, lookY: -0.8 };
const P_PULL = { ...BASE, hy: 112, lean: 0.5, head: -0.05, fL: { x: -66, y: 0 }, fR: { x: 48, y: 0 }, hL: { x: -62, y: -64 }, hR: { x: -30, y: -88 }, eye: 0.45, brow: 0.85, mouth: -0.7, lookX: 0.8, lookY: -0.2 };
const P_REACH = { ...BASE, hy: 140, lean: 0.12, head: -0.05, fL: { x: -26, y: 0 }, fR: { x: 22, y: 0 }, hL: { x: -12, y: 100 }, hR: { x: 74, y: -6 }, eye: 1, brow: -0.7, mouth: -0.1, lookX: 1, lookY: 0 };
const P_LETDOWN = { ...BASE, hy: 138, lean: 0.12, head: 0.45, fL: { x: -14, y: 0 }, fR: { x: 16, y: 0 }, hL: { x: -4, y: 108 }, hR: { x: 14, y: 96 }, eye: 0.55, brow: -0.7, mouth: -0.5, lookX: 0.3, lookY: 0.6, face: 0.6 };
const P_KNEEL = { ...BASE, hy: 80, lean: 0.3, head: 0.42, fL: { x: -64, y: 0 }, fR: { x: 50, y: 0 }, hL: { x: 8, y: 104 }, hR: { x: 26, y: 94 }, eye: 0.45, brow: -0.65, mouth: -0.5, lookX: 0.2, lookY: 0.8, face: 0.5 };
const P_SLUMP = { ...BASE, hy: 64, lean: 0.62, head: 0.5, fL: { x: -58, y: 0 }, fR: { x: 42, y: 0 }, hL: { x: 10, y: 112 }, hR: { x: 30, y: 110 }, eye: 0, brow: -0.7, mouth: -0.55, lookX: 0, lookY: 1, face: 0.35 };
const P_LOOKUP = { ...P_SLUMP, lean: 0.4, head: -0.12, eye: 1, brow: -0.35, mouth: 0.05, lookX: 0.4, lookY: -0.6 };
const P_PALM = { ...P_LOOKUP, hR: { x: 64, y: 34 }, lookX: 0.8, lookY: 0.4, head: 0.12, brow: -0.15, mouth: 0.25 };
const P_HOLD = { ...BASE, hy: 140, lean: 0.04, head: 0.22, fL: { x: -14, y: 0 }, fR: { x: 14, y: 0 }, hL: { x: 22, y: 62 }, hR: { x: 32, y: 56 }, eye: 0.95, brow: 0.15, mouth: 0.05, lookX: 0.5, lookY: 0.7, face: 0.5 };
const P_HORIZON = { ...P_HOLD, head: -0.08, lookX: 1, lookY: -0.2, brow: 0.35, face: 0.7, mouth: 0.15 };
const P_THROW = { ...P_HORIZON, hR: { x: 72, y: -62 }, lean: -0.02, head: -0.2, lookY: -0.8 };
const P_OPEN = { ...BASE, hy: 142, lean: -0.1, head: -0.24, fL: { x: -18, y: 0 }, fR: { x: 18, y: 0 }, hL: { x: -50, y: -76 }, hR: { x: 62, y: -74 }, eye: 0, brow: 0, mouth: 0.9, lookX: 0.5, lookY: -1, face: 0.6 };

function walkPose(base, phase, stride, lift, swing) {
  const p = blend(base, base, 0);
  const foot = u => {
    u = mod(u, 1);
    if (u < 0.5) { const s = u / 0.5; return { x: stride / 2 - stride * s, y: 0 }; }
    const s = (u - 0.5) / 0.5;
    return { x: -stride / 2 + stride * E.sine(s), y: lift * Math.sin(Math.PI * s) };
  };
  p.fL = foot(phase);
  p.fR = foot(phase + 0.5);
  p.hy = base.hy - 6 * Math.abs(Math.cos(TAU * phase));
  const sw = Math.sin(TAU * phase);
  p.hL = { x: base.hL.x + sw * swing, y: base.hL.y - Math.abs(sw) * 6 };
  p.hR = { x: base.hR.x - sw * swing * 0.6, y: base.hR.y - Math.abs(sw) * 4 };
  p.lean = base.lean + 0.03 * Math.cos(TAU * phase * 2);
  p.head = base.head - 0.03 * Math.cos(TAU * phase * 2);
  return p;
}

const BLINKS = [1.25, 3.2, 6.1, 13.55, 16.25, 18.2];
function blinkAt(t) {
  let b = 1;
  for (const bt of BLINKS) { const u = (t - bt) / 0.16; if (u > 0 && u < 1) b = Math.min(b, Math.abs(u * 2 - 1)); }
  return b;
}

// pull strength while the threads drag him (4.33 – 6.65), in jerky steps
function pullAt(t) {
  const s1 = seg(t, 4.3, 4.55, E.outBack) * 0.45;
  const s2 = seg(t, 5.05, 5.3, E.outBack) * 0.3;
  const s3 = seg(t, 5.85, 6.1, E.outBack) * 0.25;
  return (s1 + s2 + s3) * (1 - seg(t, 6.62, 6.9, E.out));
}

function poseAt(t) {
  let P, x = -540 + tbl('dist', t), dir = 1;
  const phase = tbl('phase', t);
  const pull = pullAt(t);
  // persistent offset from being dragged back, then the stumble forward when released
  x += -40 * seg(t, 4.3, 6.4, E.sine) + 18 * seg(t, 6.65, 7.05, E.out);

  if (t < 4.33) {
    const walkBase = { ...BASE, lean: 0.14, head: 0.16, eye: 0.75, brow: -0.35, mouth: -0.3, lookY: 0.3 };
    P = walkPose(walkBase, phase, 80, 20, 26);
    P = blend(P, P_CAUGHT, seg(t, 3.98, 4.35, E.out));
  } else if (t < 6.65) {
    P = blend(P_CAUGHT, P_PULL, clamp(pull / 0.45));
    P.lean += noise(t * 22) * 0.025 * pull + 0.12 * Math.max(0, pull - 0.45);
    P.hL.y -= 30 * Math.max(0, pull - 0.45); P.hR.y -= 22 * Math.max(0, pull - 0.45);
    P.head += noise(t * 18 + 4) * 0.04;
  } else if (t < 8.58) {
    const rel = seg(t, 6.65, 7.0, E.outBack);
    P = blend(P_PULL, { ...BASE, lean: 0.25, head: 0.25, eye: 0.8, brow: -0.5 }, rel);
    P = blend(P, P_REACH, seg(t, 6.95, 7.35, E.out));
    P = blend(P, P_LETDOWN, seg(t, 8.15, 8.55, E.inOut));
    // turn to follow the passers-by
    dir = lerp(1, -1, seg(t, 7.85, 8.1, E.inOut));
    P.face = lerp(P.face, 0.35, 1 - Math.abs(dir));
  } else if (t < 11.0) {
    dir = -1;
    P = blend(P_LETDOWN, { ...P_LETDOWN, hy: 146, head: 0.3 }, seg(t, 8.58, 8.72, E.out));
    const fall = seg(t, 8.72, 9.2, E.in2);
    P = blend(P, P_KNEEL, fall);
    P.hy -= 7 * Math.sin(Math.PI * inv(9.2, 9.42, t)); // impact settle
    P.hR = { x: P.hR.x + 6 * seg(t, 9.88, 10.0), y: P.hR.y + 4 * seg(t, 9.88, 10.0) }; // fingers open
    P = blend(P, P_SLUMP, seg(t, 10.28, 10.95, E.inOut));
  } else if (t < 14.1) {
    dir = -1;
    P = blend(P_SLUMP, P_SLUMP, 0);
    const br = Math.sin((t - 11) * 2.6);
    P.lean += br * 0.02; P.head += br * 0.015;
    P = blend(P, P_LOOKUP, seg(t, 12.85, 13.3, E.out));
    P = blend(P, P_PALM, seg(t, 13.25, 13.65, E.inOut));
    P.hR.y += 9 * Math.sin(Math.PI * inv(13.72, 13.95, t)); // catch the spark
  } else if (t < 17.0) {
    dir = lerp(-1, 1, seg(t, 16.6, 16.95, E.inOut));
    P = blend(P_PALM, { ...P_PALM, lean: 0.6, hy: 58, head: 0.2 }, seg(t, 14.2, 14.5, E.inOut));
    P = blend(P, P_HOLD, seg(t, 14.5, 15.25, E.outBack));
    P = blend(P, P_HORIZON, seg(t, 16.3, 16.9, E.inOut));
    P.face = lerp(P.face, 0.3, 1 - Math.abs(dir));
  } else if (t < 19.3) {
    const wk = walkPose({ ...P_HORIZON, hR: { x: 36, y: 44 }, hL: { x: -4, y: 104 } }, phase, 54, 16, 18);
    P = blend(P_HORIZON, wk, seg(t, 17.55, 17.9) * (1 - seg(t, 19.15, 19.5)));
  } else {
    const wk = walkPose({ ...P_HORIZON, hR: { x: 36, y: 44 }, hL: { x: -4, y: 104 } }, phase, 54, 16, 18);
    P = blend(wk, P_HORIZON, seg(t, 19.15, 19.5));
    P = blend(P, P_THROW, seg(t, 19.3, 19.48, E.out));
    P = blend(P, P_OPEN, seg(t, 19.85, 20.5, E.outBack));
  }
  P.x = x; P.dir = dir;
  P.eye *= blinkAt(t);
  // breathing on everything
  P.hy += Math.sin(t * 2.2) * 1.2;
  return P;
}

function skeleton(P) {
  const X = P.x, Y = groundY(X) - P.hy, d = P.dir;
  const W_ = (lx, ly) => ({ x: X + d * lx, y: Y + ly });
  const sl = Math.sin(P.lean), cl = Math.cos(P.lean);
  const chest = { x: sl * L.torso, y: -cl * L.torso };
  const mid = { x: sl * L.torso * 0.5, y: -cl * L.torso * 0.5 };
  const sh = { x: sl * (L.torso - 10), y: -cl * (L.torso - 10) };
  const ha = P.lean + P.head;
  const headC = { x: chest.x + Math.sin(ha) * (L.neck + L.head), y: chest.y - Math.cos(ha) * (L.neck + L.head) };
  const neckTop = { x: chest.x + Math.sin(ha) * (L.neck + 4), y: chest.y - Math.cos(ha) * (L.neck + 4) };
  const leg = f => {
    const fy = groundY(X + d * f.x) - f.y - Y;
    const r = ik(0, 0, f.x, fy, L.thigh, L.shin, -1);
    return { hip: W_(0, 0), knee: W_(r.jx, r.jy), foot: W_(r.ex, r.ey) };
  };
  const arm = h => {
    const r = ik(sh.x, sh.y, sh.x + h.x, sh.y + h.y, L.up, L.fore, 1);
    return { sh: W_(sh.x, sh.y), el: W_(r.jx, r.jy), hand: W_(r.ex, r.ey) };
  };
  return {
    P, hip: W_(0, 0), mid: W_(mid.x, mid.y), chest: W_(chest.x, chest.y), neckTop: W_(neckTop.x, neckTop.y),
    headC: W_(headC.x, headC.y), headAng: ha * d,
    legL: leg(P.fL), legR: leg(P.fR), armL: arm(P.hL), armR: arm(P.hR),
  };
}

const skelCache = new Map();
function skelAt(t) {
  const k = Math.round(t * 1000);
  if (!skelCache.has(k)) { if (skelCache.size > 400) skelCache.clear(); skelCache.set(k, skeleton(poseAt(t))); }
  return skelCache.get(k);
}

// ---------------------------------------------------------------- props: lantern + spark
function lanternAt(t) {
  const REL = 9.88;
  if (t < REL) {
    const S = skelAt(t), S0 = skelAt(t - 1 / 30);
    const h = S.armR.hand, vx = (h.x - S0.armR.hand.x) * 30;
    let ang = clamp(-vx * 0.0028, -0.75, 0.75) + 0.1 * Math.sin(t * 3.4);
    if (t > 4.3 && t < 6.7) ang += 0.35 * Math.sin(t * 9.5) * pullAt(t) * 2;
    let inten = 1 + 0.08 * noise(t * 9);
    if (t > 4.3 && t < 6.7) inten += 0.25 * noise(t * 30);
    return { x: h.x, y: h.y + 4, ang, inten, held: true };
  }
  const S = skelAt(REL), h = S.armR.hand;
  const u = clamp((t - REL) / 0.26);
  const gy = groundY(h.x - 50) - 56;
  const tip = seg(t, REL + 0.22, REL + 0.55, E.outBack);
  const y = lerp(h.y + 4, gy, u * u) + 40 * tip;
  const x = h.x - 46 * E.out(u) - 10 * seg(t, REL + 0.25, REL + 0.6, E.out);
  let inten = lerp(1, 0.14, seg(t, REL + 0.25, 11.0, E.out)) * (1 + 0.35 * noise(t * 24) * (1 - seg(t, 10.6, 11.2)));
  inten *= 1 - 0.85 * seg(t, 12.3, 12.7); // the ember gives its last spark away
  return { x, y, ang: tip * 1.35, inten, held: false, ground: u >= 1 };
}
function lanternLight(lt) {
  const c = Math.cos(lt.ang), s = Math.sin(lt.ang);
  return { x: lt.x - s * 36, y: lt.y + c * 36 };
}

const SPARK_T0 = 12.35, SPARK_LAND = 13.75, SPARK_THROW = 19.36, SPARK_HIT = 19.95;
function sparkAt(t, cam) {
  if (t < SPARK_T0) return null;
  const palm = tt => { const h = skelAt(tt).armR.hand; return { x: h.x, y: h.y - 14 }; };
  let p;
  if (t < SPARK_LAND) {
    const start = lanternLight(lanternAt(SPARK_T0));
    const S = skelAt(13.1), hc = S.headC;
    const face = { x: hc.x - 46, y: hc.y + 6 };
    if (t < 13.15) {
      const u = E.sine(inv(SPARK_T0, 13.15, t));
      p = { x: lerp(start.x, face.x, u) + Math.sin(u * 7) * 26 * (1 - u), y: lerp(start.y, face.y, E.out(u)) - Math.sin(u * Math.PI) * 60 };
    } else if (t < 13.5) {
      const a = (t - 13.15) * 9;
      p = { x: face.x + Math.cos(a) * 9, y: face.y + Math.sin(a * 1.3) * 6 };
    } else {
      const u = E.inOut(inv(13.5, SPARK_LAND, t));
      const a = (13.5 - 13.15) * 9;
      const f0 = { x: face.x + Math.cos(a) * 9, y: face.y + Math.sin(a * 1.3) * 6 };
      const pl = palm(t);
      p = { x: lerp(f0.x, pl.x, u), y: lerp(f0.y, pl.y, u) - Math.sin(u * Math.PI) * 20 };
    }
  } else if (t < SPARK_THROW) {
    const pl = palm(t);
    p = { x: pl.x + Math.sin(t * 3) * 2, y: pl.y + Math.sin(t * 4.1) * 3 - 3 };
  } else {
    const pl = palm(SPARK_THROW);
    const sun = cam ? fromScreen(cam, 1, ...sunScreen(t, cam)) : pl;
    const u = E.in2(inv(SPARK_THROW, SPARK_HIT, t));
    if (u >= 1) return { x: sun.x, y: sun.y, gone: true };
    p = { x: lerp(pl.x, sun.x, u), y: lerp(pl.y, sun.y, u) - Math.sin(u * Math.PI) * 120 };
  }
  return p;
}
function sparkInten(t) {
  return seg(t, SPARK_T0, 12.6) * (0.55 + 0.25 * seg(t, 13.7, 14.0) + 0.35 * seg(t, 14.6, 15.8) - 0.2 * seg(t, 18.5, 19.3)) * (1 + 0.1 * noise(t * 11));
}

// ---------------------------------------------------------------- camera
const CUTS = [4.33, 6.65, 8.58, 11.0];
function camAt(t) {
  let c;
  const cx = poseAt(t).x;
  if (t < 4.33) {
    const k = seg(t, 0, 3.1, E.inOut);
    c = { x: lerp(-330, cx + 70, k), y: lerp(-1150, -330, k), z: lerp(0.86, 1.32, k), r: lerp(-0.035, 0, k) };
    c.z *= 1 + 0.1 * seg(t, 3.98, 4.33, E.outExpo);
  } else if (t < 6.65) {
    const k = seg(t, 4.33, 6.65, E.sine);
    c = { x: cx + 18, y: lerp(-258, -250, k), z: lerp(1.95, 2.3, k), r: lerp(-0.06, 0.04, k) };
  } else if (t < 8.58) {
    const k = seg(t, 6.65, 8.58, E.sine);
    c = { x: cx + lerp(30, -40, k), y: -345, z: lerp(1.0, 1.14, k), r: 0 };
  } else if (t < 11.0) {
    const k = seg(t, 8.58, 11.0, E.sine);
    c = { x: cx - 20, y: lerp(-245, -150, k), z: lerp(1.42, 1.85, k), r: lerp(0.03, -0.02, k) };
  } else if (t < 12.3) {
    const hc = skelAt(t).headC;
    const k = seg(t, 11.0, 12.3, E.sine);
    c = { x: hc.x - 6, y: hc.y + 28, z: lerp(3.3, 3.65, k), r: 0.02 };
  } else {
    // continuous move from here to the end
    const hc = skelAt(Math.min(t, 14.1)).headC;
    const fx = [[12.3, hc.x - 25], [13.2, hc.x - 30], [14.1, hc.x - 20], [16.0, cx + 120], [17.0, cx + 200], [19.3, cx + 260], [21.6, cx + 110]];
    const fy = [[12.3, hc.y + 50], [13.2, hc.y + 60], [14.1, hc.y + 60], [16.0, -620], [17.0, -640], [19.3, -560], [21.6, -290]];
    const fz = [[12.3, 2.7], [13.2, 2.45], [14.1, 2.35], [16.0, 0.52], [17.0, 0.5], [19.3, 0.62], [21.6, 1.22]];
    const fr = [[12.3, 0.02], [14.1, 0], [16.0, -0.015], [19.3, 0.0], [21.6, 0.01]];
    c = { x: track(fx, t), y: track(fy, t), z: track(fz, t), r: track(fr, t) };
  }
  // punch-in settle after each hard cut
  for (const ct of CUTS) if (t >= ct && t < ct + 0.5) c.z *= 1 + 0.06 * (1 - E.out(inv(ct, ct + 0.5, t)));
  // handheld + shake
  const sh = shakeAt(t);
  c.x += (noise(t * 0.7 + 3) * 4 + noise(t * 23) * sh) / c.z;
  c.y += (noise(t * 0.6 + 9) * 4 + noise(t * 21 + 50) * sh) / c.z;
  c.r += noise(t * 0.5 + 20) * 0.004 + noise(t * 17 + 70) * sh * 0.0009;
  return c;
}
function track(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1] = keys[i]; return lerp(v0, v1, E.inOut((t - t0) / (t1 - t0))); }
  }
  return keys[keys.length - 1][1];
}
function shakeAt(t) {
  const hit = (a, amp, dur) => (t >= a ? amp * Math.exp(-(t - a) / dur) : 0);
  return hit(4.3, 16, 0.18) + 9 * pullAt(t) + hit(5.07, 14, 0.15) + hit(5.87, 12, 0.15) + hit(9.2, 14, 0.15) + hit(10.03, 6, 0.12) + hit(19.95, 12, 0.3);
}

function layerZoom(cam, f) { return lerp(1, cam.z, f); }
function applyLayer(ctx, cam, f) {
  const zl = layerZoom(cam, f);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(W / 2, H / 2);
  ctx.rotate(cam.r * Math.min(1, f * 1.2));
  ctx.scale(zl, zl);
  ctx.translate(-cam.x * f, -cam.y * f);
  return zl;
}
function toScreen(cam, f, x, y) {
  const zl = layerZoom(cam, f), r = cam.r * Math.min(1, f * 1.2);
  const dx = (x - cam.x * f) * zl, dy = (y - cam.y * f) * zl, c = Math.cos(r), s = Math.sin(r);
  return [W / 2 + dx * c - dy * s, H / 2 + dx * s + dy * c];
}
function fromScreen(cam, f, sx, sy) {
  const zl = layerZoom(cam, f), r = -cam.r * Math.min(1, f * 1.2);
  const dx = sx - W / 2, dy = sy - H / 2, c = Math.cos(r), s = Math.sin(r);
  return { x: (dx * c - dy * s) / zl + cam.x * f, y: (dx * s + dy * c) / zl + cam.y * f };
}

// ---------------------------------------------------------------- palette
const C = {
  body: hex('#090b16'), bodyDawn: hex('#1a0e14'),
  moon: hex('#a9c1ff'), lantern: hex('#ffb04a'), spark: hex('#ffd27a'), sun: hex('#ffc070'),
  scarf: hex('#ef4a2f'), scarfHi: hex('#ffa23f'), scarfDull: hex('#6e3842'),
  thread: hex('#ff3157'),
  sky: {
    night: [hex('#03040c'), hex('#0b1331'), hex('#22305f')],
    dark: [hex('#010103'), hex('#030409'), hex('#080b19')],
    pre: [hex('#06091d'), hex('#1e1745'), hex('#8a3363')],
    dawn: [hex('#1a3a7a'), hex('#c25f7c'), hex('#ffbd6e')],
  },
};
function skyCols(env) {
  const s = C.sky;
  return [0, 1, 2].map(i => {
    let c = mix(s.night[i], s.dark[i], env.darkest);
    c = mix(c, s.pre[i], env.preDawn);
    return mix(c, s.dawn[i], env.dawn);
  });
}

// ---------------------------------------------------------------- static scenery (generated once)
const SCN = {};
function initScenery() {
  const R = rng(7);
  SCN.stars = Array.from({ length: 320 }, () => ({ x: R() * 2000 - 1000, y: R() * 1700 - 1500, r: 0.6 + R() * R() * 2.4, tw: R() * TAU, sp: 1 + R() * 3 }));
  const ridge = (seed, x0, x1, step, base, amp, sc) => {
    const pts = [];
    for (let x = x0; x <= x1; x += step) {
      const n = noise(x * sc + seed) * 0.6 + noise(x * sc * 2.3 + seed * 3) * 0.3 + noise(x * sc * 5.1 + seed * 7) * 0.1;
      pts.push([x, base - amp * (n * 0.5 + 0.5)]);
    }
    return pts;
  };
  SCN.far = ridge(11, -2600, 2600, 20, 70, 190, 0.0021);
  SCN.mtn = ridge(23, -2600, 2600, 16, 150, 170, 0.0032);
  SCN.hills = ridge(37, -3000, 3000, 14, 210, 80, 0.0024);
  SCN.pines = [];
  for (let x = -3000; x < 3000; x += 18 + R() * 40) {
    const i = Math.floor((x + 3000) / 14);
    const y = SCN.hills[clamp(i, 0, SCN.hills.length - 1)][1];
    if (R() < 0.75) SCN.pines.push({ x, y: y + 4, h: 30 + R() * 70, w: 0.28 + R() * 0.12 });
  }
  SCN.clouds = Array.from({ length: 9 }, (_, i) => ({ x: -1300 + i * 330 + R() * 160, y: -1250 + R() * 900, s: 0.7 + R() * 0.9, v: 6 + R() * 10, sprite: cloudSprite(rng(100 + i)) }));
  // one cloud bank that swallows the moon at the darkest moment
  SCN.moonCloud = { sprite: cloudSprite(rng(999), 1.4) };
  SCN.rain = Array.from({ length: 560 }, () => ({ x: R(), y: R(), f: 0.55 + R() * 1.0, l: 0.7 + R() * 0.6 }));
  SCN.grass = [];
  for (let x = -3200; x < 3200; x += 6 + R() * 7) SCN.grass.push({ x, h: 8 + R() * 22, a: (R() - 0.5) * 0.5, p: R() * TAU });
  SCN.fg = [];
  for (let x = -2000; x < 2000; x += 14 + R() * 20) SCN.fg.push({ x, h: 40 + R() * 110, a: (R() - 0.5) * 0.5, p: R() * TAU, w: 3 + R() * 4 });
  SCN.tree = buildTree(rng(5));
  SCN.birds = Array.from({ length: 7 }, (_, i) => ({ dx: i * 70 + R() * 40, dy: Math.abs(i - 3) * 38 + R() * 20, p: R() * TAU, s: 0.8 + R() * 0.4 }));
  SCN.ripples = Array.from({ length: 90 }, () => ({ x: R() * 1400 - 700, ph: R(), sp: 0.6 + R() * 0.8 }));
}

function cloudSprite(R, wide = 1) {
  const cw = Math.round(760 * wide), ch = 300;
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const x = cw * (0.12 + R() * 0.76), y = ch * (0.45 + (R() - 0.5) * 0.35), r = 40 + R() * 90 * (1 - Math.abs(x / cw - 0.5));
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  return cv;
}

function buildTree(R) {
  const br = [];
  const grow = (x, y, a, len, w, depth) => {
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    br.push({ x, y, x2, y2, w, depth });
    if (depth > 6 || len < 12) return;
    const n = depth < 2 ? 2 : 2 + (R() < 0.3 ? 1 : 0);
    for (let i = 0; i < n; i++) grow(x2, y2, a + (R() - 0.5) * 1.1 + (i - (n - 1) / 2) * 0.45, len * (0.68 + R() * 0.12), w * 0.66, depth + 1);
  };
  grow(0, 0, -Math.PI / 2 - 0.08, 120, 22, 0);
  return br;
}

// ---------------------------------------------------------------- drawing: background
function drawSky(ctx, cam, env, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const [top, mid, hor] = skyCols(env);
  const hy = toScreen(cam, 0.15, 0, 60)[1];
  const g = ctx.createLinearGradient(0, hy - 1500, 0, hy + 80);
  g.addColorStop(0, rgba(top)); g.addColorStop(0.62, rgba(mid)); g.addColorStop(1, rgba(hor));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // stars
  const sv = (1 - env.dawn) * (1 - 0.75 * env.darkest) * (1 - 0.5 * env.preDawn);
  if (sv > 0.01) {
    applyLayer(ctx, cam, 0.04);
    for (const s of SCN.stars) {
      const a = sv * (0.45 + 0.55 * Math.sin(t * s.sp + s.tw)) * (s.r > 1.8 ? 1 : 0.7);
      ctx.fillStyle = `rgba(220,230,255,${a})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
      if (s.r > 2.2) { ctx.fillStyle = `rgba(200,215,255,${a * 0.15})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 4, 0, TAU); ctx.fill(); }
    }
  }
}

function sunPos(t) { return { x: 110, y: lerp(150, -40, seg(t, 18.4, 21.6, E.out)) }; }
function sunScreen(t, cam) { const s = sunPos(t); return toScreen(cam, 0.07, s.x, s.y); }

function drawMoonSun(ctx, cam, env, t) {
  // moon
  if (env.moon > 0.01 && env.dawn < 0.99) {
    applyLayer(ctx, cam, 0.06);
    const mx = -250, my = -520, a = env.moon * (1 - env.dawn);
    const g = ctx.createRadialGradient(mx, my, 40, mx, my, 330);
    g.addColorStop(0, `rgba(170,195,255,${0.32 * a})`); g.addColorStop(1, 'rgba(170,195,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, 330, 0, TAU); ctx.fill();
    const d = ctx.createRadialGradient(mx - 20, my - 20, 10, mx, my, 62);
    d.addColorStop(0, `rgba(250,250,255,${a})`); d.addColorStop(1, `rgba(190,205,240,${a})`);
    ctx.fillStyle = d; ctx.beginPath(); ctx.arc(mx, my, 60, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(140,155,200,${0.25 * a})`;
    [[-18, -10, 12], [16, 14, 9], [5, -26, 6], [-6, 22, 7]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(mx + dx, my + dy, r, 0, TAU); ctx.fill(); });
  }
  // sun
  if (env.preDawn > 0.01) {
    applyLayer(ctx, cam, 0.07);
    const s = sunPos(t);
    const R = 900;
    const g = ctx.createRadialGradient(s.x, s.y, 10, s.x, s.y, R);
    g.addColorStop(0, `rgba(255,214,140,${0.85 * env.dawn + 0.25 * env.preDawn})`);
    g.addColorStop(0.25, `rgba(255,140,90,${0.35 * env.dawn + 0.18 * env.preDawn})`);
    g.addColorStop(1, 'rgba(255,120,90,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, R, 0, TAU); ctx.fill();
    if (env.dawn > 0) {
      ctx.fillStyle = `rgba(255,246,220,${env.dawn})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, 74, 0, TAU); ctx.fill();
    }
  }
}

function drawClouds(ctx, cam, env, t) {
  applyLayer(ctx, cam, 0.1);
  const base = mix(mix(hex('#141a36'), hex('#05060c'), env.darkest), hex('#5a3c6e'), env.preDawn);
  const col = mix(base, hex('#ff9d84'), env.dawn);
  const tmp = getTmp(800, 300);
  const drawOne = (spr, x, y, s, alpha, color) => {
    const g = tmp.getContext('2d');
    g.globalCompositeOperation = 'copy'; g.drawImage(spr, 0, 0);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = rgba(color); g.fillRect(0, 0, spr.width, spr.height);
    g.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha;
    ctx.drawImage(tmp, 0, 0, spr.width, spr.height, x - spr.width * s / 2, y - spr.height * s / 2, spr.width * s, spr.height * s);
    ctx.globalAlpha = 1;
  };
  for (const c of SCN.clouds) {
    const x = c.x + t * c.v * (0.6 + env.wind * 0.4);
    // near the moon the clouds get a cold silver rim
    const nearMoon = Math.exp(-Math.pow((x + 250) / 420, 2) - Math.pow((c.y + 520) / 380, 2)) * env.moon * (1 - env.dawn);
    drawOne(c.sprite, x, c.y, c.s, 0.9, mix(col, hex('#5a6fae'), nearMoon * 0.8));
  }
  // moon cloud bank
  const k = seg(t, 14.0, 15.8, E.inOut);
  if (k > 0 && env.dawn < 1) drawOne(SCN.moonCloud.sprite, lerp(-900, -260, k), -515, 1.3, 0.98 * (1 - env.preDawn * 0.6), mix(hex('#06070d'), col, env.preDawn));
}
const TMP = {};
function getTmp(w, h) {
  const key = w + 'x' + h;
  if (!TMP[key]) { TMP[key] = document.createElement('canvas'); TMP[key].width = Math.max(w, 1100); TMP[key].height = h; }
  return TMP[key];
}

function drawRidge(ctx, pts, color, bottom = 3000) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(pts[0][0], bottom);
  for (const p of pts) ctx.lineTo(p[0], p[1]);
  ctx.lineTo(pts[pts.length - 1][0], bottom); ctx.closePath(); ctx.fill();
}

function drawLand(ctx, cam, env, t) {
  const [, mid, hor] = skyCols(env);
  // far range
  applyLayer(ctx, cam, 0.15);
  drawRidge(ctx, SCN.far, rgba(mix(hor, mid, 0.55)));
  // mountains with a cold/warm rim on the ridge
  applyLayer(ctx, cam, 0.3);
  drawRidge(ctx, SCN.mtn, rgba(mix(mix(mid, hex('#05060d'), 0.55), hex('#2a1830'), env.dawn * 0.6)));
  ctx.strokeStyle = rgba(mix(hex('#4c5f9c'), hex('#ffb07a'), env.dawn), 0.25 * (1 - env.darkest * 0.8) + 0.3 * env.dawn);
  ctx.lineWidth = 2; ctx.beginPath(); SCN.mtn.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
  // fog bank
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const fy = toScreen(cam, 0.4, 0, 170)[1];
  const fg = ctx.createLinearGradient(0, fy - 160, 0, fy + 120);
  const fc = mix(mix(hex('#3a4a7c'), hex('#0b0d18'), env.darkest), hex('#ff9e8a'), env.dawn);
  fg.addColorStop(0, rgba(fc, 0)); fg.addColorStop(0.6, rgba(fc, 0.28)); fg.addColorStop(1, rgba(fc, 0));
  ctx.fillStyle = fg; ctx.fillRect(0, fy - 160, W, 280);
  // hills with pines
  applyLayer(ctx, cam, 0.55);
  const hc = rgba(mix(mix(hex('#0b0e1d'), hex('#030308'), env.darkest), hex('#2a1626'), env.dawn));
  drawRidge(ctx, SCN.hills, hc);
  ctx.fillStyle = hc;
  for (const p of SCN.pines) {
    const sway = Math.sin(t * 1.4 + p.x) * 2 * env.wind;
    ctx.beginPath(); ctx.moveTo(p.x - p.h * p.w, p.y); ctx.lineTo(p.x + sway, p.y - p.h); ctx.lineTo(p.x + p.h * p.w, p.y); ctx.closePath(); ctx.fill();
  }
}

function drawGround(ctx, cam, env, t, light) {
  const zl = applyLayer(ctx, cam, 1);
  const vx0 = cam.x - W / 2 / zl - 400, vx1 = cam.x + W / 2 / zl + 400;
  const gc = mix(mix(hex('#06070f'), hex('#020204'), env.darkest), hex('#120a0f'), env.dawn);
  // tree on the left of the hill
  drawTree(ctx, -700, groundY(-700) + 6, t, env, gc);
  ctx.fillStyle = rgba(gc);
  ctx.beginPath(); ctx.moveTo(vx0, 4000);
  for (let x = vx0; x <= vx1; x += 12) ctx.lineTo(x, groundY(x));
  ctx.lineTo(vx1, 4000); ctx.closePath(); ctx.fill();
  // ridge rim light
  const rimC = mix(hex('#6d86d0'), hex('#ffb67a'), env.dawn);
  ctx.strokeStyle = rgba(rimC, 0.35 * (1 - env.darkest * 0.85) + 0.35 * env.dawn);
  ctx.lineWidth = 2.2 / zl;
  ctx.beginPath();
  for (let x = vx0; x <= vx1; x += 12) (x === vx0 ? ctx.moveTo(x, groundY(x)) : ctx.lineTo(x, groundY(x)));
  ctx.stroke();
  // grass blades along the ridge
  ctx.strokeStyle = rgba(gc); ctx.lineCap = 'round'; ctx.lineWidth = 2.2;
  for (const b of SCN.grass) {
    if (b.x < vx0 || b.x > vx1) continue;
    const y = groundY(b.x) + 2;
    const sway = b.a - 0.25 * env.wind + Math.sin(t * 3 + b.p + b.x * 0.02) * 0.18 * env.wind;
    ctx.beginPath(); ctx.moveTo(b.x, y);
    ctx.quadraticCurveTo(b.x + Math.sin(sway) * b.h * 0.5, y - b.h * 0.6, b.x + Math.sin(sway) * b.h, y - b.h * Math.cos(sway));
    ctx.stroke();
  }
  // rain ripples on wet ground
  if (env.rain > 0.02) {
    const rt = tbl('rain', t);
    ctx.lineWidth = 1.4 / zl;
    for (const r of SCN.ripples) {
      const x = cam.x + r.x;
      const u = mod(rt * r.sp * 2.2 + r.ph, 1);
      const y = groundY(x) + 6;
      ctx.strokeStyle = rgba(mix(hex('#8ea4e8'), hex('#ffc27a'), light.warmAt(x, y)), (1 - u) * 0.35 * env.rain);
      ctx.beginPath(); ctx.ellipse(x, y, 4 + u * 22, 1 + u * 4, 0, 0, TAU); ctx.stroke();
    }
  }
}

function drawTree(ctx, x, y, t, env, gc) {
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = rgba(gc); ctx.lineCap = 'round';
  for (const b of SCN.tree) {
    const sw = Math.sin(t * 1.3 + b.depth) * 0.012 * b.depth * env.wind;
    ctx.lineWidth = b.w;
    ctx.beginPath(); ctx.moveTo(b.x + b.y * sw, b.y); ctx.lineTo(b.x2 + b.y2 * sw * 1.2, b.y2); ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- drawing: character
function figureShapes(S, side) {
  const d = S.P.dir;
  const legShapes = lg => [
    { a: lg.hip, b: lg.knee, w: 20 }, { a: lg.knee, b: lg.foot, w: 16.5 },
    { a: lg.foot, b: { x: lg.foot.x + d * 15, y: lg.foot.y + 2 }, w: 13 },
  ];
  const armShapes = am => [{ a: am.sh, b: am.el, w: 15 }, { a: am.el, b: am.hand, w: 13 }, { c: am.hand, r: 8.5 }];
  if (side === 'far') return [...legShapes(S.legL), ...armShapes(S.armL)];
  if (side === 'near') return [...legShapes(S.legR), ...armShapes(S.armR)];
  return [
    { a: S.hip, b: S.mid, w: 24 }, { a: S.mid, b: S.chest, w: 29 },
    { a: S.chest, b: S.neckTop, w: 12 }, { c: S.headC, r: L.head },
  ];
}
function paintShapes(ctx, shapes, color, ox = 0, oy = 0, grow = 0) {
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineCap = 'round';
  for (const s of shapes) {
    if (s.c) { ctx.beginPath(); ctx.arc(s.c.x + ox, s.c.y + oy, s.r + grow / 2, 0, TAU); ctx.fill(); }
    else { ctx.lineWidth = s.w + grow; ctx.beginPath(); ctx.moveTo(s.a.x + ox, s.a.y + oy); ctx.lineTo(s.b.x + ox, s.b.y + oy); ctx.stroke(); }
  }
}

function drawScarf(ctx, S, t, env, wind) {
  const d = S.P.dir, N = 15, segL = 11.5;
  const root = { x: lerp(S.chest.x, S.neckTop.x, 0.3) - d * 4, y: lerp(S.chest.y, S.neckTop.y, 0.3) };
  const pts = [root];
  const strength = clamp(wind);
  let ang;
  for (let i = 1; i <= N; i++) {
    const k = i / N;
    const hang = Math.PI / 2 + 0.55 + 0.25 * k;
    const fly = Math.PI + 0.12 + 0.1 * k;
    ang = lerp(hang, fly, strength) + Math.sin(t * (6 + 4 * strength) - i * 0.55) * (0.08 + 0.32 * strength) * (0.3 + k);
    // facing-space angle → world (mirror for dir)
    const ax = Math.cos(ang) * d, ay = Math.sin(ang);
    const p = pts[i - 1];
    pts.push({ x: p.x + ax * segL, y: p.y + ay * segL });
  }
  const left = [], right = [];
  for (let i = 0; i <= N; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N, i + 1)];
    let nx = -(b.y - a.y), ny = b.x - a.x; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    const w = lerp(8, 3.2, i / N) * (1 + 0.15 * Math.sin(t * 9 - i));
    left.push({ x: pts[i].x + nx * w, y: pts[i].y + ny * w }); right.push({ x: pts[i].x - nx * w, y: pts[i].y - ny * w });
  }
  const col = mix(C.scarf, C.scarfDull, env.despair * 0.7);
  const g = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[N].x, pts[N].y);
  g.addColorStop(0, rgba(mix(col, hex('#000000'), 0.25))); g.addColorStop(1, rgba(mix(col, C.scarfHi, 0.5 * (1 - env.despair))));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(left[0].x, left[0].y);
  for (const p of left) ctx.lineTo(p.x, p.y);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath(); ctx.fill();
  // fringe at the tip
  ctx.strokeStyle = rgba(col); ctx.lineWidth = 1.6;
  const tip = pts[N], tdx = (tip.x - pts[N - 1].x) / segL, tdy = (tip.y - pts[N - 1].y) / segL;
  for (let j = -1; j <= 1; j++) {
    ctx.beginPath(); ctx.moveTo(tip.x - tdy * j * 2.5, tip.y + tdx * j * 2.5);
    ctx.lineTo(tip.x + tdx * 9 - tdy * j * 3.5, tip.y + tdy * 9 + tdx * j * 3.5); ctx.stroke();
  }
  return col;
}

function drawFace(ctx, S, rim) {
  const P = S.P, d = P.dir, hc = S.headC;
  const face = P.face;
  const tilt = S.headAng * 0.4;
  ctx.save(); ctx.translate(hc.x, hc.y); ctx.rotate(tilt);
  const cx = d * face * 14 + d * P.lookX * 2.5, cy = -2 + P.lookY * 2.5;
  const sp = 13.5 * (1 - 0.5 * face);
  const eyes = [
    { x: cx + d * sp * 0.5, s: 1, inner: -d },
    { x: cx - d * sp * 0.5, s: 1 - 0.3 * face, inner: d },
  ];
  const open = clamp(P.eye);
  const eyeCol = '#f7f3ea';
  for (const e of eyes) {
    const rx = 5.6 * e.s, ry = 8 * e.s;
    if (open < 0.12) {
      ctx.strokeStyle = eyeCol; ctx.lineWidth = 2.1; ctx.lineCap = 'round';
      ctx.beginPath();
      if (P.mouth > 0.3) ctx.arc(e.x, cy + 3, rx, Math.PI * 1.2, Math.PI * 1.8); // happy ^
      else { ctx.moveTo(e.x - rx, cy + 1 - e.inner * d * 1.5); ctx.quadraticCurveTo(e.x, cy + 3.5, e.x + rx, cy + 1 + e.inner * d * 1.5); } // closed, heavy lids
      ctx.stroke();
      continue;
    }
    ctx.save();
    // eyelid: half-plane below a slanted line
    const lidY = cy - ry + (1 - open) * ry * 1.7;
    const slope = P.brow * 0.5 * e.inner;
    ctx.beginPath();
    ctx.moveTo(e.x - 20, lidY - slope * 20); ctx.lineTo(e.x + 20, lidY + slope * 20);
    ctx.lineTo(e.x + 20, cy + 30); ctx.lineTo(e.x - 20, cy + 30); ctx.closePath(); ctx.clip();
    ctx.shadowColor = rgba(rim, 0.8); ctx.shadowBlur = 6;
    ctx.fillStyle = eyeCol; ctx.beginPath(); ctx.ellipse(e.x, cy, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0a0c16';
    ctx.beginPath(); ctx.arc(e.x + d * P.lookX * 1.8 + d * face * 1.2, cy + P.lookY * 2.6 + 1, 2.5 * e.s, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // mouth
  if (Math.abs(P.mouth) > 0.08) {
    const mx = d * face * 12, my = 15, mw = 7 * (1 - 0.35 * face);
    ctx.strokeStyle = 'rgba(247,243,234,0.65)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(mx - mw, my); ctx.quadraticCurveTo(mx, my + P.mouth * 6, mx + mw, my); ctx.stroke();
  }
  ctx.restore();
}

function lightingFor(S, t, env, lights) {
  // returns rim direction (unit, from body toward light), colour and strength
  let dx = 0, dy = 0, wsum = 0, col = [0, 0, 0];
  const add = (vx, vy, w, c) => {
    if (w <= 0.001) return;
    const l = Math.hypot(vx, vy) || 1;
    dx += vx / l * w; dy += vy / l * w; wsum += w;
    col = [col[0] + c[0] * w, col[1] + c[1] * w, col[2] + c[2] * w];
  };
  add(-0.55, -0.85, 0.7 * env.moon * (1 - env.darkest * 0.9) * (1 - env.dawn) + 0.05, C.moon);
  for (const l of lights) {
    const vx = l.x - S.chest.x, vy = l.y - S.chest.y;
    add(vx, vy, l.i * Math.exp(-Math.hypot(vx, vy) / l.r) * 2.2, l.c);
  }
  add(1, -0.25, 1.6 * env.dawn + 0.3 * env.preDawn, C.sun);
  const l = Math.hypot(dx, dy) || 1;
  return { dx: dx / l, dy: dy / l, col: wsum ? col.map(v => v / wsum) : C.moon, k: clamp(wsum) };
}

function drawCharacter(ctx, cam, S, t, env, lights, lantern) {
  const lit = lightingFor(S, t, env, lights);
  const body = rgba(mix(C.body, C.bodyDawn, env.dawn));
  const rimCol = mix(lit.col, hex('#ffffff'), 0.25);
  const rw = clamp(4.2 / cam.z, 1.3, 4.5);
  const ox = -lit.dx * rw, oy = -lit.dy * rw;
  const far = figureShapes(S, 'far'), core = figureShapes(S, 'core'), near = figureShapes(S, 'near');
  // soft outer glow for the whole silhouette
  ctx.save();
  ctx.shadowColor = rgba(rimCol, 0.55 * lit.k); ctx.shadowBlur = 26;
  paintShapes(ctx, [...far, ...core, ...near], body);
  ctx.restore();
  const group = sh => { paintShapes(ctx, sh, rgba(rimCol, 0.35 + 0.65 * lit.k)); paintShapes(ctx, sh, body, ox, oy, -0.5); };
  group(far);
  const scarfCol = drawScarf(ctx, S, t, env, t > 9 && t < 16.5 ? Math.max(0.42, env.wind * 0.6) : env.wind);
  group(core);
  // scarf knot over the neck
  ctx.strokeStyle = rgba(mix(scarfCol, hex('#000000'), 0.15)); ctx.lineWidth = 10; ctx.lineCap = 'round';
  const nk = { x: lerp(S.chest.x, S.neckTop.x, 0.35), y: lerp(S.chest.y, S.neckTop.y, 0.35) };
  ctx.beginPath(); ctx.moveTo(nk.x - 9 * S.P.dir, nk.y + 2); ctx.lineTo(nk.x + 8 * S.P.dir, nk.y - 1); ctx.stroke();
  drawFace(ctx, S, rimCol);
  if (lantern && lantern.held) drawLantern(ctx, lantern, body);
  group(near);
  return lit;
}

function drawLantern(ctx, lt, body) {
  ctx.save(); ctx.translate(lt.x, lt.y); ctx.rotate(lt.ang);
  const k = clamp(lt.inten, 0, 1.3);
  ctx.strokeStyle = body; ctx.fillStyle = body; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 9); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 15, 6, Math.PI, 0); ctx.stroke();
  roundRect(ctx, -13, 14, 26, 7, 3); ctx.fill();
  const g = ctx.createRadialGradient(0, 36, 1, 0, 36, 20);
  g.addColorStop(0, `rgba(255,246,214,${0.15 + 0.85 * clamp(k)})`);
  g.addColorStop(0.45, `rgba(255,170,70,${0.1 + 0.85 * clamp(k)})`);
  g.addColorStop(1, `rgba(110,45,20,${0.5 + 0.3 * clamp(k)})`);
  ctx.fillStyle = g; roundRect(ctx, -11, 21, 22, 30, 4); ctx.fill();
  ctx.strokeStyle = body; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-5, 21); ctx.lineTo(-5, 51); ctx.moveTo(5, 21); ctx.lineTo(5, 51); ctx.stroke();
  ctx.fillStyle = body; roundRect(ctx, -14, 50, 28, 7, 3); ctx.fill();
  ctx.restore();
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// passers-by under umbrellas who never stop
const GHOSTS = [{ t0: 6.45, dy: -16, s: 0.92 }, { t0: 6.7, dy: -6, s: 0.97 }, { t0: 6.95, dy: -22, s: 0.9 }];
function drawGhosts(ctx, cam, t, env) {
  if (t < 6.5 || t > 9.2) return;
  const cx0 = poseAt(6.65).x;
  const g = getLayerCanvas('ghost');
  const gc = g.getContext('2d');
  GHOSTS.forEach((gh, i) => {
    const u = t - gh.t0;
    if (u < 0) return;
    const x = cx0 + 600 - 430 * u;
    const P = walkPose({ ...BASE, lean: 0.08, head: 0.18, hR: { x: 10, y: 40 }, hL: { x: -4, y: 104 } }, u * 430 / 144, 72, 18, 22);
    P.x = x; P.dir = -1;
    const S = skeleton(P);
    gc.setTransform(1, 0, 0, 1, 0, 0); gc.clearRect(0, 0, W, H);
    applyLayer(gc, cam, 1);
    gc.translate(x, groundY(x)); gc.scale(gh.s, gh.s); gc.translate(-x, -groundY(x) + gh.dy);
    const col = 'rgb(150,168,215)';
    paintShapes(gc, [...figureShapes(S, 'far'), ...figureShapes(S, 'core'), ...figureShapes(S, 'near')], col);
    // umbrella
    const h = S.armR.hand;
    gc.strokeStyle = col; gc.lineWidth = 4;
    gc.beginPath(); gc.moveTo(h.x, h.y + 6); gc.lineTo(h.x + 4, h.y - 120); gc.stroke();
    gc.fillStyle = col; gc.beginPath(); gc.ellipse(h.x + 4, h.y - 120, 78, 46, 0.05, Math.PI, TAU); gc.closePath(); gc.fill();
    const a = 0.3 * seg(t, gh.t0, gh.t0 + 0.4) * (1 - seg(t, 8.15, 8.58));
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = a; ctx.drawImage(g, 0, 0); ctx.restore();
  });
}
const LAYERS = {};
function getLayerCanvas(name) {
  if (!LAYERS[name]) { LAYERS[name] = document.createElement('canvas'); LAYERS[name].width = W; LAYERS[name].height = H; }
  return LAYERS[name];
}

// red threads from the darkness above
function drawThreads(ctx, cam, S, t) {
  if (t < 3.95 || t > 8.0) return;
  const zl = applyLayer(ctx, cam, 1);
  const pts = [
    { at: S.armL.hand, ax: -260, d: 0 }, { at: S.armR.hand, ax: 120, d: 0.06 },
    { at: S.neckTop, ax: -60, d: 0.1 }, { at: S.mid, ax: -340, d: 0.14 },
  ];
  const fade = 1 - seg(t, 6.75, 7.35);
  const slack = seg(t, 6.62, 7.2, E.out);
  const pull = pullAt(t);
  ctx.save();
  ctx.lineCap = 'round';
  pts.forEach((p, i) => {
    const drop = E.outExpo(inv(3.98 + p.d, 4.32 + p.d, t));
    if (drop <= 0) return;
    const top = { x: S.hip.x + p.ax - 90 * pull, y: cam.y - 1300 / zl };
    const end = { x: lerp(top.x, p.at.x, drop), y: lerp(top.y, p.at.y, drop) };
    const mx = (top.x + end.x) / 2, my = (top.y + end.y) / 2;
    const len = Math.hypot(end.x - top.x, end.y - top.y) || 1;
    const nx = -(end.y - top.y) / len, ny = (end.x - top.x) / len;
    const vib = Math.sin(t * 75 + i * 2) * (1.5 + 3 * pull) * (1 - slack);
    const sag = slack * 160 + (1 - drop) * 0;
    const qx = mx + nx * vib + sag * 0.3, qy = my + ny * vib + sag;
    ctx.shadowColor = 'rgba(255,40,80,0.9)'; ctx.shadowBlur = 14;
    ctx.strokeStyle = rgba(C.thread, 0.9 * fade); ctx.lineWidth = 2.6 / zl;
    ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.quadraticCurveTo(qx, qy, end.x, end.y); ctx.stroke();
    // attach knot + flash
    if (drop > 0.98) {
      const fl = 1 - inv(4.3 + p.d, 4.6 + p.d, t);
      ctx.fillStyle = rgba(hex('#ff8fa3'), fade);
      ctx.beginPath(); ctx.arc(end.x, end.y, 4 / zl * 2, 0, TAU); ctx.fill();
      if (fl > 0) {
        ctx.strokeStyle = rgba(hex('#ff5a7a'), fl * fade); ctx.lineWidth = 2 / zl;
        ctx.beginPath(); ctx.arc(end.x, end.y, (1 - fl) * 40 + 6, 0, TAU); ctx.stroke();
      }
    }
  });
  ctx.restore();
}

// ---------------------------------------------------------------- lights, spark, rain, fx
function buildLights(t, cam) {
  const lights = [];
  const lt = lanternAt(t);
  const ll = lanternLight(lt);
  if (lt.inten > 0.02) lights.push({ x: ll.x, y: ll.y, r: 340, i: lt.inten, c: C.lantern });
  const sp = sparkAt(t, cam);
  const si = sparkInten(t);
  if (sp && !sp.gone && si > 0.01) lights.push({ x: sp.x, y: sp.y, r: 300, i: si, c: C.spark });
  return {
    list: lights, lantern: lt, spark: sp, sparkI: si,
    warmAt(x, y) { let w = 0; for (const l of lights) w += l.i * Math.exp(-Math.hypot(x - l.x, y - l.y) / l.r); return clamp(w); },
  };
}

function drawGlows(ctx, cam, light, t, env) {
  const zl = applyLayer(ctx, cam, 1);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const l of light.list) {
    const R = l.r * 1.2;
    const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, R);
    g.addColorStop(0, rgba(l.c, 0.42 * l.i)); g.addColorStop(0.25, rgba(l.c, 0.16 * l.i)); g.addColorStop(1, rgba(l.c, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(l.x, l.y, R, 0, TAU); ctx.fill();
    // warm pool on the ground
    const gy = groundY(l.x);
    if (gy - l.y < 260) {
      const k = (1 - (gy - l.y) / 260) * l.i;
      const pg = ctx.createRadialGradient(l.x, gy, 0, l.x, gy, 220);
      pg.addColorStop(0, rgba(l.c, 0.3 * k)); pg.addColorStop(1, rgba(l.c, 0));
      ctx.save(); ctx.translate(l.x, gy); ctx.scale(1, 0.22); ctx.translate(-l.x, -gy);
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(l.x, gy, 220, 0, TAU); ctx.fill(); ctx.restore();
    }
  }
  ctx.restore();
}

function drawSpark(ctx, cam, light, t) {
  if (!light.spark || t < SPARK_T0) return;
  applyLayer(ctx, cam, 1);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const zl = cam.z;
  // trail
  for (let k = 14; k >= 1; k--) {
    const tt = t - k * 0.022;
    if (tt < SPARK_T0) continue;
    const p = sparkAt(tt, camAt(tt));
    if (!p || p.gone) continue;
    const a = (1 - k / 15) * 0.4 * light.sparkI;
    ctx.fillStyle = rgba(C.spark, a);
    ctx.beginPath(); ctx.arc(p.x, p.y, (3.2 - k * 0.15) / Math.sqrt(zl) * 1.6, 0, TAU); ctx.fill();
  }
  const p = light.spark;
  if (!p.gone) {
    const r = 70 / Math.sqrt(zl);
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    g.addColorStop(0, `rgba(255,255,240,${light.sparkI})`); g.addColorStop(0.15, rgba(C.spark, 0.7 * light.sparkI)); g.addColorStop(1, rgba(C.spark, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    // little star cross
    ctx.strokeStyle = `rgba(255,240,200,${0.5 * light.sparkI})`; ctx.lineWidth = 1.4 / zl;
    const sl = (18 + 6 * Math.sin(t * 7)) / Math.sqrt(zl);
    ctx.beginPath(); ctx.moveTo(p.x - sl, p.y); ctx.lineTo(p.x + sl, p.y); ctx.moveTo(p.x, p.y - sl); ctx.lineTo(p.x, p.y + sl); ctx.stroke();
  }
  ctx.restore();
}

function drawDroppedLantern(ctx, cam, light, env) {
  const lt = light.lantern;
  if (lt.held) return;
  applyLayer(ctx, cam, 1);
  drawLantern(ctx, lt, rgba(mix(C.body, C.bodyDawn, env.dawn)));
}

function drawRain(ctx, cam, t, env, light) {
  if (env.rain < 0.01) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const rt = tbl('rain', t);
  const rate = rainRate(t);
  const pad = 200, Wr = W + pad * 2, Hr = H + pad * 2;
  const vx = -380 * env.wind, vy = 2300;
  ctx.lineCap = 'round';
  const lightPts = light.list.map(l => ({ s: toScreen(cam, 1, l.x, l.y), r: l.r * cam.z, i: l.i, c: l.c }));
  for (const d of SCN.rain) {
    const sx = mod(d.x * Wr + vx * rt * d.f * 0.45 - cam.x * cam.z * d.f * 0.6, Wr) - pad;
    const sy = mod(d.y * Hr + vy * rt * d.f * 0.45 - cam.y * cam.z * d.f * 0.6, Hr) - pad;
    let warm = 0, wc = C.lantern;
    for (const l of lightPts) { const w = l.i * Math.exp(-Math.pow(Math.hypot(sx - l.s[0], sy - l.s[1]) / (l.r * 0.9), 2)); if (w > warm) { warm = w; wc = l.c; } }
    const len = Math.max(2.5, 0.022 * rate * Math.hypot(vx, vy) * d.f * d.l);
    const nx = vx / Math.hypot(vx, vy), ny = vy / Math.hypot(vx, vy);
    const a = (0.12 + 0.2 * d.f) * env.rain * (1 - env.darkest * 0.5) + warm * 0.7 * env.rain;
    ctx.strokeStyle = rgba(mix(hex('#a9bce8'), wc, clamp(warm * 1.5)), a);
    ctx.lineWidth = d.f * (rate < 0.2 ? 2.4 : 1.4);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - nx * len, sy - ny * len); ctx.stroke();
  }
}

function drawForeground(ctx, cam, t, env) {
  // dark grass very close to the lens; only in the wider shots
  const show = (t < 4.33 ? 1 : 0) + (t >= 6.65 && t < 8.58 ? 1 : 0);
  if (!show) return;
  const zl = applyLayer(ctx, cam, 1.25);
  const gc = rgba(mix(hex('#020306'), hex('#0a0507'), env.dawn));
  ctx.strokeStyle = gc; ctx.lineCap = 'round';
  const yb = cam.y * 1.25 + (H / 2) / zl + 30;
  for (const b of SCN.fg) {
    const sway = b.a - 0.3 * env.wind + Math.sin(t * 2.4 + b.p) * 0.15;
    ctx.lineWidth = b.w;
    ctx.beginPath(); ctx.moveTo(b.x, yb); ctx.quadraticCurveTo(b.x + Math.sin(sway) * b.h * 0.5, yb - b.h * 0.6, b.x + Math.sin(sway) * b.h, yb - b.h * Math.cos(sway)); ctx.stroke();
  }
}

function drawDust(ctx, cam, t, S) {
  // puffs when he drops to his knees and when the lantern hits the ground
  const puffs = [];
  if (t > 9.18 && t < 10.2) puffs.push({ t0: 9.18, x: S.legL.knee.x, n: 9, s: 1 });
  const lt = lanternAt(10.2);
  if (t > 10.13 && t < 11.0) puffs.push({ t0: 10.13, x: lt.x, n: 7, s: 0.7 });
  if (t > 4.3 && t < 6.7) puffs.push({ t0: 4.3, x: S.legR.foot.x, n: 6, s: 0.6 }, { t0: 5.07, x: S.legL.foot.x, n: 6, s: 0.6 });
  if (!puffs.length) return;
  applyLayer(ctx, cam, 1);
  for (const p of puffs) {
    const u = (t - p.t0) / 0.8;
    if (u < 0 || u > 1) continue;
    const R = rng(Math.floor(p.t0 * 100));
    for (let i = 0; i < p.n; i++) {
      const a = Math.PI + R() * Math.PI, sp = (40 + R() * 70) * p.s;
      const x = p.x + Math.cos(a) * sp * E.out(u) * 1.4, y = groundY(p.x) + Math.sin(a) * sp * E.out(u) * 0.5 - 4;
      ctx.fillStyle = `rgba(130,145,190,${0.28 * (1 - u)})`;
      ctx.beginPath(); ctx.arc(x, y, (4 + R() * 6) * (0.6 + u) * p.s, 0, TAU); ctx.fill();
    }
  }
}

function drawTear(ctx, cam, S, t) {
  if (t < 11.15 || t > 12.35) return;
  applyLayer(ctx, cam, 1);
  const hc = S.headC, d = S.P.dir;
  const ex = hc.x + d * S.P.face * 14 + d * 6.7 * (1 - 0.5 * S.P.face);
  let y, x = ex;
  if (t < 11.85) { const u = E.inOut(inv(11.15, 11.85, t)); y = hc.y + 6 + u * 26; x = ex + u * 2 * d; }
  else { const u = inv(11.85, 12.35, t); y = hc.y + 32 + 260 * u * u; x = ex + 2 * d; }
  const a = seg(t, 11.15, 11.3) * (1 - seg(t, 12.2, 12.35));
  ctx.save();
  ctx.shadowColor = 'rgba(170,200,255,0.9)'; ctx.shadowBlur = 8;
  ctx.fillStyle = `rgba(215,232,255,${0.95 * a})`;
  ctx.beginPath(); ctx.moveTo(x, y - 5.5); ctx.quadraticCurveTo(x + 3.2, y, x, y + 3); ctx.quadraticCurveTo(x - 3.2, y, x, y - 5.5); ctx.fill();
  ctx.restore();
}

function drawClockRing(ctx, cam, t, env) {
  const a = seg(t, 16.95, 17.35) * (1 - seg(t, 19.3, 19.9));
  if (a <= 0) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const [sx, sy] = toScreen(cam, 0.07, sunPos(t).x, 70);
  const burst = seg(t, 19.25, 19.9, E.out);
  const R = 250 * (0.85 + 0.15 * seg(t, 16.95, 17.5, E.outBack)) + 500 * burst;
  const p = E.sine(inv(17.0, 19.25, t));
  const col = mix(hex('#c79cff'), hex('#ffd38a'), p);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.shadowColor = rgba(col, 0.8); ctx.shadowBlur = 16;
  // ticks
  for (let i = 0; i < 60; i++) {
    const ang = -Math.PI / 2 + i / 60 * TAU;
    const big = i % 5 === 0;
    const passed = i / 60 <= p;
    ctx.strokeStyle = rgba(col, passed ? 0.95 : 0.25);
    ctx.lineWidth = big ? 3 : 1.6;
    const r0 = R - (big ? 18 : 9);
    ctx.beginPath(); ctx.moveTo(sx + Math.cos(ang) * r0, sy + Math.sin(ang) * r0); ctx.lineTo(sx + Math.cos(ang) * R, sy + Math.sin(ang) * R); ctx.stroke();
  }
  // progress arc + sweeping hand
  ctx.strokeStyle = rgba(col, 0.9); ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.arc(sx, sy, R + 14, -Math.PI / 2, -Math.PI / 2 + p * TAU); ctx.stroke();
  const ha = -Math.PI / 2 + p * TAU;
  ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(ha) * (R - 30), sy + Math.sin(ha) * (R - 30)); ctx.stroke();
  ctx.restore();
}

function drawBirds(ctx, cam, t, env) {
  if (t < 19.6) return;
  applyLayer(ctx, cam, 0.3);
  const u = t - 19.6;
  ctx.strokeStyle = rgba(mix(hex('#140a10'), hex('#2a1420'), 0.5), 0.9 * seg(t, 19.6, 19.9));
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 3;
  for (const b of SCN.birds) {
    const x = -520 + b.dx + u * 150, y = -420 + b.dy - u * 25;
    const fl = Math.sin(t * 9 + b.p) * 9 * b.s;
    ctx.beginPath(); ctx.moveTo(x - 14 * b.s, y - fl); ctx.quadraticCurveTo(x - 6 * b.s, y - 3, x, y + 2); ctx.quadraticCurveTo(x + 6 * b.s, y - 3, x + 14 * b.s, y - fl); ctx.stroke();
  }
}

function drawGodRays(ctx, cam, t, env) {
  if (env.dawn < 0.02) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const [sx, sy] = sunScreen(t, cam);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU + t * 0.05 + Math.sin(i * 3.1) * 0.2;
    const w = 0.05 + 0.04 * Math.sin(i * 7.3);
    const L_ = 1800;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, L_);
    g.addColorStop(0, `rgba(255,210,150,${0.16 * env.dawn})`); g.addColorStop(1, 'rgba(255,190,130,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.arc(sx, sy, L_, a - w, a + w); ctx.closePath(); ctx.fill();
  }
  // lens flare ghosts along the line through the centre
  const vx = W / 2 - sx, vy = H / 2 - sy;
  [[0.5, 30, 0.1], [0.9, 60, 0.06], [1.3, 18, 0.12], [1.6, 90, 0.04]].forEach(([k, r, al]) => {
    const x = sx + vx * k, y = sy + vy * k;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,200,160,${al * env.dawn})`); g.addColorStop(1, 'rgba(255,200,160,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  });
  ctx.restore();
}

function drawSparkBurst(ctx, cam, t) {
  const u = inv(SPARK_HIT, SPARK_HIT + 1.0, t);
  if (u <= 0 || u >= 1) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const [sx, sy] = sunScreen(t, cam);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(255,220,160,${0.8 * (1 - u)})`; ctx.lineWidth = 6 * (1 - u) + 1;
  ctx.beginPath(); ctx.arc(sx, sy, 40 + E.out(u) * 900, 0, TAU); ctx.stroke();
  const R = rng(42);
  for (let i = 0; i < 28; i++) {
    const a = R() * TAU, sp = 200 + R() * 600;
    const x = sx + Math.cos(a) * sp * E.out(u), y = sy + Math.sin(a) * sp * E.out(u);
    ctx.fillStyle = `rgba(255,220,150,${(1 - u) * 0.9})`;
    ctx.beginPath(); ctx.arc(x, y, 2 + R() * 3, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawGrade(ctx, t, env) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // despair: drain the colour
  const des = env.despair * 0.75 + env.darkest * 0.35;
  if (des > 0.01) {
    ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = `rgba(128,128,128,${des})`; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  // warm grade at dawn
  if (env.dawn > 0.01) {
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = `rgba(255,170,90,${0.35 * env.dawn})`; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  // flashes
  const flash = (t0, dur, col, amp) => { const u = (t - t0) / dur; if (u >= 0 && u < 1) { ctx.fillStyle = rgba(hex(col), amp * Math.pow(1 - u, 2)); ctx.fillRect(0, 0, W, H); } };
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  flash(4.3, 0.35, '#ff2a55', 0.22);
  flash(5.07, 0.3, '#ff2a55', 0.12);
  flash(5.87, 0.3, '#ff2a55', 0.1);
  flash(13.75, 0.5, '#ffc46b', 0.12);
  flash(SPARK_HIT, 0.9, '#ffe2b0', 0.55);
  ctx.restore();
  // red tension pulse at the edges while pulled
  const pull = pullAt(t);
  // vignette
  const vg = ctx.createRadialGradient(W / 2, H * 0.47, H * 0.25, W / 2, H * 0.5, H * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, `rgba(${(pull * 90) | 0},0,${(pull * 15) | 0},${0.62 + 0.15 * env.darkest + 0.12 * env.despair - 0.25 * env.dawn})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  // heartbeat during "deb turgan paytingiz"
  const hb = Math.max(0, Math.sin((t - 11.0) * Math.PI * 1.6)) ** 8 * (t > 11 && t < 12.3 ? 1 : 0);
  if (hb > 0) { ctx.fillStyle = `rgba(0,0,0,${0.18 * hb})`; ctx.fillRect(0, 0, W, H); }
  // letterbox fade at start / end
  const fadeIn = 1 - seg(t, 0, 0.5, E.out), fadeOut = seg(t, DURATION - 0.35, DURATION, E.in2);
  const f = Math.max(fadeIn, fadeOut);
  if (f > 0) { ctx.fillStyle = `rgba(0,0,0,${f})`; ctx.fillRect(0, 0, W, H); }
}

// ---------------------------------------------------------------- typography
const CAP_Y = 1520;
function drawCaptions(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  CAPS.forEach(([s, e, text, style], ci) => {
    const prevEnd = ci ? CAPS[ci - 1][1] + (CAPS[ci - 1][3] === 'drop' ? 0.08 : 0.1) : -1;
    const t0 = Math.max(s - 0.1, prevEnd), t1 = e;
    if (t < t0 - 0.01 || t > t1 + 0.4) return;
    const hero = style === 'hero';
    const size = hero ? 88 : text.length > 17 ? 50 : 56;
    const spacing = size * (hero ? 0.22 : 0.3);
    ctx.font = `${hero ? 800 : 700} ${size}px Montserrat`;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const chars = [...text];
    const widths = chars.map(ch => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
    let x = W / 2 - total / 2;
    const exitU = inv(t1 - 0.06, t1 + 0.1, t);
    const stagger = Math.min(0.035, 0.32 / chars.length);
    let fill;
    if (style === 'cold') fill = '#c9d6ff';
    else if (style === 'tense') fill = '#ffd9df';
    else if (style === 'faint') fill = '#c4c3cf';
    else if (style === 'warm') fill = '#ffe7bf';
    else fill = '#f6f2ea';
    const y0 = hero ? 1480 : CAP_Y;
    // accent line under the caption
    const la = seg(t, t0, t0 + 0.35, E.out) * (1 - exitU);
    if (la > 0) {
      const lw = (hero ? 260 : 70) * la;
      ctx.fillStyle = style === 'tense' ? `rgba(255,60,95,${la})` : style === 'cold' ? `rgba(150,175,255,${la})` : `rgba(255,190,100,${la})`;
      ctx.fillRect(W / 2 - lw / 2, y0 + size * 0.85, lw, hero ? 5 : 3);
    }
    chars.forEach((ch, i) => {
      const w = widths[i];
      const lt = t - t0 - i * stagger;
      const p = hero ? E.outBack(clamp(lt / 0.45)) : E.out(clamp(lt / 0.3));
      let alpha = clamp(lt / 0.22) * (1 - exitU);
      let dy = (1 - p) * (hero ? 60 : 34), rot = 0, sc = hero ? 0.6 + 0.4 * p : 1;
      if (style === 'tense' && lt > 0) { dy += noise(t * 30 + i * 5) * 2.2; rot = noise(t * 25 + i * 9) * 0.03; }
      if (style === 'drop' && t > t1 - 0.04) {
        const fu = Math.max(0, t - (t1 - 0.04) - i * 0.02);
        dy += 3600 * fu * fu; rot = (hash(i) - 0.5) * 5 * fu; alpha = clamp(1 - fu * 4);
      } else if (exitU > 0) { dy -= 16 * E.out(exitU); }
      if (style === 'faint') dy += Math.sin(t * 2 + i * 0.6) * 1.5;
      if (alpha <= 0.002) { x += w + spacing; return; }
      ctx.save();
      ctx.translate(x + w / 2, y0 + dy); ctx.rotate(rot); ctx.scale(sc, sc);
      ctx.globalAlpha = alpha;
      ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 3;
      if (hero) {
        const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
        g.addColorStop(0, '#fff6dc'); g.addColorStop(0.55, '#ffd27a'); g.addColorStop(1, '#ff9a4a');
        ctx.fillStyle = g;
        ctx.shadowColor = 'rgba(255,150,60,0.7)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 0;
      } else ctx.fillStyle = fill;
      // highlight the word that carries the meaning
      if (style === 'warm' && text.startsWith('OZGINA') && i >= 7 && i <= 10) {
        ctx.fillStyle = '#ffc45c'; ctx.shadowColor = 'rgba(255,170,60,0.9)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 0;
      }
      ctx.fillText(ch, -w / 2, 0);
      ctx.restore();
      x += w + spacing;
    });
  });
}

// ---------------------------------------------------------------- frame
let CTX = null;
function initScene(canvas) {
  CTX = canvas.getContext('2d');
  initScenery();
}

function renderFrame(t) {
  const ctx = CTX;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
  const env = envAt(t);
  const cam = camAt(t);
  const S = skelAt(t);
  const light = buildLights(t, cam);

  drawSky(ctx, cam, env, t);
  drawMoonSun(ctx, cam, env, t);
  drawClouds(ctx, cam, env, t);
  drawBirds(ctx, cam, t, env);
  drawClockRing(ctx, cam, t, env);
  drawLand(ctx, cam, env, t);
  drawGodRays(ctx, cam, t, env);
  drawGround(ctx, cam, env, t, light);
  drawGhosts(ctx, cam, t, env);
  applyLayer(ctx, cam, 1);
  drawCharacter(ctx, cam, S, t, env, light.list, light.lantern);
  drawThreads(ctx, cam, S, t);
  drawDroppedLantern(ctx, cam, light, env);
  drawDust(ctx, cam, t, S);
  drawTear(ctx, cam, S, t);
  drawGlows(ctx, cam, light, t, env);
  drawSpark(ctx, cam, light, t);
  drawForeground(ctx, cam, t, env);
  drawRain(ctx, cam, t, env, light);
  drawSparkBurst(ctx, cam, t);
  drawGrade(ctx, t, env);
  drawCaptions(ctx, t);
}

window.SCENE = { W, H, FPS, DURATION, initScene, renderFrame };
