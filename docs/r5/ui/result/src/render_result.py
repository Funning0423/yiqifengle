# r5 U1 结算画面备选稿渲染（只出设计稿，不改游戏代码）。
#   python3 docs/r5/ui/result/src/render_result.py      （在仓库根目录跑）
# v2.2 现状：读 v22_nodes.json（dump_v22_nodes.cjs 用 tools/board-ui/harness.cjs 跑真实 BoardPanels.ts 得到的节点位置），
#           用包里的同一批切图（creator-build-project/assets/bundles/board_art）按节点逐个画出来。
# v3-A / v3-B：按阶段一精简规则排版（8 的倍数间距、三级字号、无钉浅木框、文楷标题切图）。
import json, os, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '../../../../..'))
ART = os.path.join(ROOT, 'creator-build-project/assets/bundles/board_art')
OUT = os.path.abspath(os.path.join(HERE, '..'))
S = 2  # px per pt
FB = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'; FR = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
_c = {}
def font(sz, bold=True):
    k = (sz, bold)
    if k not in _c: _c[k] = ImageFont.truetype(FB if bold else FR, max(6, round(sz * S)), index=2)  # index 2 = SC
    return _c[k]
_a = {}
def art(key):
    if key not in _a: _a[key] = Image.open(os.path.join(ART, key + '.png')).convert('RGBA')
    return _a[key]
def hexc(h): h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4)) + ((int(h[6:8], 16),) if len(h) >= 8 else (255,))
BROWN, BROWN2, WHITE, GREY, TEAL = (99, 63, 33, 255), (118, 86, 55, 255), (251, 248, 236, 255), (150, 140, 124, 255), (38, 98, 104, 255)

# ---------- primitives (pt in, px out) ----------
def sliced(img, w, h, il, it):
    """9/3-slice: il / it = destination border in px (left/right, top/bottom); source borders are proportional."""
    W, H = img.size; w = max(1, round(w)); h = max(1, round(h))
    sl = img.info.get('_il'); out = Image.new('RGBA', (w, h))
    def part(box, size):
        return img.crop(box).resize((max(1, size[0]), max(1, size[1])), Image.LANCZOS)
    return out, part
