# r5 U1 定稿图：v3-A 结算 + 红点方案 A。布局全部来自 spec.py（与 IMPLEMENT.md 同一套公式），切图全部是包里现成的
# creator-build-project/assets/bundles/board_art/**（唯一新件：final/assets/reddot.png）。
#   python3 docs/r5/ui/final/src/render_final.py     （仓库根目录或任意目录都可）
# 图上不画任何 harness / 预览说明字；手机画面外的版本标题和标注只在图框外。
import os, sys, json, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__)); FIN = os.path.dirname(HERE)
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(FIN, '..', 'result', 'src'))
import spec, render_result as R
S = R.S; ART = R.ART
K_UI, K_HALF, K_SEA = (0.621, 0.591, 0.562), (0.811, 0.796, 0.781), (0.498, 0.624, 0.702)
TEXT = {False: dict(brown=(99, 63, 33), brown2=(118, 86, 55), teal=(38, 98, 104), white=(251, 248, 236), grey=(150, 140, 124)),
        True: dict(brown=(30, 19, 8), brown2=(34, 23, 11), teal=(6, 30, 34), white=(232, 226, 212), grey=(60, 54, 46))}
DOT = Image.open(os.path.join(FIN, 'assets', 'reddot.png')).convert('RGBA')
def mul(im, k):
    if k is None: return im
    r, g, b, a = im.split(); r = r.point(lambda v: round(v * k[0])); g = g.point(lambda v: round(v * k[1])); b = b.point(lambda v: round(v * k[2]))
    return Image.merge('RGBA', (r, g, b, a))
def put(c, im, cx, cy, op=1.0): R.put(c, im, cx, cy, op)
def spr(c, key, cx, cy, w, h=None, op=1.0, k=None, gray=False, base=None):
    img = R.art(key) if not isinstance(key, Image.Image) else key
    if h is None: h = w * img.height / img.width
    im = img.resize((max(1, round(w * S)), max(1, round(h * S))), Image.LANCZOS)
    if gray: g = im.convert('LA').convert('RGBA'); g.putalpha(im.split()[3]); im = g
    if base: im = mul(im, [v / 255 for v in base])
    put(c, mul(im, k), cx, cy, op)
def text(c, s, cx, cy, fs, col, bold=True, anchor='mm'): R.text(c, s, cx, cy, fs, col + (255,), bold, anchor)
def glow(c, cx, cy, r, rgb, a0): R.glow(c, cx, cy, r, rgb, a0)
def button(c, kind, cx, cy, w, h, label, night, pressed=False):
    sc = 0.96 if pressed else 1.0; dy = 3 if pressed else 0; w2, h2 = w * sc, h * sc
    sh = Image.new('RGBA', (round((w - 4) * S), round((h - 2) * S))); ImageDraw.Draw(sh).rounded_rectangle((0, 0, sh.width - 1, sh.height - 1), radius=round(min(18, h / 2) * S),
        fill=(74 - 30 * night, 50 - 20 * night, 30 - 6 * night, 110)); put(c, sh, cx, cy + 6)
    plate = R.nine('popup/btn_%s_3s' % kind, w2 * S, h2 * S, 207, 0, 207 * h2 / 312 * S, 0)
    if pressed: plate = mul(plate, (240 / 255,) * 3)
    put(c, mul(plate, K_UI if night else None), cx, cy + dy)
    text(c, label, cx, cy + dy + h * 0.03, 16 * sc, TEXT[night]['white' if kind == 'primary' else 'brown'])
def badge(c, cx, cy, d, icon, night):
    glow(c, cx, cy, d * 40 / 68, (0xFF, 0xE2, 0x8C), 0.43)
    g = Image.new('RGBA', c.size); dr = ImageDraw.Draw(g); r = d / 2 * S; k = d / 68
    base = (0xA0, 0x80, 0x5C) if night else (0xC4, 0xA0, 0x6C)
    dr.ellipse((cx * S - r, (cy + 6 * k) * S - r, cx * S + r, (cy + 6 * k) * S + r), fill=base + (255,))
    dr.ellipse((cx * S - r, cy * S - r, cx * S + r, cy * S + r), fill=(0xFF, 0xF8, 0xE4, 255)); r2 = r * 60 / 68
    dr.ellipse((cx * S - r2, cy * S - r2, cx * S + r2, cy * S + r2), fill=(0xFA, 0xEC, 0xCC, 255)); c.alpha_composite(g)
    spr(c, icon, cx, cy, d * 54 / 68, d * 54 / 68 * R.art(icon).height / R.art(icon).width if R.art(icon).width > R.art(icon).height else None, k=K_UI if night else None) if False else \
        spr(c, icon, cx, cy, *fit(icon, d * 54 / 68), k=K_UI if night else None)
