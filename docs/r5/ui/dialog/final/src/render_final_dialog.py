"""U2 定稿图：390×844 / 375×667 各一张（7 个状态）、7 屏汇总、红线、compare_final_390x844。
底图全部是 Blender 新渲（render_scene_bg.py）：当前基线角色 + bc81575f 岛场景 + 游戏回家跟拍机位。界面元素直接用 assets/ 里的定稿切图
（9 宫格 / 3 宫格按 slices.json 的内边距拉伸）和 fonts/ 里的子集字体，所以图上的就是切图 + 子集在规则下的真实效果。"""
import os, json, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import dialog_spec as D
HERE = D.HERE; FINAL = D.FINAL; AS = os.path.join(FINAL, 'assets'); BG = os.path.join(FINAL, 'raw', 'bg')
S = 2
SL = json.load(open(os.path.join(AS, 'slices.json')))
F_UI = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'; F_UIR = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
def UI(sz, bold=True): return ImageFont.truetype(F_UI if bold else F_UIR, round(sz), index=2)
def FN(path, sz): return ImageFont.truetype(path, round(sz * S))
CHAR_GLB = '/workspace/yiqifengle/previews/角色动画bot/r5-wrist-footik/final/chr_b_r5g2_r5wrist_v4_final.glb'
SRC_A = '底图：Blender 新渲 · 角色 GLB %s' % CHAR_GLB
SRC_B = '场景源 SHA bc81575f：creator-project/assets/firstslice/combined_visual_m.glb + combined_anchors_m.json · 机位 TRANSITION_CAMERA.returnFollow.out（回家跟拍）'
SRC_NOTE = SRC_A
K_UI = (0.621, 0.591, 0.562)
COL = dict(day=dict(body=(0x5A, 0x46, 0x36), narr=(118, 86, 55), name=(255, 251, 240)),
           night=dict(body=(30, 19, 8), narr=(34, 23, 11), name=(232, 226, 212)))
CREAM = (255, 247, 228)
def lum(c):
    v = [x / 255 for x in c[:3]]; v = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in v]; return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]
def contrast(a, b): x, y = lum(a), lum(b); return (max(x, y) + 0.05) / (min(x, y) + 0.05)
def mul(c, k): return tuple(round(c[i] * k[i]) for i in range(3))
def asset(n): return Image.open(os.path.join(AS, n + '.png')).convert('RGBA')
def tint(im, rgb):
    r, g, b, a = im.split(); ch = [c.point(lambda v, f=t / 255: round(v * f)) for c, t in zip((r, g, b), rgb)]; return Image.merge('RGBA', (*ch, a))
def nine(im, ins, w, h):
    """9 宫格：ins = [l,t,r,b] px@3x；输出 w×h pt @S。"""
    k = S / 3; W, H = round(w * S), round(h * S); l, t, r, b = ins; L, T, Rr, Bb = round(l * k), round(t * k), round(r * k), round(b * k)
    out = Image.new('RGBA', (W, H)); iw, ih = im.size
    xs = [(0, l, 0, L), (l, iw - r, L, W - Rr), (iw - r, iw, W - Rr, W)]; ys = [(0, t, 0, T), (t, ih - b, T, H - Bb), (ih - b, ih, H - Bb, H)]
    for sx0, sx1, dx0, dx1 in xs:
        for sy0, sy1, dy0, dy1 in ys:
            if sx1 <= sx0 or sy1 <= sy0 or dx1 <= dx0 or dy1 <= dy0: continue
            out.alpha_composite(im.crop((sx0, sy0, sx1, sy1)).resize((dx1 - dx0, dy1 - dy0), Image.LANCZOS), (dx0, dy0))
    return out
def place(c, im, x, y, ax, ay):
    """把 im 的锚点 (ax, ay)（Cocos 习惯：ay 从下往上）放到 (x, y) pt。"""
    c.alpha_composite(im, (round(x * S - ax * im.width), round(y * S - (1 - ay) * im.height)))
def scaled(n, k=S / 3):
    im = asset(n); return im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
