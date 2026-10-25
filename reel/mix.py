"""Mix a voice-over into the rendered reel without re-rendering any frames.

usage: python3 mix.py <voice_dir> <reel.mp4> <out.mp4> [soundtrack.wav]

<voice_dir> holds 01..08 (wav/mp3/m4a/ogg), one clip per scene (see voiceover.md); or a single
voice.* that is laid at t=0. Music is ducked under the voice (sidechain), the result is
loudness-normalised to -14 LUFS and muxed over the untouched video stream.
"""
import glob, os, subprocess, sys

START = {1: 0.40, 2: 3.20, 3: 5.60, 4: 7.60, 5: 9.60, 6: 11.30, 7: 14.30, 8: 17.40}  # keep in sync with voiceover.md
EXT = ('wav', 'mp3', 'm4a', 'ogg', 'flac', 'aac')

def find(d, stem):
    for e in EXT:
        p = os.path.join(d, f'{stem}.{e}')
        if os.path.exists(p): return p
    return None

def main():
    if len(sys.argv) < 4: sys.exit(__doc__)
    vdir, reel, out = sys.argv[1:4]
    music = sys.argv[4] if len(sys.argv) > 4 else os.path.join(os.path.dirname(reel) or '.', 'soundtrack.wav')
    clips = [(find(vdir, f'{i:02d}'), t) for i, t in START.items()]
    clips = [(p, t) for p, t in clips if p]
    if not clips:
        single = find(vdir, 'voice')
        if not single: sys.exit(f'no voice clips found in {vdir}')
        clips = [(single, 0.0)]
    cmd = ['ffmpeg', '-y', '-v', 'error', '-i', reel, '-i', music]
    for p, _ in clips: cmd += ['-i', p]
    f = []
    for k, (_, t) in enumerate(clips):
        ms = int(t * 1000)
        f.append(f'[{k + 2}:a]aformat=sample_rates=48000:channel_layouts=stereo,highpass=f=70,adelay={ms}|{ms}[v{k}]')
    vin = ''.join(f'[v{k}]' for k in range(len(clips)))
    f.append(f'{vin}amix=inputs={len(clips)}:normalize=0:duration=longest,volume=1.6,apad=whole_dur=20,asplit=2[vbus][vsc]')
    f.append('[1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.8[m]')
    f.append('[m][vsc]sidechaincompress=threshold=0.02:ratio=9:attack=8:release=320:makeup=1[duck]')
    f.append('[duck][vbus]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=9,atrim=0:20[a]')
    cmd += ['-filter_complex', ';'.join(f), '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
            '-ar', '48000', '-movflags', '+faststart', out]
    subprocess.run(cmd, check=True)
    print('wrote', out)

main()
