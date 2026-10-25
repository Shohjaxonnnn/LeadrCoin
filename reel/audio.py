"""Synthesised soundtrack for the reel: 120 bpm beat, bass, pad, whooshes and impacts
locked to the scene cuts in index.html. No samples, no external assets."""
import json, sys, wave
import numpy as np

# one source of truth for timing, written by plan.py and also used by index.html / mix.py
T = json.loads(open('timing.js').read().split('=', 1)[1].strip().rstrip(';'))
SCN = T['scenes']

SR = 48000
DUR = float(T['duration'])
N = int(SR * DUR)
BPM = 120.0
BEAT = 60.0 / BPM
rng = np.random.default_rng(7)

# scene cuts and headline slam moments, straight from the plan
CUTS = [x['t0'] for x in SCN[1:]]
HITS = [SCN[0]['vs'] - 0.05] + [x['slam'] for x in SCN[1:5]] + [SCN[5]['vs'] + 0.4, SCN[6]['vs'], SCN[7]['vs']]

L = np.zeros(N); R = np.zeros(N)

def put(buf, start, sig, gain=1.0):
    i = int(start * SR)
    if i >= N or i + len(sig) <= 0: return
    a = max(i, 0); b = min(i + len(sig), N)
    buf[a:b] += sig[a - i:b - i] * gain

def both(start, sig, gain=1.0, pan=0.0):
    put(L, start, sig, gain * (1 - max(pan, 0)))
    put(R, start, sig, gain * (1 + min(pan, 0)))

def lowpass(x, fc):
    a = 1 - np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); s = 0.0
    for i in range(len(x)):
        s += a * (x[i] - s); y[i] = s
    return y

def kick(length=0.42):
    t = np.arange(int(SR * length)) / SR
    f = 42 + 130 * np.exp(-t / 0.028)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.17)
    click = rng.standard_normal(len(t)) * np.exp(-t / 0.004) * 0.25
    return np.tanh((body + click) * 1.6) * 0.95

def hat(length=0.07):
    t = np.arange(int(SR * length)) / SR
    n = np.diff(rng.standard_normal(len(t) + 1))
    return n * np.exp(-t / 0.018)

def clap(length=0.22):
    t = np.arange(int(SR * length)) / SR
    n = rng.standard_normal(len(t)); n = n - lowpass(n, 900)
    env = np.exp(-t / 0.06) * (1 + 0.8 * (np.sin(t * 900) > 0.6))
    return n * env * 0.5

def impact(length=1.1):
    t = np.arange(int(SR * length)) / SR
    f = 34 + 70 * np.exp(-t / 0.09)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.42)
    burst = lowpass(rng.standard_normal(len(t)), 5000) * np.exp(-t / 0.07) * 0.5
    return np.tanh((boom + burst) * 1.4) * 0.9

def whoosh(length=0.42):
    n = int(SR * length); t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    # rising band: crossfade a few lowpass cutoffs
    out = np.zeros(n)
    cut = [400, 900, 1800, 3600, 7000]
    for k, fc in enumerate(cut):
        band = lowpass(noise, fc)
        w = np.exp(-((t / length - (k + 0.5) / len(cut)) ** 2) / 0.03)
        out += band * w
    env = (t / length) ** 2.2 * (1 - 0.15 * (t / length))
    return out * env * 0.9

def riser(length=1.6):
    n = int(SR * length); t = np.arange(n) / SR; p = t / length
    f = 180 * (1 + 6 * p ** 2)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.35
    noise = lowpass(rng.standard_normal(n), 6000) * 0.5
    return (tone + noise) * p ** 2.4

def pop(length=0.12):
    t = np.arange(int(SR * length)) / SR
    return np.sin(2 * np.pi * np.cumsum(520 + 700 * np.exp(-t / 0.02)) / SR) * np.exp(-t / 0.035) * 0.6

# ---------- drums ----------
K = kick(); H = hat(); C = clap()
for b in range(int(DUR / BEAT)):
    t = b * BEAT
    if t < 0.0: continue
    both(t, K, 0.95)
    both(t + BEAT / 2, H, 0.20, pan=0.25 if (b % 2) else -0.25)
    if b % 2 == 1 and t > 1.9:
        both(t, C, 0.32)
    if b % 4 == 3:
        both(t + BEAT * 0.75, H, 0.16, pan=0.3)

# ---------- bass + pad (sidechained to the kick) ----------
tt = np.arange(N) / SR
since = np.mod(tt, BEAT)
duck = np.clip(since / 0.22, 0, 1) ** 1.6                    # pumps after each kick
roots = [55.0, 55.0, 43.65, 49.0]                              # A1 A1 F1 G1  (per bar)
chords = [(220.0, 261.63, 329.63), (220.0, 261.63, 329.63), (174.61, 220.0, 261.63), (196.0, 246.94, 293.66)]
bar = (tt // (BEAT * 4)).astype(int) % 4
f_bass = np.array(roots)[bar]
ph = 2 * np.pi * np.cumsum(f_bass) / SR
bass = (np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)) * 0.55 * duck
bass = np.tanh(bass * 1.5) * 0.7
# fade bass in after the first bar
bass *= np.clip((tt - 1.0) / 0.5, 0, 1)

pad = np.zeros(N)
for ci, ch in enumerate(chords):
    mask = (bar == ci).astype(float)
    mask = lowpass(mask, 6)                                    # smooth bar changes
    for f in ch:
        for det in (-0.4, 0.4):
            p = 2 * np.pi * np.cumsum(np.full(N, f * (1 + det / 100))) / SR
            saw = sum(np.sin(h * p) / h for h in range(1, 6)) * 0.09
            pad += saw * mask
pad = lowpass(pad, 1800) * duck * 0.9
pad *= np.clip((tt - 0.5) / 2.0, 0, 1) * np.clip((DUR - tt) / 1.0, 0, 1)
L += bass + pad * 0.9; R += bass + pad * 1.05

# ---------- scene transitions & hits ----------
W = whoosh(0.42); I = impact(); P = pop()
for c in CUTS:
    both(c - 0.42, W, 0.42, pan=-0.2)
    both(c, I, 0.55)
for h in HITS:
    both(h, P, 0.32)
    both(h, impact(0.6), 0.28)
both(SCN[7]['t0'] - 1.6, riser(1.6), 0.42)
both(0.0, impact(1.4), 0.5)

# ---------- master ----------
fade = np.clip((DUR - tt) / 0.9, 0, 1) ** 1.2
L *= fade; R *= fade
st = np.stack([L, R], 1)
st = np.tanh(st * 1.15)
st /= max(np.abs(st).max(), 1e-9); st *= 0.89
pcm = (st * 32767).astype('<i2')
out = sys.argv[1] if len(sys.argv) > 1 else 'out/soundtrack.wav'
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote', out, f'{DUR}s', 'peak', float(np.abs(st).max()))
