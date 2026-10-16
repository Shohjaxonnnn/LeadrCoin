import numpy as np, wave, sys
SR = 48000; DUR = 18.6; N = int(SR * DUR)
rng = np.random.default_rng(7)
BPM = 120; BEAT = 60 / BPM; BAR = 4 * BEAT

def T(n): return np.arange(n) / SR
def mtof(m): return 440 * 2 ** ((m - 69) / 12)
def S(t): return int(t * SR)

def add(buf, x, t, gain=1.0, pan=0.0):
    i = S(t)
    if i >= N: return
    x = x[: N - i].copy()
    fo = min(S(0.012), x.shape[-1]); x[..., -fo:] *= np.linspace(1, 0, fo)
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    if x.ndim == 1:
        buf[0, i:i + len(x)] += x * gain * l * 1.414
        buf[1, i:i + len(x)] += x * gain * r * 1.414
    else:
        buf[:, i:i + x.shape[1]] += x * gain

def fft_filter(x, fn):
    n = len(x); X = np.fft.rfft(x); f = np.fft.rfftfreq(n, 1 / SR)
    return np.fft.irfft(X * fn(f), n)

def lp(f, fc, order=2): return 1 / np.sqrt(1 + (f / fc) ** (2 * order))
def hp(f, fc, order=2): return 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** (2 * order))

def stft_sweep(x, center_fn, q=1.0):
    """bandpass with moving center frequency (center_fn(time)->Hz)"""
    W = 2048; H = 512; win = np.hanning(W)
    out = np.zeros(len(x) + W); norm = np.zeros(len(x) + W)
    xp = np.concatenate([x, np.zeros(W)])
    f = np.fft.rfftfreq(W, 1 / SR); lf = np.log2(np.maximum(f, 1))
    for s in range(0, len(x), H):
        c = center_fn(s / SR)
        g = np.exp(-0.5 * ((lf - np.log2(c)) / q) ** 2)
        y = np.fft.irfft(np.fft.rfft(xp[s:s + W] * win) * g, W)
        out[s:s + W] += y * win; norm[s:s + W] += win ** 2
    return out[:len(x)] / np.maximum(norm[:len(x)], 1e-3)

def env_adsr(n, a, d, s, r, hold):
    t = T(n); e = np.zeros(n)
    e = np.where(t < a, t / a, s + (1 - s) * np.exp(-(t - a) / d))
    rel = t > hold
    e[rel] *= np.exp(-(t[rel] - hold) / r)
    return e

# ---------------- instruments ----------------
def kick(gain=1.0):
    n = S(0.5); t = T(n)
    f = 46 + 120 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 7)
    click = rng.standard_normal(n) * np.exp(-t * 900) * 0.6
    click = fft_filter(click, lambda f: hp(f, 1500))
    return np.tanh(1.6 * (body + click)) * gain

def clap():
    n = S(0.4); t = T(n); x = np.zeros(n)
    for k, o in enumerate([0, 0.011, 0.022, 0.034]):
        i = S(o); seg = rng.standard_normal(n - i) * np.exp(-T(n - i) * (180 if k < 3 else 16))
        x[i:] += seg
    return fft_filter(x, lambda f: np.exp(-0.5 * (np.log2(np.maximum(f, 1) / 1500) / 0.9) ** 2)) * 0.9

def hat(open_=False):
    n = S(0.25 if open_ else 0.07); t = T(n)
    x = rng.standard_normal(n) * np.exp(-t * (18 if open_ else 70))
    return fft_filter(x, lambda f: hp(f, 7500, 3)) * 0.5

def additive(freq, n, harm=10, roll=0.55, decay_h=0.0, detune=0.0, phase=0.0):
    t = T(n); y = np.zeros(n)
    for h in range(1, harm + 1):
        fh = freq * h * (1 + detune)
        if fh > 16000: break
        a = (roll ** (h - 1)) / h ** 0.3
        e = np.exp(-t * decay_h * (h - 1)) if decay_h else 1
        y += a * e * np.sin(2 * np.pi * fh * t + phase * h)
    return y

def pad_chord(notes, dur):
    n = S(dur); out = np.zeros((2, n))
    for m in notes:
        for v, (dt, pan) in enumerate([(-0.012, -0.8), (-0.005, -0.3), (0, 0), (0.006, 0.35), (0.013, 0.85)]):
            y = additive(mtof(m), n, harm=12, roll=0.62, detune=dt, phase=rng.uniform(0, 6.28))
            l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
            out[0] += y * l; out[1] += y * r
    e = env_adsr(n, 0.08, 0.6, 0.75, 0.25, dur - 0.05)
    return out * e * 0.035

