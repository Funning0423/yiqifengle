# 运镜bot r5 meadow pitch floor: labelled before/after images (PIL).
#   python3 pair_sheet.py RENDERDIR POSES.json OUTDIR "LABEL"
import json, sys, os
from PIL import Image, ImageDraw, ImageFont
rd, P, od, label = sys.argv[1], json.load(open(sys.argv[2])), sys.argv[3], sys.argv[4]
pr = {r['name']: r for r in json.load(open(os.path.join(rd, 'probe.json')))['rows']}
F = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 17); S = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 14)
os.makedirs(od, exist_ok=True); tiles = []
for p, title in zip(P['poses'], ['改前 6eafc35f：最低 pitch −12°（固定）', '改后：最低 pitch = pitchMin(4 m)']):
    im = Image.open(os.path.join(rd, p['name'] + '.png')).convert('RGB'); w, h = im.size
    c = Image.new('RGB', (w, h + 216), 'white'); c.paste(im, (0, 0)); d = ImageDraw.Draw(c); r = pr.get(p['name'], {})
    d.text((6, h + 4), title, fill='black', font=F)
    import math; arm = math.dist(p['position'], p['target'])
    d.text((6, h + 28), '输入 pitch %.2f°，臂长 %.2f m' % (p['pitch'], p['dist']), fill='#333', font=S)
    d.text((6, h + 48), '实际离注视点 %.2f m，视线仰角 %.2f°%s' % (arm, p['viewPitchDeg'], '（离地不足被抬高拉近）' if p['groundClamped'] else ''), fill='#333', font=S)
    d.text((6, h + 68), '镜头离她脚 %.2f m，离镜头下方地面 %.2f m' % (p['lensAboveFeetM'], r.get('lensAboveTerrainM') or 0), fill='#333', font=S)
    y = h + 88
    for line in label.split('\n'): d.text((6, y), line, fill='#555', font=S); y += 20
    out = os.path.join(od, ('BEFORE' if p['code'] == '6eafc35f' else 'AFTER') + '_meadow_4m_lowpitch_390x844.jpg'); c.save(out, quality=90); tiles.append(c); print('IMG', out)
W = sum(t.size[0] for t in tiles) + 8 * (len(tiles) + 1); H = max(t.size[1] for t in tiles) + 16
s = Image.new('RGB', (W, H), 'white'); x = 8
for t in tiles: s.paste(t, (x, 8)); x += t.size[0] + 8
s.save(os.path.join(od, 'PAIR_meadow_4m_lowpitch_390x844.jpg'), quality=90); print('IMG', os.path.join(od, 'PAIR_meadow_4m_lowpitch_390x844.jpg'))
