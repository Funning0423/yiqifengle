# r5 U1 定稿 · v3-A 结算 + 红点 A 的布局公式（IMPLEMENT.md 里的公式就是这份代码；出图和 7 屏数值表都从这里算）。
# 单位：逻辑 pt（= Cocos 设计分辨率单位，结算面板 scale 1）。y 向下为正；面板内坐标 x 从面板中心起，y 从面板上沿起。
# Cocos 节点位置：node.position = (x, panelH/2 - y)（面板 body 原点在中心、y 向上）。
import json, math, os
HERE = os.path.dirname(os.path.abspath(__file__))
LAYOUTS = os.path.join(HERE, '../../result/src/layouts_7screens.json')
SCREENS = [(390, 844), (414, 896), (360, 780), (375, 667), (390, 520), (320, 568), (768, 1024)]  # transitions-DESIGN §4.1

# ---------- 常量（来源见 IMPLEMENT.md §2） ----------
E = 23            # 面板木边：panel_frame_9s 九宫格 inset 212 源 px 显示成 23 pt（BoardPanels PANEL_EDGE_PT）
PAD = 16          # 按钮 / 内容到面板内沿（PM 定：从面板内沿算）
C = E + PAD       # 39：内容区到面板外沿
MARGIN = 16       # 面板外沿到 安全区顶带（刘海 / 胶囊下沿）和 安全区底（home 横条）的最小距离
SHADOW = 6        # 按钮投影（ACTION_SHADOW）
BTN_GAP = 16      # 两个按钮之间
NAME_LINE = 22    # 16 pt 文字行高
STAR_ASPECT = 184 / 170   # star_full 宽 / 高
CHEST_ASPECT = 147 / 180  # 闭合宝箱 高 / 宽（CHEST_H / CHEST_W）
FRAME_K, FRAME_DY, LID_REACH = 0.60, 0.028, 0.47   # ResultChest3D：闭合宝箱占 RT 方框宽 60%；箱心在框心下 2.8%；开盖后盖顶在箱心上 47% 框边
def ceil8(v): return int(math.ceil(v / 8 - 1e-9) * 8)
def popup_scale(W, H): return max(0.3, min(W / 750, H / 1300, 0.62))   # PopupKit.popupScale

TIERS = {  # 档位：N 常规 / C 紧凑 / M 矮屏（奖励放宝箱右侧）/ X 极矮（星星和分数并一行）
    'N': dict(top=64, star=(64, 48), starRow=64, g1=16, score=40, g2=24, chest=168, badge=64, g3=24, btnH=56, side=False, inline=False),
    'C': dict(top=56, star=(56, 44), starRow=56, g1=8,  score=40, g2=16, chest=128, badge=56, g3=16, btnH=52, side=False, inline=False),
    'M': dict(top=56, star=(48, 40), starRow=48, g1=8,  score=40, g2=8,  chest=104, badge=48, g3=16, btnH=52, side=True,  inline=False),
    'X': dict(top=56, star=(32, 24), starRow=0,  g1=0,  score=40, g2=8,  chest=104, badge=48, g3=16, btnH=52, side=True,  inline=True),
}
TIERS['N2'] = dict(TIERS['N'], g2=16, badge=56, g3=16)   # 开箱后高度修正（§3.5）：N 放不下时先收紧 N 的留白和徽章，再降到 C
TIERS['CS'] = dict(TIERS['C'], side=True)                     # C 的星和宝箱，奖励放宝箱右侧（开箱后不再往上加徽章带）
TIERS['XS'] = dict(TIERS['X'], top=48, chest=88, g3=8, btnH=44, rows=True)   # 极矮压缩：奖励按「图标 32 + 14 pt 名字」横行排
for _t in TIERS.values(): _t.setdefault('rows', False)
ORDER = ['N', 'N2', 'C', 'CS', 'M', 'X', 'XS']
ROW_ICON, ROW_NAME_W, ROW_GAP = 32, 49, 6
LID_OVERHANG = 0.10   # 打开态盖子超出闭合箱体右沿的量（RT 方框边的比例，render_chest_rt 实测 (565−500)/640）   # XS 横行：图标、名字列宽（14 pt「星光 ×2」）、间距
CARD_GAP = 8      # 开箱后面板（含标题木牌）上沿离关卡卡片下沿的最小距离（PM 2026-10-18 15:32）
def card_bottom(W, H):
    """关卡卡片（BoardLayout.boardLayout(...).plate，竖屏）下沿 = plate.y + plate.height/2，y 向下。"""
    d = json.load(open(LAYOUTS))['%dx%d' % (W, H)]; b = d.get('board_real') or d['board_fb']; p = b['plate']
    return p['y'] + p['height'] / 2

def chest_geo(cw):
    ch = cw * CHEST_ASPECT; F = cw / FRAME_K
    return dict(w=cw, h=ch, frame=F, lid=LID_REACH * F, k=cw / 180)