def fit(key, box):
    im = R.art(key); s_ = min(box / im.width, box / im.height); return im.width * s_, im.height * s_
_rt = {}
def chest_rt(st, side):
    """游戏里的 3D 宝箱 RenderTexture（render_chest_rt.py 按 ResultChest3D 机位渲的方框图）+ SPEC v2.2 描边 1.5 pt #4A2810。"""
    k = (st, round(side * S))
    if k not in _rt:
        im = Image.open(os.path.join(FIN, 'raw', 'chest_rt_%s.png' % st)).convert('RGBA').resize((k[1], k[1]), Image.LANCZOS)
        a = im.split()[3].point(lambda v: 255 if v > 40 else 0).filter(ImageFilter.MaxFilter(2 * round(1.5 * S) + 1))
        ol = Image.new('RGBA', im.size, (0x4A, 0x28, 0x10, 0)); ol.putalpha(a.filter(ImageFilter.GaussianBlur(0.6))); ol.alpha_composite(im); _rt[k] = ol
    return _rt[k]
def floor(c, cx, cy, w, night):
    g = Image.new('RGBA', c.size); d = ImageDraw.Draw(g); n = 10; a0 = 0.30 if night else 0.45; st = 1 - (1 - a0) ** (1 / n)
    for kk in range(n):
        f = 1 - kk / n * 0.6; rx, ry = w / 2 * f * S, w * 30 / 220 * f * S
        d.ellipse((cx * S - rx, cy * S - ry, cx * S + rx, cy * S + ry), fill=(0x3C, 0x26, 0x14, round(255 * st)))
    c.alpha_composite(g.filter(ImageFilter.GaussianBlur(S * 2)))

BG = R.BG
def backdrop(W, H, night=False, shade=0.35, img=None):
    src = img if img is not None else BG
    sc = max(W * S / src.width, H * S / src.height); bg = src.resize((round(src.width * sc), round(src.height * sc)), Image.LANCZOS)
    x0 = (bg.width - W * S) // 2; y0 = (bg.height - H * S) // 2; c = bg.crop((x0, y0, x0 + W * S, y0 + H * S)).convert('RGBA')
    if night: c = mul(c, tuple((a + b) / 2 for a, b in zip(K_UI, K_SEA)))  # 示意：棋盘按 K_UI / 海按 K_SEA，这里两者平均
    if shade: c.alpha_composite(Image.new('RGBA', c.size, (16, 28, 34, round(255 * shade))))
    return c
def chrome(c, W, H, f):
    d = ImageDraw.Draw(c)
    if f['B'] >= 20: d.rounded_rectangle(((W / 2 - 67) * S, (H - 13) * S, (W / 2 + 67) * S, (H - 8) * S), radius=3 * S, fill=(20, 20, 20, 210))

