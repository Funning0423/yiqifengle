# QA only: arrows + titles on blender_global_wind_preview.py frames -> wind_compare.png (t = 3 s stills) + wind_compare.mp4.
# python3 make_wind_compare.py <global_wind dir>
import json, math, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont
D = sys.argv[1]; F = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'; FB = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
SEG = [('before', '现状（帆船旅程，草原 yaw 180°）', '草阵风朝 %s；旗 %s；帆受风侧 %s：草与旗、帆相反'),
       ('after_default', '统一后 · 默认风（GlobalWind 默认 109°，船静止）', '草 %s；旗 %s；帆受风侧 %s：同向'),
       ('after_az250', '统一后 · setGlobalWindAzimuth(250)（船静止）', '草 %s；旗 %s；帆受风侧 %s：一起转，帆换到左舷')]
COL = {'wind': (20, 20, 20), 'grass': (40, 170, 40), 'pennant': (220, 30, 30), 'sail': (30, 90, 220)}
NAME = {'wind': '风', 'grass': '草', 'pennant': '旗', 'sail': '帆'}
def az(v): return '%d°' % round(math.degrees(math.atan2(v[0], v[1])) % 360)
def arrow(d, a, b, col, w=6):
    d.line([tuple(a[:2]), tuple(b[:2])], fill=col, width=w); ang = math.atan2(b[1] - a[1], b[0] - a[0]); L = 18
    d.polygon([tuple(b[:2]), (b[0] - L * math.cos(ang - .45), b[1] - L * math.sin(ang - .45)), (b[0] - L * math.cos(ang + .45), b[1] - L * math.sin(ang + .45))], fill=col)
def deco(img, J, key, title, sub):
    im = img.convert('RGB'); d = ImageDraw.Draw(im); f = ImageFont.truetype(F, 20); fb = ImageFont.truetype(FB, 24)
    for k in ('grass', 'pennant', 'sail') + (('wind',) if key != 'before' else ()):
        a, b = J['windAt' if k == 'wind' else k]; arrow(d, a, b, (255, 255, 255), 10); arrow(d, a, b, COL[k], 5); d.text((b[0] + 6, b[1] - 12), NAME[k], font=f, fill=COL[k], stroke_width=3, stroke_fill=(255, 255, 255))
    w = J['worldDirs']; d.rectangle([0, 0, im.width, 70], fill=(255, 255, 255))
    d.text((10, 4), title, font=fb, fill=(20, 20, 20)); d.text((10, 38), sub % (az(w['grass']), az(w['pennant']), az(w['sail'])) + ('   风 ' + az(w['wind']) if key != 'before' else ''), font=f, fill=(60, 60, 60))
    return im
stills = []; os.makedirs(os.path.join(D, 'annot'), exist_ok=True); n = 0
for key, title, sub in SEG:
    J = json.load(open(os.path.join(D, key + '.json')))
    i = 0
    while os.path.exists(os.path.join(D, 'frames', '%s_%03d.png' % (key, i))):
        im = deco(Image.open(os.path.join(D, 'frames', '%s_%03d.png' % (key, i))), J, key, title, sub); im.save(os.path.join(D, 'annot', '%04d.png' % n)); n += 1
        if i == 24: stills.append(im)
        i += 1
W = sum(s.width for s in stills) + 10 * (len(stills) - 1); o = Image.new('RGB', (W, stills[0].height + 40), (255, 255, 255)); x = 0
for s in stills: o.paste(s, (x, 0)); x += s.width + 10
ImageDraw.Draw(o).text((10, stills[0].height + 6), '箭头 = 世界 xz 方向（世界轴，azimuth = atan2(x,z)）。草为阵风行进方向（摆动轴相同），旗 = 旗面质心方向，帆 = 主帆鼓向的一舷（船体横向 ×side）。黑箭头 = GlobalWind。t = 3 s 帧；Cycles 64 + OIDN。草未放大。', font=ImageFont.truetype(F, 20), fill=(40, 40, 40))
o.save(os.path.join(D, 'wind_compare.png'))
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '8', '-i', os.path.join(D, 'annot', '%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '24', os.path.join(D, 'wind_compare.mp4')], check=True)
print('frames', n, 'still', o.size)
