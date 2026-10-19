# QA only: labels + H lines on the blender_lod_scale_lineup.py renders -> scale_lineup.png.  python3 annotate_lod_lineup.py <dir>
import json, os, sys
from PIL import Image, ImageDraw, ImageFont
D = sys.argv[1]; F = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'; H = 1.74
CN = {'heroine': '女主', 'stool': '阅读凳', 'door': '灯塔门', 'tuft': '湖畔草丛×2.61', 'reed': '芦苇×1.29', 'bush': '灌木', 'barrel': '木桶', 'sailboat': '帆船',
      'house': '湖畔屋B', 'pavilion': '凉亭', 'tree_round': '圆树×2.69', 'conifer': '松树×3.13', 'palm_tall': '岛·高棕榈', 'lighthouse': '灯塔+小屋',
      'gate': '天空城门(前)', 'robot': '园丁机器人', 'windmill': '草原风车', 'balloon': '热气球'}
def panel(raw, lay, title, fs, skip=()):
    im = Image.open(os.path.join(D, raw)).convert('RGB'); L = json.load(open(os.path.join(D, lay))); c = L['cam']; sc = c['rx'] / c['vw']
    X = lambda x: (x - c['cx']) * sc + c['rx'] / 2; Y = lambda z: c['ry'] / 2 - (z - c['cz']) * sc
    top = int(fs * 5.2); out = Image.new('RGB', (im.width, im.height + top), (250, 250, 248)); out.paste(im, (0, top)); d = ImageDraw.Draw(out)
    f = ImageFont.truetype(F, fs); fb = ImageFont.truetype(F, int(fs * 1.25))
    for k, col in ((1, (200, 40, 40)), (2, (220, 120, 20)), (3, (40, 110, 200))):
        y = Y(k * H) + top
        for x0 in range(0, out.width, 24): d.line([(x0, y), (x0 + 12, y)], fill=col, width=2)
        d.text((6, y - fs - 2), '%dH = %.2f m' % (k, k * H), font=f, fill=col)
    for m in range(0, int(c['cz'] * 2) + 2):
        y = Y(m) + top
        if top < y < out.height: d.line([(out.width - 14, y), (out.width, y)], fill=(80, 80, 80), width=2)
    n = 0
    for it in L['items']:
        if it['key'] in skip: continue
        xc = (X(it['x0']) + X(it['x1'])) / 2; ytop = Y(it['h']) + top; row = n % 2; n += 1; ty = int(fs * 0.3 + row * fs * 2.4)
        d.line([(xc, ty + fs * 2.3), (xc, ytop - 4)], fill=(150, 150, 150), width=1)
        for txt, yy in ((CN.get(it['key'], it['key']), ty), ('%.2fm · %.2fH' % (it['h'], it['h'] / H), ty + fs * 1.15)):
            w = d.textlength(txt, font=f); x = min(max(xc - w / 2, 4), out.width - w - 4); d.text((x, yy), txt, font=f, fill=(30, 30, 30))
    d.text((10, out.height - int(fs * 1.6)), title, font=fb, fill=(20, 20, 20))
    return out
a = panel('lineup_raw.png', 'lineup_layout.json', '全景比例对照（正交前视，同一比例尺；H = 女主身高 1.74 m；右侧刻度 1 m；最左小物件见下方放大）', 26, skip=('stool', 'door', 'tuft', 'reed', 'bush', 'barrel'))
b = panel('lineup_near_raw.png', 'lineup_near_layout.json', '近景放大：女主 / 凳 / 门 / 小物 / 帆船 / 湖畔屋（屋门约 1.8 m ≈ 1.0H，灯塔门 2.39 m = 1.37H）', 26)
b = b.resize((a.width, int(b.height * a.width / b.width)))
o = Image.new('RGB', (a.width, a.height + b.height + 10), (255, 255, 255)); o.paste(a, (0, 0)); o.paste(b, (0, a.height + 10)); o.save(os.path.join(D, 'scale_lineup.png')); print(o.size)