def bg(W, H, mode='day', seven=False, cam=False):
    n = ('bg7cam_%dx%d' % (W, H)) if cam else ('bg7_%dx%d' % (W, H)) if seven else ('bg_%dx%d_%s' % (W, H, mode))
    info = json.load(open(os.path.join(BG, n + '.json')))
    return Image.open(os.path.join(BG, n + '.jpg')).convert('RGBA').resize((W * S, H * S), Image.LANCZOS), info
def chrome(c, W, H, safe, night=False):
    d = ImageDraw.Draw(c); col = (20, 20, 20, 255) if not night else (240, 240, 240, 255)
    ty = max(10, safe['top'] / 2 + 2); d.text((28 * S, ty * S), '9:41', font=UI(15 * S), fill=col, anchor='lm')
    bx = W - 28; d.rounded_rectangle(((bx - 24) * S, (ty - 5.5) * S, bx * S, (ty + 5.5) * S), radius=3 * S, outline=col, width=S); d.rounded_rectangle(((bx - 22) * S, (ty - 3.5) * S, (bx - 6) * S, (ty + 3.5) * S), radius=2 * S, fill=col)
    cp = safe.get('capsule')
    if cp:
        d.rounded_rectangle((cp['left'] * S, cp['top'] * S, cp['right'] * S, cp['bottom'] * S), radius=16 * S, fill=(255, 255, 255, 170), outline=(0, 0, 0, 40), width=1)
        mx = (cp['left'] + cp['right']) / 2; my = (cp['top'] + cp['bottom']) / 2
        d.line((mx * S, (my - 9) * S, mx * S, (my + 9) * S), fill=(0, 0, 0, 50), width=1)
        for i in (-1, 0, 1): d.ellipse(((cp['left'] + 22 + i * 7 - 2.2) * S, (my - 2.2) * S, (cp['left'] + 22 + i * 7 + 2.2) * S, (my + 2.2) * S), fill=(0, 0, 0, 220))
        rx = cp['right'] - 22; d.ellipse(((rx - 8) * S, (my - 8) * S, (rx + 8) * S, (my + 8) * S), outline=(0, 0, 0, 220), width=round(1.8 * S)); d.ellipse(((rx - 3) * S, (my - 3) * S, (rx + 3) * S, (my + 3) * S), fill=(0, 0, 0, 220))
    if safe['bottom'] >= 20: d.rounded_rectangle(((W / 2 - 67) * S, (H - 13) * S, (W / 2 + 67) * S, (H - 8) * S), radius=3 * S, fill=col)
def draw_dialog(c, L, night=False, chars=None):
    k = K_UI if night else (1, 1, 1); col = COL['night' if night else 'day']
    sp = lambda im: tint(im, tuple(round(255 * x) for x in k)) if night else im
    x0, x1, top, bot = L['x0'], L['x1'], L['top'], L['bottom']; M = 12
    b = SL['dialog_bubble_9s']; c.alpha_composite(sp(nine(asset('dialog_bubble_9s'), b['insets_px'], x1 - x0 + 2 * M, bot - top + 2 * M)), (round((x0 - M) * S), round((top - M) * S)))
    t = L['tail']
    if t:
        n = 'dialog_tail_' + t['dir']; place(c, sp(scaled(n, S / 3 * t['k'])), t['x'], t['y'], *SL[n]['anchor'])
    g = L['tag']
    if g:
        Wt = g['Wt']; rim = sp(nine(asset('dialog_name_rim_3s'), SL['dialog_name_rim_3s']['insets_px'], Wt + 8, 40))
        c.alpha_composite(rim, (round((g['x'] - 4) * S), round((g['cy'] - 20) * S)))
        fill = tint(nine(asset('dialog_name_fill_3s'), SL['dialog_name_fill_3s']['insets_px'], Wt, 32), mul(g['color'], k))
        c.alpha_composite(fill, (round(g['x'] * S), round((g['cy'] - 16) * S)))
        ImageDraw.Draw(c).text((g['cx'] * S, (g['cy'] + 0.5) * S), g['text'], font=FN(D.F_NAME, g['fs']), fill=col['name'] + (255,), anchor='mm')
    d = ImageDraw.Draw(c); m = L['m']; fb = FN(D.F_BODY, m['fs']); lines = L['pages'][L['page']]
    left = chars
    for i, ln in enumerate(lines):
        if left is not None:
            if left <= 0: break
            ln = ln[:left]; left -= len(ln)
        y = L['text_y0'] + i * m['lh'] + m['lh'] / 2
        if L['narration']: d.text(((x0 + x1) / 2 * S, y * S), ln, font=fb, fill=col['narr'] + (255,), anchor='mm')
        else: d.text((L['text_x'] * S, y * S), ln, font=fb, fill=col['body'] + (255,), anchor='lm')
    if L['arrow'] and chars is None: place(c, sp(scaled('dialog_next_arrow')), L['arrow']['cx'], L['arrow']['cy'], 0.5, 0.5)