def draw_result(W, H, kind='win', state='open', night=False, rewards=None, pressed=None, c=None):
    rewards = rewards or [('board/tool_starlight', '星光 ×2'), ('r2/tool_tidenet', '潮汐网')]
    L = spec.layout(W, H, kind, state, len(rewards), tuple(r[1] for r in rewards), icons=tuple(r[0] for r in rewards))
    f = L['frame']; c = c or backdrop(W, H, night); chrome(c, W, H, f); T = TEXT[night]; ku = K_UI if night else None; kh = K_HALF if night else None
    for n in L['nodes']:
        nm, x, y, w, h = n['name'], n['x'], n['y'], n['w'], n['h']
        if nm == 'PanelFrame': put(c, mul(R.nine('popup/panel_frame_9s', w * S, h * S, 212, 212, 23 * S, 23 * S), ku), x, y)
        elif nm == 'TitlePlank': put(c, mul(R.nine('popup/title_plank_3s', w * S, h * S, 252, 0, 252 * h / 315 * S, 0), ku), x, y)
        elif nm == 'Title': spr(c, n['sprite'], x, y, w, h, k=ku)
        elif nm == 'StarGlow': glow(c, x, y, w / 2, n['glow'], n['alpha'] * (0.85 if night else 1))
        elif nm.startswith('Star-'): spr(c, n['sprite'], x, y, w, h, op=1 if n['on'] else 0.75, k=kh, base=None if n['on'] else (235, 235, 235))
        elif nm == 'Score':
            a, b = n['text'], ' ' + n['unit']; wa, wb = R.tw(a, 32), R.tw(b, 16); x0 = x - (wa + wb) / 2
            text(c, a, x0, y, 32, T['brown'], True, 'lm'); text(c, b, x0 + wa, y + 5, 16, T['brown2'], True, 'lm')
        elif nm == 'ResultMessage': text(c, n['text'], x, y, 16, T[n['role']], False)
        elif nm == 'ResultGoals':
            ic = 32; lab = '×%d' % n['goals'][0][1]; gw = ic + 8 + R.tw(lab, 16); x0 = x - gw / 2
            spr(c, n['goals'][0][0], x0 + ic / 2, y, ic, ic, k=ku); text(c, lab, x0 + ic + 8, y, 16, T['brown'], True, 'lm')
        elif nm == 'ResultNotice':
            tw_ = R.tw(n['text'], 16, False); x0 = x - (tw_ + 26) / 2
            if n['icon'] == 'warn':
                g = ImageDraw.Draw(c); g.ellipse(((x0) * S, (y - 9) * S, (x0 + 18) * S, (y + 9) * S), fill=(232, 150, 70, 255)); text(c, '!', x0 + 9, y, 13, T['white'])
            else: spr(c, n['icon'], x0 + 9, y, None if False else 16, 18, k=ku)
            text(c, n['text'], x0 + 26, y, 16, T[n['role']], False, 'lm')
        elif nm == 'ResultChestRays': spr(c, 'popup/fx_rays', x, y, w, h, op=n['alpha'], k=kh)
        elif nm == 'ResultChestHalo': glow(c, x, y, w / 2, n['glow'], n['alpha'])
        elif nm == 'ResultChestFloor': floor(c, x, y, w, night)
        elif nm == 'ResultChest3D': put(c, mul(chest_rt('open' if state == 'open' else 'closed', w), kh), x, y)
        elif nm.startswith('ResultFloat-'): badge(c, x, y, w, n['icon'], night)
        elif nm.startswith('ResultRewardName-'): text(c, n['text'], x, y, 16, T['brown'], True)
        elif nm.startswith('Btn-'): button(c, n['button'], x, y, w, h, n['text'], night, pressed == n['text'])
    return c, L

# ---------- 红线标注 ----------
MAG = (214, 40, 160, 255); CY = (20, 140, 200, 255)
def redline(c, L, W, H):
    d = ImageDraw.Draw(c); f = L['frame']; P = L['panel']; F = R.font(10)
    def hl(y, col, lab=None, x0=0, x1=None):
        x1 = W if x1 is None else x1
        for x in range(int(x0 * S), int(x1 * S), 12): d.line((x, y * S, x + 6, y * S), fill=col, width=2)
        if lab: d.text(((x0 + 4) * S, (y + 2) * S), lab, font=F, fill=col, anchor='lt')
    hl(f['T'], CY, '安全区顶带 T=%d（max(top, 胶囊下沿)）' % f['T']); hl(H - f['B'], CY, '安全区底 B=%d' % f['B'])
    px0, px1 = P['cx'] - P['w'] / 2, P['cx'] + P['w'] / 2
    def vm(x, y0, y1, lab, col=MAG):
        d.line((x * S, y0 * S, x * S, y1 * S), fill=col, width=3)
        for yy in (y0, y1): d.line(((x - 4) * S, yy * S, (x + 4) * S, yy * S), fill=col, width=3)
        right = x > W - 60
        d.text(((x - 6 if right else x + 6) * S, (y0 + y1) / 2 * S), lab, font=F, fill=col, anchor='rm' if right else 'lm')
    def hm(y, x0, x1, lab, col=MAG):
        d.line((x0 * S, y * S, x1 * S, y * S), fill=col, width=3)
        for xx in (x0, x1): d.line((xx * S, (y - 4) * S, xx * S, (y + 4) * S), fill=col, width=3)
        d.text(((x0 + x1) / 2 * S, (y - 4) * S), lab, font=F, fill=col, anchor='mb')
    vm(px1 + 4, P['bottom'], H - f['B'], '%.1f（≥16）' % (H - f['B'] - P['bottom']))
    vm(px1 + 4, f['T'], P['top'], '%.1f（≥16）' % (P['top'] - f['T']))
    btn = [n for n in L['nodes'] if n['name'].startswith('Btn-')]
    b0 = btn[0]; inner_b = P['bottom'] - 23; bb = b0['y'] + b0['h'] / 2 + 6
    vm(b0['x'], bb, inner_b, '%.0f' % (inner_b - bb))
    hm(b0['y'] - b0['h'] / 2 - 6, px0 + 23, b0['x'] - b0['w'] / 2, '%.0f' % (b0['x'] - b0['w'] / 2 - px0 - 23))
    rr = R.dashed; rr(d, ((px0 + 23) * S, (P['top'] + 23) * S, (px1 - 23) * S, (P['bottom'] - 23) * S), (214, 40, 160, 150), 1, 8)
    hm(P['top'] + 10, px0, px1, 'pw %d' % P['w'], CY)
    lid = [n for n in L['nodes'] if n['name'] == 'LidTop']
    if lid and any(n['name'].startswith('ResultFloat') for n in L['nodes']):
        y = lid[0]['y']; hl(y, (230, 120, 20, 255), '3D 开盖盖顶（LID_REACH 0.47）', px0 + 30, px1 - 30)
    return c

