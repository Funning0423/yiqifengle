# r5 U1 解锁提示 → 红点：两个方案的交互稿（只出图，不写游戏代码）。
#   python3 docs/r5/ui/unlock/src/render_unlock.py      （在仓库根目录跑）
# 底图：本作实机岛屏截图（previews/pm-audit/C0_island_T9_props_reference.png）和阶段一旅程册定稿图（c-popups/r2/journey_book.png），
#       都缩到 390×844 pt @2x 存在本目录。结算帧直接调 result/src/render_result.py 的 v3-A。
import os, sys, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(OUT, '..', 'result', 'src')); import render_result as R
S = 2; FB = R.FB; FR = R.FR
def F(sz, b=True): return ImageFont.truetype(FB if b else FR, round(sz), index=2)
DOT = (0xCE, 0x34, 0x2E, 255); RING = (0xF8, 0xF2, 0xE2, 255)  # 草莓红（调色板唯一的红）+ 奶油描边
def dot(c, x, y, d=12, ring=2):
    g = Image.new('RGBA', c.size); dr = ImageDraw.Draw(g); r = d / 2 * S
    dr.ellipse((x * S - r - 1, y * S - r + 2, x * S + r + 1, y * S + r + 4), fill=(60, 30, 10, 70))
    dr.ellipse((x * S - r, y * S - r, x * S + r, y * S + r), fill=RING); r2 = r - ring * S
    dr.ellipse((x * S - r2, y * S - r2, x * S + r2, y * S + r2), fill=DOT)
    dr.ellipse((x * S - r2 * 0.45, y * S - r2 * 0.75, x * S + r2 * 0.05, y * S - r2 * 0.25), fill=(255, 255, 255, 110))
    c.alpha_composite(g)
def ring(c, x, y, r, col=(214, 40, 160, 255)):
    d = ImageDraw.Draw(c); d.ellipse(((x - r) * S, (y - r) * S, (x + r) * S, (y + r) * S), outline=col, width=3)
def tap(c, x, y):
    g = Image.new('RGBA', c.size); d = ImageDraw.Draw(g)
    for k, a in [(26, 60), (18, 110), (10, 200)]: d.ellipse(((x - k) * S, (y - k) * S, (x + k) * S, (y + k) * S), outline=(255, 255, 255, a), width=4)
    d.ellipse(((x - 7) * S, (y - 7) * S, (x + 7) * S, (y + 7) * S), fill=(255, 255, 255, 200)); c.alpha_composite(g)
def base(name): return Image.open(os.path.join(HERE, name)).convert('RGBA')
ISL_JOURNAL = (219, 719); ISL_SIGN = (368, 546); JB_MEADOW = (279, 404); JB_TIDE_CH = (259, 344)

def frames_A():
    f1, _ = R.v3a(390, 844, 'closed')
    f2 = base('island_390.jpg'); dot(f2, *ISL_JOURNAL); tap(f2, 195, 748)
    f3 = base('journey_390.jpg'); dot(f3, *JB_MEADOW); tap(f3, 160, 431)
    f4 = base('journey_390.jpg')
    return [(f1, '① 过关存档成功\n结算页不再写解锁文字'), (f2, '② 回到小岛\n旅程册右上角出现红点'), (f3, '③ 打开旅程册：岛上的红点消失\n新开放的「花粉草甸」牌上有红点'), (f4, '④ 点进花粉草甸章节页后\n这张牌的红点消失')]
def frames_B():
    f1, _ = R.v3a(390, 844, 'closed')
    f2 = base('island_390.jpg'); dot(f2, *ISL_SIGN, d=14); dot(f2, *ISL_JOURNAL); tap(f2, 300, 578)
    f3 = R.phone(390, 844, 0.0); d = ImageDraw.Draw(f3)
    d.text((195 * S, 330 * S), '直接进入 主线 05（路牌原有行为）', font=F(15 * S), fill=(255, 255, 255, 255), anchor='mm', stroke_width=3, stroke_fill=(40, 30, 20, 200))
    f4 = base('journey_390.jpg'); dot(f4, *JB_TIDE_CH, d=10); tap(f4, 160, 323)
    return [(f1, '① 过关存档成功\n结算页不写解锁文字'), (f2, '② 回到小岛：路牌红点（新主线关）\n旅程册红点（新开放的挑战）'), (f3, '③ 点路牌：照旧进下一关\n路牌红点消失'), (f4, '④ 打开旅程册：潮汐小径的\n「挑战」标记旁有红点，点开后消失')]