STATES = [('single', '① 单行', None), ('three', '② 三行（最多 3 行/页）', None), ('longname', '③ 长名字 · 6 字占位名缩到 14 pt', 'right'),
          ('narration', '④ 旁白（无名字、无尾巴、居中）', None), ('pages', '⑤ 多页 · 第 1 页，右下翻页箭头', 'left'), ('change', '⑥ 换说话人（阿宁→老铆，尾巴换到右侧）', 'right'),
          ('night', '⑦ 夜间（切图乘 K_UI，文字单独取色）', None)]
def speaker_pt(kind, W, H, info):
    if kind is None: return info['girl_head_pt']
    return (-40, H * 0.45) if kind == 'left' else (W + 40, H * 0.42)
def frame(W, H, sid, side, mode=None, seven=False, cam=False, page=0):
    night = sid == 'night' or mode == 'night'
    im, info = bg(W, H, 'night' if night else 'day', seven, cam); ln = D.LINES[sid]
    sp = None if not ln.get('speaker') else speaker_pt(side, W, H, info)
    L = D.layout(W, H, info['girl_bbox_pt'], sp, ln.get('speaker'), ln['text'], page=page)
    draw_dialog(im, L, night); chrome(im, W, H, L['safe'], night)
    return im, L, info
def tile_info(L):
    s = '离女孩 %.1f pt · 离底部安全区 %.0f pt · 每页 ≤%d 行 · %d 页' % (L['gap_girl'], L['gap_safe'], L['max_lines'], len(L['pages']))
    return s, (L['gap_girl'] >= 13 and L['gap_safe'] >= 16)
def save_jpg(im, p, limit=1400):
    q = 90
    while True:
        im.convert('RGB').save(p, quality=q, optimize=True, progressive=True)
        if os.path.getsize(p) <= limit * 1024 or q <= 60: return os.path.getsize(p)
        q -= 5
def flow(rows_, title, subs, foot=(), pad=36, cap_h=110):
    """按行流式排版（每格宽度不同，行内顶对齐）。rows_ = [[tile, ...], ...]"""
    hh = 90 + 34 * len(subs); fh = 30 + 34 * len(foot)
    W_ = max(pad + sum(t[0].width + pad for t in r) for r in rows_); Hs = [max(t[0].height for t in r) + cap_h + pad for r in rows_]
    out = Image.new('RGB', (W_, hh + sum(Hs) + fh), (244, 238, 226)); d = ImageDraw.Draw(out)
    d.text((pad, 50), title, font=UI(44), fill=(60, 40, 22), anchor='lm')
    for i, s_ in enumerate(subs): d.text((pad, 98 + 34 * i), s_, font=UI(22, False), fill=(100, 80, 60), anchor='lm')
    y = hh
    for r, h_ in zip(rows_, Hs):
        x = pad
        for im, cap, info, ok in r:
            out.paste(im.convert('RGB'), (x, y)); d.rectangle((x - 2, y - 2, x + im.width + 1, y + im.height + 1), outline=(120, 100, 80), width=2)
            cx = x + im.width / 2; d.text((cx, y + im.height + 28), cap, font=UI(24), fill=(60, 40, 22), anchor='mm')
            if info:
                for j, part in enumerate(info.split('\n')): d.text((cx, y + im.height + 60 + 26 * j), part, font=UI(18, False), fill=(40, 120, 60) if ok else (190, 50, 40), anchor='mm')
            x += im.width + pad
        y += h_
    y = out.height - fh + 10
    for s_ in foot: d.text((pad, y), s_, font=UI(21, False), fill=(60, 45, 30)); y += 34
    return out
