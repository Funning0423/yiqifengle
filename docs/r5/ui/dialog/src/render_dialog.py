"""U2 对话框对比图：现有（IslandToast）· 方案 A 海风气泡 · 方案 B 折角纸牌。
底图（2026-10-18 重出）：两种屏都是 Blender 新渲——当前基线角色 + bc81575f 岛场景 + 游戏回家跟拍机位（final/src/render_scene_bg.py）。
旧底图 evidence-mac 11-return-7s.jpg 是 r4 时期旧模型，已停用。
单位 pt，2× 出图。只出对比图，不是定稿。"""
import os, json
from PIL import Image, ImageDraw, ImageFont, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.dirname(HERE)
S = 2
F_NAME = os.path.join(HERE, 'fonts', 'RHR-CN-Bold.preview-subset.ttf')        # 资源圆体 Bold（OFL 1.1）子集
F_BODY = os.path.join(HERE, 'fonts', 'NotoSansSC-Bold.preview-subset.otf')    # 思源黑体 / Noto Sans SC Bold（OFL 1.1）子集
F_SYS = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'               # 现有吐司：系统字体（示意）
F_UI = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'                   # 只用于图框外的标题和说明
def font(p, sz, idx=0): return ImageFont.truetype(p, round(sz * S), index=idx)

LINES = ['风把海的味道吹过来了。', '今天也去灯塔那边走走吧。']
SPEAKER = '阿芳'
# 名字标签配色：角色的标志色，白字对比 ≥ 4.5:1（见 README §3）
TAG = {'阿芳': (0xA0, 0x62, 0x0E), '阿宁': (0x2A, 0x7B, 0x80), '老铆': (0x5A, 0x7A, 0x3C)}
BODY = (0x5A, 0x46, 0x36); CREAM = (0xFF, 0xF7, 0xE4); CREAM_B = (0xFB, 0xF2, 0xDC); RIM_B = (0xDC, 0xC5, 0x9A)
ACCENT = (0xE0, 0x96, 0x3C); TEAL = (0x2F, 0x86, 0x8A)

# 2026-10-18 重出：底图换成当前基线 Blender 新渲（见 final/src/render_scene_bg.py），女孩区域 = 角色网格投影包围盒（json 里给）。
SAFE = {(390, 844): dict(top=47, bottom=34), (375, 667): dict(top=20, bottom=34)}   # 与 U1 layouts_7screens 同源
BGDIR = os.path.join(OUT, 'final', 'raw', 'bg')
SRC_A = '底图：Blender 新渲 · 角色 GLB /workspace/yiqifengle/previews/角色动画bot/r5-wrist-footik/final/chr_b_r5g2_r5wrist_v4_final.glb'
SRC_B = '场景源 SHA bc81575f：creator-project/assets/firstslice/combined_visual_m.glb + combined_anchors_m.json · 机位 TRANSITION_CAMERA.returnFollow.out（回家跟拍，position/target 见 final/raw/bg/*.json）'

def scene(W, H):
    info = json.load(open(os.path.join(BGDIR, 'bg_%dx%d_day.json' % (W, H))))
    im = Image.open(os.path.join(BGDIR, 'bg_%dx%d_day.jpg' % (W, H))).convert('RGB').resize((W * S, H * S), Image.LANCZOS)
    g = tuple(info['girl_bbox_pt']); hx, hy = info['girl_head_pt']; face = (hx - 40, g[1], hx + 40, hy + 25)   # 背影：头部（帽子到后脑）
    return im, [g], face, 1.0, 0, 0

def rr(d, box, r, **kw): d.rounded_rectangle([v * S for v in box], radius=r * S, **kw)
def shadow(c, box, r, off=4, blur=10, a=46, poly=None):
    g = Image.new('L', c.size, 0); dg = ImageDraw.Draw(g)
    if poly: dg.polygon([(x * S, (y + off) * S) for x, y in poly], fill=a)
    else: dg.rounded_rectangle([box[0] * S, (box[1] + off) * S, box[2] * S, (box[3] + off) * S], radius=r * S, fill=a)
    g = g.filter(ImageFilter.GaussianBlur(blur * S / 2)); sh = Image.new('RGBA', c.size, (60, 40, 20, 255)); sh.putalpha(g); c.alpha_composite(sh)