def nine(key, w, h, src_l, src_t, dst_l, dst_t):
    img = art(key); W, H = img.size; w = max(2, round(w)); h = max(2, round(h)); dl = min(round(dst_l), w // 2); dt = min(round(dst_t), h // 2)
    out = Image.new('RGBA', (w, h)); xs = [0, src_l, W - src_l, W]; ys = [0, src_t, H - src_t, H]; dx = [0, dl, w - dl, w]; dy = [0, dt, h - dt, h]
    for i in range(3):
        for j in range(3):
            sb = (xs[i], ys[j], xs[i+1], ys[j+1]); db = (dx[i], dy[j], dx[i+1], dy[j+1])
            if sb[2] <= sb[0] or sb[3] <= sb[1] or db[2] <= db[0] or db[3] <= db[1]: continue
            out.paste(img.crop(sb).resize((db[2]-db[0], db[3]-db[1]), Image.LANCZOS), (db[0], db[1]))
    return out
def put(canvas, im, cx, cy, op=1.0):
    if op < 1: a = im.split()[3].point(lambda v: round(v * op)); im = im.copy(); im.putalpha(a)
    canvas.alpha_composite(im, (round(cx * S - im.width / 2), round(cy * S - im.height / 2)))
def sprite(canvas, key, cx, cy, w, h=None, op=1.0, gray=False):
    img = art(key)
    if h is None: h = w * img.height / img.width
    im = img.resize((max(1, round(w * S)), max(1, round(h * S))), Image.LANCZOS)
    if gray:
        g = im.convert('LA').convert('RGBA'); g.putalpha(im.split()[3]); im = g
    put(canvas, im, cx, cy, op)
def panel(canvas, cx, cy, w, h):  # popup/panel_frame_9s, source inset 212, edge 23 pt (SPEC v2.1 result inset)
    put(canvas, nine('popup/panel_frame_9s', w * S, h * S, 212, 212, 23 * S, 23 * S), cx, cy)
def plank(canvas, cx, cy, w, h=44.1):
    put(canvas, nine('popup/title_plank_3s', w * S, h * S, 252, 0, 252 * h / 315 * S, 0), cx, cy)
def button(canvas, kind, cx, cy, w, h, label, fs=16):
    sh = Image.new('RGBA', (round((w - 4) * S), round((h - 2) * S)), (0, 0, 0, 0)); d = ImageDraw.Draw(sh)
    d.rounded_rectangle((0, 0, sh.width - 1, sh.height - 1), radius=round(min(18, h / 2) * S), fill=(74, 50, 30, 110)); put(canvas, sh, cx, cy + 6)
    put(canvas, nine('popup/btn_%s_3s' % kind, w * S, h * S, 207, 0, 207 * h / 312 * S, 0), cx, cy)
    text(canvas, label, cx, cy, fs, WHITE if kind == 'primary' else BROWN)
def text(canvas, s, cx, cy, fs, color, bold=True, anchor='mm'):
    d = ImageDraw.Draw(canvas); d.text((cx * S, cy * S), s, font=font(fs, bold), fill=color, anchor=anchor)
def tw(s, fs, bold=True): return font(fs, bold).getlength(s) / S
def glow(canvas, cx, cy, r, rgb, a0, n=16):
    g = Image.new('RGBA', canvas.size, (0, 0, 0, 0)); d = ImageDraw.Draw(g); st = 1 - (1 - a0) ** (1 / n)
    for k in range(n):
        rr = r * (1 - k / n) * S; d.ellipse((cx * S - rr, cy * S - rr, cx * S + rr, cy * S + rr), fill=rgb + (round(255 * st),))
    canvas.alpha_composite(g.filter(ImageFilter.GaussianBlur(S * 1.5)))
def chest_floor(canvas, cx, cy, w):
    g = Image.new('RGBA', canvas.size, (0, 0, 0, 0)); d = ImageDraw.Draw(g); n = 10; st = 1 - (1 - 0.45) ** (1 / n)
    for k in range(n):
        f = 1 - k / n * 0.6; rx, ry = w / 2 * f * S, w * 0.14 * f * S
        d.ellipse((cx * S - rx, cy * S - ry, cx * S + rx, cy * S + ry), fill=(0x3C, 0x26, 0x14, round(255 * st)))
    canvas.alpha_composite(g.filter(ImageFilter.GaussianBlur(S * 2)))
def badge(canvas, cx, cy, d_pt, icon_key):
    glow(canvas, cx, cy, d_pt * 40 / 68, (0xFF, 0xE2, 0x8C), 0.43, 8)
    g = Image.new('RGBA', canvas.size, (0, 0, 0, 0)); dr = ImageDraw.Draw(g); r = d_pt / 2 * S
    dr.ellipse((cx * S - r, cy * S - r, cx * S + r, cy * S + r), fill=(0xFF, 0xF8, 0xE4, 255)); r2 = r * 60 / 68
    dr.ellipse((cx * S - r2, cy * S - r2, cx * S + r2, cy * S + r2), fill=(0xFA, 0xEC, 0xCC, 255)); canvas.alpha_composite(g)
    sprite(canvas, icon_key, cx, cy, d_pt * 0.8)

# ---------- phone backdrop ----------
BG = Image.open(os.path.join(HERE, 'bg_board_v31.jpg')).convert('RGBA')
SAFE = {(390, 844): dict(top=47, bottom=34, cap=(50, 82)), (375, 667): dict(top=20, bottom=34, cap=(26, 58))}  # real-device rows of tools/board-ui/test_board_hint_above_tray.cjs
def phone(W, H, shade=0.35):
    sc = max(W * S / BG.width, H * S / BG.height); bg = BG.resize((round(BG.width * sc), round(BG.height * sc)), Image.LANCZOS)
    x0 = (bg.width - W * S) // 2; y0 = (bg.height - H * S) // 2; c = bg.crop((x0, y0, x0 + W * S, y0 + H * S))
    c.alpha_composite(Image.new('RGBA', c.size, (16, 28, 34, round(255 * shade))))  # PopupKit SHADE (16,28,34) α 0.35
    return c
def chrome(c, W, H):
    """底图（阶段一 v3.1 棋盘定稿图）自带状态栏和胶囊示意，这里只补底部横条。"""
    s = SAFE[(W, H)]; d = ImageDraw.Draw(c)
    if H > 700: d.rounded_rectangle(((W / 2 - 67) * S, (H - 13) * S, (W / 2 + 67) * S, (H - 8) * S), radius=3 * S, fill=(20, 20, 20, 200))
    yb = (H - s['bottom']) * S
    for x in range(0, W * S, 16): d.line((x, yb, x + 8, yb), fill=(255, 255, 255, 150), width=2)  # 安全区底线（测试真机行 bottom 34）

# ---------- v2.2: draw the harness node dump ----------
def draw_v22(key, W, H):
    c = phone(W, H); chrome(c, W, H); nodes = json.load(open(os.path.join(HERE, 'v22_nodes.json')))[key]['nodes']; marks = {}
    opened = any(n['name'] == 'ResultChestRays' for n in nodes)
    for n in nodes:
        nm, x, y, w, h = n['name'], n['x'], n['y'], n['w'], n['h']
        if nm == 'PopupShade': continue
        if nm == 'ResultChestHalo': glow(c, x, y, w / 2, (0xFF, 0xD6, 0x78) if opened else (0xFF, 0xDE, 0x8C), 0.59 if opened else 0.47); continue
        if nm == 'ActionShadow':
            sh = Image.new('RGBA', (round(w * S), round(h * S))); ImageDraw.Draw(sh).rounded_rectangle((0, 0, sh.width - 1, sh.height - 1), radius=round(min(18, h / 2) * S), fill=(74, 50, 30, 110)); put(c, sh, x, y + 6); continue
        if nm == 'ResultFloatPlate':
            glow(c, x, y, w * 40 / 68, (0xFF, 0xE2, 0x8C), 0.43, 8); g = Image.new('RGBA', c.size); dr = ImageDraw.Draw(g); r = w / 2 * S
            dr.ellipse((x * S - r, y * S - r, x * S + r, y * S + r), fill=(0xFF, 0xF8, 0xE4, 255)); r2 = r * 60 / 68; dr.ellipse((x * S - r2, y * S - r2, x * S + r2, y * S + r2), fill=(0xFA, 0xEC, 0xCC, 255)); c.alpha_composite(g); continue
        if 'sprite' in n and n['sprite']:
            k = n['sprite']
            if not os.path.exists(os.path.join(ART, k + '.png')): continue
            if n.get('type') == 1:
                sx = abs(n['sxy'][0]); il, it = n['inset']
                im = nine(k, w * S, h * S, il, it, il * sx * S, it * sx * S); put(c, im, x, y, n['op'])
            else: sprite(c, k, x, y, w, h, n['op'])
            if nm == 'PanelFrame': marks['panel'] = (x - w / 2, y - h / 2, x + w / 2, y + h / 2)
            if nm == 'Plate': marks.setdefault('btn', []).append((x - w / 2, y - h / 2, x + w / 2, y + h / 2 + 6))
        elif 'text' in n:
            col = hexc(n['color']); fs = n['fs']
            if nm.startswith('ResultGoalCount'): text(c, n['text'], x - w / 2, y, fs, col, n.get('bold', True), 'lm')
            else: text(c, n['text'], x, y, fs, col, n.get('bold', True))
    return c, marks

# ---------- v3 layouts ----------
def compact(H): return H <= 700
def v3a(W, H, state):
    """v3-A 焦点收拢：结构跟 v2.2 一样（一个居中面板），只按精简规则重排。"""
    c = phone(W, H); chrome(c, W, H); s = SAFE[(W, H)]; cp = compact(H)
    pw = 352 if W >= 390 else 336; E = 23; PAD = 16; G = 16 if cp else 24
    star_c, star_s = (56, 44) if cp else (64, 48); chest_w = 128 if cp else 168; bh = 52 if cp else 56
    lose = state == 'lose'
    # 内容高度（从面板内沿算起）：标题牌 32 → 星星 → 分数 → 宝箱 / 文案 → 按钮
    rows = [('title', 40), ('gap', 8 if cp else 16), ('stars', star_c), ('gap', 16 if cp else 16), ('score', 40 if not lose else 24)]
    if lose: rows += [('gap', 16), ('goal', 32)]
    else: rows += [('gap', G), ('chest', chest_w * 0.82 + ((56 if cp else 64) + 40 if state == 'open' else 0))]
    rows += [('gap', G), ('btn', bh + 6)]
    inner = sum(h for _, h in rows); ph = inner + 2 * (E + PAD) - 8
    top_lim = s['cap'][1] + 16; bot_lim = H - max(s['bottom'], 0) - 16
    cy = max(top_lim + ph / 2, min((top_lim + bot_lim) / 2, bot_lim - ph / 2)); top = cy - ph / 2
    panel(c, W / 2, cy, pw, ph); y = top + E + PAD - 8; M = {'panel': (W / 2 - pw / 2, top, W / 2 + pw / 2, top + ph)}
    for name, h in rows:
        if name == 'title':
            k = 'popup/title_5' if lose else 'popup/title_4'; tw_ = art(k).width * 0.42 * (1.15)
            plank(c, W / 2, top + 8, tw_ + 64, 48); sprite(c, k, W / 2, top + 9, tw_)
        elif name == 'stars':
            sc_ = y + h / 2
            if not lose: glow(c, W / 2, sc_, star_c * 1.15, (0xFF, 0xE2, 0x8C), 0.42)
            for i, (dx, sz, dy) in enumerate([(-(star_c / 2 + star_s / 2 + 8), star_s, 6), (0, star_c, 0), (star_c / 2 + star_s / 2 + 8, star_s, 6)]):
                sprite(c, 'popup/star_empty' if lose else 'popup/star_full', W / 2 + dx, sc_ + dy, sz, op=0.75 if lose else 1)
        elif name == 'score':
            if lose: text(c, '还差一点点，换个顺序再试试吧', W / 2, y + h / 2, 16, BROWN, False)
            else:
                a, b = '630', ' 分'; wa, wb = tw(a, 32), tw(b, 16); x0 = W / 2 - (wa + wb) / 2
                text(c, a, x0, y + h / 2, 32, BROWN, True, 'lm'); text(c, b, x0 + wa, y + h / 2 + 5, 16, BROWN2, True, 'lm')
        elif name == 'goal':
            ic = 32; label = '×3'; gw = ic + 8 + tw(label, 16); x0 = W / 2 - gw / 2
            sprite(c, 'board/piece_strawberry', x0 + ic / 2, y + h / 2, ic); text(c, label, x0 + ic + 8, y + h / 2, 16, BROWN, True, 'lm')
        elif name == 'chest':
            bd = 56 if cp else 64
            ccy = y + h - chest_w * 0.41 if state == 'open' else y + h / 2
            if state == 'open':
                sprite(c, 'popup/fx_rays', W / 2, ccy - 12, chest_w * 1.3, op=0.5); glow(c, W / 2, ccy - 10, chest_w * 0.46, (0xFF, 0xD6, 0x78), 0.59)
                chest_floor(c, W / 2 + 6, ccy + chest_w * 0.36, chest_w * 0.9); sprite(c, 'popup/chest_open', W / 2 + 4, ccy, chest_w * 0.98)
                by = y + bd / 2; badge(c, W / 2, by, bd, 'r2/tool_tidenet')
                text(c, '潮汐网', W / 2, by + bd / 2 + 12, 16, BROWN)
            else:
                glow(c, W / 2, ccy + 2, chest_w * 0.45, (0xFF, 0xDE, 0x8C), 0.47); chest_floor(c, W / 2 + 6, ccy + chest_w * 0.34, chest_w * 0.9)
                sprite(c, 'popup/chest_closed', W / 2 + 4, ccy, chest_w)
            M['chest'] = (W / 2 - chest_w / 2, y, W / 2 + chest_w / 2, y + h)
        elif name == 'btn':
            span = pw - 2 * (E + PAD); bw = (span - 16) / 2; byc = y + bh / 2
            l1, l2 = ('再试一次', '回小岛') if lose else ('下一关', '回小岛')
            button(c, 'primary', W / 2 - bw / 2 - 8, byc, bw, bh, l1); button(c, 'secondary', W / 2 + bw / 2 + 8, byc, bw, bh, l2)
            M['btn'] = [(W / 2 - span / 2, y, W / 2 + span / 2, y + bh + 6)]
        y += h
    return c, M
def v3b(W, H, state):
    """v3-B 星星主角 · 底卡：星星放大浮在棋盘上方，结算内容收进一张贴底的浅木卡。"""
    c = phone(W, H, 0.42); chrome(c, W, H); s = SAFE[(W, H)]; cp = compact(H); lose = state == 'lose'
    cw = 352 if W >= 390 else 336; E = 23; PAD = 16; bh = 52 if cp else 56; chest_w = 104 if cp else 128
    star_c = 72 if cp else 88; star_s = 56 if cp else 64
    rows = [('stars', star_c * 0.5), ('gap', 8), ('title', 32), ('gap', 8), ('score', 40 if not lose else 24)]
    if lose: rows += [('gap', 16), ('goal', 32)]
    else: rows += [('gap', 16), ('reward', chest_w * 0.82 + (8 if state == 'open' else 0))]
    rows += [('gap', 16 if cp else 24), ('btn', bh + 6)]
    ch = sum(h for _, h in rows) + 2 * (E + PAD) - 8
    bottom = H - max(s['bottom'], 0) - 16; top = bottom - ch; cy = top + ch / 2
    panel(c, W / 2, cy, cw, ch); M = {'panel': (W / 2 - cw / 2, top, W / 2 + cw / 2, bottom)}
    # 星星压在卡片上沿（一半在卡外），是整张卡的“王冠”
    sy = top + 8
    if not lose: glow(c, W / 2, sy, star_c * 1.2, (0xFF, 0xE2, 0x8C), 0.55)
    for dx, sz, dy in [(-(star_c / 2 + star_s / 2 + 8), star_s, 10), (0, star_c, 0), (star_c / 2 + star_s / 2 + 8, star_s, 10)]:
        sprite(c, 'popup/star_empty' if lose else 'popup/star_full', W / 2 + dx, sy + dy, sz, op=0.9 if lose else 1)
    M['stars'] = (W / 2 - 1.5 * star_c, sy - star_c / 2, W / 2 + 1.5 * star_c, sy + star_c / 2)
    y = top + E + PAD - 8
    for name, h in rows:
        if name == 'stars': pass
        elif name == 'title':
            k = 'popup/title_5' if lose else 'popup/title_4'; sprite(c, k, W / 2, y + h / 2, art(k).width * 0.42 * 1.3)
        elif name == 'score':
            if lose: text(c, '还差一点点，换个顺序再试试吧', W / 2, y + h / 2, 16, BROWN, False)
            else:
                a, b = '630', ' 分'; wa, wb = tw(a, 32), tw(b, 16); x0 = W / 2 - (wa + wb) / 2
                text(c, a, x0, y + h / 2, 32, BROWN, True, 'lm'); text(c, b, x0 + wa, y + h / 2 + 5, 16, BROWN2, True, 'lm')
        elif name == 'goal':
            ic = 32; label = '×3'; gw = ic + 8 + tw(label, 16); x0 = W / 2 - gw / 2
            sprite(c, 'board/piece_strawberry', x0 + ic / 2, y + h / 2, ic); text(c, label, x0 + ic + 8, y + h / 2, 16, BROWN, True, 'lm')
        elif name == 'reward':
            ccy = y + h / 2; span = cw - 2 * (E + PAD)
            if state == 'open':
                # 宝箱打开后：箱子退到左边，奖励徽章排在右边（不再飘），一眼看到得到了什么
                cx0 = W / 2 - span / 4 - 8; sprite(c, 'popup/fx_rays', cx0, ccy - 8, chest_w * 1.3, op=0.7); glow(c, cx0, ccy - 6, chest_w * 0.46, (0xFF, 0xD6, 0x78), 0.59)
                chest_floor(c, cx0 + 5, ccy + chest_w * 0.34, chest_w * 0.9); sprite(c, 'popup/chest_open', cx0 + 4, ccy, chest_w * 0.98)
                bd = 56 if cp else 64; bx = W / 2 + span / 4 + 8; badge(c, bx, ccy - 10, bd, 'r2/tool_tidenet'); text(c, '潮汐网', bx, ccy - 10 + bd / 2 + 14, 16, BROWN)
            else:
                glow(c, W / 2, ccy + 2, chest_w * 0.45, (0xFF, 0xDE, 0x8C), 0.47); chest_floor(c, W / 2 + 5, ccy + chest_w * 0.34, chest_w * 0.9); sprite(c, 'popup/chest_closed', W / 2 + 4, ccy, chest_w)
        elif name == 'btn':
            span = cw - 2 * (E + PAD); bw = (span - 16) / 2; byc = y + bh / 2; l1, l2 = ('再试一次', '回小岛') if lose else ('下一关', '回小岛')
            button(c, 'primary', W / 2 - bw / 2 - 8, byc, bw, bh, l1); button(c, 'secondary', W / 2 + bw / 2 + 8, byc, bw, bh, l2)
            M['btn'] = [(W / 2 - span / 2, y, W / 2 + span / 2, y + bh + 6)]
        y += h
    return c, M

# ---------- annotation ----------
RED = (226, 54, 54, 255); MAG = (214, 40, 160, 255)
def dashed(d, box, col, w=2, dash=10):
    x0, y0, x1, y1 = box
    for (a, b) in [((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)), ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))]:
        L = math.hypot(b[0] - a[0], b[1] - a[1]); n = max(1, int(L / dash))
        for k in range(0, n, 2):
            t0, t1 = k / n, min(1, (k + 1) / n); d.line((a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0, a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1), fill=col, width=w)