def sheet(tiles, cols, title, subs, foot=(), pad=36, head=None, cap_h=96):
    tw_ = max(t[0].width for t in tiles); th = max(t[0].height for t in tiles); rows = math.ceil(len(tiles) / cols)
    hh = head or (90 + 34 * len(subs)); fh = 30 + 34 * len(foot)
    out = Image.new('RGB', (pad + cols * (tw_ + pad), hh + rows * (th + cap_h + pad) + fh), (244, 238, 226)); d = ImageDraw.Draw(out)
    d.text((pad, 50), title, font=UI(44), fill=(60, 40, 22), anchor='lm')
    for i, s in enumerate(subs): d.text((pad, 98 + 34 * i), s, font=UI(22, False), fill=(100, 80, 60), anchor='lm')
    for i, (im, cap, info, ok) in enumerate(tiles):
        r, cI = divmod(i, cols); x = pad + cI * (tw_ + pad); y = hh + r * (th + cap_h + pad)
        out.paste(im.convert('RGB'), (x, y)); d.rectangle((x - 2, y - 2, x + im.width + 1, y + im.height + 1), outline=(120, 100, 80), width=2)
        d.text((x + im.width / 2, y + im.height + 30), cap, font=UI(26), fill=(60, 40, 22), anchor='mm')
        if info: d.text((x + im.width / 2, y + im.height + 66), info, font=UI(20, False), fill=(40, 120, 60) if ok else (190, 50, 40), anchor='mm')
    y = out.height - fh + 10
    for s in foot: d.text((pad, y), s, font=UI(21, False), fill=(60, 45, 30)); y += 34
    return out
def contrast_table():
    rows = []
    for mode in ('day', 'night'):
        k = K_UI if mode == 'night' else (1, 1, 1); bub = mul(CREAM, k); c = COL[mode]
        rows.append((mode, '正文', c['body'], bub, contrast(c['body'], bub)))
        rows.append((mode, '旁白', c['narr'], bub, contrast(c['narr'], bub)))
        for nm, tc in D.TAG_COLORS.items():
            rows.append((mode, '名字·' + nm, c['name'], mul(tc, k), contrast(c['name'], mul(tc, k))))
        for tc in D.TAG_FALLBACK: rows.append((mode, '名字·备用色', c['name'], mul(tc, k), contrast(c['name'], mul(tc, k))))
    return rows
def main_states(W, H):
    tiles, meta = [], {}
    for sid, cap, side in STATES:
        im, L, info = frame(W, H, sid, side)
        s, ok = tile_info(L)
        if sid == 'three' and len(L['pages']) > 1: s += '（这台机型放不下 3 行，按 §5 公式自动分页）'; cap = '② 三行台词 → 本机 2 行/页，自动翻页'
        tiles.append((im, cap, s, ok)); meta[sid] = dict(gap_girl=L['gap_girl'], gap_safe=L['gap_safe'], max_lines=L['max_lines'], pages=[len(p) for p in L['pages']], top=L['top'], h=L['h'],
                                                         tag=L['tag'] and {k: L['tag'][k] for k in ('text', 'fs', 'Wt')}, tail=L['tail'], camera=info['camera'], girl_bbox=info['girl_bbox_pt'])
    ct = contrast_table(); low = [r for r in ct if r[4] < 4.5]
    foot = [SRC_A, SRC_B, '机位参数：position %s → target %s，fov %.0f°（竖直），女孩在 toThreshold 进度 0.60（%s），walk_loop 第 8 帧；%s' % (
                tiles and meta['single']['camera']['position'], meta['single']['camera']['target'], meta['single']['camera']['fovVerticalDeg'], 's=2.96 m', '夜间底图的光照是近似（月光+冷环境），不是游戏夜间着色器'),
            '名字「阿芳 / 阿宁 / 老铆 / 灯塔下的旅人」都是占位名。字体：名字 QFL Dialog Name（资源圆体 Bold 子集），正文 QFL Dialog Body（思源黑体 SC Bold 子集，glyf），OFL 1.1。',
            '夜间对比度：正文 %.1f · 旁白 %.1f · 名字最低 %.1f（白天最低 %.1f），全部 ≥ 4.5。' % (
                [r for r in ct if r[0] == 'night' and r[1] == '正文'][0][4], [r for r in ct if r[0] == 'night' and r[1] == '旁白'][0][4],
                min(r[4] for r in ct if r[0] == 'night' and r[1].startswith('名字')), min(r[4] for r in ct if r[0] == 'day')) + ('' if not low else '  ⚠ 低于 4.5：' + str(low))]
    out = sheet(tiles, 4, 'U2 对话框定稿 · 海风气泡 · %d×%d' % (W, H),
                ['7 个状态，同一镜头。界面 = assets/ 定稿切图按 slices.json 拉伸 + fonts/ 子集字体；绿色 = 离女孩 ≥13 pt 且离底部安全区 ≥16 pt。'], foot)
    return out, meta, ct
