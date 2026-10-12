# python3 compose_sheet.py <before_dir> <after_dir> <out.jpg>
# Rows: before side, after side, after front, after 3/4. Columns: 0.00 .. 1.75 s.
import sys
from PIL import Image, ImageDraw, ImageFont

before, after, out = sys.argv[1:]
times = ['0_00', '0_25', '0_50', '0_75', '1_00', '1_25', '1_50', '1_75']
labels = ['0.00s', '0.25s', '0.50s', '0.75s', '1.00s', '1.25s', '1.50s', '1.75s']
rows = [
    (before, 'side', '改之前 · 侧面'),
    (after, 'side', '改之后 · 侧面'),
    (after, 'front', '改之后 · 正面'),
    (after, 'q34', '改之后 · 四分之三'),
]
font = ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-microhei.ttc', 22)
font_s = ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-microhei.ttc', 18)
cell = Image.open('%s/%s_%s.png' % (rows[0][0], rows[0][1], times[0])).convert('RGB')
w, h = cell.size
gutter, head, gap = 196, 36, 4
W = gutter + len(times) * w + (len(times) - 1) * gap
H = head + len(rows) * h + (len(rows) - 1) * gap
sheet = Image.new('RGB', (W, H), (24, 24, 26))
dr = ImageDraw.Draw(sheet)
for ci, lab in enumerate(labels):
    dr.text((gutter + ci * (w + gap) + 8, 8), lab, font=font_s, fill=(230, 230, 230))
for ri, (folder, view, title) in enumerate(rows):
    y = head + ri * (h + gap)
    dr.text((10, y + 12), title, font=font, fill=(255, 255, 255))
    for ci, t in enumerate(times):
        im = Image.open('%s/%s_%s.png' % (folder, view, t)).convert('RGB')
        sheet.paste(im, (gutter + ci * (w + gap), y))
sheet.save(out, quality=86)
print(out, sheet.size)