def tw(fn, s, sz): return ImageDraw.Draw(Image.new('L', (1, 1))).textlength(s, font=font(fn, sz)) / S

def home_bar(d, W, H): rr(d, (W / 2 - 67, H - 13, W / 2 + 67, H - 8), 3, fill=(20, 20, 20, 255))

def existing(c, W, H):
    """现有：IslandToast（ui/IslandToast.ts）——仓库里唯一的岛上文字条：奶油胶囊、金色细边、棕字 15、单行、y=132。"""
    d = ImageDraw.Draw(c); s = LINES[0]; w = min(330, tw(F_SYS, s, 15) + 40); h = 32; cx, cy = W / 2, 132
    rr(d, (cx - w / 2 + 1, cy - h / 2 + 2, cx + w / 2 + 1, cy + h / 2 + 2), h / 2, fill=(40, 30, 20, 40))
    rr(d, (cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2), h / 2, fill=(248, 242, 226, 240), outline=(201, 177, 133, 255), width=round(1.5 * S))
    d.text((cx * S, cy * S), s, font=font(F_SYS, 15, 2), fill=(99, 63, 33, 255), anchor='mm')
    return [(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)]

def plan_a(c, W, H, top, girl_cx, compact=False):
    """A 海风气泡：整宽大圆角奶油气泡；名字胶囊骑在左上沿（水平、不倾斜）；上沿一个小尾巴指向说话的人；右下角翻页提示。"""
    d = ImageDraw.Draw(c); m = 14; fs, lh = (16, 25) if compact else (17, 27); pad_t, pad_b = (26, 22) if compact else (30, 24)
    h = pad_t + lh * len(LINES) + pad_b; x0, x1 = m, W - m; box = (x0, top, x1, top + h); r = 30
    tx = max(x0 + 70, min(x1 - 40, girl_cx)); tail = [(tx - 11, top + 1), (tx, top - 11), (tx + 11, top + 1)]
    shadow(c, box, r); shadow(c, None, 0, poly=tail, a=30)
    rr(d, box, r, fill=CREAM + (250,)); d.polygon([(x * S, y * S) for x, y in tail], fill=CREAM + (250,))
    rr(d, (x0 + 3, top + 3, x1 - 3, top + h - 3), r - 3, outline=(240, 226, 196, 255), width=round(1.5 * S))   # 内沿一圈很淡的奶油线
    name = SPEAKER; nw = tw(F_NAME, name, 16) + 36; nh = 32; nx = x0 + 22; ny = top
    rr(d, (nx, ny - nh / 2 + 2, nx + nw, ny + nh / 2 + 2), nh / 2, fill=(70, 45, 20, 60))
    rr(d, (nx, ny - nh / 2, nx + nw, ny + nh / 2), nh / 2, fill=TAG[name] + (255,), outline=(255, 248, 232, 255), width=round(2 * S))
    d.text(((nx + nw / 2) * S, ny * S), name, font=font(F_NAME, 16), fill=(255, 251, 240, 255), anchor='mm')
    for i, ln in enumerate(LINES): d.text(((x0 + 26) * S, (top + pad_t + lh * i + lh / 2) * S), ln, font=font(F_BODY, fs), fill=BODY + (255,), anchor='lm')
    ax, ay = x1 - 26, top + h - 18   # 翻页提示：圆角小三角，上下轻跳
    d.polygon([((ax - 7) * S, (ay - 4) * S), ((ax + 7) * S, (ay - 4) * S), (ax * S, (ay + 5) * S)], fill=ACCENT + (255,))
    return [box, (nx, ny - nh / 2, nx + nw, ny + nh / 2), (tx - 11, top - 11, tx + 11, top)]

