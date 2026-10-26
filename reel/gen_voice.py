"""Generate the voice-over clips (one wav per scene) from lines.json in the current video folder.

usage: python3 ../../gen_voice.py [out_dir=raw] [scene numbers ...]      (run from videos/<name>/)

Provider comes from lines.json "voice.provider" (or env TTS_PROVIDER):
  aisha   Aisha AI, https://back.aisha.group — env AISHA_API_KEY; voice.model (e.g. Amir), voice.mood, voice.speed
  gemini  Gemini TTS — env GEMINI_API_KEY; voice.model (TTS model), voice.name (e.g. Puck); language code uz-UZ
Keys are read from the environment only; they are never written to disk.
"""
import base64, json, os, subprocess, sys, tempfile, time, wave

CFG = json.load(open('lines.json')) if os.path.exists('lines.json') else {'scenes': []}
LINES = {i + 1: s['text'] for i, s in enumerate(CFG['scenes'])}
V = CFG.get('voice', {})
PROVIDER = os.environ.get('TTS_PROVIDER', V.get('provider', 'aisha'))


def curl(args, data=None):
    r = subprocess.run(['curl', '-sS', '-m', '180'] + args, input=data, capture_output=True)
    if r.returncode: sys.exit(r.stderr.decode())
    return r.stdout


# ---------- Aisha AI ----------
AISHA = os.environ.get('AISHA_BASE_URL', 'https://back.aisha.group')

def aisha(text):
    key = os.environ.get('AISHA_API_KEY') or sys.exit('set AISHA_API_KEY')
    form = ['--form-string', f'transcript={text}', '--form-string', 'language=uz',
            '--form-string', f"model={V.get('model', 'Gulnoza')}", '--form-string', f"mood={V.get('mood', 'Neutral')}",
            '--form-string', f"speed={V.get('speed', 1.0)}"]
    for attempt in range(5):
        out = curl(['-X', 'POST', f'{AISHA}/api/v1/tts/post/', '-H', f'X-Api-Key: {key}', '-w', '\n%{http_code}'] + form)
        body, code = out.rsplit(b'\n', 1)
        if code in (b'429', b'503'): time.sleep(4 * (attempt + 1)); continue
        break
    try: d = json.loads(body)
    except ValueError: sys.exit(f'aisha {code.decode()}: {body[:300]!r}')
    if code not in (b'200', b'201', b'202'): sys.exit(f'aisha {code.decode()}: ' + json.dumps(d, ensure_ascii=False)[:400])
    url = d.get('audio_path') or d.get('audio_url') or d.get('audioUrl')
    for _ in range(60):                                     # async job: poll until the audio is ready
        if url or not d.get('id'): break
        time.sleep(2)
        d = json.loads(curl([f"{AISHA}/api/v1/tts/status/{d['id']}/", '-H', f'X-Api-Key: {key}']))
        if d.get('status') == 'FAILED': sys.exit('aisha job failed: ' + json.dumps(d, ensure_ascii=False)[:300])
        url = d.get('audio_path') or d.get('audio_url') or d.get('audioUrl')
    if not url: sys.exit('aisha: no audio in response: ' + json.dumps(d, ensure_ascii=False)[:300])
    if not url.startswith('http'): url = f"{AISHA}/{url.lstrip('/')}"
    return curl(['-L', url, '-H', f'X-Api-Key: {key}', '-H', 'Accept: audio/*, */*'])


# ---------- Gemini ----------
def gemini(text):
    key = os.environ.get('GEMINI_API_KEY') or sys.exit('set GEMINI_API_KEY')
    model = V.get('model', 'gemini-3.8-flash-tts')
    body = {'contents': [{'parts': [{'text': text}]}],
            'generationConfig': {'responseModalities': ['AUDIO'],
                                 # the language code is what makes Gemini pronounce Uzbek (Latin drifts into Turkish without it)
                                 'speechConfig': {'languageCode': 'uz-UZ', 'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': V.get('name', 'Puck')}}}}}
    for attempt in range(6):
        d = json.loads(curl([f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent', '-H', f'x-goog-api-key: {key}',
                             '-H', 'Content-Type: application/json', '-d', '@-'], json.dumps(body).encode()))
        if d.get('error', {}).get('code') in (429, 503): time.sleep(4 * (attempt + 1)); continue
        break
    if 'error' in d: sys.exit(json.dumps(d['error'], ensure_ascii=False)[:400])
    part = d['candidates'][0]['content']['parts'][0]['inlineData']
    raw = base64.b64decode(part['data'])
    if raw[:4] == b'RIFF': return raw                       # newer models return a complete wav
    rate = int(part['mimeType'].split('rate=')[1].split(';')[0]) if 'rate=' in part.get('mimeType', '') else 24000
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f: path = f.name
    with wave.open(path, 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(raw)
    data = open(path, 'rb').read(); os.remove(path); return data


def save(audio, path):
    """Any container/codec -> mono 24 kHz wav with leading/trailing silence trimmed."""
    sr = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04'
    with tempfile.NamedTemporaryFile(delete=False) as f: f.write(audio); src = f.name
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-af', f'{sr},areverse,{sr},areverse', '-ar', '24000', '-ac', '1', path], check=True)
    os.remove(src)


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else 'raw'
    only = [int(x) for x in sys.argv[2:]] or list(LINES)
    os.makedirs(out, exist_ok=True)
    tts = {'aisha': aisha, 'gemini': gemini}[PROVIDER]
    for i in only:
        path = os.path.join(out, f'{i:02d}.wav')
        save(tts(LINES[i]), path)
        with wave.open(path) as w:
            print(f'{i:02d}  {w.getnframes() / w.getframerate():.2f}s  {LINES[i]}')


if __name__ == '__main__':
    main()
