# U3 首帧合成：与 art-src/board-ui/a-loading/src/first_screen.py 第 1 步完全相同的叠加（logo ×0.78 中心 (389,340)、title ×0.92 中心 (375,452)、空轨道 bar_track 中心 y 1293），
# 只换底图 = 新 fs50k 底图；jpg_under 同样从 q92 往下找，progressive + 4:2:0；上限从 60000 收紧到 58208（不超过原文件 58,207 B）。
# python3 u3_compose.py BASE_FS.jpg OUT.jpg [SLICES_DIR] [LIMIT]
import sys, io, json
from PIL import Image
base, out = sys.argv[1], sys.argv[2]
S = sys.argv[3] if len(sys.argv) > 3 else '/workspace/u3/src/art-src/board-ui/a-loading/slices'
LIMIT = int(sys.argv[4]) if len(sys.argv) > 4 else 58208
W, H = 750, 1624; LOGO_S = 0.78; TITLE_S = 0.92
logo = Image.open(S+'/logo.png').convert('RGBA'); logo = logo.resize((round(logo.width*LOGO_S), round(logo.height*LOGO_S)), Image.LANCZOS)
title = Image.open(S+'/title.png').convert('RGBA'); title = title.resize((round(title.width*TITLE_S), round(title.height*TITLE_S)), Image.LANCZOS)
track = Image.open(S+'/bar_track.png').convert('RGBA')
LOGO_C = (375+round(18*LOGO_S), 340); TITLE_C = (375, 452); BAR_CY = round(0.796*H)
BX = (W-track.width)//2; BY = BAR_CY-track.height//2
def box(im, c): return (round(c[0]-im.width/2), round(c[1]-im.height/2))
LB = box(logo, LOGO_C); TB = box(title, TITLE_C)
b0 = Image.open(base); assert b0.size == (W, H), b0.size
im = b0.convert('RGBA'); im.alpha_composite(logo, LB); im.alpha_composite(title, TB); im.alpha_composite(track, (BX, BY)); im = im.convert('RGB')
for q in range(92, 60, -1):
    b = io.BytesIO(); im.save(b, 'JPEG', quality=q, optimize=True, progressive=True, subsampling=2)
    if b.tell() < LIMIT: open(out, 'wb').write(b.getvalue()); break
print(json.dumps(dict(out=out, q=q, bytes=b.tell(), logo=dict(size=logo.size, topleft=LB, center=LOGO_C), title=dict(size=title.size, topleft=TB, center=TITLE_C), track=dict(size=track.size, topleft=(BX, BY), center_y=BAR_CY))))
