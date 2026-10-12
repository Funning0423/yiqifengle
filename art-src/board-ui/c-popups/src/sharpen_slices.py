# Higher-resolution slices for settings chrome, main buttons, and the six tools.
# Same crop, same 9-slice maths, same focus_grade. Never LANCZOS-enlarges a smaller render.
#   python3 sharpen_slices.py --check-legacy
#   python3 sharpen_slices.py --apply /tmp/popup-hi/raw /tmp/hires/board
import os, sys, json, subprocess
from PIL import Image, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
POPUP_SLICES = os.path.join(HERE, '..', 'slices')
BOARD_SLICES = os.path.join(ROOT, 'art-src', 'board-ui', 'b-board', 'slices')
R2_SLICES = os.path.join(HERE, '..', 'r2', 'slices')
POPUP_RAW = os.path.join(HERE, 'raw')
BOARD_RAW = os.path.join(ROOT, 'art-src', 'board-ui', 'b-board', 'src', 'raw')
R2_RAW = os.path.join(HERE, 'round2', 'raw')

# Signed-off alpha boxes on the 1× renders. Higher renders crop the same frame ×N,
# so a tighter fringe at the new sample rate cannot change the slice aspect.
CROP = {
    'title_plank_clean': (660, (29, 68, 631, 256)),
    'btn_primary': (648, (23, 22, 625, 188)),
    'btn_secondary': (648, (23, 22, 625, 188)),
    'btn_close': (160, (17, 16, 143, 144)),
    'toggle_on': (240, (15, 19, 225, 121)),
    'toggle_off': (240, (15, 19, 225, 121)),
    'toggle_knob': (240, (80, 35, 160, 115)),
    'icon_music': (160, (32, 18, 132, 133)),
    'icon_sfx': (160, (26, 31, 151, 126)),
    'icon_sun': (160, (17, 24, 143, 142)),
    'icon_moon': (160, (31, 35, 134, 130)),
    'icon_motion': (160, (35, 25, 125, 140)),
    'icon_about': (160, (39, 34, 121, 141)),
    'icon_home': (160, (48, 2, 112, 152)),
    'icon_play': (160, (53, 46, 114, 120)),
}
ICON_BOX = {
    'icon_music': (73, 84), 'icon_sfx': (111, 84), 'icon_sun': (90, 84), 'icon_moon': (91, 84),
    'icon_motion': (66, 84), 'icon_home': (36, 84), 'icon_about': (64, 84), 'icon_play': (46, 56),
}
ICON_H = {'icon_play': 56}
REGIONAL_BOX = {
    'tool_tidenet': (19, 46, 173, 192),
    'tool_sunseed': (19, 5, 173, 192),
    'tool_starshears': (19, 13, 173, 192),
}


def focus_grade(im):
    a = im.getchannel('A')
    rgb = ImageEnhance.Contrast(ImageEnhance.Color(im.convert('RGB')).enhance(1.22)).enhance(1.10)
    o = rgb.convert('RGBA')
    o.putalpha(a)
    return o


def scale_of(measured, base):
    n = int(round(measured / float(base)))
    if n < 1 or abs(measured - base * n) > 2:
        raise SystemExit('render %s is not an integer multiple of %s' % (measured, base))
    return n


def scaled(im, f):
    if f > 1.001:
        raise SystemExit('refuse upscale factor %s' % f)
    return im.resize((max(1, int(round(im.width * f))), max(1, int(round(im.height * f)))), Image.LANCZOS)


def fit_h(im, h):
    if im.height < h:
        raise SystemExit('refuse upscale %s to height %s' % (im.size, h))
    if im.height == h:
        return im
    w = max(1, int(round(im.width * float(h) / im.height)))
    return im.resize((w, h), Image.LANCZOS)


def fit_w(im, w):
    if im.width < w:
        raise SystemExit('refuse upscale %s to width %s' % (im.size, w))
    if im.width == w:
        return im
    h = max(1, int(round(im.height * float(w) / im.width)))
    return im.resize((w, h), Image.LANCZOS)