def side_badge(t, n): return t['badge'] if n <= 1 else 40   # 右侧竖排 2 件时徽章缩到 40
def chest_rows(t, n_side):
    """宝箱行高：闭合 RHc、打开 RHo。宝箱底边贴行底（两种状态宝箱不动）。"""
    g = chest_geo(t['chest']); rhc = ceil8(g['h'])
    if not t['side']:
        band = t['badge'] + 8 + NAME_LINE if n_side else 0
        rho = ceil8(band + 8 + g['lid'] + g['h'] / 2) if n_side else max(rhc, ceil8(g['lid'] + g['h'] / 2))
    else:
        col = 2 * ROW_ICON + 8 if t['rows'] else 2 * (side_badge(t, 2) + 4 + NAME_LINE) + 8   # 右侧一列总按 2 件留高（开箱前不知道箱里几件）
        rho = max(ceil8(g['lid'] + g['h'] / 2), ceil8(col))
    return rhc, rho, g

def heights(t, kind='win', n_side=1):
    star_block = t['starRow'] + t['g1'] + t['score'] if not t['inline'] else t['score']
    if kind == 'win':
        rhc, rho, _ = chest_rows(t, n_side)
        head = t['top'] + star_block + t['g2']
        tail = t['g3'] + t['btnH'] + SHADOW + C
        return head + rhc + tail, head + rho + tail
    if kind == 'lose':
        body = t['top'] + (t['starRow'] + 16 if not t['inline'] else 0) + 24 + 16 + 40 + 24  # 星 → 文案 24 → 目标 40
        return body + t['btnH'] + SHADOW + C, None
    # unsaved / readonly：星 + 分数 + 提示行 24
    body = t['top'] + star_block + 16 + 24 + 24
    return body + t['btnH'] + SHADOW + C, None

def safe_for(W, H):
    d = json.load(open(LAYOUTS))['%dx%d' % (W, H)]; s = d.get('realSafe') or d['fallbackSafe']
    return dict(top=s['top'], bottom=s['bottom'], left=s.get('left', 0), right=s.get('right', 0), capsule=s.get('capsule'), real=bool(d.get('realSafe')))

def frame(W, H, safe=None, n_side=1):
    s = safe or safe_for(W, H); cap = s.get('capsule') or {}
    T = max(s['top'], cap.get('bottom', 0)); B = s['bottom']
    pw = min(round(680 * popup_scale(W, H)), W - s['left'] - s['right'] - 24)
    card = card_bottom(W, H)
    top_lim = max(T + MARGIN, card + CARD_GAP); bot_lim = H - B - MARGIN   # 面板上沿 / 下沿的界限
    A = bot_lim - top_lim
    tier = None
    for k in ORDER:
        if heights(TIERS[k], 'win', n_side)[1] <= A: tier = k; break
    return dict(W=W, H=H, T=T, B=B, A=A, card=card, top_lim=top_lim, bot_lim=bot_lim, pw=pw, ci=pw - 2 * C, tier=tier or 'pages', safe=s)