def measure_bottom(c, M):
    """量按钮（含 6 pt 投影）到面板内沿的距离，画在图上。"""
    d = ImageDraw.Draw(c); px0, py0, px1, py1 = M['panel']; inner_b = py1 - 23
    b = M['btn'][0]; gap = inner_b - b[3]; x = (b[0] + b[2]) / 2 + 4
    d.line((px0 * S + 6, inner_b * S, px1 * S - 6, inner_b * S), fill=MAG + (0,) if False else MAG, width=1)
    d.line((x * S, b[3] * S, x * S, inner_b * S), fill=MAG, width=3)
    for yy in (b[3], inner_b): d.line(((x - 5) * S, yy * S, (x + 5) * S, yy * S), fill=MAG, width=3)
    d.text(((x + 8) * S, (b[3] + inner_b) / 2 * S), '%.0f pt' % gap, font=font(11), fill=MAG, anchor='lm')
    return gap
HARNESS = '非实机 · harness 合成 · SPEC v2.2 布局'
def harness_caption(c, W, H):
    """预览工具 work/rsv2/drive.py 给预览图加的黑色说明条（字样取自 tools/board-ui/test_result_screen_style.cjs 的 CAPTION 列表）。"""
    d = ImageDraw.Draw(c); h = 22; y0 = H - max(SAFE[(W, H)]['bottom'], 0) - 8 - h
    d.rectangle((0, y0 * S, W * S, (y0 + h) * S), fill=(0, 0, 0, 200)); d.text((W / 2 * S, (y0 + h / 2) * S), HARNESS, font=font(12, False), fill=(255, 255, 255, 255), anchor='mm')
    dashed(d, (2 * S, (y0 - 2) * S, (W - 2) * S, (y0 + h + 2) * S), RED, 4, 14)
    return (0, y0, W, y0 + h)

