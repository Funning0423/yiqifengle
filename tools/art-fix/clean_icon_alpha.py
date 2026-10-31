#!/usr/bin/env python3
"""journal r6 (界面验收部 8dc998a8 annot/dn_vs_close_320_day_night.png): dark specks at the icon_moon tips.
Cause: the slice carries near-black RGB under low/zero alpha plus an opaque near-black render wedge at the upper tip; Cocos samples
straight (non-premultiplied) alpha with bilinear filtering, so the black RGB bleeds into the visible edge.
Fix, in the art source and the project copy (same bytes, tools/board_art_sync.py --check stays clean; .meta untouched):
  1. pixels whose RGB is near-black (max < 60) are background render leftovers -> alpha 0;
  2. edge bleed: every pixel with alpha < 255 takes the RGB average of its opaque-ish neighbours (iterative dilation), alpha kept.
Usage: python3 tools/art-fix/clean_icon_alpha.py [--check] icon_moon [icon_sun ...]"""
import os, sys
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'art-src/board-ui/c-popups/slices'); DST = os.path.join(ROOT, 'creator-build-project/assets/bundles/board_art/popup')
def clean(im):
    im = im.convert('RGBA'); W, H = im.size; px = im.load()
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a and max(r, g, b) < 60: px[x, y] = (0, 0, 0, 0)
    have = [[px[x, y][3] >= 128 for x in range(W)] for y in range(H)]
    rgb = [[px[x, y][:3] for x in range(W)] for y in range(H)]
    frontier = True
    while frontier:
        frontier = False; upd = []
        for y in range(H):
            for x in range(W):
                if have[y][x]: continue
                acc = [0, 0, 0]; n = 0
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        xx, yy = x + dx, y + dy
                        if 0 <= xx < W and 0 <= yy < H and have[yy][xx]:
                            c = rgb[yy][xx]; acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; n += 1
                if n: upd.append((x, y, (acc[0] // n, acc[1] // n, acc[2] // n)))
        for x, y, c in upd: rgb[y][x] = c; have[y][x] = True; frontier = True
    for y in range(H):
        for x in range(W): px[x, y] = rgb[y][x] + (px[x, y][3],)
    return im
def dark_edge(im):
    im = im.convert('RGBA'); px = im.load(); W, H = im.size
    return sum(1 for y in range(H) for x in range(W) if px[x, y][3] > 0 and max(px[x, y][:3]) < 60)
if __name__ == '__main__':
    a = sys.argv[1:]; check = '--check' in a; names = [n for n in a if not n.startswith('--')]; bad = 0
    for n in names:
        for d in (SRC, DST):
            p = os.path.join(d, n + '.png'); im = Image.open(p); k = dark_edge(im)
            if check: print(f"{'FAIL' if k else 'PASS'} {os.path.relpath(p, ROOT)} dark-under-alpha={k}"); bad += bool(k); continue
            clean(im).save(p, optimize=True); print('cleaned', os.path.relpath(p, ROOT), 'was', k)
    sys.exit(1 if bad else 0)
