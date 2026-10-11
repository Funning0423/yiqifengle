# QA only. python3 make_fx_video.py <frames.json> <frames_dir> <out.mp4> <title> [every]
# Labels each rendered frame (NON-NATIVE offline replica, day/night, wind, flash) and encodes an H.264 mp4.
import json, os, sys, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFont
cfg = json.load(open(sys.argv[1])); src = sys.argv[2]; out = sys.argv[3]; title = sys.argv[4]; every = int(sys.argv[5]) if len(sys.argv) > 5 else 2
font = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'; F1 = ImageFont.truetype(font, 17); F2 = ImageFont.truetype(font, 15)
tmp = tempfile.mkdtemp(prefix='fxvid-'); n = 0
for k, f in enumerate(cfg['frames']):
    if k % every: continue
    p = os.path.join(src, 'f%05d.png' % k)
    if not os.path.exists(p): continue
    im = Image.open(p).convert('RGB'); d = ImageDraw.Draw(im, 'RGBA'); W, H = im.size
    d.rectangle([0, 0, W, 50], fill=(0, 0, 0, 150)); d.text((8, 4), title, font=F1, fill=(255, 255, 255)); d.text((8, 27), '离线复刻预览（Blender Cycles，非 Cocos 渲染）', font=F2, fill=(220, 220, 220))
    mode = '夜里' if f['night'] >= .999 else ('白天' if f['night'] <= .001 else '昼夜过渡 %.2f' % f['night'])
    info = '%s  t=%.2fs  风力 %.2f  闪光 %.2f' % (mode, f['t'], f.get('wind', 0), f['beam']['flash'] if f['night'] > 0 else 0)
    d.rectangle([0, H - 30, W, H], fill=(0, 0, 0, 150)); d.text((8, H - 26), info, font=F2, fill=(255, 255, 255))
    im.save(os.path.join(tmp, 'v%05d.png' % n)); n += 1
fps = cfg['fps'] / every
subprocess.check_call(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(fps), '-i', os.path.join(tmp, 'v%05d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', out])
print('VIDEO', out, n, 'frames @', fps, 'fps')
