# Contact sheet: python3 sheet.py <out.jpg> <cols> <img.png[=label]> ...   (label defaults to the file name)
import os
import sys

from PIL import Image, ImageDraw, ImageFont


def font(sz):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf'):
        if os.path.exists(p):
            return ImageFont.truetype(p, sz)
    return ImageFont.load_default()


def sheet(out, cols, items, scale=1.0, quality=88):
    ims = []
    for it in items:
        p, _, lab = it.partition('=')
        im = Image.open(p).convert('RGB')
        if scale != 1.0:
            im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
        ims.append((im, lab or os.path.splitext(os.path.basename(p))[0]))
    w, h = ims[0][0].size
    rows = (len(ims) + cols - 1) // cols
    S = Image.new('RGB', (cols * w, rows * h), (30, 30, 32))
    dr = ImageDraw.Draw(S)
    f = font(max(12, h // 28))
    for i, (im, lab) in enumerate(ims):
        x, y = (i % cols) * w, (i // cols) * h
        S.paste(im, (x, y))
        dr.rectangle([x, y, x + int(len(lab) * h / 50) + 12, y + h // 22 + 8], fill=(0, 0, 0))
        dr.text((x + 6, y + 4), lab, fill=(255, 255, 255), font=f)
    S.save(out, quality=quality)
    return out


if __name__ == '__main__':
    sheet(sys.argv[1], int(sys.argv[2]), sys.argv[3:])
