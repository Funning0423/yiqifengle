#!/usr/bin/env python3
"""运镜bot option A images: her walk 30.675-40.075 s on 7 screens, BEFORE (d08b5bc5 track) vs AFTER (working-tree track), her real skinned
model on the REAL CharacterMotion replay (her_walk_replay.cjs, 60 fps) through the decoded runtime lens; magenta = 0.08 margin frame,
white capsule = WeChat menu, blue = HUD keep-out bands (s6_walk_check.render). usage: render_follow.py <replay.json> <before_track.ts> <outdir>"""
import json, sys, os, subprocess
H = os.path.dirname(os.path.abspath(__file__))
rp, before_ts, outdir = sys.argv[1:4]
sys.argv = ['s6_walk_check.py', rp, '/dev/null']; G = {'__file__': os.path.join(H, 's6_walk_check.py'), '__name__': 'x'}
exec(open(os.path.join(H, 's6_walk_check.py')).read(), G)
from PIL import Image, ImageDraw
def rows_of(ts):
    s = open(ts).read(); K = json.loads(s[s.index('TRACK=') + 6:s.rindex(';')]); dec = G['g']['dec'] if 'dec' in G['g'] else None
    hr = open(os.path.join(H, 'her_size_runtime.py')).read(); hr = hr[:hr.index('src = sys.argv[1]')]; os.environ['QF_COAST_TRACK'] = ts; h = {'__file__': os.path.join(H, 'her_size_runtime.py'), '__name__': 'x'}; exec(hr, h)
    out = {}
    for scr in K['s7']:
        n7 = K['s7_len'][scr]; sh = h['dec'](K['shared'], K['n_shared']); b7 = h['dec'](K['s7'][K['base']], n7); s7 = b7 if scr == K['base'] else h['dec'](K['s7'][scr], n7, b7); out[scr] = sh + s7[1:]
    return out
RB, RA = rows_of(before_ts), rows_of(os.path.join(H, '../../creator-build-project/assets/bundles/region_coast/scripts/CoastArrivalTrack.ts'))
run = [r for r in json.load(open(rp)) if r['name'] == '60fps'][0]
TS = [31, 33, 34.5, 36, 38, 40]; SCR = list(RA.keys()); HP = 300; info = {}
def tile(R, scr, t, lab):
    G['rows'] = R; fr, held = G['frame_at'](run, t); im, hp = G['render'](fr, t, scr, HP); G['label'](im, f"{lab} {t}s {fr['clip'][:11]} {hp:.0f}px"); return im, round(hp, 1)
big_rows = []
for scr in SCR:
    strip = []
    for lab, R in (('BEFORE', RB), ('AFTER', RA)):
        row = []
        for t in TS: im, hp = tile(R, scr, t, lab); row.append(im); info.setdefault(scr, {}).setdefault(lab, {})[t] = hp
        strip.append(row)
    tw, th = strip[0][0].size; S = Image.new('RGB', (tw * len(TS) + 4 * len(TS), (th + 4) * 2 + 22), (255, 255, 255)); d = ImageDraw.Draw(S)
    d.text((4, 4), f'{scr}  top: BEFORE d08b5bc5 (camera not retimed)  bottom: AFTER follow camera  | magenta 0.08 margin, white = WeChat menu, blue = HUD bands', fill=(0, 0, 0))
    for r, row in enumerate(strip):
        for c, im in enumerate(row): S.paste(im, (c * (tw + 4), 22 + r * (th + 4)))
    S.save(os.path.join(outdir, f's6s7_follow_strip_{scr}.png')); big_rows.append(S)
W = max(s.width for s in big_rows); B = Image.new('RGB', (W, sum(s.height + 10 for s in big_rows)), (255, 255, 255)); y = 0
for s in big_rows: B.paste(s, (0, y)); y += s.height + 10
B.save(os.path.join(outdir, 's6s7_follow_before_after_7screens.png'))
sm = B.resize((B.width // 2, B.height // 2)); sm.save(os.path.join(outdir, 's6s7_follow_before_after_7screens_small.jpg'), quality=85)
print(json.dumps(info))