def seven():
    tiles, rows = [], []
    for W, H in D.SCREENS + [(390, 520, 'cam'), (320, 568, 'cam')]:
        cam = False
        if isinstance(W, tuple): pass
        if len((W, H)) and False: pass
        yield W, H
def summary():
    items = [(W, H, False) for W, H in D.SCREENS] + [(390, 520, True), (320, 568, True)]
    k = 0.62; tiles = []; meta = []
    for W, H, cam in items:
        im, L, info = frame(W, H, 'three', None, seven=True, cam=cam)
        d = ImageDraw.Draw(im); gy = info['girl_bbox_pt'][3]
        d.line((0, gy * S, W * S, gy * S), fill=(230, 60, 60, 255), width=2); d.line((0, (gy + 13) * S, W * S, (gy + 13) * S), fill=(230, 60, 60, 160), width=2)
        d.text((8 * S, (gy - 10) * S), '女孩底 %.0f / +13' % gy, font=UI(11 * S), fill=(230, 60, 60, 255), anchor='lm')
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        s, ok = tile_info(L); s = s.replace(' · 离底部', '\n离底部')
        cap = '%d×%d%s' % (W, H, ' · 建议对话镜头' if cam else '')
        if L['camera_needed']: s = '默认跟拍镜头下 1 行都放不下\n→ 要对话镜头让位（§4.4）'; ok = False
        tiles.append((im, cap, s, ok))
        meta.append(dict(screen='%dx%d' % (W, H), camera_variant=cam, camera=info['camera'], girl_bbox=info['girl_bbox_pt'], max_lines=L['max_lines'], pages=[len(p) for p in L['pages']],
                         gap_girl=L['gap_girl'], gap_safe=L['gap_safe'], camera_needed=L['camera_needed'], top=L['top'], h=L['h']))
    out = flow([tiles[:4] + [tiles[6]], tiles[4:6] + tiles[7:]], 'U2 对话框定稿 · 7 种竖屏汇总（三行台词）',
                ['同一句三行台词按 §5 公式排：每页行数 = 底部到「女孩底 +13（+尾巴 15，紧凑档 13 / 名字胶囊 16）」之间放得下几行，上限 3。红线 = 女孩投影底边和 +13。',
                 '后两格：390×520、320×568 在默认跟拍镜头下 1 行都放不下，按 §4.4 建议对话时镜头 targetHeight −0.10 m 重渲后的效果。'],
                [SRC_A, SRC_B, '所有格子同一比例（1 pt = 1.24 px）。底图 1× 渲染放大（汇总图只看布局）。机位见 raw/bg/*.json；夜间、红线、单屏 7 状态见其他图。'])
    return out, meta
