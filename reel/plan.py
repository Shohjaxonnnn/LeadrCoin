"""Prepare the voice clips and derive the whole timeline from them.

usage (from videos/<name>/):  python3 ../../plan.py [raw_dir=raw]
                               python3 ../../plan.py --estimate      (no audio yet: durations guessed from the text)

Reads lines.json (scene texts and timing hints) and raw/01.wav … (from gen_voice.py). Speeds the clips to
lines.json "tempo" (raised automatically so the reel fits "maxDuration"), levels them, writes voice/NN.wav and
timing.js: scene cuts, voice start times, the "slam" moment of a scene's punch word and the audio "hit".
The page (animation), audio.py (whooshes/impacts) and mix.py (voice placement) all read timing.js, so picture
and sound stay in sync.

lines.json scene keys: text, lead (silence before the voice, default 0.30), tail (hold after it, default 0.35),
slam ("last" | "first": the headline lands on that spoken word), hit (offset of the audio hit from the voice start).
"""
import json, os, subprocess, sys, wave
import numpy as np

CFG = json.load(open('lines.json'))
SCN_CFG = CFG['scenes']
ESTIMATE = '--estimate' in sys.argv
RAW = next((a for a in sys.argv[1:] if not a.startswith('--')), 'raw')
TEMPO = float(CFG.get('tempo', 1.0))
MAX = CFG.get('maxDuration')
OUT = 'voice'


def segments(x, sr, drop_db=26, hop_s=0.02, merge_s=0.09, min_s=0.06):
    hop = int(sr * hop_s); n = len(x) // hop
    db = np.array([20 * np.log10(np.sqrt(np.mean(x[i * hop:(i + 1) * hop] ** 2)) + 1e-9) for i in range(n)])
    act = db > db.max() - drop_db
    segs, s = [], None
    for i, a in enumerate(act):
        if a and s is None: s = i
        if not a and s is not None: segs.append([s, i]); s = None
    if s is not None: segs.append([s, n])
    merged = []
    for a, b in segs:
        if merged and (a - merged[-1][1]) * hop_s < merge_s: merged[-1][1] = b
        else: merged.append([a, b])
    return [[round(a * hop_s, 2), round(b * hop_s, 2)] for a, b in merged if (b - a) * hop_s > min_s]


def load(path):
    w = wave.open(path); sr = w.getframerate()
    x = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(float) / 32768; w.close()
    return x, sr


def guess(text):
    """Rough reading time and word spans for a line (used before the real audio exists)."""
    words = text.replace('—', ' ').split()
    spans, t = [], 0.0
    for w in words:
        d = 0.12 + 0.065 * len(w.strip('.,!?:;'))
        spans.append([round(t, 2), round(t + d, 2)]); t += d + (0.25 if w[-1] in '.,!?:;' else 0.05)
    return round(t, 2), spans


# 1) raw durations and speech segments at tempo 1.0
raw = []
for i, sc in enumerate(SCN_CFG, 1):
    if ESTIMATE:
        dur, segs = guess(sc['text'])
    else:
        x, sr = load(f'{RAW}/{i:02d}.wav')
        dur, segs = len(x) / sr, segments(x, sr)
    raw.append((dur, segs))


def layout(tempo, squeeze=1.0):
    out, t = [], 0.0
    for i, (sc, (dur, segs)) in enumerate(zip(SCN_CFG, raw), 1):
        lead = sc.get('lead', 0.30) * squeeze
        tail = sc.get('tail', 0.35 if i < len(SCN_CFG) else 1.0) * squeeze
        d = dur / tempo
        s = [[round(a / tempo, 2), round(b / tempo, 2)] for a, b in segs]
        vs = t + lead
        t1 = vs + d + tail
        e = {'id': f's{i}', 't0': round(t, 3), 't1': round(t1, 3), 'vs': round(vs, 3), 'dur': round(d, 3), 'segs': s}
        if sc.get('slam') == 'last' and s: e['slam'] = round(vs + s[-1][0] - 0.04, 3)
        if sc.get('slam') == 'first': e['slam'] = round(vs, 3)
        e['hit'] = e.get('slam', round(vs + sc.get('hit', 0.0), 3))
        out.append(e); t = t1
    return out, t


# 2) fit into maxDuration: speed the voice up (to 1.35x at most), then tighten the pauses
tempo, squeeze = TEMPO, 1.0
scenes, total = layout(tempo)
while MAX and total > MAX and tempo < 1.35:
    tempo = round(tempo + 0.02, 3); scenes, total = layout(tempo)
while MAX and total > MAX and squeeze > 0.4:
    squeeze = round(squeeze - 0.05, 3); scenes, total = layout(tempo, squeeze)
if MAX and total > MAX: print(f'WARNING: {total:.2f}s is still over {MAX}s; shorten the lines')

# 3) write the processed clips (skipped in estimate mode)
if not ESTIMATE:
    os.makedirs(OUT, exist_ok=True)
    for i in range(1, len(SCN_CFG) + 1):
        tmp, dst = f'{OUT}/.tmp{i}.wav', f'{OUT}/{i:02d}.wav'
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', f'{RAW}/{i:02d}.wav', '-af', f'atempo={tempo},highpass=f=70',
                        '-ar', '24000', '-ac', '1', tmp], check=True)
        x, sr = load(tmp); os.remove(tmp)
        live = x[np.abs(x) > 10 ** (-40 / 20)]
        gain = 10 ** (-19 / 20) / max(np.sqrt(np.mean(live ** 2)), 1e-6)       # speech at about -19 dBFS RMS
        gain = min(gain, 0.89 / max(np.abs(x).max(), 1e-6))                      # never clip
        with wave.open(dst, 'wb') as o:
            o.setnchannels(1); o.setsampwidth(2); o.setframerate(sr); o.writeframes((np.clip(x * gain, -1, 1) * 32767).astype('<i2').tobytes())

for e in scenes:
    print(f"{e['id']:>3}  {e['t0']:6.2f}-{e['t1']:6.2f}  voice@{e['vs']:5.2f} ({e['dur']:.2f}s)" + (f"  slam@{e['slam']}" if 'slam' in e else ''))
timing = {'duration': round(total, 3), 'tempo': tempo, 'estimated': ESTIMATE, 'scenes': scenes}
open('timing.js', 'w').write('window.TIMING = ' + json.dumps(timing, indent=1) + ';\n')
print(f'total {total:.2f}s  tempo {tempo}' + ('  (ESTIMATE)' if ESTIMATE else '') + ' -> timing.js')
