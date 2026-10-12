# python3 sheet.py <out.png> <row1_prefix> [<row2_prefix> ...] [--views side,front,q34,back] [--labels a,b]
# Paste <prefix>_<view>.png renders into a grid (one row per prefix).
import sys
from PIL import Image, ImageDraw

args = sys.argv[1:]
views = 'side,front,q34,back'
labels = None
if '--views' in args:
    i = args.index('--views')
    views = args[i + 1]
    del args[i:i + 2]
if '--labels' in args:
    i = args.index('--labels')
    labels = args[i + 1].split(',')
    del args[i:i + 2]
out, rows = args[0], args[1:]
views = views.split(',')
ims = [[Image.open('%s_%s.png' % (r, v)).convert('RGB') for v in views] for r in rows]
w, h = ims[0][0].size
sheet = Image.new('RGB', (w * len(views), h * len(rows)), (30, 30, 30))
dr = ImageDraw.Draw(sheet)
for ri, row in enumerate(ims):
    for ci, im in enumerate(row):
        sheet.paste(im.resize((w, h)), (ci * w, ri * h))
    if labels:
        dr.text((8, ri * h + 6), labels[ri], fill=(255, 255, 255))
sheet.save(out, quality=88)
