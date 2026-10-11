#!/usr/bin/env python3
"""T5: per-frame mean luma of tower / house / sea ROIs in a native capture (needs ffmpeg + Pillow).
usage: measure_video_jump.py VIDEO START_S DURATION_S [out.csv]   ROIs are for the 586x1266 near native capture."""
import sys, subprocess, tempfile, glob, os
from PIL import Image
video, start, dur = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]); out = sys.argv[4] if len(sys.argv) > 4 else None
s = 1266 / 1024
ROIS = {'tower': (130, 370, 235, 430), 'house': (245, 445, 320, 470), 'sea': (20, 700, 450, 760)}
ROIS = {k: tuple(int(v * s) for v in b) for k, b in ROIS.items()}
with tempfile.TemporaryDirectory() as d:
    subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(start), '-t', str(dur), '-i', video, '-vsync', '0', os.path.join(d, 'f%05d.png')], check=True)
    rows, prev = [], None
    for i, f in enumerate(sorted(glob.glob(os.path.join(d, 'f*.png')))):
        im = Image.open(f).convert('L'); r = {}
        for k, b in ROIS.items():
            h = im.crop(b).histogram(); r[k] = sum(j * v for j, v in enumerate(h)) / sum(h)
        jump = {k: (r[k] - prev[k]) / max(prev[k], 1) * 100 for k in r} if prev else {k: 0.0 for k in r}
        rows.append((i, start + i / 60, r, jump)); prev = r
worst = max(rows, key=lambda x: max(abs(v) for v in x[3].values()))
print(f"frames={len(rows)} worst frame {worst[0]} t~{worst[1]:.3f}s " + ' '.join(f"{k}={worst[2][k]:.1f}({worst[3][k]:+.1f}%)" for k in ROIS))
if out:
    with open(out, 'w') as fh:
        fh.write('frame,t_s,' + ','.join(f'{k},{k}_jump_pct' for k in ROIS) + '\n')
        for i, t, r, j in rows: fh.write(f'{i},{t:.4f},' + ','.join(f'{r[k]:.2f},{j[k]:.2f}' for k in ROIS) + '\n')
