import numpy as np, subprocess, json, wave
SR = 48000; TEMPO = 1.15
src = '/root/.claude/uploads/62380302-87ea-5cb7-acb7-cdccbc0f62fc/6bd981de-voicelab-speech.wav'
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-af',
    f'aresample={SR},highpass=f=75,atempo={TEMPO},equalizer=f=250:t=q:w=1.2:g=-2,equalizer=f=4200:t=q:w=1:g=2.5,'
    'acompressor=threshold=-20dB:ratio=3:attack=5:release=80:makeup=2',
    '-f', 'f32le', '-ac', '1', '-'], capture_output=True, check=True).stdout
v = np.frombuffer(raw, np.float32).copy()
# speech segments from silencedetect on the original file (seconds), scaled by tempo
segs = [(0.309, 2.674), (3.106, 4.372), (4.992, 6.845), (7.229, 9.366), (9.892, 12.087), (12.321, 13.420),
        (13.990, 15.293), (15.596, 16.517), (16.974, 18.453), (19.004, 20.114), (20.452, 21.283), (21.696, 22.838)]
PAD = 0.04
clips = []
for a, b in segs:
    i0 = int(max(0, a / TEMPO - PAD) * SR); i1 = int(min(len(v) / SR, b / TEMPO + PAD) * SR)
    c = v[i0:i1].copy(); f = int(0.015 * SR)
    c[:f] *= np.linspace(0, 1, f); c[-f:] *= np.linspace(1, 0, f); clips.append(c)
lines = [[0, 1], [2, 3], [4, 5], [6, 7, 8], [9, 10, 11]]
GAP, LEAD = 0.1, 0.24
starts = [0.0]; place = []
t = 0.35
for k, ln in enumerate(lines):
    if k > 0:
        A = t + 0.22
        if k == 4 and A < t + 0.15: raise SystemExit(f'S5 too late {t}')
        starts.append(A); t = A + LEAD
    for j, ci in enumerate(ln):
        place.append(round(t, 3)); t += len(clips[ci]) / SR + (GAP if j < len(ln) - 1 else 0)
    print(f'scene {k+1}: start {starts[-1]:.2f} voice end {t:.2f}')
END = 20.0; assert t < END - 0.4, t
starts.append(END)
out = np.zeros(int(END * SR), np.float32)
for c, p in zip(clips, place):
    i = int(p * SR); out[i:i + len(c)] += c
out /= np.max(np.abs(out)) + 1e-9; out *= 0.9
with wave.open('voice_track.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32767).astype(np.int16).tobytes())
json.dump({'starts': [round(s, 3) for s in starts], 'old': [0, 3.5, 7, 10.5, 14, 18], 'voice': place, 'end': END}, open('timeline.json', 'w'))
print(json.load(open('timeline.json')))