def layout(W, H, kind='win', state='open', n_side=1, names=('潮汐网',), safe=None, icons=('r2/tool_tidenet',)):
    """返回所有节点（屏幕坐标 pt，y 向下）。kind: win/lose/unsaved/readonly；state: closed/open（win）。"""
    n_side = min(n_side, 3); f = frame(W, H, safe, n_side); tk = f['tier'] if f['tier'] != 'pages' else 'X'; t = TIERS[tk]
    pw, ci = f['pw'], f['ci']; band_top, band_bot = f['top_lim'], f['bot_lim']
    if kind == 'win':
        hc, ho = heights(t, 'win', n_side); h = ho if state == 'open' else hc
        cy_open = (band_top + band_bot) / 2; cy_open = max(band_top + ho / 2, min(cy_open, band_bot - ho / 2))
        bottom = cy_open + ho / 2; top = bottom - h       # 底边按“打开态”定位：开箱时只有上半部分往上长
    else:
        h = heights(t, kind)[0]; cy = (band_top + band_bot) / 2; top = cy - h / 2; bottom = top + h
    cx = f['safe']['left'] + (W - f['safe']['left'] - f['safe']['right']) / 2
    N = []
    def add(name, x, y, w, hh, **kw): N.append(dict(name=name, x=cx + x, y=top + y, w=w, h=hh, lx=x, ly=y, **kw))
    add('PanelFrame', 0, h / 2, pw, h, sprite='popup/panel_frame_9s', inset=212, edge=E)
    title = {'win': ('popup/title_4', 143, 49), 'lose': ('popup/title_5', 186, 50), 'unsaved': ('r2/title_unsaved', 188, 50), 'readonly': ('r2/title_review', 188, 50)}[kind]
    tw_ = 24 * title[1] / title[2]
    add('TitlePlank', 0, 24, max(tw_ + 64, 96), 48, sprite='popup/title_plank_3s', inset3=252)
    add('Title', 0, 24 - 1, tw_, 24, sprite=title[0])
    y = t['top']; big, side = t['star']; stars = 3 if kind == 'win' else (0 if kind == 'lose' else 3)
    def star_row(yc, x0=0):
        bw, sw = big * STAR_ASPECT, side * STAR_ASPECT; off = bw / 2 + (8 if not t['inline'] else 4) + sw / 2
        for i, (dx, sz, dy) in enumerate([(-off, side, 6 if not t['inline'] else 4), (0, big, 0), (off, side, 6 if not t['inline'] else 4)]):
            on = i < stars if kind != 'lose' else False
            add('Star-%d' % i, x0 + dx, yc + dy, sz * STAR_ASPECT, sz, sprite='popup/star_full' if on else 'popup/star_empty', on=on)
        return off * 2 + sw
    if not t['inline']:
        if kind == 'win': add('StarGlow', 0, y + t['starRow'] / 2, big * 2.3, big * 2.3, glow=(0xFF, 0xE2, 0x8C), alpha=0.42)
        star_row(y + t['starRow'] / 2); y += t['starRow'] + (t['g1'] if kind != 'lose' else 16)
    if kind == 'lose':
        add('ResultMessage', 0, y + 12, ci, 24, text='还差一点点，换个顺序再试试吧', fs=16, role='brown', bold=False); y += 24 + 16
        add('ResultGoals', 0, y + 20, ci, 40, goals=[('board/piece_strawberry', 3)]); y += 40 + 24
    else:
        if t['inline']:
            gw = star_row(-999)  # 先量宽度
            N[:] = [n for n in N if not n['name'].startswith('Star-')]
            sw_ = 72; total = gw + 16 + sw_; x0 = -total / 2 + gw / 2
            star_row(y + 20, x0); add('Score', x0 + gw / 2 + 16 + sw_ / 2, y + 20, sw_, 40, text='630', unit='分', fs=32)
        else: add('Score', 0, y + t['score'] / 2, ci, t['score'], text='630', unit='分', fs=32)
        y += t['score'] + (t['g2'] if kind == 'win' else 16)
        if kind in ('unsaved', 'readonly'):
            add('ResultNotice', 0, y + 12, ci, 24, text='成绩还没存进旅程册' if kind == 'unsaved' else '记录暂时不能写入，这局只看不存', fs=16,
                role='brown' if kind == 'unsaved' else 'brown2', icon='warn' if kind == 'unsaved' else 'r2/icon_lock'); y += 24 + 24
    if kind == 'win':
        rhc, rho, g = chest_rows(t, n_side); rh = rho if state == 'open' else rhc
        row_top = y; row_bot = y + rh; ccy = row_bot - g['h'] / 2; k = g['k']
        sidew = ROW_ICON + ROW_GAP + ROW_NAME_W if t['rows'] else 72
        sgap = min(16 + round(LID_OVERHANG * g['frame']), ci - g['w'] - sidew)   # 打开的盖子向右伸出约 0.10F，右列要让开
        group = g['w'] + sgap + sidew if (t['side'] and state == 'open' and n_side) else g['w']
        ccx = -group / 2 + g['w'] / 2 if group != g['w'] else 0
        add('ResultChestRow', 0, y + rh / 2, ci, rh)
        if state == 'open':
            add('ResultChestRays', ccx, ccy - 48 * k, min(300 * k, ci), min(300 * k, ci), sprite='popup/fx_rays', alpha=0.5)
            add('ResultChestHalo', ccx, ccy - 26 * k, 2 * 78 * k, 2 * 78 * k, glow=(0xFF, 0xD6, 0x78), alpha=0.59)
        else:
            add('ResultChestHalo', ccx, ccy + 4 * k, 2 * 74 * k, 2 * 74 * k, glow=(0xFF, 0xDE, 0x8C), alpha=0.47)
        add('ResultChestFloor', ccx + 0.06 * g['w'], ccy + g['h'] / 2 - 0.02 * g['w'], g['w'], g['w'] * 60 / 220, floor=True)
        add('ResultChest3D', ccx + 8 * k, ccy - FRAME_DY * g['frame'], g['frame'], g['frame'], rt=True)
        add('ResultChestArt', ccx + 8 * k, ccy if state != 'open' else ccy + g['h'] / 2 - g['w'] * 0.98 * 387 / 400 / 2, g['w'] * (1 if state != 'open' else 0.98),
            g['h'] if state != 'open' else g['w'] * 0.98 * 387 / 400, sprite='popup/chest_open' if state == 'open' else 'popup/chest_closed', fallback=True)
        if state != 'open':
            hw = min(ci, g['w'] + 48); add('ResultChestTap', ccx, ccy, hw, max(44, g['h'] + 32), hit=True)
        add('LidTop', ccx, ccy - g['lid'], 0, 0, guide=True)
        if state == 'open' and n_side:
            b = t['badge']
            if not t['side']:
                colW = min(ci / n_side, 96)
                for i in range(n_side):
                    bx = (i - (n_side - 1) / 2) * colW
                    add('ResultFloat-%d' % i, bx, row_top + b / 2, b, b, badge=True, icon=icons[i % len(icons)])
                    add('ResultRewardName-%d' % i, bx, row_top + b + 8 + NAME_LINE / 2, colW - 4, NAME_LINE, text=names[i % len(names)], fs=16, role='brown', bold=True)
            elif t['rows']:
                n2 = min(n_side, 2); x0 = group / 2 - sidew; blk = n2 * ROW_ICON + (n2 - 1) * 8; y0 = row_top + (rh - blk) / 2
                for i in range(n2):
                    add('ResultFloat-%d' % i, x0 + ROW_ICON / 2, y0 + ROW_ICON / 2, ROW_ICON, ROW_ICON, badge=True, icon=icons[i % len(icons)])
                    add('ResultRewardName-%d' % i, x0 + ROW_ICON + ROW_GAP + ROW_NAME_W / 2, y0 + ROW_ICON / 2, ROW_NAME_W, NAME_LINE, text=names[i % len(names)], fs=14, role='brown', bold=True, align='left')
                    y0 += ROW_ICON + 8
            else:
                n2 = min(n_side, 2); b = side_badge(t, n2); colx = group / 2 - 36; blk = n2 * (b + 4 + NAME_LINE) + (n2 - 1) * 8; y0 = row_top + (rh - blk) / 2
                for i in range(n2):
                    add('ResultFloat-%d' % i, colx, y0 + b / 2, b, b, badge=True, icon=icons[i % len(icons)])
                    add('ResultRewardName-%d' % i, colx, y0 + b + 4 + NAME_LINE / 2, 72, NAME_LINE, text=names[i % len(names)], fs=16, role='brown', bold=True)
                    y0 += b + 4 + NAME_LINE + 8
        y = row_bot + t['g3']
    bh = t['btnH']
    labels = {'win': ('下一关', '回小岛'), 'lose': ('再试一次', '回小岛'), 'unsaved': ('重试保存', '返回海岛'), 'readonly': (None, '返回海岛')}[kind]
    by = h - C - SHADOW - bh / 2
    if labels[0]:
        bw = (ci - BTN_GAP) / 2
        add('Btn-' + labels[0], -(bw / 2 + BTN_GAP / 2), by, bw, bh, button='primary', text=labels[0], fs=16)
        add('Btn-' + labels[1], (bw / 2 + BTN_GAP / 2), by, bw, bh, button='secondary', text=labels[1], fs=16)
    else:
        bw = min(240, ci); add('Btn-' + labels[1], 0, by, bw, bh, button='primary', text=labels[1], fs=16)
    return dict(frame=f, tier=tk, panel=dict(cx=cx, top=top, bottom=top + h, w=pw, h=h), nodes=N)