# ---------- 岛屏 / 旅程册（红点 A） ----------
ISL = Image.open(os.path.join(FIN, '..', 'unlock', 'src', 'island_390.jpg')).convert('RGBA')
LAY = json.load(open(spec.LAYOUTS))
def island(W, H):
    if (W, H) == (390, 844): return ISL.copy()
    sc = W / 390; im = ISL.resize((round(ISL.width * sc), round(ISL.height * sc)), Image.LANCZOS)
    tag = [s for s in LAY['%dx%d' % (W, H)]['props']['slots'] if s['role'] == 'journal'][0]['tag']
    want = H / 2 - tag['y']; have = (422 + 372.94) * sc; y0 = round((have - want) * S)
    y0 = max(0, min(im.height - H * S, y0)); return im.crop((0, y0, W * S, y0 + H * S))
def island_noprops(W, H):
    """打开旅程册时岛上的三件道具和标签随 dock 隐藏（IslandJourneyOverlay.open: dock.active=false；3D 道具跟 dockVisible()）。
    底图里道具是截图烘进去的：用道具上方的一条海面竖向镜像盖住道具区（只做示意）。"""
    im = ISL.copy(); band = im.crop((0, 1310, im.width, 1415))  # 道具上方干净的一段海面（2× px）
    im.paste(band.transpose(Image.FLIP_TOP_BOTTOM), (0, 1415)); im.paste(band, (0, 1520))
    if (W, H) == (390, 844): return im
    sc = W / 390; im2 = im.resize((round(im.width * sc), round(im.height * sc)), Image.LANCZOS)
    tag = [s_ for s_ in LAY['%dx%d' % (W, H)]['props']['slots'] if s_['role'] == 'journal'][0]['tag']
    want = H / 2 - tag['y']; have = (422 + 372.94) * sc; yy = round((have - want) * S); yy = max(0, min(im2.height - H * S, yy))
    return im2.crop((0, yy, W * S, yy + H * S))
def journal_dot_xy(W, H):
    """红点圆心（屏幕 pt，y 向下）= 旅程册道具右上角：x = prop.x + 0.374·prop.height − 2，y = prop.bottom + prop.height − 6（Cocos y 向上）。"""
    if (W, H) != (390, 844):  # 375×667 底图是 390 截图缩放裁切的示意：按底图里的道具算，保证点落在画出来的书角上
        sc = W / 390; tag = [s for s in LAY['%dx%d' % (W, H)]['props']['slots'] if s['role'] == 'journal'][0]['tag']
        y0 = (422 + 372.94) * sc - (H / 2 - tag['y']); top = (422 + 354.44 - 59) * sc - y0
        return W / 2 + 0.374 * 59 * sc - 2, top + 6
    p = [s for s in LAY['%dx%d' % (W, H)]['props']['slots'] if s['role'] == 'journal'][0]['prop']
    return W / 2 + p['x'] + 0.374 * p['height'] - 2, H / 2 - (p['bottom'] + p['height'] - 6)