def strip(title, sub, frames, notes):
    pw, ph = 390 * S, 844 * S; sc = 0.62; fw, fh = round(pw * sc), round(ph * sc); gap = 36; head = 140
    W = gap + len(frames) * (fw + gap); H = head + fh + 130 + 40 * len(notes) + 20
    out = Image.new('RGB', (W, H), (244, 238, 226)); d = ImageDraw.Draw(out)
    d.text((gap, 50), title, font=F(46), fill=(60, 40, 22), anchor='lm'); d.text((gap, 104), sub, font=F(26, False), fill=(110, 90, 70), anchor='lm')
    for i, (f, cap) in enumerate(frames):
        x = gap + i * (fw + gap); out.paste(f.convert('RGB').resize((fw, fh), Image.LANCZOS), (x, head)); d.rectangle((x - 2, head - 2, x + fw + 1, head + fh + 1), outline=(120, 100, 80), width=2)
        for k, line in enumerate(cap.split('\n')): d.text((x + fw / 2, head + fh + 36 + k * 34), line, font=F(24 if k == 0 else 22, k == 0), fill=(60, 40, 22), anchor='mm')
        if i < len(frames) - 1: ax = x + fw + 6; ay = head + fh / 2; d.polygon([(ax, ay - 12), (ax + 24, ay), (ax, ay + 12)], fill=(150, 110, 70))
    y = head + fh + 120
    for n in notes: d.text((gap, y), n, font=F(24, False), fill=(60, 45, 30)); y += 40
    return out

def dot_spec():
    """红点样式卡：1x / 2x、昼夜、放在道具和章节牌上的位置。"""
    W, H = 1500, 640; out = Image.new('RGBA', (W, H), (244, 238, 226, 255)); d = ImageDraw.Draw(out)
    d.text((40, 50), '红点样式（两个方案共用）', font=F(44), fill=(60, 40, 22, 255), anchor='lm')
    rows = ['直径 12 pt（章节牌上 10 pt，路牌上 14 pt），2 pt 奶油描边 #f8f2e2，填色草莓红 #ce342e（调色板里唯一允许的红）。',
            '不带数字、不带“新”字；位置：道具图标右上角，圆心落在图标外框内 4 pt；章节牌落在章节名右侧 8 pt。',
            '出现时一次性弹入：0 → 1.15 → 1，0.24 s cubicOut；之后不闪、不呼吸（避免和宝箱、小屋提示抢注意力）。',
            '夜间：和星星、宝箱一样乘 K_HALF (0.811, 0.796, 0.781)，保留一点暖色；描边同样乘 K_HALF。',
            '点击区域不变（用道具自己的 hit 区，≥ 64×82 pt），红点本身不可点、不挡触摸。']
    y = 110
    for r in rows: d.text((40, y), r, font=F(25, False), fill=(60, 45, 30, 255)); y += 44
    def sample(cx, cy, scale, night):
        c = Image.new('RGBA', (220, 220), (0, 0, 0, 0)); g = R.S
        tmp = Image.new('RGBA', (110 * S, 110 * S), (0, 0, 0, 0)); R.S = S
        bg = Image.new('RGBA', tmp.size, (58, 140, 160, 255) if not night else (29, 87, 112, 255)); tmp.alpha_composite(bg)
        R.sprite(tmp, 'r2/icon_charm', 55, 55, 64)
        dot(tmp, 55 + 26, 55 - 26, 12)
        if night:
            px = tmp.load(); kx = (0.811, 0.796, 0.781)
        out.alpha_composite(tmp.resize((round(tmp.width * scale), round(tmp.height * scale)), Image.LANCZOS), (cx, cy))
        R.S = g
    sample(60, 360, 1.0, False); sample(340, 360, 1.0, True); sample(620, 390, 0.5, False)
    for x, t in [(170, '白天 2x'), (450, '夜间 2x（乘 K_HALF 示意）'), (675, '1x')]: d.text((x, 600), t, font=F(22, False), fill=(60, 45, 30, 255), anchor='mm')
    return out.convert('RGB')

