#!/usr/bin/env python3
"""r2 item 3 final: overlays (end frame of the arrival push-in + projected cell centres + keep-out bands + 8 pt lines) and
tiles.json camera_per_aspect. usage: final_overlays.py <out_v4 dir> <overlay out dir> <tiles.json>"""
import sys, os, json, numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import lens as L, tap_check as TC, keepout_r2 as K, final_poses as FP
D, O, TJ = sys.argv[1:4]; F = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'final_poses.json'))); L.LENS = K.P(0.0)
tj = json.load(open(TJ)); cpa = {'rule': '运镜bot r2 (Grok Bot ruling (i)): D2 look line + quat + fov kept; distance = shortest at which the playable 7x7 cells (+-3.5 m, slab top) '
      'and her face keep >= 8 pt from the screen sides and the keep-out bands (portrait h<=600: c2d10462 compact HUD [0,131] / tool top h-94; else current HUD topNoGo / toolsY-32). '
      'Stone frame may leave the screen (x symmetric). Tap: far-row short side >= 28 pt, 0 wrong taps of +-8 pt. Engine vertical fov, no widening.', 'screens': {}}
for s, r in F.items():
    w, h = map(int, s.split('x')); top, tool = FP.band(w, h); C = TC.centres(r['distance_m'], w, h); p = np.array(r['pos'])
    cpa['screens'][s] = dict(distance_m=r['distance_m'], hud=r['band_kind'], keepout_pt=dict(top=top, tool_top=tool), position_island_world=r['pos'],
        position_local=[round(-(p[0] + 0.6), 4) + 0.0, round(p[1] + 0.845, 4), round(-(p[2] - 21.5), 4)], look_at_local=[0, 0, -0.05], quat_island_world_xyzw=r['quat_xyzw'],
        quat_local_xyzw=[-0.523599, 0, 0, 0.851965], fov_vertical_deg=50, far_short_pt=r['far_short_pt'], far_cell_height_pt=r['far_cell_height_pt'], wrong_taps=r['wrong_taps'],
        cell_centres_pt=[[round(float(x), 1), round(float(y), 1)] for x, y in C])
    im = Image.open(f'{D}/{s}/end_frame.png').convert('RGB'); k = im.height / h; dr = ImageDraw.Draw(im, 'RGBA')
    dr.rectangle([0, 0, im.width, top * k], fill=(40, 120, 220, 70)); dr.rectangle([0, tool * k, im.width, im.height], fill=(40, 120, 220, 70))
    for y in (top + 8, tool - 8): dr.line([0, y * k, im.width, y * k], fill=(255, 0, 255), width=1)
    for x in (8, w - 8): dr.line([x * k, 0, x * k, im.height], fill=(255, 0, 255), width=1)
    for x, y in C: dr.ellipse([x * k - 3, y * k - 3, x * k + 3, y * k + 3], fill=(255, 220, 0), outline=(0, 0, 0))
    dr.text((4, top * k + 2), f"{s} {r['band_kind']} D {r['distance_m']} far {r['far_short_pt']}pt", fill=(0, 0, 0))
    im.save(f'{O}/overlay_{s}.png')
tj['camera_per_aspect'] = cpa; json.dump(tj, open(TJ, 'w'), ensure_ascii=False, indent=1); print('ok', list(cpa['screens']))