def reddot(c, x, y, d=12, op=1.0, scale=1.0, k=None):
    spr(c, DOT, x, y, d * scale, d * scale, op=op, k=k)
CH = [('tide', '潮汐小径', 10, 2, False), ('meadow', '花粉草甸', 9, 0, False), ('sky', '天空回声', 0, 0, True), ('lake', '风铃湖畔', 0, 0, True)]
def journey(W, H, dots=(), bg=None):
    """照 IslandPanels.openJourney 的 750 设计 px 排版 × popupScale 画；4 章。"""
    s = spec.popup_scale(W, H); c = bg if bg is not None else island(W, H)
    c.alpha_composite(Image.new('RGBA', c.size, (16, 28, 34, round(255 * 0.35))))
    pw, ph = 680 * s, (104 + 4 * 176 + 3 * 32 + 72) * s; cx, top = W / 2, H / 2 - ph / 2
    put(c, R.nine('popup/panel_frame_9s', pw * S, ph * S, 276, 276, 92 * s * S, 92 * s * S), cx, H / 2)
    tw_, th_ = R.art('r2/title_journey').size; plw = max(300, tw_ + 150) * s
    put(c, R.nine('popup/title_plank_3s', plw * S, 105 * s * S, 252, 0, 252 / 3 * s * S, 0), cx, top); spr(c, 'r2/title_journey', cx, top - 105 * s * 0.02, tw_ * s, th_ * s)
    spr(c, 'popup/btn_close', cx + (340 - 32) * s, top + 24 * s, 80 * s)
    P = lambda x, y: (cx + x * s, top + y * s)
    for i, (cid, name, st, chl, locked) in enumerate(CH):
        cy = 104 + i * 208 + 88; ix = -272 + 24; tx = ix + 208 + 24
        sign = R.nine('r2/sign_plank_3s', 544 * s * S, 176 * s * S, 90, 0, 90 * s * S, 0)
        if locked: g = sign.convert('LA').convert('RGBA'); g.putalpha(sign.split()[3]); sign = g
        put(c, sign, *P(0, cy))
        spr(c, 'r2/region_' + cid, *P(ix + 104, cy), 208 * s, 136 * s, gray=locked)
        spr(c, 'popup/reward_seal_' + cid, *P(ix + 12, cy - 56), 64 * s, 64 * s, gray=locked)
        if locked: spr(c, 'r2/icon_lock', *P(ix + 104, cy), None or 64 * s * 61 / 72, 64 * s)
        tw2, th2 = R.art('r2/chapter_' + cid).size; spr(c, 'r2/chapter_' + cid, *P(tx + tw2 / 2, cy - 40), tw2 * s, th2 * s, gray=locked)
        if cid in dots: reddot(c, *P(tx + tw2 + 8 + 10, cy - 40 - 14), 20 * s)
        if locked: text(c, '挑战需通关主线 12', *P(tx, cy + 16), 24 * s, TEXT[False]['grey'], False, 'lm'); continue
        spr(c, 'popup/star_full', *P(tx + 16, cy + 8), 32 * s, 32 * s); text(c, '%d/12' % st, *P(tx + 40, cy + 8), 24 * s, TEXT[False]['brown'], True, 'lm')
        lab = '挑战 %d/4' % chl; w = (44 + len(lab) * 22) * s; x0, y0 = P(tx, cy + 52); d = ImageDraw.Draw(c)
        d.rounded_rectangle((x0 * S, (y0 - 18 * s) * S, (x0 + w) * S, (y0 + 18 * s) * S), radius=18 * s * S, fill=(236, 244, 240, 255), outline=(100, 168, 164, 255), width=2)
        d.line(((x0 + 16 * s) * S, (y0 - 10 * s) * S, (x0 + 16 * s) * S, (y0 + 10 * s) * S), fill=(58, 120, 118, 255), width=3)
        d.polygon([((x0 + 17 * s) * S, (y0 - 10 * s) * S), ((x0 + 29 * s) * S, (y0 - 6 * s) * S), ((x0 + 17 * s) * S, (y0 - 1 * s) * S)], fill=(58, 120, 118, 255))
        text(c, lab, *P(tx + 30, cy + 52), 24 * s, TEXT[False]['teal'], True, 'lm')
    return c
