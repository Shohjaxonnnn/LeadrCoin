"""Transcribe a wav with Gemini to check what a TTS clip actually says.
usage: GEMINI_API_KEY=.. python3 transcribe.py file.wav"""
import base64, json, os, subprocess, sys, time

key = os.environ['GEMINI_API_KEY']
audio = base64.b64encode(open(sys.argv[1], 'rb').read()).decode()
prompt = 'Transcribe verbatim in Uzbek Latin script exactly what is spoken, every word, no timestamps, one line.'
body = {'contents': [{'parts': [{'text': prompt}, {'inlineData': {'mimeType': 'audio/wav', 'data': audio}}]}]}
for attempt in range(5):
    r = subprocess.run(['curl', '-sS', '-m', '120', 'https://generativelanguage.googleapis.com/v1beta/models/' + os.environ.get('ASR_MODEL', 'gemini-3.8-flash') + ':generateContent',
                        '-H', f'x-goog-api-key: {key}', '-H', 'Content-Type: application/json', '-d', '@-'],
                       input=json.dumps(body).encode(), capture_output=True)
    d = json.loads(r.stdout)
    if d.get('error', {}).get('code') in (429, 503): time.sleep(4 * (attempt + 1)); continue
    break
print(d['candidates'][0]['content']['parts'][0]['text'].strip() if 'candidates' in d else json.dumps(d, ensure_ascii=False)[:400])
