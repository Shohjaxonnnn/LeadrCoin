"""Generate per-scene voice lines with Gemini TTS (Algenib), build voice track + scene timeline.
usage: GK=... python3 tts.py <video_dir>   (reads <dir>/script.json: {"scenes": ["text", ...]})"""
import json, subprocess, base64, sys, os, hashlib, wave
import numpy as np
D = sys.argv[1]; SR = 48000
CACHE = os.path.join(os.path.dirname(__file__), 'tts_cache'); os.makedirs(CACHE, exist_ok=True)
MODEL, VOICE = os.environ.get('TTS_MODEL', 'gemini-3.8-flash-tts'), os.environ.get('VOICE', 'Algenib')
STYLE = ("Read this Uzbek (Latin script) advertisement line as a native speaker from Tashkent: "
         "pure, natural Uzbek pronunciation with no Russian or English accent. "
         "Young male announcer, energetic, warm and confident, upbeat commercial pace:\n\n")
if os.environ.get('FEMALE') == '1':
    STYLE = STYLE.replace('Young male announcer, energetic, warm and confident', 'Young female announcer, friendly, warm, bright and confident, smiling voice')
MAX_END, MIN_END = 19.7, 15.5
LEAD, TAIL, FIRST = 0.28, 0.3, 0.35

def tts(text):
    h = hashlib.sha1((MODEL + VOICE + STYLE + text).encode()).hexdigest()[:16]
    p = os.path.join(CACHE, h + '.wav')
    if not os.path.exists(p):
        body = {"contents": [{"parts": [{"text": STYLE + text}]}],
                "generationConfig": {"responseModalities": ["AUDIO"],
                    "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOICE}}}}}
        for attempt in range(8):
            r = subprocess.run(['curl', '-s', '-m', '180', '-H', f'x-goog-api-key: {os.environ["GK"]}',
                '-H', 'Content-Type: application/json',
                f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent',
                '-d', json.dumps(body)], capture_output=True)
            d = json.loads(r.stdout or b'{}')
            if 'candidates' in d: break
            print('retry', text[:30], str(d)[:300])
            if 'PerDay' in str(d): raise SystemExit('daily quota exhausted for ' + MODEL)
            import time; time.sleep(30)
        data = base64.b64decode(d['candidates'][0]['content']['parts'][0]['inlineData']['data'])
        if data[:4] != b'RIFF':  # raw 24k PCM -> wav
            import io; b = io.BytesIO(); w = wave.open(b, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(data); w.close(); data = b.getvalue()
        open(p, 'wb').write(data)
    return p

def load(p, tempo):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-af',
        f'aresample={SR},highpass=f=75,atempo={tempo},equalizer=f=250:t=q:w=1.2:g=-2,equalizer=f=4200:t=q:w=1:g=2.5,'
        'acompressor=threshold=-20dB:ratio=3:attack=5:release=80:makeup=2', '-f', 'f32le', '-ac', '1', '-'],
        capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).copy()
    e = np.convolve(np.abs(x), np.ones(480) / 480, 'same'); thr = 0.02 * e.max()
    idx = np.where(e > thr)[0]; a = max(0, idx[0] - int(0.03 * SR)); b = min(len(x), idx[-1] + int(0.06 * SR))
    x = x[a:b]; f = int(0.01 * SR); x[:f] *= np.linspace(0, 1, f); x[-f:] *= np.linspace(1, 0, f)
    return x

scenes = json.load(open(os.path.join(D, 'script.json')))['scenes']
WHOLE = os.environ.get('WHOLE') == '1'
if WHOLE:
    if os.environ.get('NOSTYLE') == '1': STYLE = ''
    else: STYLE = STYLE.replace('line', 'script').replace(':\n\n', '. Leave a clear pause of about one second between paragraphs.\n\n')
    full = load(tts('\n\n'.join(scenes)), 1.0)
    e = np.convolve(np.abs(full), np.ones(480) / 480, 'same'); quiet = e < 0.02 * e.max()
    gaps = []; i = 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]: j += 1
            if j - i > 0.15 * SR: gaps.append(((i + j) // 2, (j - i) / SR))
            i = j
        else: i += 1
    chars = np.array([len(x) for x in scenes], float); cum = np.cumsum(chars)[:-1] / chars.sum()
    exp = cum * len(full)
    # DP: pick increasing gaps closest to expected boundaries, favour longer gaps
    import itertools
    best = None
    for combo in itertools.combinations(range(len(gaps)), len(scenes) - 1):
        cost = sum(abs(gaps[g][0] - x) / SR - 0.8 * gaps[g][1] for g, x in zip(combo, exp))
        if best is None or cost < best[0]: best = (cost, combo)
    cuts = [gaps[g][0] for g in best[1]]
    if os.environ.get('CUTS'): cuts = [int(float(c) * SR) for c in os.environ['CUTS'].split(',')]
    print('gaps', [(round(g[0] / SR, 2), round(g[1], 2)) for g in gaps]); print('cuts', [round(c / SR, 2) for c in cuts], 'expected', np.round(exp / SR, 2))
    bounds = [0] + cuts + [len(full)]
    os.makedirs(os.path.join(D, 'parts'), exist_ok=True); paths = []
    for k in range(len(scenes)):
        seg = full[bounds[k]:bounds[k + 1]]; pp = os.path.join(D, 'parts', f'{k}.wav')
        with wave.open(pp, 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(seg, -1, 1) * 32767).astype(np.int16).tobytes())
        paths.append(pp)
    chars = np.array([len(x) for x in scenes], float); durs = np.array([(bounds[k + 1] - bounds[k]) / SR for k in range(len(scenes))])
    print('split check (s per char):', np.round(durs / chars, 3))
    if (durs / chars).max() / (durs / chars).min() > 2.2: raise SystemExit('split looks wrong')
    def load(p, tempo, _l=load):
        return _l(p, tempo)
else:
    paths = [tts(s) for s in scenes]
raw_len = sum(len(load(p, 1.0)) for p in paths) / SR
n = len(scenes); overhead = FIRST + (n - 1) * (LEAD + TAIL) + 0.75
tempo = max(1.0, raw_len / (MAX_END - overhead))
print(f'raw speech {raw_len:.2f}s -> tempo {tempo:.3f}')
if tempo > 1.25: raise SystemExit('script too long, shorten text')
clips = [load(p, round(tempo, 3)) for p in paths]
starts, voice = [0.0], []
t = FIRST
for i, c in enumerate(clips):
    if i > 0:
        starts.append(round(t + TAIL, 3)); t = starts[-1] + LEAD
    voice.append([round(t, 3), round(t + len(c) / SR, 3)]); t += len(c) / SR
end = round(max(MIN_END, t + 0.75), 2)
if end > MAX_END + 0.3: end = round(t + 0.5, 2)
starts.append(end)
out = np.zeros(int(end * SR) + SR, np.float32)
for c, (a, b) in zip(clips, voice):
    i = int(a * SR); out[i:i + len(c)] += c
out /= np.max(np.abs(out)) + 1e-9; out *= 0.9
with wave.open(os.path.join(D, 'voice_track.wav'), 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32767).astype(np.int16).tobytes())
tl = {'starts': starts, 'voice': voice, 'end': end, 'tempo': round(tempo, 3)}
json.dump(tl, open(os.path.join(D, 'timeline.json'), 'w'))
print(json.dumps(tl))
