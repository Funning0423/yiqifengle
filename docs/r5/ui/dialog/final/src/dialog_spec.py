"""U2 定稿 · 对话框（海风气泡）布局规则 —— IMPLEMENT.md §3–§6 的唯一数据源，render_final_dialog.py 和表格都从这里取数。
坐标：pt，屏幕左上原点，y 向下（Cocos 里换成节点坐标见 IMPLEMENT §2）。"""
import json, os, math
from PIL import ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); FINAL = os.path.dirname(HERE)
F_NAME = os.path.join(FINAL, 'fonts', 'QFLDialogName.ttf'); F_BODY = os.path.join(FINAL, 'fonts', 'QFLDialogBody.ttf')
LAYOUTS = os.path.join(FINAL, '..', '..', 'final', 'src', 'spec.py')
SCREENS = [(390, 844), (414, 896), (360, 780), (375, 667), (390, 520), (320, 568), (768, 1024)]
# ---- 常量 ----
M_SIDE, MAX_W, GAP_SAFE, GAP_GIRL = 14, 480, 16, 13
R = 30                      # 气泡可见圆角
TAIL_W, TAIL_H, TAIL_IN = 22, 12, 5          # 尾巴底宽、伸出高度、盖进气泡的平板
TAG_H, TAG_X, TAG_PAD, TAG_MIN, TAG_TEXT_MAX = 32, 20, 16, 64, 88
NAME_FS, NAME_FS_MIN = 16, 14
REG = dict(fs=17, lh=26, padT=24, padB=20, padX=24)
CMP = dict(fs=16, lh=24, padT=22, padB=18, padX=20)
MAX_LINES = 3
NO_HEAD = set('，。、！？：；”’）》」』…—～·,.!?:;)')     # 不能出现在行首的标点（避头）
TAG_COLORS = {'阿芳': (0xA0, 0x62, 0x0E), '阿宁': (0x2A, 0x7B, 0x80), '老铆': (0x5A, 0x7A, 0x3C)}   # 占位名
TAG_FALLBACK = [(0x8A, 0x5A, 0x9E), (0xB0, 0x4E, 0x4E), (0x3E, 0x6E, 0x9E)]                    # 名单外角色按名字 hash 取
def tag_color(name):
    if name in TAG_COLORS: return TAG_COLORS[name]
    h = 0
    for ch in name: h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return TAG_FALLBACK[h % len(TAG_FALLBACK)]
_fc = {}
def font(path, sz):
    k = (path, sz)
    if k not in _fc: _fc[k] = ImageFont.truetype(path, sz * 8)   # 8× 精度量宽
    return _fc[k]
def tw(s, path, sz): return font(path, sz).getlength(s) / 8
def safe_for(W, H):
    import importlib.util
    sp = importlib.util.spec_from_file_location('u1spec', LAYOUTS); m = importlib.util.module_from_spec(sp); sp.loader.exec_module(m)
    return m.safe_for(W, H)
def metrics(W, H): return dict(CMP if (H < 700 or W < 360) else REG, compact=(H < 700 or W < 360))
def wrap(text, width, fs):
    """逐字换行 + 避头：下一行行首是 NO_HEAD 标点时，把本行最后一个字一起带下去。返回行列表。"""
    lines, cur = [], ''
    for ch in text:
        if ch == '\n': lines.append(cur); cur = ''; continue
        if tw(cur + ch, F_BODY, fs) <= width or not cur: cur += ch; continue
        if ch in NO_HEAD and len(cur) >= 2: lines.append(cur[:-1]); cur = cur[-1] + ch
        else: lines.append(cur); cur = ch
    if cur: lines.append(cur)
    return lines
def name_tag(name):
    """名字胶囊：文本宽 ≤ 88 用 16 pt；超了换 14 pt；还超就截断加「…」。返回 (显示文本, 字号, 外宽 Wt)。"""
    if not name: return None
    fs = NAME_FS
    if tw(name, F_NAME, fs) > TAG_TEXT_MAX: fs = NAME_FS_MIN
    s = name
    if tw(s, F_NAME, fs) > TAG_TEXT_MAX:
        while s and tw(s + '…', F_NAME, fs) > TAG_TEXT_MAX: s = s[:-1]
        s += '…'
    return s, fs, max(TAG_MIN, math.ceil(tw(s, F_NAME, fs)) + 2 * TAG_PAD)
def box_gap(a, b):
    dx = max(b[0] - a[2], a[0] - b[2], 0); dy = max(b[1] - a[3], a[1] - b[3], 0)
    return math.hypot(dx, dy) if (dx or dy) else -min(a[2] - b[0], b[2] - a[0], a[3] - b[1], b[3] - a[1])