def pluck(m, dur=0.45):
    n = S(dur); t = T(n)
    y = additive(mtof(m), n, harm=14, roll=0.75, decay_h=9)
    return y * np.exp(-t * 7) * np.minimum(1, t / 0.002) * 0.16

def bass(m, dur):
    n = S(dur); t = T(n)
    y = additive(mtof(m), n, harm=8, roll=0.5) + 0.5 * np.sin(2 * np.pi * mtof(m) * t)
    e = np.minimum(1, t / 0.005) * np.exp(-t * 3.5) * np.clip((dur - t) / 0.02, 0, 1)
    return np.tanh(1.4 * y) * e * 0.33

def bell(f0, dur=1.4, idx=2.2, ratio=3.5):
    n = S(dur); t = T(n)
    mod = np.sin(2 * np.pi * f0 * ratio * t) * idx * np.exp(-t * 5)
    return np.sin(2 * np.pi * f0 * t + mod) * np.exp(-t * 3.2) * np.minimum(1, t / 0.002)

# ---------------- SFX ----------------
def pop(f1=1300, f2=260, dur=0.12):
    n = S(dur); t = T(n)
    f = f2 + (f1 - f2) * np.exp(-t * 55)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 32) * np.minimum(1, t / 0.0015)
    nz = fft_filter(rng.standard_normal(n), lambda f: hp(f, 3000)) * np.exp(-t * 400) * 0.25
    return np.tanh(1.3 * (y + nz))

def click(f=3200):
    n = S(0.03); t = T(n)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t * 260) + fft_filter(rng.standard_normal(n), lambda x: hp(x, 4000)) * np.exp(-t * 600) * 0.5
    return y

def whoosh(dur=0.6, f_lo=250, f_hi=4500, peak=0.55):
    n = S(dur); x = rng.standard_normal(n)
    def cf(tt):
        p = tt / dur
        return f_lo * (f_hi / f_lo) ** (np.sin(np.pi * min(p, 1)) ** 0.8)
    y = stft_sweep(x, cf, q=0.7)
    t = T(n); p = t / dur
    e = np.where(p < peak, (p / peak) ** 2.2, np.exp(-(p - peak) * 9))
    y = y * e; y /= np.max(np.abs(y)) + 1e-9
    return y

def whoosh_st(dur=0.6, pan_from=-0.9, pan_to=0.9, **kw):
    y = whoosh(dur, **kw); n = len(y); p = np.linspace(pan_from, pan_to, n)
    return np.stack([y * np.cos((p + 1) * np.pi / 4), y * np.sin((p + 1) * np.pi / 4)]) * 1.414

def impact(dur=2.2, sub=1.0):
    n = S(dur); t = T(n)
    f = 34 + 70 * np.exp(-t * 9)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2) * sub
    nz = fft_filter(rng.standard_normal(n), lambda f: lp(f, 2500) * hp(f, 80)) * np.exp(-t * 6) * 0.7
    crack = fft_filter(rng.standard_normal(n), lambda f: hp(f, 2000)) * np.exp(-t * 60) * 0.5
    return np.tanh(1.5 * (s + nz + crack)) * np.minimum(1, t / 0.002)

def riser(dur):
    n = S(dur); t = T(n); p = t / dur
    x = stft_sweep(rng.standard_normal(n), lambda tt: 300 * (9000 / 300) ** (tt / dur), q=0.9)
    x /= np.max(np.abs(x))
    f = 180 * 2 ** (p * 2.6)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.4 * np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR)
    trem = 0.7 + 0.3 * np.sin(2 * np.pi * np.cumsum(4 + 20 * p ** 2) / SR)
    return (x * 0.8 + tone * 0.25 * trem) * p ** 2.2

def reverb(x, secs=2.0, damp=4500):
    n = S(secs); t = T(n)
    ir = np.stack([rng.standard_normal(n), rng.standard_normal(n)]) * np.exp(-t * 6.9 / secs)
    ir[:, :S(0.012)] = 0
    ir = np.stack([fft_filter(c, lambda f: lp(f, damp)) for c in ir])
    L = x.shape[1] + n; nf = 1 << int(np.ceil(np.log2(L)))
    out = np.stack([np.fft.irfft(np.fft.rfft(x[c], nf) * np.fft.rfft(ir[c], nf), nf)[:x.shape[1]] for c in range(2)])
    return out / np.sqrt(np.sum(ir[0] ** 2)) * 0.9

