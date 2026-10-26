"""Make a short Uzbek sample per voice so voices can be compared by ear.
usage: TTS_PROVIDER=gemini|aisha TTS_MODEL=<model> python3 tools/voice_samples.py out_dir Voice1 Voice2 ...
(gemini: voice = prebuilt voice name, TTS_MODEL = TTS model; aisha: voice = Aisha model name, e.g. Amir)"""
import os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import gen_voice as g

TEXT = 'Boshlang‘ich to‘lov? Yo‘q! Foiz va ortiqcha to‘lov? Yo‘q! Orzu Mobile — ariza qoldiring!'
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
for v in sys.argv[2:]:
    if g.PROVIDER == 'gemini': g.V = {'model': os.environ.get('TTS_MODEL', 'gemini-3.8-flash-tts'), 'name': v}
    else: g.V = {'model': v, 'mood': os.environ.get('TTS_MOOD', 'Neutral'), 'speed': 1.0}
    try:
        g.save(g.aisha(TEXT) if g.PROVIDER == 'aisha' else g.gemini(TEXT), f'{out}/{v}.wav')
    except SystemExit as e:
        print(v, 'ERR', str(e)[:140]); continue
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', f'{out}/{v}.wav', '-codec:a', 'libmp3lame', '-q:a', '3', f'{out}/{v}.mp3'], check=True)
    print(v, 'ok')
