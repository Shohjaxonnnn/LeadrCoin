import numpy as np
SR = 48000; N = 0
rng = np.random.default_rng(7)
def T(n): return np.arange(n) / SR
def mtof(m): return 440 * 2 ** ((m - 69) / 12)
def S(t): return int(t * SR)

def add(buf, x, t, gain=1.0, pan=0.0):
    i = S(t)
    if i >= N or i < 0: return
    x = x[..., : N - i].copy()
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