def plan_b(c, W, H, top, compact=False):
    """B 折角纸牌：八边形折角（低多边形的切角，不是动森的波浪边）；两段平涂的面表示倒角；名字胶囊收在牌子里的第一行；
    右下角一个青绿小圆钮当翻页提示。"""
    d = ImageDraw.Draw(c); m = 18; fs, lh = (16, 25) if compact else (17, 27); head = 30 if compact else 34; pad_b = 18 if compact else 22
    h = 14 + head + lh * len(LINES) + pad_b; x0, x1, y0, y1 = m, W - m, top, top + h; k = 16
    poly = [(x0 + k, y0), (x1 - k, y0), (x1, y0 + k), (x1, y1 - k), (x1 - k, y1), (x0 + k, y1), (x0, y1 - k), (x0, y0 + k)]
    shadow(c, None, 0, poly=poly, a=50)
    d.polygon([(x * S, y * S) for x, y in poly], fill=RIM_B + (255,))
    i = 3; inner = [(x0 + k, y0 + i), (x1 - k, y0 + i), (x1 - i, y0 + k), (x1 - i, y1 - k), (x1 - k, y1 - i), (x0 + k, y1 - i), (x0 + i, y1 - k), (x0 + i, y0 + k)]
    d.polygon([(x * S, y * S) for x, y in inner], fill=CREAM_B + (255,))
    top_face = [(x0 + k, y0 + i), (x1 - k, y0 + i), (x1 - i, y0 + k), (x1 - i, y0 + k + 6), (x0 + i, y0 + k + 6), (x0 + i, y0 + k)]
    d.polygon([(x * S, y * S) for x, y in top_face], fill=(255, 250, 238, 255))   # 上面一条亮面（平涂，不用渐变）
    name = SPEAKER; nw = tw(F_NAME, name, 15) + 30; nh = 26; nx = x0 + 18; ny = y0 + 14 + nh / 2 - 2
    rr(d, (nx, ny - nh / 2, nx + nw, ny + nh / 2), nh / 2, fill=TAG[name] + (255,))
    d.text(((nx + nw / 2) * S, ny * S), name, font=font(F_NAME, 15), fill=(255, 251, 240, 255), anchor='mm')
    d.line(((nx + nw + 10) * S, ny * S, (x1 - 22) * S, ny * S), fill=(232, 216, 182, 255), width=round(1.5 * S))   # 名字后面一条细线，把标题行和正文分开
    for j, ln in enumerate(LINES): d.text(((x0 + 22) * S, (y0 + 14 + head + lh * j + lh / 2) * S), ln, font=font(F_BODY, fs), fill=BODY + (255,), anchor='lm')
    bx, by = x1 - 24, y1 - 22
    d.ellipse(((bx - 10) * S, (by - 10) * S, (bx + 10) * S, (by + 10) * S), fill=TEAL + (255,))
    d.line(((bx - 4) * S, (by - 2) * S, bx * S, (by + 2.5) * S, (bx + 4) * S, (by - 2) * S), fill=(255, 250, 238, 255), width=round(2.2 * S), joint='curve')
    return [(x0, y0, x1, y1)]

def gap(boxes, girl):
    best = 1e9
    for a in boxes:
        for b in girl:
            dx = max(b[0] - a[2], a[0] - b[2], 0); dy = max(b[1] - a[3], a[1] - b[3], 0)
            v = (dx * dx + dy * dy) ** 0.5 if (dx or dy) else -min(a[2] - b[0], b[2] - a[0], a[3] - b[1], b[3] - a[1])
            best = min(best, v)
    return best

def frame(W, H, kind):
    c, girl, face, k, ox, _ = scene(W, H); c = c.convert('RGBA'); compact = H < 700
    sb = SAFE[(W, H)]['bottom']; gb = max(b[3] for b in girl); gcx = (face[0] + face[2]) / 2
    if kind == 'now': boxes = existing(c, W, H)
    elif kind == 'A':
        fs, lh = (16, 25) if compact else (17, 27); pad_t, pad_b = (26, 22) if compact else (30, 24); h = pad_t + lh * 2 + pad_b
        top = min(H - sb - 16 - h, max(gb + 13 + 16, H - sb - 16 - h)); boxes = plan_a(c, W, H, top, gcx, compact)
    else:
        fs, lh = (16, 25) if compact else (17, 27); head = 30 if compact else 34; pad_b = 18 if compact else 22; h = 14 + head + lh * 2 + pad_b
        top = H - sb - 16 - h; boxes = plan_b(c, W, H, top, compact)
    d = ImageDraw.Draw(c); home_bar(d, W, H)
    g = gap(boxes, girl); fg = gap(boxes, [face]); bot = H - sb - max(b[3] for b in boxes)
    return c, dict(gap=round(g, 1), face=round(fg, 1), safe=round(bot, 1), boxes=boxes, top=round(min(b[1] for b in boxes), 1))