def sheet(version, W, H, frames, notes, tag):
    """一张版本图：标题条 + 三个手机（过关·宝箱未开 / 过关·宝箱打开 / 差一点点）+ 右侧说明。"""
    pw, ph = W * S, H * S; gap = 40; head = 150; foot = 70; side = 640
    out = Image.new('RGB', (gap + 3 * (pw + gap) + side, head + ph + foot), (244, 238, 226)); d = ImageDraw.Draw(out)
    d.text((gap, 48), version, font=ImageFont.truetype(FB, 52, index=2), fill=(60, 40, 22), anchor='lm')
    d.text((gap, 108), '%d×%d pt · %s' % (W, H, tag), font=ImageFont.truetype(FR, 28, index=2), fill=(110, 90, 70), anchor='lm')
    caps = ['过关 · 宝箱未开', '过关 · 点开宝箱后', '差一点点（失败）']
    for i, f in enumerate(frames):
        x = gap + i * (pw + gap); out.paste(f.convert('RGB'), (x, head)); d.rectangle((x - 2, head - 2, x + pw + 1, head + ph + 1), outline=(120, 100, 80), width=2)
        d.text((x + pw / 2, head + ph + 36), caps[i], font=ImageFont.truetype(FB, 28, index=2), fill=(60, 40, 22), anchor='mm')
    x = gap + 3 * (pw + gap); y = head; fN = ImageFont.truetype(FR, 24, index=2)
    for line in notes:
        col = (200, 40, 40) if line.startswith('！') else (160, 30, 130) if line.startswith('◆') else (60, 45, 30)
        for seg in wrap(line, fN, side - 30):
            d.text((x, y), seg, font=fN, fill=col); y += 34
        y += 8
    return out