def tap(c, x, y):
    g = Image.new('RGBA', c.size); d = ImageDraw.Draw(g)
    for k_, a in [(22, 70), (15, 120), (8, 200)]: d.ellipse(((x - k_) * S, (y - k_) * S, (x + k_) * S, (y + k_) * S), outline=(255, 255, 255, a), width=4)
    c.alpha_composite(g)
def island_dock_tap_xy(W, H):
    p = [s for s in LAY['%dx%d' % (W, H)]['props']['slots'] if s['role'] == 'journal'][0]
    if (W, H) != (390, 844): x, y = journal_dot_xy(W, H); return W / 2, y + 26
    return W / 2 + p['hit']['x'], H / 2 - p['hit']['y']

# ---------- 拼图 ----------
def F(sz, b=True): return ImageFont.truetype(R.FB if b else R.FR, round(sz), index=2)
def sheet(title, sub, frames, notes=(), scale=1.0):
    fw, fh = round(frames[0][0].width * scale), round(frames[0][0].height * scale); gap = 36; head = 140
    nh = 40 * len(notes)
    out = Image.new('RGB', (gap + len(frames) * (fw + gap), head + fh + 110 + nh + 10), (244, 238, 226)); d = ImageDraw.Draw(out)
    d.text((gap, 50), title, font=F(46), fill=(60, 40, 22), anchor='lm'); d.text((gap, 104), sub, font=F(26, False), fill=(110, 90, 70), anchor='lm')
    for i, (f, cap) in enumerate(frames):
        x = gap + i * (fw + gap); out.paste(f.convert('RGB').resize((fw, fh), Image.LANCZOS), (x, head)); d.rectangle((x - 2, head - 2, x + fw + 1, head + fh + 1), outline=(120, 100, 80), width=2)
        for k_, line in enumerate(cap.split('\n')): d.text((x + fw / 2, head + fh + 34 + k_ * 32), line, font=F(26 if k_ == 0 else 22, k_ == 0), fill=(60, 40, 22), anchor='mm')
    y = head + fh + 100
    for n_ in notes: d.text((gap, y), n_, font=F(24, False), fill=(60, 45, 30)); y += 40
    return out
def save(im, name, sizes, jpg=False):
    p = os.path.join(FIN, name)
    if jpg:
        q = 90
        while True:
            im.convert('RGB').save(p, quality=q, optimize=True, progressive=True)
            if os.path.getsize(p) <= 690 * 1024 or q <= 60: break
            q -= 4
    else: im.save(p, optimize=True)
    sizes[name] = os.path.getsize(p); return p

