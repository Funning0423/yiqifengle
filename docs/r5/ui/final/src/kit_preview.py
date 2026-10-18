"""切图总览：复用切图（9-slice 线标在原图上）+ 新增红点 + 按下态示意。输出 final/assets/kit_preview.png"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from PIL import Image, ImageDraw, ImageFont
import render_final as RF
R = RF.R; FIN = RF.FIN
B = os.path.join(FIN, '..', '..', '..', '..', 'creator-build-project', 'assets', 'bundles', 'board_art')
def F(sz, b=True): return ImageFont.truetype(R.FB if b else R.FR, sz, index=2)
out = Image.new('RGB', (1800, 1500), (244, 238, 226)); d = ImageDraw.Draw(out)
d.text((30, 40), 'v3-A 定稿 · 切图总览（复用为主，新增仅 reddot.png）', font=F(40), fill=(60, 40, 22), anchor='lm')
d.text((30, 85), '品红虚线 = 9-slice / 3-slice 内边距（源 px）；括号 = 游戏里的路径 bundles/board_art/…；按下态 = 同一张图代码变换，不出新图', font=F(22, False), fill=(110, 90, 70), anchor='lm')
def item(name, x, y, maxw, maxh, L=0, T=0, cap=''):
    im = Image.open(os.path.join(B, name + '.png')).convert('RGBA'); w, h = im.size; k = min(maxw / w, maxh / h, 1.0)
    im = im.resize((round(w * k), round(h * k)), Image.LANCZOS); bg = Image.new('RGBA', im.size, (226, 216, 198, 255)); bg.alpha_composite(im)
    out.paste(bg.convert('RGB'), (x, y)); dd = ImageDraw.Draw(out)
    def dash(p0, p1):
        (x0, y0), (x1, y1) = p0, p1; n = int(max(abs(x1 - x0), abs(y1 - y0)) // 8)
        for i in range(0, n, 2): dd.line((x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, x0 + (x1 - x0) * (i + 1) / n, y0 + (y1 - y0) * (i + 1) / n), fill=(220, 40, 160), width=2)
    W2, H2 = im.size
    if L: dash((x + L * k, y), (x + L * k, y + H2)); dash((x + W2 - L * k, y), (x + W2 - L * k, y + H2))
    if T: dash((x, y + T * k), (x + W2, y + T * k)); dash((x, y + H2 - T * k), (x + W2, y + H2 - T * k))
    dd.text((x, y + H2 + 10), cap or name, font=F(20), fill=(60, 40, 22)); dd.text((x, y + H2 + 36), '%s  %d×%d' % ('(' + name + '.png)', w, h), font=F(17, False), fill=(110, 90, 70))
item('popup/panel_frame_9s', 30, 130, 320, 320, 276, 276, '结算面板 9-slice 276（结算页覆写 212 → 木边 23 pt）')
item('popup/title_plank_3s', 420, 130, 360, 200, 252, 0, '标题木牌 3-slice 左右 252')
item('popup/btn_primary_3s', 840, 130, 300, 200, 207, 0, '主按钮 3-slice 左右 207（ART_PX 3）')
item('popup/btn_secondary_3s', 1200, 130, 300, 200, 207, 0, '次按钮 3-slice 左右 207')
item('popup/star_full', 30, 560, 184, 170, cap='星 · 亮')
item('popup/star_empty', 330, 560, 190, 170, cap='星 · 暗')
item('popup/title_4', 500, 600, 286, 98, cap='标题字「过关啦」')
item('popup/title_5', 830, 600, 372, 100, cap='标题字「差一点点」')
item('r2/title_unsaved', 1250, 600, 376, 100, cap='标题字（未保存）')
item('popup/fx_rays', 30, 860, 240, 240, cap='开箱光芒')
item('popup/chest_closed', 320, 880, 260, 220, cap='宝箱 2D 兜底 · 关')
item('popup/chest_open', 620, 860, 260, 240, cap='宝箱 2D 兜底 · 开')
# 按钮常态 / 按下态（代码变换）
x0, y0 = 960, 860
for i, (lab, pr) in enumerate([('常态', False), ('按下 ×0.96 · 下沉 3 · 压暗 240', True)]):
    c = Image.new('RGBA', (360, 110), (226, 216, 198, 255)); RF.S_save = RF.S
    btn = Image.open(os.path.join(B, 'popup/btn_primary_3s.png')).convert('RGBA')
    nine = R.nine('popup/btn_primary_3s', 300, 104, 207, 0, 69, 0)
    if pr:
        nine = nine.resize((round(300 * .96), round(104 * .96)), Image.LANCZOS); px = nine.load()
        r_, g_, b_, a_ = nine.split(); nine = Image.merge('RGBA', [ch.point(lambda v: v * 240 // 255) for ch in (r_, g_, b_)] + [a_])
    c.alpha_composite(nine, ((360 - nine.width) // 2, (110 - nine.height) // 2 + (3 if pr else 0)))
    out.paste(c.convert('RGB'), (x0, y0 + i * 150)); d.text((x0 + 370, y0 + i * 150 + 55), lab, font=F(20), fill=(60, 40, 22), anchor='lm')
# 红点：新增
dot = Image.open(os.path.join(FIN, 'assets', 'reddot.png')).convert('RGBA')
d.text((30, 1210), '新增 · reddot.png 48×48（Blender 一期灯光与色板，pngquant）→ art-src/board-ui/c-popups/slices/reddot.png → bundles/board_art/popup/reddot.png', font=F(22), fill=(160, 40, 30))
for i, (bgc, kk, lab) in enumerate([((244, 238, 226), None, '日 · 24 / 48 / 96 px'), ((251, 248, 236), None, '日 · 奶油底'), ((70, 80, 90), RF.K_HALF, '夜 · ×K_HALF'), ((40, 120, 140), None, '海面上')]):
    x = 30 + i * 300; out.paste(Image.new('RGB', (260, 200), bgc), (x, 1250))
    for j, sz in enumerate([24, 48, 96]):
        im = dot.resize((sz, sz), Image.LANCZOS)
        if kk: r_, g_, b_, a_ = im.split(); im = Image.merge('RGBA', [ch.point(lambda v, f=f: round(v * f)) for ch, f in zip((r_, g_, b_), kk)] + [a_])
        out.paste(im, (x + 20 + j * 70 - (sz - 48) // 2 * (j == 2), 1300 + (96 - sz) // 2), im)
    d.text((x, 1465), lab, font=F(20), fill=(60, 40, 22))
out.save(os.path.join(FIN, 'assets', 'kit_preview.png'), optimize=True); print('ok')