# ---------------- MUSIC ----------------
music = np.zeros((2, N)); drums = np.zeros((2, N)); send = np.zeros((2, N))
Am = [57, 60, 64, 71]; F = [53, 57, 60, 64]; C = [55, 60, 64, 67]; G = [55, 59, 62, 69]
prog = [(Am, 45), (F, 41), (C, 48), (G, 43), (Am, 45), (F, 41), (G, 43), (C, 48), (F, 41)]
BREAK = (13.5, 14.0)
def in_break(t): return BREAK[0] <= t < BREAK[1]

K = kick(); CL = clap(); HC = hat(); HO = hat(True)
kick_times = []
for b, (ch, root) in enumerate(prog):
    t0 = b * BAR
    if t0 >= 18: break
    dur = min(BAR, 18.4 - t0)
    pc = pad_chord(ch, dur + 0.3)
    if b == 6:  # build bar: pad filter rises handled by fade-out at break
        pc[:, S(1.5):] *= np.linspace(1, 0, pc.shape[1] - S(1.5))
    add(music, pc, t0, gain=1.0)
    add(send, pc, t0, gain=0.6)
    for k in range(4):
        tb = t0 + k * BEAT
        if tb >= 17.9 or in_break(tb): continue
        kick_times.append(tb)
        add(drums, K, tb, 0.95)
        if b >= 1 and k in (1, 3): add(drums, CL, tb, 0.45, 0.05); add(send, np.stack([CL, CL]), tb, 0.25)
        for h in (0.5,):
            th = tb + h * BEAT
            if not in_break(th): add(drums, HO if b >= 4 else HC, th, 0.5 if b >= 4 else 0.6, 0.25)
        for h in (0.25, 0.75):
            th = tb + h * BEAT
            if b >= 2 and not in_break(th): add(drums, HC, th, 0.28, -0.25)
        # bass offbeat 8ths
        for h in (0.5,):
            th = tb + h * BEAT
            if not in_break(th): add(music, bass(root - 12 + 12, BEAT * 0.48), th, 1.0)
    # plucks arpeggio from bar 3 on
    if b >= 3:
        arp = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[2] + 12, ch[1] + 12]
        for s16 in range(16):
            ts = t0 + s16 * BEAT / 4
            if ts >= 17.9 or in_break(ts) or (b == 6 and ts > 13.5): continue
            pl = pluck(arp[s16 % len(arp)])
            pan = 0.45 if s16 % 2 else -0.45
            add(music, pl, ts, 0.9 if b >= 7 else 0.65, pan)
            add(send, pl, ts, 0.5, pan)

# sidechain pumping on music bus
sc = np.ones(N); t_sc = T(S(BEAT))
curve = 1 - 0.65 * np.exp(-t_sc * 9)
for kt in kick_times:
    i = S(kt); m = min(len(curve), N - i); sc[i:i + m] = np.minimum(sc[i:i + m], curve[:m])
music *= sc

# ---------------- SFX ----------------
sfx = np.zeros((2, N))
add(sfx, impact(2.4), 0.02, 0.85); add(send, np.stack([impact(1.0)] * 2), 0.02, 0.3)
add(sfx, bell(mtof(81), 2.0) * 0.25, 0.02, 1.0)
add(sfx, whoosh_st(0.45, -0.3, 0.3, f_lo=600, f_hi=6000), 0.15, 0.22)
add(sfx, whoosh_st(0.45, 0.3, -0.3, f_lo=600, f_hi=6000), 0.36, 0.2)
add(sfx, whoosh_st(0.75, -1, -0.2, f_lo=200, f_hi=3500), 0.42, 0.42)
add(sfx, whoosh_st(0.75, 1, 0.2, f_lo=220, f_hi=3800), 0.52, 0.42)
add(sfx, pop(1500, 320), 1.28, 0.55); add(sfx, bell(mtof(88), 1.6) * 0.22, 1.3, 1.0, 0.1)
add(send, np.stack([bell(mtof(88), 1.6)] * 2) * 0.22, 1.3, 1.0)
add(sfx, whoosh_st(0.5, 0, 0, f_lo=900, f_hi=7000) * 0.6, 1.75, 0.2)
# transitions
for tc in (3.5, 7.0, 10.5):
    add(sfx, whoosh_st(0.7, -0.8, 0.8, f_lo=180, f_hi=5500), tc - 0.48, 0.5)
    add(sfx, impact(0.6, 0.6) * 0.5, tc, 0.4)
# scene 2
add(sfx, whoosh_st(0.6, 0, 0, f_lo=300, f_hi=3000), 3.75, 0.3)
add(sfx, click(2600), 4.15, 0.35, -0.3); add(sfx, click(2900), 4.4, 0.35, -0.3)
for tt, m in ((4.62, 84), (4.87, 88)):
    add(sfx, pop(1700, 500, 0.09), tt, 0.45, 0.4); add(sfx, bell(mtof(m), 1.0) * 0.18, tt, 1.0, 0.4)
    add(send, np.stack([bell(mtof(m), 1.0)] * 2) * 0.18, tt, 1.0)
