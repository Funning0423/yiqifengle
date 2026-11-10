#!/usr/bin/env python3
"""Composite a kit-ON lakeside board: projected cell quads plus the shipped board_art sprites.
Reads the placement JSON written by test_lakeside_kit_pieces.cjs. Screen y grows downward.
"""
import json
import sys
from PIL import Image, ImageDraw

spec = json.load(open(sys.argv[1], encoding='utf-8'))
w, h = int(spec['w']), int(spec['h'])
image = Image.new('RGBA', (w, h), (176, 210, 204, 255))
draw = ImageDraw.Draw(image, 'RGBA')
draw.rectangle([0, 0, w, h], fill=(168, 204, 198, 255))
for quad in spec['quads']:
    pts = [(p['x'], p['y']) for p in quad]
    draw.polygon(pts, fill=(214, 232, 226, 70))
    draw.line(pts + pts[:1], fill=(236, 246, 240, 210), width=2)
sprites = {}
root = spec['artRoot']
pieces = sorted(spec['pieces'], key=lambda p: p['y'])
for piece in pieces:
    if piece['type'] is None:
        continue
    key = piece['key']
    if key not in sprites:
        sprites[key] = Image.open(root + '/' + key + '.png').convert('RGBA')
    side = max(1, int(round(piece['width'])))
    sprite = sprites[key].resize((side, side), Image.Resampling.LANCZOS)
    left = int(round(piece['x'] - 0.5 * side))
    top = int(round(piece['y'] - (1 - piece['anchorY']) * side))
    image.alpha_composite(sprite, (left, top))
image.convert('RGB').save(sys.argv[2], 'PNG')
