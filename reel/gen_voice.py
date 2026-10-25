"""Generate the voice-over clips with Gemini TTS (one wav per scene, see voiceover.md).

usage: GEMINI_API_KEY=... python3 gen_voice.py [out_dir=voice] [scene numbers ...]
env:   TTS_MODEL (default gemini-3.8-flash-tts), TTS_VOICE (default Puck), TTS_LANG (uz-UZ), TTS_STYLE ('')

The key is read from the environment only; it is never written to disk.
"""
import base64, json, os, subprocess, sys, time, wave

KEY = os.environ.get('GEMINI_API_KEY') or sys.exit('set GEMINI_API_KEY')
MODEL = os.environ.get('TTS_MODEL', 'gemini-3.8-flash-tts')
VOICE = os.environ.get('TTS_VOICE', 'Puck')
API = 'https://generativelanguage.googleapis.com/v1beta/models'

# keep in sync with voiceover.md
LINES = {
    1: 'Nasiya — yashirin to‘lovlar bormi?',
    2: 'Boshlang‘ich to‘lov? Yo‘q!',
    3: 'Foiz va ortiqcha to‘lov? Yo‘q!',
    4: 'Kechiksangiz jarima? Yo‘q!',
    5: 'iCloud bloklash? Yo‘q!',
    6: 'Faqat pasport va karta kerak.',
    7: 'Sovg‘a! Har bir iPhone bilan chexol, oyna va zaryadka!',
    8: 'Orzu Mobile — ariza qoldiring!',
}
# The language code is what makes Gemini pronounce Uzbek properly (without it Latin script drifts into Turkish).
# Style prefixes / audio tags tend to be read out loud, so none by default; set TTS_STYLE to try one.
LANG = os.environ.get('TTS_LANG', 'uz-UZ')
STYLE = os.environ.get('TTS_STYLE', '')


def call(model, body):
    for attempt in range(6):
        r = subprocess.run(['curl', '-sS', '-m', '120', f'{API}/{model}:generateContent', '-H', f'x-goog-api-key: {KEY}',
                            '-H', 'Content-Type: application/json', '-d', '@-'], input=json.dumps(body).encode(), capture_output=True)
        if r.returncode: sys.exit(r.stderr.decode())
        d = json.loads(r.stdout)
        if d.get('error', {}).get('code') in (429, 503): time.sleep(4 * (attempt + 1)); continue   # busy / rate limit
        return d
    return d


def tts(text):
    d = call(MODEL, {'contents': [{'parts': [{'text': STYLE + text}]}],
                     'generationConfig': {'responseModalities': ['AUDIO'],
                                          'speechConfig': {'languageCode': LANG,
                                                           'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': VOICE}}}}})
    if 'error' in d: sys.exit(json.dumps(d['error'], ensure_ascii=False))
    part = d['candidates'][0]['content']['parts'][0]['inlineData']
    return base64.b64decode(part['data']), part.get('mimeType', '')


def trim(path):
    """Cut leading/trailing silence so the clip starts exactly on the first word."""
    sr = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04'
    tmp = path + '.tmp.wav'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', path, '-af', f'{sr},areverse,{sr},areverse', '-ar', '24000', '-ac', '1', tmp], check=True)
    os.replace(tmp, path)


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else 'voice'
    only = [int(x) for x in sys.argv[2:]] or list(LINES)
    os.makedirs(out, exist_ok=True)
    for i in only:
        pcm, mime = tts(LINES[i])
        path = os.path.join(out, f'{i:02d}.wav')
        if pcm[:4] == b'RIFF':                                # newer models return a complete wav
            open(path, 'wb').write(pcm)
        else:                                                  # older ones: raw s16le mono PCM, rate in the mime type
            rate = int(mime.split('rate=')[1].split(';')[0]) if 'rate=' in mime else 24000
            with wave.open(path, 'wb') as w:
                w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(pcm)
        trim(path)
        with wave.open(path) as w:
            dur = w.getnframes() / w.getframerate()
        print(f'{i:02d}  {dur:.2f}s  {mime}  {LINES[i]}')


if __name__ == '__main__':
    main()