add(sfx, pop(1200, 280), 5.22, 0.55, -0.4); add(sfx, pop(1400, 330), 5.42, 0.55, 0.4)
add(sfx, whoosh_st(0.5, -0.4, 0.4, f_lo=500, f_hi=4000), 5.65, 0.25)
# scene 3 slams
for i, tt in enumerate((7.1, 7.45, 7.8)):
    add(sfx, whoosh_st(0.3, -0.9, 0.0, f_lo=800, f_hi=6000, peak=0.85), tt - 0.25, 0.35)
    add(sfx, impact(0.7, 0.9) * 0.7, tt + 0.03, 0.6 + 0.1 * i)
add(sfx, whoosh_st(0.6, 0, 0, f_lo=300, f_hi=3000), 8.15, 0.3)
# counter ticks 8.6 -> 9.8 slowing
tt = 8.6; k = 0
while tt < 9.75:
    add(sfx, click(3600 - k * 40), tt, 0.3, 0.2 * np.sin(k))
    p = (tt - 8.6) / 1.2; tt += 0.035 + 0.11 * p ** 2; k += 1
add(sfx, bell(mtof(84), 1.6) * 0.3, 9.8, 1.0); add(sfx, bell(mtof(91), 1.6) * 0.18, 9.86, 1.0)
add(send, np.stack([bell(mtof(84), 1.6)] * 2) * 0.3, 9.8, 1.0)
# scene 4
add(sfx, whoosh_st(0.6, 0, 0, f_lo=300, f_hi=3000), 10.75, 0.3)
for tt, m in ((11.37, 79), (11.67, 83), (11.97, 86)):
    add(sfx, click(2700), tt - 0.2, 0.3, -0.3)
    add(sfx, pop(1700, 500, 0.09), tt, 0.45, 0.35); add(sfx, bell(mtof(m + 5), 1.0) * 0.18, tt, 1.0, 0.35)
    add(send, np.stack([bell(mtof(m + 5), 1.0)] * 2) * 0.16, tt, 1.0)
for tt, f in ((12.57, 1100), (12.77, 1300), (12.97, 1550)):
    add(sfx, pop(f, f / 4.5), tt, 0.55, (tt - 12.77) * 4)
# build & drop
add(sfx, riser(1.1), 12.9, 0.5)
add(send, np.stack([riser(1.1)] * 2), 12.9, 0.25)
add(sfx, impact(3.0, 1.2), 14.0, 1.0); add(send, np.stack([impact(1.5)] * 2), 14.0, 0.45)
for i, m in enumerate((84, 88, 91, 96)):
    add(sfx, bell(mtof(m), 1.8) * 0.16, 14.05 + i * 0.06, 1.0, (-0.6, -0.2, 0.2, 0.6)[i])
add(send, np.stack([bell(mtof(96), 1.8)] * 2) * 0.2, 14.2, 1.0)
add(sfx, whoosh_st(0.5, -0.5, 0.5, f_lo=500, f_hi=5000), 14.15, 0.25)
add(sfx, pop(1300, 300), 14.92, 0.5, -0.3); add(sfx, pop(1500, 350), 15.12, 0.5, 0.3)
add(sfx, whoosh_st(0.55, 0, 0, f_lo=250, f_hi=3500), 15.15, 0.35)
add(sfx, pop(900, 160, 0.18), 15.55, 0.6)
# shine sparkle
for i in range(6):
    m = (96, 100, 103, 108, 103, 108)[i]
    add(sfx, bell(mtof(m), 0.8, idx=1.2, ratio=2.0) * 0.08, 16.45 + i * 0.07, 1.0, -0.7 + i * 0.28)
add(send, np.stack([bell(mtof(103), 0.8)] * 2) * 0.1, 16.5, 1.0)

# ---------------- MIX ----------------
rev = reverb(send, 2.2)
mix = music * 0.9 + drums * 0.5 + sfx * 1.15 + rev * 0.35
mix = np.stack([fft_filter(c, lambda f: hp(f, 28, 2)) for c in mix])
# fade out end
fe = S(17.3); mix[:, fe:] *= np.linspace(1, 0, N - fe) ** 2
mix[:, S(18.0):] = 0
mix = mix[:, :S(18.0)]
mix /= np.max(np.abs(mix)) + 1e-9
mix = np.tanh(mix * 1.15) / np.tanh(1.15)  # soft limiter
mix *= 0.95
out = (mix.T * 32767).astype(np.int16)
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes())
print('ok', mix.shape)
