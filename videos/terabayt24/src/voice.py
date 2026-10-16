import numpy as np, subprocess, json, wave
SR = 48000; import sys
TEMPO = float(sys.argv[1]) if len(sys.argv) > 1 else 1.18
src = '/tmp/claude-0/-home-user-LeadrCoin/62380302-87ea-5cb7-acb7-cdccbc0f62fc/scratchpad/gem/Algenib.src.wav'
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-af',
    f'aresample={SR},highpass=f=75,atempo={TEMPO},equalizer=f=250:t=q:w=1.2:g=-2,equalizer=f=4200:t=q:w=1:g=2.5,'
    'acompressor=threshold=-20dB:ratio=3:attack=5:release=80:makeup=2',
    '-f', 'f32le', '-ac', '1', '-'], capture_output=True, check=True).stdout
v = np.frombuffer(raw, np.float32).copy()
# speech segments from silencedetect on the original file (seconds), scaled by tempo
segs = [(0.216, 2.614), (2.801, 4.009), (4.196, 6.307), (6.645, 8.903), (9.124, 11.522), (11.711, 12.523),
        (12.735, 13.118), (13.548, 15.136), (15.278, 16.188), (16.378, 18.061), (18.292, 19.530), (19.683, 20.556), (20.730, 22.080)]
PAD = 0.03
clips = []
for a, b in segs:
    i0 = int(max(0, a / TEMPO - PAD) * SR); i1 = int(min(len(v) / SR, b / TEMPO + PAD) * SR)
    c = v[i0:i1].copy(); f = int(0.015 * SR)
    c[:f] *= np.linspace(0, 1, f); c[-f:] *= np.linspace(1, 0, f); clips.append(c)
lines = [[0, 1], [2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]]
LEAD = 0.2
starts = [0.0]; place = []
t = 0.35
for k, ln in enumerate(lines):
    if k > 0:
        A = t + 0.18
        if k == 4 and A < t + 0.15: raise SystemExit(f'S5 too late {t}')
        starts.append(A); t = A + LEAD
    for j, ci in enumerate(ln):
        place.append(round(t, 3)); t += len(clips[ci]) / SR + (min(0.2, max(0.06, (segs[ci + 1][0] - segs[ci][1]) / TEMPO - 2 * PAD)) if j < len(ln) - 1 else 0)
    print(f'scene {k+1}: start {starts[-1]:.2f} voice end {t:.2f}')
END = 20.0; assert t < END - 0.35, t
starts.append(END)
out = np.zeros(int(END * SR), np.float32)
for c, p in zip(clips, place):
    i = int(p * SR); out[i:i + len(c)] += c
out /= np.max(np.abs(out)) + 1e-9; out *= 0.9
with wave.open('voice_track.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32767).astype(np.int16).tobytes())
json.dump({'starts': [round(s, 3) for s in starts], 'old': [0, 3.5, 7, 10.5, 14, 18], 'voice': place, 'end': END}, open('timeline.json', 'w'))
print(json.load(open('timeline.json')))
