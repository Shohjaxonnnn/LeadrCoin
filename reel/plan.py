"""Prepare the voice clips and derive the whole timeline from them.

usage: python3 plan.py <raw_voice_dir> [tempo=1.2]

Reads raw/01..08.wav (from gen_voice.py), speeds them up a little (ad-read pace), levels them, writes voice/NN.wav,
and writes timing.js: scene cuts, voice start times and the moment of each "Yo'q!" slam. index.html (animation),
audio.py (whooshes/impacts) and mix.py (voice placement) all read that one file, so picture and sound stay in sync.
"""
import json, os, subprocess, sys, wave
import numpy as np

RAW = sys.argv[1]
TEMPO = float(sys.argv[2]) if len(sys.argv) > 2 else 1.2
OUT = 'voice'
LEAD = {1: 0.45}                 # silence before the voice in a scene (default 0.30)
TAIL = {6: 1.15, 7: 0.55, 8: 1.10}   # hold after the voice (default 0.35): chips on S6, CTA hold on S8
os.makedirs(OUT, exist_ok=True)


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


scenes, t = [], 0.0
for i in range(1, 9):
    src, dst, tmp = f'{RAW}/{i:02d}.wav', f'{OUT}/{i:02d}.wav', f'{OUT}/.tmp{i}.wav'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-af', f'atempo={TEMPO},highpass=f=70', '-ar', '24000', '-ac', '1', tmp], check=True)
    w = wave.open(tmp); sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(float) / 32768; w.close()
    live = x[np.abs(x) > 10 ** (-40 / 20)]
    gain = 10 ** (-19 / 20) / max(np.sqrt(np.mean(live ** 2)), 1e-6)           # speech at about -19 dBFS RMS
    gain = min(gain, 0.89 / max(np.abs(x).max(), 1e-6))                          # never clip
    y = np.clip(x * gain, -1, 1)
    with wave.open(dst, 'wb') as o:
        o.setnchannels(1); o.setsampwidth(2); o.setframerate(sr); o.writeframes((y * 32767).astype('<i2').tobytes())
    os.remove(tmp)
    dur = len(y) / sr
    segs = segments(y, sr)
    vs = t + LEAD.get(i, 0.30)
    t1 = vs + dur + TAIL.get(i, 0.35)
    sc = {'id': f's{i}', 't0': round(t, 3), 't1': round(t1, 3), 'vs': round(vs, 3), 'dur': round(dur, 3), 'segs': segs}
    if 2 <= i <= 5: sc['slam'] = round(vs + segs[-1][0] - 0.04, 3)             # "Yo'q!" lands on the word
    scenes.append(sc); t = t1
    print(f'S{i}  {sc["t0"]:6.2f}-{sc["t1"]:6.2f}  voice@{vs:5.2f} ({dur:.2f}s)  segs={segs}' + (f'  slam@{sc["slam"]}' if 'slam' in sc else ''))

timing = {'duration': round(t, 3), 'tempo': TEMPO, 'scenes': scenes}
open('timing.js', 'w').write('window.TIMING = ' + json.dumps(timing, indent=1) + ';\n')
print('total', timing['duration'], 's -> timing.js')