def layout(W, H, girl, speaker_pt, name, text, safe=None, page=0):
    """girl = 女孩投影包围盒 (l,t,r,b)；speaker_pt = 说话人头顶投影点（None = 旁白 / 不在镜头里）。"""
    s = safe or safe_for(W, H); m = metrics(W, H)
    bw = min(W - s.get('left', 0) - s.get('right', 0) - 2 * M_SIDE, MAX_W); x0 = (W - bw) / 2; x1 = x0 + bw
    bottom = H - s['bottom'] - GAP_SAFE
    tag = name_tag(name); Wt = tag[2] if tag else 0
    # ---- 尾巴方向和位置（不依赖行数） ----
    tail = None
    if name and speaker_pt is not None:
        sx, sy = speaker_pt
        if sx < 0 or sx > W: tail = ('left' if sx < 0 else 'right', sy)
        else:
            lo, hi = x0 + R + TAIL_W / 2, x1 - R - TAIL_W / 2
            if tag: lo = max(lo, x0 + TAG_X + Wt + 8 + TAIL_W / 2)    # 不压名字胶囊
            tail = ('up', min(hi, max(lo, sx)))
    # ---- 最多几行：bottom − keepTop 能放下的行数 ----
    gx = (girl[0] - GAP_GIRL, girl[2] + GAP_GIRL)
    keep = girl[3] + GAP_GIRL
    over = lambda a, b: a < gx[1] and b > gx[0]
    if tail and tail[0] == 'up' and over(tail[1] - TAIL_W / 2, tail[1] + TAIL_W / 2): keep = max(keep, girl[3] + GAP_GIRL + TAIL_H)
    if tag and over(x0 + TAG_X, x0 + TAG_X + Wt): keep = max(keep, girl[3] + GAP_GIRL + TAG_H / 2)
    avail = bottom - keep
    fit = math.floor((avail - m['padT'] - m['padB']) / m['lh'])
    max_lines = max(1, min(MAX_LINES, fit)); camera_needed = fit < 1
    lines = wrap(text, bw - 2 * m['padX'], m['fs'])
    pages = [lines[i:i + max_lines] for i in range(0, len(lines), max_lines)] or [[]]
    n = max(len(p) for p in pages); h = m['padT'] + n * m['lh'] + m['padB']; top = bottom - h
    out = dict(W=W, H=H, safe=s, m=m, x0=x0, x1=x1, top=top, bottom=bottom, bw=bw, h=h, pages=pages, page=page, max_lines=max_lines, fit=fit,
               camera_needed=camera_needed, keep=keep, avail=avail, name=name, tag=None, tail=None, arrow=None, narration=not name)
    shapes = [(x0, top, x1, bottom)]
    if tag:
        out['tag'] = dict(text=tag[0], fs=tag[1], Wt=Wt, x=x0 + TAG_X, cx=x0 + TAG_X + Wt / 2, cy=top, color=tag_color(name))
        shapes.append((x0 + TAG_X, top - TAG_H / 2, x0 + TAG_X + Wt, top + TAG_H / 2))
    if tail:
        k, v = tail
        if k == 'up': out['tail'] = dict(dir='up', x=v, y=top); shapes.append((v - TAIL_W / 2, top - TAIL_H, v + TAIL_W / 2, top))
        else:
            y = min(bottom - R - TAIL_W / 2, max(top + R + TAIL_W / 2, v)); x = x0 if k == 'left' else x1
            out['tail'] = dict(dir=k, x=x, y=y); shapes.append((x - TAIL_H, y - TAIL_W / 2, x, y + TAIL_W / 2) if k == 'left' else (x, y - TAIL_W / 2, x + TAIL_H, y + TAIL_W / 2))
    if page < len(pages) - 1: out['arrow'] = dict(cx=x1 - 13, cy=bottom - 12)   # 落在右侧内边距里（不和文字抢位置）
    out['shapes'] = shapes
    out['gap_girl'] = round(min(box_gap(a, girl) for a in shapes), 1)
    out['gap_safe'] = round(H - s['bottom'] - bottom, 1)
    out['text_x'] = x0 + m['padX']; out['text_y0'] = top + m['padT']
    return out
LINES = {l['id']: l for l in json.load(open(os.path.join(FINAL, 'tools', 'sample_dialog', 'mock_r5_u2.json')))['lines']}
def bg_info(W, H, mode='day', seven=False):
    p = os.path.join(FINAL, 'raw', 'bg', ('bg7_%dx%d.json' % (W, H)) if seven else ('bg_%dx%d_%s.json' % (W, H, mode)))
    return json.load(open(p))
def table():
    rows = []
    for W, H in SCREENS:
        bi = bg_info(W, H, seven=True); g = bi['girl_bbox_pt']; L = layout(W, H, g, bi['girl_head_pt'], '阿芳', LINES['three']['text'])
        rows.append(dict(screen='%dx%d' % (W, H), compact=L['m']['compact'], fs=L['m']['fs'], lh=L['m']['lh'], safeB=L['safe']['bottom'], bw=round(L['bw'], 1), x0=round(L['x0'], 1),
                         bottom=round(L['bottom'], 1), girl_bottom=g[3], keep=round(L['keep'], 1), avail=round(L['avail'], 1), fit=L['fit'], max_lines=L['max_lines'],
                         pages=[len(p) for p in L['pages']], top=round(L['top'], 1), h=L['h'], tail_x=round(L['tail']['x'], 1) if L['tail'] else None,
                         gap_girl=L['gap_girl'], gap_safe=L['gap_safe'], camera_needed=L['camera_needed']))
    return rows
if __name__ == '__main__':
    rows = table(); json.dump(rows, open(os.path.join(HERE, 'screens_dialog.json'), 'w'), ensure_ascii=False, indent=1)
    for r in rows: print(r)
    for nm in ['阿芳', '灯塔下的旅人', '灯塔下的远方旅人们', '阿宁']: print(nm, name_tag(nm))
