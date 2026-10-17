"""Music + SFX + voice mix.  usage: python3 mix.py <video_dir> <out.wav>
reads timeline.json, sfx.json ([{t,type,gain,pan,arg}]), script.json["music"]"""
import json, sys, os, wave
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import sfxlib as L
from sfxlib import *
D, OUT = sys.argv[1], sys.argv[2]
TL = json.load(open(os.path.join(D, 'timeline.json'))); END = TL['end']; ST = TL['starts']
SFX = json.load(open(os.path.join(D, 'sfx.json')))
MUS = json.load(open(os.path.join(D, 'script.json'))).get('music', {})
L.N = N = int(SR * (END + 0.6))
rng = np.random.default_rng(MUS.get('seed', 7)); L.rng = rng

DROP = ST[-2]  # last scene start
best = min(range(4, 16), key=lambda nb: abs(nb * 4 * 60 / DROP - MUS.get('bpm', 120)))
BPM = best * 4 * 60 / DROP; BEAT = 60 / BPM; BAR = 4 * BEAT; DROP_BAR = best
print(f'BPM {BPM:.1f}, drop at bar {DROP_BAR}')
NOTES = {'Am': [57, 60, 64, 71], 'F': [53, 57, 60, 64], 'C': [55, 60, 64, 67], 'G': [55, 59, 62, 69],
         'Em': [52, 55, 59, 62], 'Dm': [50, 57, 60, 65], 'Fm': [53, 56, 60, 63], 'Db': [53, 56, 61, 65],
         'Ab': [51, 56, 60, 63], 'Eb': [51, 55, 58, 62], 'Bb': [50, 53, 58, 62], 'Cm': [51, 55, 60, 62],
         'D': [54, 57, 62, 64], 'Bm': [50, 54, 59, 61], 'A': [52, 57, 61, 64], 'E': [52, 56, 59, 64]}
ROOT = {'Am': 45, 'F': 41, 'C': 48, 'G': 43, 'Em': 40, 'Dm': 38, 'Fm': 41, 'Db': 37, 'Ab': 44, 'Eb': 39,
        'Bb': 46, 'Cm': 48, 'D': 38, 'Bm': 47, 'A': 45, 'E': 40}
cyc = MUS.get('chords', ['Am', 'F', 'C', 'G'])
drop_cyc = MUS.get('drop_chords', cyc)
nbars = int(np.ceil(END / BAR)) + 1
prog = [cyc[b % len(cyc)] if b < DROP_BAR else drop_cyc[(b - DROP_BAR) % len(drop_cyc)] for b in range(nbars)]
tr = MUS.get('transpose', 0)
BREAK = (DROP - BEAT, DROP)
def in_break(t): return BREAK[0] <= t < BREAK[1]

music = np.zeros((2, N)); drums = np.zeros((2, N)); send = np.zeros((2, N)); sfx = np.zeros((2, N))
K = kick(); CL = clap(); HC = hat(); HO = hat(True)
kick_times = []
arp_style = MUS.get('arp', [0, 1, 2, 3, 2, 1])
for b, name in enumerate(prog):
    ch = [m + tr for m in NOTES[name]]; root = ROOT[name] + tr
    t0 = b * BAR
    if t0 >= END: break
    pc = pad_chord(ch, min(BAR, END + 0.4 - t0) + 0.3)
    if b == DROP_BAR - 1:
        pc[:, S(BAR * 0.75):] *= np.linspace(1, 0, pc.shape[1] - S(BAR * 0.75))
    add(music, pc, t0); add(send, pc, t0, gain=0.6)
    for k in range(4):
        tb = t0 + k * BEAT
        if tb >= END - 0.1 or in_break(tb): continue
        if MUS.get('half_intro') and b == 0 and k % 2: continue
        kick_times.append(tb); add(drums, K, tb, 0.95)
        if b >= 1 and k in (1, 3): add(drums, CL, tb, 0.45, 0.05); add(send, np.stack([CL, CL]), tb, 0.25)
        th = tb + 0.5 * BEAT
        if not in_break(th):
            add(drums, HO if b >= 2 else HC, th, 0.5 if b >= 2 else 0.6, 0.25)
            add(music, bass(root, BEAT * 0.48), th, 1.0)
        for h in (0.25, 0.75):
            th = tb + h * BEAT
            if b >= 1 and not in_break(th): add(drums, HC, th, 0.28, -0.25)
    if b >= 1:
        arp = [ch[i % 4] + 12 for i in arp_style]
        for s16 in range(16):
            ts = t0 + s16 * BEAT / 4
            if ts >= END - 0.1 or in_break(ts) or (b == DROP_BAR - 1 and ts > BREAK[0]): continue
            pl = pluck(arp[s16 % len(arp)]); pan = 0.45 if s16 % 2 else -0.45
            add(music, pl, ts, 0.9 if b >= DROP_BAR else 0.6, pan); add(send, pl, ts, 0.5, pan)
sc = np.ones(N); curve = 1 - 0.65 * np.exp(-T(S(BEAT)) * 9)
for kt in kick_times:
    i = S(kt); m = min(len(curve), N - i); sc[i:i + m] = np.minimum(sc[i:i + m], curve[:m])
music *= sc

def stereo(x): return np.stack([x, x])
# automatic: opening impact, scene-cut whooshes, riser + drop
add(sfx, impact(2.0), 0.02, 0.7); add(send, stereo(impact(1.0)), 0.02, 0.25)
for i, c in enumerate(ST[1:-2]):
    add(sfx, whoosh_st(0.7, -0.8 if i % 2 == 0 else 0.8, 0.8 if i % 2 == 0 else -0.8, f_lo=180, f_hi=5500), c - 0.45, 0.45)
    add(sfx, impact(0.6, 0.6) * 0.5, c, 0.35)