def state_png(name, title, nodes, edges):
    """极简状态图：nodes = [(id, label, x, y)], edges = [(a, b, label)]。坐标单位 px。"""
    W = max(x for _, _, x, _ in nodes) + 300; H = max(y for _, _, _, y in nodes) + 160
    im = Image.new('RGB', (W, H), (250, 247, 240)); d = ImageDraw.Draw(im); d.text((30, 40), title, font=F(34), fill=(60, 40, 22), anchor='lm')
    pos = {}; bw, bh = 300, 96
    for i, lab, x, y in nodes:
        pos[i] = (x, y); d.rounded_rectangle((x - bw / 2, y - bh / 2, x + bw / 2, y + bh / 2), radius=22, fill=(255, 252, 244), outline=(150, 105, 55), width=3)
        for k, line in enumerate(lab.split('\n')): d.text((x, y - (len(lab.split('\n')) - 1) * 15 + k * 30), line, font=F(23 if k == 0 else 20, k == 0), fill=(60, 40, 22), anchor='mm')
    for a, b, lab in edges:
        (x0, y0), (x1, y1) = pos[a], pos[b]
        if a == b: continue
        dx, dy = x1 - x0, y1 - y0
        def clip(ddx, ddy):  # 从框心沿 (ddx, ddy) 走到框边
            tx = (bw / 2 + 8) / abs(ddx) if ddx else 1e9; ty = (bh / 2 + 8) / abs(ddy) if ddy else 1e9; t = min(tx, ty); return ddx * t, ddy * t
        cx0, cy0 = clip(dx, dy); sx, sy = x0 + cx0, y0 + cy0; ex, ey = x1 - cx0, y1 - cy0
        d.line((sx, sy, ex, ey), fill=(120, 90, 60), width=3); ang = math.atan2(ey - sy, ex - sx)
        d.polygon([(ex, ey), (ex - 18 * math.cos(ang - 0.4), ey - 18 * math.sin(ang - 0.4)), (ex - 18 * math.cos(ang + 0.4), ey - 18 * math.sin(ang + 0.4))], fill=(120, 90, 60))
        mx, my = (sx + ex) / 2, (sy + ey) / 2; tw_ = F(19, False).getlength(lab)
        d.rectangle((mx - tw_ / 2 - 6, my - 15, mx + tw_ / 2 + 6, my + 15), fill=(250, 247, 240)); d.text((mx, my), lab, font=F(19, False), fill=(150, 40, 120), anchor='mm')
    im.save(os.path.join(OUT, name), optimize=True); return im

def build():
    sizes = {}
    a = strip('方案 A · 一个入口：所有解锁都汇到旅程册', '岛屏只有「旅程册」会亮红点；进册子后，红点落到具体的章节牌上', frames_A(),
              ['出现时机：存档成功（result.saved 且 completionRecorded）后，算出「新开放集合 − 已看过集合」不为空，回到岛屏时旅程册亮点。',
               '消失：打开旅程册即清掉岛上的点；章节牌上的点在点进该章节页（openChapter）时清掉；集合写进 localStorage，不写旅程存档。'])
    p = os.path.join(OUT, 'unlock_A_journal.jpg'); a.save(p, quality=86, optimize=True); sizes['A'] = os.path.getsize(p)
    b = strip('方案 B · 按类型分两处：新主线关 → 路牌，新挑战 / 新章节 → 旅程册', '路牌本来就是“继续旅程”，新关卡的红点放在它身上最顺手；挑战和章节仍在旅程册里', frames_B(),
              ['出现时机：同 A；但新主线关（nextStageId 变了）记到路牌，挑战 / 章节（islandGates().r5[*].ok 由 false 变 true）记到旅程册。',
               '消失：路牌点在点路牌（进关）时清掉；旅程册点在打开册子时清掉；挑战标记旁的点在点进那一章时清掉。'])
    p = os.path.join(OUT, 'unlock_B_signpost.jpg'); b.save(p, quality=86, optimize=True); sizes['B'] = os.path.getsize(p)
    p = os.path.join(OUT, 'reddot_spec.png'); dot_spec().save(p, optimize=True); sizes['spec'] = os.path.getsize(p)
    state_png('state_A.png', '方案 A 状态图（每个新开放项 id 一份，岛屏的点 = 任一项处于「未看」）',
              [('idle', '未开放', 200, 170), ('fresh', '已开放 · 未看\n岛：旅程册亮点\n册：章节牌亮点', 720, 170), ('book', '册子已打开\n岛上的点灭\n章节牌仍亮', 1240, 170), ('seen', '已看过\n全部灭', 1240, 470), ('legacy', '老玩家 · 首次升级\n直接记为已看', 200, 470)],
              [('idle', 'fresh', '存档成功且新开放'), ('fresh', 'book', '点旅程册'), ('book', 'seen', '点进该章节'), ('fresh', 'seen', '直接从旅程进入该地区'), ('legacy', 'seen', '首次启动迁移')])
    state_png('state_B.png', '方案 B 状态图（路牌点和旅程册点分开记）',
              [('idle', '未开放', 200, 320), ('signN', '新主线关 · 未看\n路牌亮点', 720, 170), ('bookN', '新挑战 / 章节 · 未看\n旅程册亮点', 720, 470), ('bookO', '册子已打开\n挑战标记旁亮点', 1240, 470), ('seen', '已看过\n全部灭', 1240, 170)],
              [('idle', 'signN', '存档成功，nextStageId 变了'), ('idle', 'bookN', '存档成功，gate.ok 变 true'), ('signN', 'seen', '点路牌进关'), ('bookN', 'bookO', '点旅程册'), ('bookO', 'seen', '点进该章节')])
    sizes['stateA'] = os.path.getsize(os.path.join(OUT, 'state_A.png')); sizes['stateB'] = os.path.getsize(os.path.join(OUT, 'state_B.png'))
    print(sizes)
if __name__ == '__main__': build()