def sheet(W, H, title, sub, note):
    cols = [('now', '现有 · IslandToast 吐司（ui/IslandToast.ts）'), ('A', '方案 A · 海风气泡'), ('B', '方案 B · 折角纸牌')]
    frames = [(frame(W, H, k), lab) for k, lab in cols]
    fw, fh = W * S, H * S; gap_ = 40; head = 150; foot = 150
    out = Image.new('RGB', (gap_ + 3 * (fw + gap_), head + fh + foot + 120), (244, 238, 226)); d = ImageDraw.Draw(out)
    F = lambda sz, b=True: ImageFont.truetype(F_UI if b else F_SYS, sz, index=2)
    d.text((gap_, 52), title, font=F(46), fill=(60, 40, 22), anchor='lm'); d.text((gap_, 108), sub, font=F(24, False), fill=(110, 90, 70), anchor='lm')
    meta = {}
    for i, ((im, m), lab) in enumerate(frames):
        x = gap_ + i * (fw + gap_); out.paste(im.convert('RGB'), (x, head)); d.rectangle((x - 2, head - 2, x + fw + 1, head + fh + 1), outline=(120, 100, 80), width=2)
        d.text((x + fw / 2, head + fh + 36), lab, font=F(28), fill=(60, 40, 22), anchor='mm')
        ok = m['gap'] >= 13 and m['safe'] >= 0
        info = ('离女孩 %.1f pt · 离头 %.1f pt · 离底部安全区 %.1f pt' % (m['gap'], m['face'], m['safe'])) if m['gap'] >= 0 else ('压住女孩 %.1f pt（离头 %.1f pt）' % (-m['gap'], m['face']))
        d.text((x + fw / 2, head + fh + 76), info, font=F(22, False), fill=(40, 120, 60) if ok else (190, 50, 40), anchor='mm')
        meta[['now', 'A', 'B'][i]] = {k: v for k, v in m.items() if k != 'boxes'}
    y = head + fh + 120
    for n_ in note: d.text((gap_, y), n_, font=F(22, False), fill=(60, 45, 30)); y += 34
    # 名字标签配色图例
    x = out.width - gap_ - 3 * 150
    for j, (nm, col) in enumerate(TAG.items()):
        bx = x + j * 150; d.rounded_rectangle((bx, head + fh + 112, bx + 120, head + fh + 152), radius=20, fill=col)
        d.text((bx + 60, head + fh + 132), nm, font=ImageFont.truetype(F_NAME, 24), fill=(255, 251, 240), anchor='mm')
    return out, meta

if __name__ == '__main__':
    allm = {}
    for (W, H), src in [((390, 844), SRC_A), ((375, 667), SRC_A)]:
        im, meta = sheet(W, H, 'U2 对话框 · 对比 · %d×%d（只是对比图，不是定稿）' % (W, H),
                         '同一句台词、同一位说话人「阿芳」；名字用资源圆体 Bold，正文用思源黑体（Noto Sans SC）Bold；奶油色、圆角、按角色上色的名字胶囊',
                         [src, SRC_B, '规则：界面元素离女孩 ≥ 13 pt、不压头、避开底部安全区（再留 16）。绿色 = 满足，红色 = 不满足。右下：名字标签配色（阿芳 / 阿宁 / 老铆，占位名）。2026-10-18 用新底图重出。'])
        p = os.path.join(OUT, 'compare_%dx%d.jpg' % (W, H)); q = 90
        while True:
            im.save(p, quality=q, optimize=True, progressive=True)
            if os.path.getsize(p) <= 700 * 1024 or q <= 60: break
            q -= 5
        allm['%dx%d' % (W, H)] = dict(meta, bytes=os.path.getsize(p)); print(p, os.path.getsize(p), meta)
    json.dump(allm, open(os.path.join(HERE, 'measure.json'), 'w'), ensure_ascii=False, indent=1)
