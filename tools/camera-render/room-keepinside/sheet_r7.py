# 运镜bot r7: contact sheets from bl_room_keepinside.py renders (PIL). Draws the 0.9 safe frame on each tile.
#   python3 sheet_r7.py RENDERDIR POSES.json OUT.jpg COLS "TITLE" "LABEL"
import json, sys, os
from PIL import Image, ImageDraw, ImageFont
rd, poses, out, cols, title, label = sys.argv[1], json.load(open(sys.argv[2])), sys.argv[3], int(sys.argv[4]), sys.argv[5], sys.argv[6]
F = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 20); S = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 17)
cl = {r['name']: r for r in json.load(open(os.path.join(rd, 'clearance.json')))['rows']}
tiles = [Image.open(os.path.join(rd, p['name'] + '.png')).convert('RGB') for p in poses]; tw, th = tiles[0].size
rows = (len(tiles) + cols - 1) // cols; pad, head, cap = 8, 74, 50
im = Image.new('RGB', (cols * (tw + pad) + pad, head + rows * (th + cap + pad)), 'white'); dr = ImageDraw.Draw(im)
dr.text((pad, 6), title, fill='black', font=F); dr.text((pad, 38), label, fill='#333', font=S)
for i, (p, t) in enumerate(zip(poses, tiles)):
    x, y = pad + (i % cols) * (tw + pad), head + (i // cols) * (th + cap + pad); im.paste(t, (x, y))
    m = (1 - 0.9) / 2; dr.rectangle((x + tw * m, y + th * m, x + tw * (1 - m), y + th * (1 - m)), outline='#ffeb3b', width=1)
    r = cl.get(p['name'], {}); fr = r.get('frame', {})
    s1 = p['name'] + ('  yaw %s' % p['yaw'] if 'yaw' in p else '') + ('  w %.2f' % p['w'] if 'w' in p else '') + ('  t %.1fs' % p['t'] if 't' in p else '')
    s2 = ('滞后 %.2f m  ' % p['lagM'] if 'lagM' in p else '') + '她占 %.0f%%  离墙/物 %.2f m' % (100 * fr.get('herFrac', 0), r.get('clearanceAllM', 0))
    dr.text((x, y + th + 2), s1, fill='black', font=S); dr.text((x, y + th + 24), s2, fill='#444', font=S)
im.save(out, quality=88); print('SHEET', out, im.size)
