"""Make a short Uzbek sample per Gemini voice so they can be compared by ear.
usage: GEMINI_API_KEY=.. TTS_MODEL=.. python3 tools/voice_samples.py out_dir Voice1 Voice2 ..."""
import os, subprocess, sys, wave
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import gen_voice as g

TEXT = 'Boshlang‘ich to‘lov? Yo‘q! Foiz va ortiqcha to‘lov? Yo‘q! Orzu Mobile — ariza qoldiring!'
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
for v in sys.argv[2:]:
    g.VOICE = v
    try:
        pcm, mime = g.tts(TEXT)
    except SystemExit as e:
        print(v, 'ERR', str(e)[:140]); continue
    wav = f'{out}/{v}.wav'
    if pcm[:4] == b'RIFF': open(wav, 'wb').write(pcm)
    else:
        with wave.open(wav, 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-q:a', '3', f'{out}/{v}.mp3'], check=True)
    with wave.open(wav) as w: print(v, f'{w.getnframes() / w.getframerate():.1f}s', 'ok')
