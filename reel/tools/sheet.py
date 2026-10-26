"""Contact sheet of a video's scenes (one frame near the end of each scene, plus mid-scene frames).
usage (from videos/<name>/): python3 ../../tools/sheet.py out.png"""
import glob, json, os, subprocess, sys, tempfile
from PIL import Image

T = json.loads(open('timing.js').read().split('=', 1)[1].strip().rstrip(';'))
times = []
for s in T['scenes']:
    times += [round(s['vs'] + s['dur'] * 0.5, 2), round(s['t1'] - 0.2, 2)]
tmp = tempfile.mkdtemp()
subprocess.run(['node', os.path.join(os.path.dirname(__file__), 'frames.js'), tmp] + [str(t) for t in times], check=True)
files = sorted(glob.glob(f'{tmp}/f_*.png'), key=lambda f: float(os.path.basename(f)[2:-4]))
ims = [Image.open(f).resize((270, 480)) for f in files]
cols = len(T['scenes'])
sheet = Image.new('RGB', (274 * cols, 484 * 2), (30, 30, 30))
for k, im in enumerate(ims):                # row 0: mid-line, row 1: end of scene
    sheet.paste(im, ((k // 2) * 274, (k % 2) * 484))
sheet.save(sys.argv[1]); print(sys.argv[1], sheet.size, times)