def redline():
    Z = 4; rows_ = []
    for W, H in ((390, 844), (375, 667)):
        im, info = bg(W, H); ln = D.LINES['three']
        L = D.layout(W, H, info['girl_bbox_pt'], info['girl_head_pt'], ln['speaker'], ln['text'])
        L2 = dict(L, pages=[[]]); draw_dialog(im, L2); chrome(im, W, H, L['safe'])
        y0 = L['top'] - 80; crop = im.crop((0, round(y0 * S), W * S, H * S)); crop = crop.resize((W * Z, round((H - y0) * Z)), Image.LANCZOS)
        d = ImageDraw.Draw(crop); RC = (226, 48, 48, 255); f = UI(24); g = info['girl_bbox_pt']; m = L['m']
        P = lambda x, y: (x * Z, (y - y0) * Z)
        def hl(xa, xb, y, t, dy=-18):
            d.line((*P(xa, y), *P(xb, y)), fill=RC, width=3)
            for x in (xa, xb): d.line((*P(x, y - 3), *P(x, y + 3)), fill=RC, width=3)
            d.text((P((xa + xb) / 2, y)[0], P(0, y)[1] + dy), t, font=f, fill=RC, anchor='mm')
        def vl(x, ya, yb, t, right=True):
            d.line((*P(x, ya), *P(x, yb)), fill=RC, width=3)
            for y in (ya, yb): d.line((*P(x - 3, y), *P(x + 3, y)), fill=RC, width=3)
            d.text((P(x, 0)[0] + (12 if right else -12), P(0, (ya + yb) / 2)[1]), t, font=f, fill=RC, anchor='lm' if right else 'rm')
        x0, x1, top, bot = L['x0'], L['x1'], L['top'], L['bottom']
        d.rectangle((*P(x0, top), *P(x1, bot)), outline=(40, 130, 220, 255), width=3)
        for i in range(len(L['pages'][0])):
            ya = L['text_y0'] + i * m['lh']; d.rectangle((*P(L['text_x'], ya), *P(x1 - m['padX'], ya + m['lh'])), outline=(40, 170, 90, 255), width=2)
            d.text(P(L['text_x'] + 6, ya + m['lh'] / 2), '第 %d 行 · %d pt 字 / 行高 %d' % (i + 1, m['fs'], m['lh']), font=f, fill=(40, 140, 80, 255), anchor='lm')
        tg = L['tag']; hl(tg['x'], tg['x'] + tg['Wt'], top - 22, '胶囊 %d×32' % tg['Wt']); hl(x0, tg['x'], top - 4, '20', dy=-16)
        t = L['tail']; d.text(P(t['x'] + 16, top - 6), '尾巴 %d×%d，x = clamp(头 %.0f) = %.0f' % (t['w'], t['h'], info['girl_head_pt'][0], t['x']), font=f, fill=RC, anchor='lm')
        d.line((*P(0, g[3]), *P(W, g[3])), fill=(230, 60, 60, 200), width=2); d.text(P(W - 6, g[3] - 6), '女孩投影底边 %.0f' % g[3], font=f, fill=RC, anchor='rs')
        vl(t['x'] - 30, g[3], top - t['h'], '≥13：%.1f' % (top - t['h'] - g[3]), right=False)
        vl(x1 - 70, top, top + m['padT'], 'padT %d' % m['padT'], right=False)
        vl(x1 - 70, bot - m['padB'], bot, 'padB %d' % m['padB'], right=False)
        hl(x1 - m['padX'], x1, L['text_y0'] + m['lh'] * 1.5, '%d' % m['padX'])
        hl(0, x0, (top + bot) / 2, '%d' % x0); hl(x1, W, (top + bot) / 2, '%d' % (W - x1))
        hl(x0, x1, bot + 8, '气泡宽 %d = min(W − 28, 480)，高 %d = padT + %d×%d + padB' % (x1 - x0, L['h'], len(L['pages'][0]), m['lh']), dy=18)
        vl(W - 30, bot, H - L['safe']['bottom'], '16', right=False); vl(W - 30, H - L['safe']['bottom'], H, '安全区 %d' % L['safe']['bottom'], right=False)
        rows_.append([(crop, '%d×%d · 三行状态底部放大（1 pt = %d px）' % (W, H, Z), '蓝 = 气泡可见边 · 绿 = 文字行框 · 每页 ≤%d 行（本机）' % L['max_lines'], True)])
    kit = Image.new('RGBA', (1560, 760), (250, 246, 236, 255)); d = ImageDraw.Draw(kit); f = UI(26); fs_ = UI(21, False)
    d.text((30, 30), '切图（3 px/pt；Blender 阶段一光照 + 色板；pngquant）· 红线 = 九宫格/三宫格分割 · 红点 = 锚点', font=f, fill=(60, 40, 22))
    y = 90; bub = asset('dialog_bubble_9s'); kit.alpha_composite(bub, (30, y))
    for v in (144, bub.width - 144): d.line((30 + v, y, 30 + v, y + bub.height), fill=(226, 48, 48), width=2); d.line((30, y + v, 30 + bub.width, y + v), fill=(226, 48, 48), width=2)
    for i, t_ in enumerate(['dialog_bubble_9s.png  396×396 px', '内边距 144/144/144/144 px = 48 pt', '（12 投影 + 30 圆角 + 6 余量）', '节点 = 可见气泡四周各放大 12 pt', '文字内边距（从可见边算）：', '  常规 上 24 / 下 20 / 左右 24', '  紧凑 上 22 / 下 18 / 左右 20']):
        d.text((450, y + 10 + 36 * i), t_, font=fs_, fill=(80, 60, 40))
    x = 820
    for n in ('dialog_tail_up', 'dialog_tail_left', 'dialog_tail_right', 'dialog_next_arrow'):
        im = asset(n); kit.alpha_composite(im, (x, y)); a = SL[n].get('anchor', [0.5, 0.5]); ax, ay = x + a[0] * im.width, y + (1 - a[1]) * im.height
        d.ellipse((ax - 5, ay - 5, ax + 5, ay + 5), fill=(226, 48, 48)); d.text((x, y + 116), n.replace('dialog_', ''), font=fs_, fill=(80, 60, 40)); d.text((x, y + 144), '%d×%d' % im.size, font=fs_, fill=(80, 60, 40)); x += 170
    d.text((820, y + 176), '尾巴可见 30×15 pt（紧凑档缩 0.867 → 26×13）', font=fs_, fill=(80, 60, 40)); d.text((820, y + 202), '锚点 = 底边中点；底下 5 pt 平板盖进气泡（同色，不露缝）', font=fs_, fill=(80, 60, 40))
    rim = asset('dialog_name_rim_3s'); fil = asset('dialog_name_fill_3s'); yy = y + 230
    kit.alpha_composite(rim, (820, yy)); kit.alpha_composite(fil, (1000, yy + 12))
    for xx, im_, ins_, oy in ((820, rim, 60, 0), (1000, fil, 48, 12)):
        for v in (ins_, im_.width - ins_): d.line((xx + v, yy + oy, xx + v, yy + oy + im_.height), fill=(226, 48, 48), width=2)
    d.text((1140, yy + 10), 'name_rim_3s（奶油外圈，不着色）', font=fs_, fill=(80, 60, 40)); d.text((1140, yy + 42), 'name_fill_3s（白底，乘角色色）', font=fs_, fill=(80, 60, 40)); d.text((1140, yy + 74), '三宫格左右 60 / 48 px', font=fs_, fill=(80, 60, 40))
    y = 520
    d.text((30, y), '名字胶囊伸缩和截断（名字文本 ≤ 88 pt 用 16 pt；超了 14 pt；再超截断加「…」；外宽 = max(64, 文本 + 32)）', font=fs_, fill=(80, 60, 40)); y += 44; x = 30
    for nm in ('阿芳', '阿宁', '老铆', '灯塔下的旅人', '灯塔下的远方旅人们'):
        tag = D.name_tag(nm); Wt = tag[2]; S0 = 2
        r_ = nine(asset('dialog_name_rim_3s'), SL['dialog_name_rim_3s']['insets_px'], Wt + 8, 40); fl = tint(nine(asset('dialog_name_fill_3s'), SL['dialog_name_fill_3s']['insets_px'], Wt, 32), D.tag_color(nm))
        kit.alpha_composite(r_, (x, y)); kit.alpha_composite(fl, (x + 4 * S0, y + 4 * S0))
        d.text((x + (4 + Wt / 2) * S0, y + 20 * S0), tag[0], font=FN(D.F_NAME, tag[1]), fill=(255, 251, 240), anchor='mm')
        d.text((x, y + 96), '%d 字 → %d pt · 外宽 %d%s' % (len(nm), tag[1], Wt, ' · 截断' if tag[0].endswith('…') else ''), font=UI(18, False), fill=(80, 60, 40))
        x += max(Wt * S0 + 40, 230)
    rows_.append([(kit, '切图 · 内边距 · 锚点 · 名字伸缩', '', True)])
    return flow(rows_, 'U2 对话框定稿 · 红线标注', ['单位 pt。数字全部来自 src/dialog_spec.py；7 屏坐标见 IMPLEMENT 附录 A。红线图隐藏了台词，只留行框。'], [SRC_A, SRC_B])