def snap(im, tw, th):
    """Land on the signed-off canvas. At most 2 px, and only by padding or shrinking."""
    if im.size == (tw, th):
        return im
    if abs(im.width - tw) > 2 or abs(im.height - th) > 2:
        raise SystemExit('slice size %s drifted from %s' % (im.size, (tw, th)))
    if im.width < tw or im.height < th:
        canvas = Image.new('RGBA', (max(im.width, tw), max(im.height, th)), (0, 0, 0, 0))
        canvas.alpha_composite(im, ((canvas.width - im.width) // 2, (canvas.height - im.height) // 2))
        im = canvas
    if im.size != (tw, th):
        if im.width < tw or im.height < th:
            raise SystemExit('refuse upscale snap %s -> %s' % (im.size, (tw, th)))
        im = im.resize((tw, th), Image.LANCZOS)
    return im


def locked_crop(im, name):
    base, box = CROP[name]
    n = scale_of(im.width, base)
    l, t, r, b = [v * n for v in box]
    if r > im.width or b > im.height:
        raise SystemExit('crop outside %s %s' % (name, im.size))
    return im.crop((l, t, r, b)), n


def compact(im, l, t, mid=24):
    w, h = im.size
    r = l
    b = t if t else 0
    cx0 = (w - mid) // 2
    cy0 = (h - mid) // 2 if t else 0
    nw = l + mid + r
    nh = (t + mid + b) if t else h
    o = Image.new('RGBA', (nw, nh), (0, 0, 0, 0))
    xs = [(0, l, 0), (cx0, cx0 + mid, l), (w - r, w, l + mid)]
    ys = [(0, t, 0), (cy0, cy0 + mid, t), (h - b, h, t + mid)] if t else [(0, h, 0)]
    for (a0, a1, dx) in xs:
        for (b0, b1, dy) in ys:
            o.alpha_composite(im.crop((a0, b0, a1, b1)), (dx, dy))
    return o


def load(raw_dir, name):
    return Image.open(os.path.join(raw_dir, name + '.png')).convert('RGBA')


def frame_and_buttons(raw_dir):
    panel = load(raw_dir, 'panel_frame_clean')
    n = scale_of(panel.width, 640)
    ins = int(round(118 * 0.78 * n))
    mid = 24 * n
    fr = compact(scaled(panel, 0.78), ins, ins, mid)
    if fr.size != (ins * 2 + mid, ins * 2 + mid):
        raise SystemExit('panel %s' % (fr.size,))
    note = '精简版（无角钉）。九宫格 insets %d px（四边相同），中心 %d px 可拉伸；所有弹窗宽 680' % (ins, mid)
    yield ('panel_frame_9s', fr, '弹窗框', note)

    plank = load(raw_dir, 'title_plank_clean')
    cut, n = locked_crop(plank, 'title_plank_clean')
    pl = scaled(cut, 0.56)
    pl = snap(pl, pl.width, 105 * n)
    e = 84 * n
    if abs(int(round(150 * 0.56 * n)) - e) > 1:
        raise SystemExit('plank cap drifted')
    bar = compact(pl, e, 0, 24 * n)
    if bar.size != (e * 2 + 24 * n, 105 * n):
        raise SystemExit('plank %s' % (bar.size,))
    note = '精简版（无绳无钉）。三宫格：左右各 %d px 不拉伸' % e
    yield ('title_plank_3s', bar, '弹窗框', note)

    for k in ('primary', 'secondary'):
        src = load(raw_dir, 'btn_' + k)
        cut, n = locked_crop(src, 'btn_' + k)
        fitted = fit_h(cut, 104 * n)
        cap = int(round(110 * n * fitted.height / float(cut.height)))
        if abs(cap - 69 * n) > 1:
            raise SystemExit('button cap %s' % cap)
        cap = 69 * n
        btn = compact(fitted, cap, 0, 24 * n)
        if btn.size != (162 * n, 104 * n):
            raise SystemExit('button %s' % (btn.size,))
        note = '三宫格：左右各 %d px 不拉伸；高 %d = 54pt' % (cap, 104 * n) if n == 1 else '三宫格：左右各 %d px 不拉伸；贴图高 %d（界面仍按高 104 排，缩 1/%d）' % (cap, btn.height, n)
        yield ('btn_%s_3s' % k, btn, '通用按钮', note)

    src = load(raw_dir, 'btn_close')
    cut, n = locked_crop(src, 'btn_close')
    close = snap(fit_w(cut, 96 * n), 96 * n, 98 * n)
    yield ('btn_close', close, '通用按钮', '命中区 ≥44pt')


def icons_and_toggles(raw_dir, icons=None):
    for name, (ow, oh) in ICON_BOX.items():
        if icons is not None and name not in icons:
            continue
        src = load(raw_dir, name)
        cut, n = locked_crop(src, name)
        base_h = ICON_H.get(name, 84)
        icon = snap(fit_h(cut, base_h * n), ow * n, oh * n)
        yield (name, icon, '小图标', '')
    for name, note in (
        ('toggle_on', '也做音乐音量滑条的已填充段（三宫格，左右各 %d px）'),
        ('toggle_off', '也做音乐音量滑条的轨道（三宫格）'),
    ):
        src = load(raw_dir, name)
        cut, n = locked_crop(src, name)
        tog = snap(fit_h(cut, 56 * n), 115 * n, 56 * n)
        text = (note % (28 * n)) if '%d' in note else note
        yield (name, tog, '开关', text)
    src = load(raw_dir, 'toggle_knob')
    cut, n = locked_crop(src, 'toggle_knob')
    knob = snap(fit_h(cut, 48 * n), 48 * n, 48 * n)
    yield ('toggle_knob', knob, '开关', '跟随 isOn 左右移动 0.15 s')


def popup_chrome(raw_dir):
    for item in frame_and_buttons(raw_dir):
        yield item
    for item in icons_and_toggles(raw_dir):
        yield item


def tray_image(im):
    graded = focus_grade(im)
    side = 768 if im.width >= 768 else 192
    if im.width < side or im.height < side:
        raise SystemExit('refuse upscale tool %s' % (im.size,))
    if graded.size != (side, side):
        graded = graded.resize((side, side), Image.LANCZOS)
    return graded


def hero_image(im):
    graded = focus_grade(im)
    side = 1200 if im.width >= 1200 else 400
    if im.width < side or im.height < side:
        raise SystemExit('refuse upscale hero %s' % (im.size,))
    if graded.size != (side, side):
        graded = graded.resize((side, side), Image.LANCZOS)
    return graded


def regional_image(im, name):
    n = scale_of(im.width, 192)
    l, t, r, b = [v * n for v in REGIONAL_BOX[name]]
    if r > im.width or b > im.height:
        raise SystemExit('regional box outside %s' % name)
    return focus_grade(im.crop((l, t, r, b)))


def pngquant(path):
    subprocess.run(['pngquant', '--force', '--skip-if-larger', '--quality', '70-92', '--speed', '1', '--strip', '--output', path, path], check=False)


def write_png(path, im):
    im.save(path)
    pngquant(path)


def patch_sizes(path, updates):
    data = json.load(open(path))
    rows = data['rows'] if isinstance(data, dict) else data
    by = {row['file']: row for row in rows}
    for name, im, group, note in updates:
        row = by.get(name + '.png')
        if row is None:
            raise SystemExit('missing sizes row ' + name)
        row['w'] = im.width
        row['h'] = im.height
        row['bytes'] = os.path.getsize(os.path.join(os.path.dirname(path), name + '.png'))
        if note:
            row['note'] = note
    if isinstance(data, dict) and 'groups' in data:
        groups = {}
        for row in rows:
            groups[row['group']] = groups.get(row['group'], 0) + row['bytes']
        data['groups'] = groups
        data['total'] = sum(row['bytes'] for row in rows if not str(row['group']).startswith('精简'))
    text = json.dumps(data, ensure_ascii=False, indent=1)
    if not text.endswith('\n'):
        text += '\n'
    open(path, 'w').write(text)
    if isinstance(data, list):
        # popup / board manifests have no trailing structure; match the previous newline-free dump style plus a newline
        pass


def mean_abs(a, b):
    import numpy as np
    A = np.asarray(a.convert('RGBA')).astype('float')
    B = np.asarray(b.convert('RGBA')).astype('float')
    if A.shape != B.shape:
        raise SystemExit('shape %s vs %s' % (A.shape, B.shape))
    d = abs(A - B)
    m = (A[..., 3] > 16) | (B[..., 3] > 16)
    if not m.any():
        return 0.0
    return float(d[..., :3][m].mean())


def check_legacy():
    bad = 0
    for name, im, group, note in popup_chrome(POPUP_RAW):
        old = Image.open(os.path.join(POPUP_SLICES, name + '.png')).convert('RGBA')
        diff = mean_abs(im, old)
        print('%-20s %s vs %s  mean %.2f' % (name, im.size, old.size, diff))
        if im.size != old.size or diff > 8:
            bad += 1
    for name in ('tool_starlight', 'tool_windbell', 'tool_tidebottle'):
        im = tray_image(load(BOARD_RAW, name))
        old = Image.open(os.path.join(BOARD_SLICES, name + '.png')).convert('RGBA')
        diff = mean_abs(im, old)
        print('%-20s %s vs %s  mean %.2f' % (name, im.size, old.size, diff))
        if im.size != old.size or diff > 8:
            bad += 1
        hero = hero_image(load(R2_RAW, name + '_hero'))
        hold = Image.open(os.path.join(R2_SLICES, 'hero_' + name.split('_', 1)[1] + '.png')).convert('RGBA')
        hdiff = mean_abs(hero, hold)
        print('%-20s %s vs %s  mean %.2f' % ('hero_' + name.split('_', 1)[1], hero.size, hold.size, hdiff))
        if hero.size != hold.size or hdiff > 8:
            bad += 1
    for name in REGIONAL_BOX:
        im = regional_image(load(R2_RAW, name), name)
        old = Image.open(os.path.join(R2_SLICES, name + '.png')).convert('RGBA')
        diff = mean_abs(im, old)
        print('%-20s %s vs %s  mean %.2f' % (name, im.size, old.size, diff))
        if im.size != old.size or diff > 8:
            bad += 1
    if bad:
        raise SystemExit('legacy mismatch %s' % bad)
    print('LEGACY_OK')


def save_group(directory, items):
    os.makedirs(directory, exist_ok=True)
    saved = []
    for name, im, group, note in items:
        path = os.path.join(directory, name + '.png')
        write_png(path, im)
        saved.append((name, im, group, note))
        print('wrote', path, im.size, os.path.getsize(path))
    return saved


def apply(popup_raw, board_dir):
    # Colour must match the signed-off renders once both are the old size. Checked before replacing raws.
    for name in ('panel_frame_clean', 'title_plank_clean', 'btn_primary', 'btn_secondary', 'btn_close',
                 'icon_music', 'icon_sfx', 'icon_sun', 'icon_moon', 'icon_motion', 'icon_about',
                 'toggle_on', 'toggle_off', 'toggle_knob'):
        new = load(popup_raw, name)
        old = load(POPUP_RAW, name)
        diff = mean_abs(new.resize(old.size, Image.LANCZOS), old)
        print('color', name, round(diff, 2), new.size)
        if diff > 12:
            raise SystemExit('color drift %s %.2f' % (name, diff))
    for name in ('tool_starlight', 'tool_windbell', 'tool_tidebottle'):
        new = Image.open(os.path.join(board_dir, name + '_1440.png')).convert('RGBA')
        old = load(BOARD_RAW, name)
        diff = mean_abs(new.resize(old.size, Image.LANCZOS), old)
        print('color', name, round(diff, 2))
        if diff > 12:
            raise SystemExit('color drift %s %.2f' % (name, diff))
    for name, box in REGIONAL_BOX.items():
        new = load(popup_raw, name)
        old = load(R2_RAW, name)
        n = scale_of(new.width, 192)
        l, t, r, b = [v * n for v in box]
        cut = new.crop((l, t, r, b)).resize((box[2] - box[0], box[3] - box[1]), Image.LANCZOS)
        diff = mean_abs(cut, old.crop(box))
        print('color', name, round(diff, 2), new.size)
        if diff > 12:
            raise SystemExit('color drift %s %.2f' % (name, diff))

    popup_items = list(frame_and_buttons(popup_raw))
    popup_items += list(icons_and_toggles(popup_raw, ('icon_music', 'icon_sfx', 'icon_sun', 'icon_moon', 'icon_motion', 'icon_about')))
    saved = save_group(POPUP_SLICES, popup_items)
    patch_sizes(os.path.join(POPUP_SLICES, 'sizes.json'), saved)

    trays = []
    heroes = []
    regions = []
    for name in ('tool_starlight', 'tool_windbell', 'tool_tidebottle'):
        src = Image.open(os.path.join(board_dir, name + '_1440.png')).convert('RGBA')
        tray = tray_image(src)
        hero = hero_image(src)
        short = name.split('_', 1)[1]
        trays.append((name, tray, '道具', '%d²；无货用 Sprite.grayscale；焦点调色' % tray.width))
        heroes.append(('hero_' + short, hero, '首次获得', '道具介绍大图 %d px（同一机位 1440 渲染后缩小，形状和颜色不变）' % hero.width))
        raw_out = os.path.join(BOARD_RAW, name + '.png')
        src.save(raw_out, optimize=True)
        hero_out = os.path.join(R2_RAW, name + '_hero.png')
        src.save(hero_out, optimize=True)
    save_group(BOARD_SLICES, trays)
    patch_sizes(os.path.join(BOARD_SLICES, 'sizes.json'), trays)
    save_group(R2_SLICES, heroes)
    for name in REGIONAL_BOX:
        src = load(popup_raw, name)
        regions.append((name, regional_image(src, name), '行囊', ''))
        src.save(os.path.join(R2_RAW, name + '.png'), optimize=True)
    save_group(R2_SLICES, regions)
    # Keep the signed-off regional sentences; only the pixel size changes.
    patch_sizes(os.path.join(R2_SLICES, 'sizes.json'), heroes + [(n, im, g, '') for (n, im, g, note) in regions])

    for name in ('panel_frame_clean', 'title_plank_clean', 'btn_primary', 'btn_secondary', 'btn_close',
                 'icon_music', 'icon_sfx', 'icon_sun', 'icon_moon', 'icon_motion', 'icon_about',
                 'toggle_on', 'toggle_off', 'toggle_knob'):
        load(popup_raw, name).save(os.path.join(POPUP_RAW, name + '.png'), optimize=True)
    print('APPLY_OK')


if __name__ == '__main__':
    if '--check-legacy' in sys.argv:
        check_legacy()
    elif '--apply' in sys.argv:
        i = sys.argv.index('--apply')
        apply(sys.argv[i + 1], sys.argv[i + 2])
    else:
        raise SystemExit('pass --check-legacy or --apply <popup-raw> <board-dir>')