def table():
    rows = []
    for (W, H) in SCREENS:
        f = frame(W, H); t = TIERS[f['tier']] if f['tier'] in TIERS else None
        hc, ho = heights(t, 'win', 1); hl = heights(t, 'lose')[0]
        o = layout(W, H, 'win', 'open'); c = layout(W, H, 'win', 'closed'); l = layout(W, H, 'lose')
        rows.append(dict(screen='%dx%d' % (W, H), safe=('真机行' if f['safe']['real'] else '无 wx 兜底'), T=f['T'], B=f['B'], A=f['A'],
                         scale=round(popup_scale(W, H), 4), pw=f['pw'], ci=f['ci'], tier=f['tier'], h_closed=hc, h_open=ho, h_lose=hl,
                         top_open=round(o['panel']['top'], 1), top_closed=round(c['panel']['top'], 1), bottom=round(o['panel']['bottom'], 1),
                         lose_top=round(l['panel']['top'], 1), card=f['card'], gap_card=round(o['panel']['top'] - f['card'], 1), gap_bottom=round(H - f['B'] - o['panel']['bottom'], 1), gap_top=round(o['panel']['top'] - f['T'], 1),
                         btn_w=round((f['ci'] - BTN_GAP) / 2, 1)))
    return rows
if __name__ == '__main__':
    rows = table(); json.dump(rows, open(os.path.join(HERE, 'screens.json'), 'w'), ensure_ascii=False, indent=1)
    for r in rows: print(r)
    for k in ORDER: print(k, heights(TIERS[k], 'win', 1), heights(TIERS[k], 'lose'), heights(TIERS[k], 'unsaved'))