def compare_final():
    import importlib.util
    sp = importlib.util.spec_from_file_location('rd', os.path.join(FINAL, '..', 'src', 'render_dialog.py')); rd = importlib.util.module_from_spec(sp); sp.loader.exec_module(rd)
    W, H = 390, 844; tiles = []
    im, info = bg(W, H); im2 = im.copy(); tb = rd.existing(im2, W, H)[0]; chrome(im2, W, H, D.safe_for(W, H)); g = info['girl_bbox_pt']; tg = D.box_gap(tb, g)
    tiles.append((im2, '旧 · IslandToast 吐司（ui/IslandToast.ts）', ('一行、固定在 y=132，和女孩帽子重叠 %.1f pt' % -tg) if tg < 0 else ('一行、固定在 y=132，离女孩 %.1f pt' % tg), tg >= 13))
    im3 = im.copy(); fs, lh, pad_t, pad_b = 17, 27, 30, 24; h = pad_t + lh * 2 + pad_b; top = H - 34 - 16 - h
    bx = rd.plan_a(im3, W, H, top, info['girl_head_pt'][0]); chrome(im3, W, H, D.safe_for(W, H))
    tiles.append((im3, '对比稿 A · 海风气泡（55ed0f1，平面示意）', '离女孩 %.1f pt' % min(D.box_gap(b, g) for b in bx), True))
    im4, L, _ = frame(W, H, 'compare', None); s, ok = tile_info(L)
    tiles.append((im4, '定稿 A · Blender 切图 + 子集字体', s, ok))
    return sheet(tiles, 3, 'U2 对话框 · 旧 IslandToast / 对比稿 A / 定稿 A · 390×844',
                 ['同一镜头、同一句台词。定稿相对对比稿：切图有倒角和投影、尾巴可上/左/右、名字胶囊白底着色、字号行高按屏分档、行数按离女孩距离算。'], [SRC_A, SRC_B])
if __name__ == '__main__':
    OUTD = FINAL; meta = {}
    for W, H in ((390, 844), (375, 667)):
        im, m, ct = main_states(W, H); p = os.path.join(OUTD, 'dialog_%dx%d.jpg' % (W, H)); meta['%dx%d' % (W, H)] = dict(m, bytes=save_jpg(im, p)); print(p)
    im, m = summary(); meta['7screens'] = m; print(save_jpg(im, os.path.join(OUTD, 'dialog_7screens.jpg')))
    im = redline(); print(save_jpg(im, os.path.join(OUTD, 'redline_dialog.jpg')))
    im = compare_final(); print(save_jpg(im, os.path.join(OUTD, '..', 'compare_final_390x844.jpg')))
    meta['contrast'] = [dict(mode=r[0], role=r[1], fg=r[2], bg=r[3], ratio=round(r[4], 2)) for r in contrast_table()]
    json.dump(meta, open(os.path.join(HERE, 'measure_final.json'), 'w'), ensure_ascii=False, indent=1, default=str)
    for r in meta['contrast']: print(r)