add(sfx, riser(1.1), DROP - 1.1, 0.45); add(send, stereo(riser(1.1)), DROP - 1.1, 0.2)
add(sfx, impact(3.0, 1.2), DROP, 0.95); add(send, stereo(impact(1.5)), DROP, 0.45)
for i, m in enumerate((84, 88, 91, 96)):
    add(sfx, bell(mtof(m + tr), 1.8) * 0.15, DROP + 0.05 + i * 0.06, 1.0, (-0.6, -0.2, 0.2, 0.6)[i])

for e in SFX:
    t = e['t']; g = e.get('gain', 1.0); p = e.get('pan', 0.0); a = e.get('arg'); ty = e['type']
    if ty == 'whoosh': add(sfx, whoosh_st(0.6, p - 0.6, p + 0.6, f_lo=250, f_hi=4500), t - 0.3, 0.35 * g)
    elif ty == 'swish': add(sfx, whoosh_st(0.5, p, p, f_lo=400, f_hi=3500), t - 0.2, 0.28 * g)
    elif ty == 'pop': f = a or 1300; add(sfx, pop(f, f / 4.5), t, 0.5 * g, p)
    elif ty == 'click': add(sfx, click(a or 3000), t, 0.35 * g, p)
    elif ty == 'ding':
        m = a or 84; add(sfx, pop(1700, 500, 0.09), t, 0.4 * g, p); add(sfx, bell(mtof(m), 1.2) * 0.2, t, g, p)
        add(send, stereo(bell(mtof(m), 1.2)) * 0.18, t, g)
    elif ty == 'impact': add(sfx, impact(a or 0.8, 0.9) * 0.7, t, 0.6 * g, p); add(send, stereo(impact(0.6)), t, 0.15 * g)
    elif ty == 'slam':
        add(sfx, whoosh_st(0.3, -0.9, 0.0, f_lo=800, f_hi=6000, peak=0.85), t - 0.25, 0.35 * g)
        add(sfx, impact(0.7, 0.9) * 0.7, t + 0.03, 0.65 * g)
    elif ty == 'sparkle':
        for i, m in enumerate((96, 100, 103, 108, 103, 108)):
            add(sfx, bell(mtof(m), 0.8, idx=1.2, ratio=2.0) * 0.08, t + i * 0.07, g, -0.7 + i * 0.28)
        add(send, stereo(bell(mtof(103), 0.8)) * 0.1, t, g)
    elif ty == 'msg':  # chat bubble: two quick rising blips
        for k, (f1, f2) in enumerate(((700, 900), (1100, 1500))):
            n = S(0.07); tt = T(n); f = f1 + (f2 - f1) * tt / tt[-1]
            y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 40) * np.minimum(1, tt / 0.002)
            add(sfx, y, t + k * 0.06, 0.45 * g, p)
        add(send, stereo(bell(mtof(91), 0.6)) * 0.05, t, g)
    elif ty == 'type':  # keyboard typing for a duration a
        tt = t; k = 0
        while tt < t + (a or 0.8):
            add(sfx, click(2200 + 300 * (k % 3)), tt, 0.16 * g, p + 0.1 * np.sin(k)); tt += 0.06 + 0.05 * rng.random(); k += 1
    elif ty == 'tick':
        tt = t; k = 0; dur = a or 1.0
        while tt < t + dur:
            add(sfx, click(3600 - k * 40), tt, 0.28 * g, 0.2 * np.sin(k)); pp = (tt - t) / dur; tt += 0.035 + 0.11 * pp ** 2; k += 1
    elif ty == 'cash':  # coin/cash-register
        for k, m in enumerate((88, 95)):
            add(sfx, bell(mtof(m), 0.9, idx=3.0, ratio=1.41) * 0.22, t + k * 0.08, g, p)
        add(sfx, click(5200), t, 0.3 * g)
    else: raise SystemExit('unknown sfx ' + ty)

rev = reverb(send, 2.2)
with wave.open(os.path.join(D, 'voice_track.wav')) as w:
    vo = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64) / 32767
voice = np.zeros(N); voice[:min(N, len(vo))] = vo[:N]
env = np.abs(voice); k = S(0.25); env = np.convolve(env, np.ones(k) / k, 'same')
env = np.minimum(1, env / (np.percentile(env[env > 1e-4], 60) + 1e-9))
duck = 1 - 0.62 * env; duckS = 1 - 0.3 * env
bed = music * 0.9 + drums * 0.5 + rev * 0.35
act = env > 0.5
VG = np.sqrt(np.mean((bed[:, act] * duck[act]) ** 2)) * 10 ** (11 / 20) / np.sqrt(np.mean(voice[act] ** 2))
mix = bed * duck + sfx * 1.15 * duckS + stereo(voice) * VG
mix = np.stack([fft_filter(c, lambda f: hp(f, 28, 2)) for c in mix])
fe = S(END - 0.6); mix[:, fe:] *= np.linspace(1, 0, N - fe) ** 2
mix = mix[:, :S(END)]
mix /= np.max(np.abs(mix)) + 1e-9
mix = np.tanh(mix * 1.15) / np.tanh(1.15) * 0.95
with wave.open(OUT, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix.T * 32767).astype(np.int16).tobytes())
print('mix ok', END)