def build():
    sizes = {}; os.makedirs(os.path.join(FIN, 'frames'), exist_ok=True)
    for (W, H) in [(390, 844), (375, 667)]:
        key = '%dx%d' % (W, H); tier = spec.frame(W, H)['tier']
        a, _ = draw_result(W, H, 'win', 'closed'); b, Lb = draw_result(W, H, 'win', 'open'); l, Ll = draw_result(W, H, 'lose')
        for nm, im in (('win_closed', a), ('win_open', b), ('lose', l)): im.convert('RGB').save(os.path.join(FIN, 'frames', '%s_%s.jpg' % (nm, key)), quality=88); sizes['frames/%s_%s.jpg' % (nm, key)] = os.path.getsize(os.path.join(FIN, 'frames', '%s_%s.jpg' % (nm, key)))
        save(sheet('v3-A 定稿 · 结算 · %s' % key, '档位 %s · 面板宽 %d（680 × popupScale）· 底部按钮离面板内沿 16 · 面板离安全区 ≥ 16' % (tier, spec.frame(W, H)['pw']),
                   [(a, '成功 · 开箱前\n点宝箱领取（呼吸光 + 轻跳）'), (b, '成功 · 3 星 · 开箱后\n奖励名：星光 ×2 / 潮汐网'), (l, '失败\n还差一点点，换个顺序再试试吧')]), 'result_%s.jpg' % key, sizes, True)
        r1 = redline(draw_result(W, H, 'win', 'open')[0], Lb, W, H); r2 = redline(draw_result(W, H, 'lose')[0], Ll, W, H)
        r3, L3 = draw_result(W, H, 'win', 'closed', pressed='下一关'); r3 = redline(r3, L3, W, H)
        save(sheet('v3-A 定稿 · 红线标注 · %s' % key, '洋红 = 实测距离（pt）；青 = 安全区线；橙 = 3D 开盖盖顶；虚线框 = 面板内沿（木边 23）',
                   [(r1, '成功 · 开箱后'), (r2, '失败'), (r3, '开箱前 ·「下一关」按下态\n×0.96 + 下沉 3 + 压暗 6%')]), 'redline_%s.jpg' % key, sizes, True)
        # 红点 A 四步
        f1, _ = draw_result(W, H, 'win', 'open')
        f2 = island(W, H); reddot(f2, *journal_dot_xy(W, H)); tap(f2, *island_dock_tap_xy(W, H))
        f3 = journey(W, H, dots=('meadow',), bg=island_noprops(W, H)); s = spec.popup_scale(W, H); tap(f3, W / 2 + 0 * s, H / 2 - (104 + 4 * 176 + 3 * 32 + 72) * s / 2 + (104 + 208 + 88) * s)
        f4 = journey(W, H, dots=(), bg=island_noprops(W, H))
        save(sheet('红点方案 A 定稿 · %s' % key, '所有解锁都汇到旅程册：岛上只亮旅程册一个点；册子里亮在新开放的章节牌上（红点 reddot.png，Blender 渲）',
                   [(f1, '① 过关，成绩已存\n结算页不写解锁文字'), (f2, '② 回到小岛\n旅程册右上角出现红点'), (f3, '③ 打开旅程册：岛上的点已灭\n新开放的「花粉草甸」牌上有点'), (f4, '④ 进过花粉草甸章节页后\n回到册子，牌上的点也灭了')],
                   ['底图：② 是本作岛屏实机截图（pm-audit C0）%s；' % ('' if key == '390x844' else '缩放裁切的示意，道具大小与 375×667 实际布局略有出入，红点位置以 IMPLEMENT §8 公式为准'),
                    '③④ 按 IslandPanels.openJourney 的排版用包内切图重画（4 章）；打开册子时 dock 和三件道具随之隐藏。'], scale=0.62), 'reddot_A_%s.jpg' % key, sizes, True)
    # 夜间
    n1, _ = draw_result(390, 844, 'win', 'open', night=True); n2, _ = draw_result(390, 844, 'lose', night=True); d1, _ = draw_result(390, 844, 'win', 'open')
    nisl = mul(ISL.copy(), tuple((a + b) / 2 for a, b in zip(K_UI, K_SEA))); reddot(nisl, *journal_dot_xy(390, 844), k=K_HALF)
    save(sheet('v3-A 定稿 · 夜间 · 390x844', '木件 / 面板 / 按钮 ×K_UI；星星、宝箱、光芒、红点 ×K_HALF；文字不乘色，换夜间色（≥4.5:1）；棋盘 / 岛底图为示意乘色',
               [(d1, '白天（对照）'), (n1, '夜间 · 成功 · 开箱后'), (n2, '夜间 · 失败'), (nisl, '夜间 · 岛上红点')]), 'result_night_390x844.jpg', sizes, True)
    # 7 种竖屏
    fr = []
    for (W, H) in spec.SCREENS:
        im, L = draw_result(W, H, 'win', 'open'); fr.append((redline(im, L, W, H), '%dx%d · %s' % (W, H, L['tier'])))
    hmax = max(f.height for f, _ in fr); gap = 30; tot = sum(f.width for f, _ in fr) * 0.5 + gap * (len(fr) + 1)
    out = Image.new('RGB', (round(tot), round(hmax * 0.5) + 200), (244, 238, 226)); d = ImageDraw.Draw(out); x = gap
    d.text((gap, 50), 'v3-A · 7 种竖屏 · 成功开箱后（最高的状态）· 红线', font=F(40), fill=(60, 40, 22), anchor='lm')
    for f, cap in fr:
        im = f.convert('RGB').resize((round(f.width * 0.5), round(f.height * 0.5)), Image.LANCZOS); out.paste(im, (round(x), 100))
        d.text((x + im.width / 2, 100 + im.height + 40), cap, font=F(26), fill=(60, 40, 22), anchor='mm'); x += im.width + gap
    save(out, 'result_7screens.jpg', sizes, True)
    json.dump(sizes, open(os.path.join(HERE, 'sizes_final.json'), 'w'), indent=1); print(json.dumps(sizes, indent=1))
if __name__ == '__main__': build()