def wrap(s, f, width):
    out, cur = [], ''
    for ch in s:
        if f.getlength(cur + ch) > width: out.append(cur); cur = '　' + ch if out else ch
        else: cur += ch
    if cur: out.append(cur)
    return out

def build():
    res = {}
    for (W, H) in [(390, 844), (375, 667)]:
        key = '%dx%d' % (W, H)
        # v2.2
        fr, gaps = [], []
        for st in ['win-ready', 'win-claimed', 'lose-ready']:
            c, M = draw_v22('%s-%s' % (key, st), W, H); gaps.append(measure_bottom(c, M)); box = harness_caption(c, W, H)
            dd = ImageDraw.Draw(c); lab = 'harness 字 → 去掉（只在预览图里，玩家包不能有）'; lw = tw(lab, 11); dd.rounded_rectangle((4 * S, (box[1] - 24) * S, (12 + lw) * S, (box[1] - 6) * S), radius=4 * S, fill=(255, 255, 255, 235)); dd.text((8 * S, (box[1] - 15) * S), lab, font=font(11), fill=RED, anchor='lm'); fr.append(c)
        notes = ['包内代码：BoardPanels.ts（SPEC v2.2 d6a0019 + 审批条件 e2bd707 + R1/R2 修正，基线 bc81575）。',
                 '画法：tools/board-ui/harness.cjs 跑真实的 openResult()，导出每个节点的位置和尺寸，再用包里的切图逐个画出来。不是实机截图：3D 宝箱换成了 2D 兜底图（popup/chest_*.png），棋盘底图是示意。',
                 '◆ 按钮（含 6 pt 投影）到面板内沿：%s pt。代码规则：ACTION_INNER_PAD 16 + 面板木边 23。' % ' / '.join('%.0f' % g for g in gaps),
                 '！红框里的黑条是预览工具 work/rsv2/drive.py 加的 harness 说明字（“非实机”“harness 合成”“动效预览”“布局/动效”“SPEC v2.2 布局”）。包里已经由 test_result_screen_style 守住；给 PM 看的图也要去掉，否则容易被当成游戏内容。',
                 '现状问题：① 面板固定 350 宽，高度为了宝箱留了大块空白（390×844 过关页面板高 670 pt）；② 星星只有 28–37 pt，焦点落在宝箱上；③ 字号有 34 / 16 两级再加烘焙标题，分数“630 分”的“分”和数字同号；④ 失败页的目标图标贴左边、“×3”离得很远（ResultGoalCount 左对齐）；⑤ 开箱后奖励徽章飘在分数下面，没有名字；⑥ 解锁提示 unlockHint 在 v2.2 被删掉了，玩家看不到新开放了什么（见 unlock/）。',
                 '文案：过关啦 / 630 分 / 下一关 / 回小岛；失败：差一点点 / 步数用完了，换个顺序试试？/ 再试一次 / 回小岛。']
        res['v2.2-' + key] = sheet('v2.2 现状', W, H, fr, notes, '包内现状（harness 复原）')
        # v3-A
        fr, gaps = [], []
        for st in ['closed', 'open', 'lose']:
            c, M = v3a(W, H, st); gaps.append(measure_bottom(c, M)); fr.append(c)
        notes = ['v3-A 焦点收拢：结构不变（一个居中面板、点宝箱领取），只按阶段一精简规则重排，改动最小。',
                 '面板宽 352 pt（680 px 设计稿 ÷ 1.923，取 8 的倍数；375 宽用 336），高度跟内容走，不再留空白。',
                 '间距只用 8 / 16 / 24；字号三级：标题（文楷切图 title_4 / title_5）、正文 16、数字 32（“分”降成 16 的单位字）。',
                 '星星 64 / 48 pt（v2.2 是 37 / 29），后面加一层暖光，焦点回到星星；宝箱 168 pt（矮屏 128）。',
                 '开箱后：奖励徽章停在箱口上方，下面写上名字“潮汐网”。',
                 '失败页：图标和“×3”作为一组居中；文案改成“还差一点点，换个顺序再试试吧”（不说“用完了”）。',
                 '◆ 按钮（含投影）到面板内沿：%s pt；面板外沿到底部横条 / 屏幕底 ≥ 16 pt。' % ' / '.join('%.0f' % g for g in gaps),
                 '图上没有 harness 字。']
        res['v3A-' + key] = sheet('v3-A 焦点收拢（建议）', W, H, fr, notes, '改进版 A · 设计稿')
        # v3-B
        fr, gaps = [], []
        for st in ['closed', 'open', 'lose']:
            c, M = v3b(W, H, st); gaps.append(measure_bottom(c, M)); fr.append(c)
        notes = ['v3-B 星星主角 · 底卡：结算收进一张贴底的浅木卡，三颗星放大到 88 / 64 pt（矮屏 72 / 56），一半压在卡片上沿；标题直接放在卡面上（文楷切图，不再加标题木牌）。上方露出棋盘。',
                 '卡片宽 352 pt（375 宽用 336），下沿距底部横条（没有横条时距屏幕底）16 pt；拇指一伸就能点到“下一关”。',
                 '开箱后宝箱退到左边，奖励徽章和名字排在右边，不再飘动；多件奖励时右边横向排开（每件 64 + 间距 16）。',
                 '遮罩加深到 42%，因为卡片上方的空白直接露出棋盘。',
                 '◆ 按钮（含投影）到卡片内沿：%s pt。' % ' / '.join('%.0f' % g for g in gaps),
                 '代价：要改 configureResultLayout 的整体布局（星星移出面板），R1 的宝箱交接动画也要重新对位置；改动比 v3-A 大。',
                 '区域棋盘上女孩站在棋盘下方时，底卡可能盖住她：结算是全屏模态，不受 HUD 的 13 pt 规则约束，但要 PM 确认能不能接受。',
                 '图上没有 harness 字。']
        res['v3B-' + key] = sheet('v3-B 星星主角 · 底卡（建议）', W, H, fr, notes, '改进版 B · 设计稿')
    os.makedirs(OUT, exist_ok=True); sizes = {}
    for k, im in res.items():
        p = os.path.join(OUT, 'result_%s.jpg' % k); q = 88
        while True:
            im.save(p, quality=q, optimize=True, progressive=True)
            if os.path.getsize(p) <= 690 * 1024 or q <= 60: break
            q -= 4
        sizes[k] = os.path.getsize(p)
    # 对比总表：每个尺寸一张，三个版本的“过关 · 宝箱未开”并排
    for (W, H) in [(390, 844), (375, 667)]:
        key = '%dx%d' % (W, H); ims = []
        for v, fn in [('v2.2 现状', lambda: draw_v22('%s-win-ready' % key, W, H)[0]), ('v3-A 焦点收拢', lambda: v3a(W, H, 'closed')[0]), ('v3-B 星星主角 · 底卡', lambda: v3b(W, H, 'closed')[0])]:
            c = fn()
            if v.startswith('v2.2'): harness_caption(c, W, H)
            ims.append((v, c))
        pw, ph = W * S, H * S; gap = 40; head = 110
        out = Image.new('RGB', (gap + 3 * (pw + gap), head + ph + 30), (244, 238, 226)); d = ImageDraw.Draw(out)
        for i, (v, c) in enumerate(ims):
            x = gap + i * (pw + gap); out.paste(c.convert('RGB'), (x, head)); d.text((x + pw / 2, 60), v + '  %d×%d' % (W, H), font=ImageFont.truetype(FB, 34, index=2), fill=(60, 40, 22), anchor='mm')
        p = os.path.join(OUT, 'compare_%s.jpg' % key); out.save(p, quality=84, optimize=True, progressive=True); sizes['compare-' + key] = os.path.getsize(p)
    json.dump(sizes, open(os.path.join(HERE, 'sizes.json'), 'w'), indent=1); print(sizes)
if __name__ == '__main__': build()
