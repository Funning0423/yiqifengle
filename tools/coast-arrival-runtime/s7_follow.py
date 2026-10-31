#!/usr/bin/env python3
"""运镜bot option A (Grok Bot 2026-10-30): S6/S7 camera follows her slow walk (COAST_S7_WALK 30.675-40.075 s).
The accepted camera (ref_transition.json, 46459044) framed her standing at the S6 pause until 35.575 s and walking 1.2 m/s after.
The follow camera = that camera TRANSLATED along z (position AND target, so rotation/fov/yaw/pitch are unchanged) by
dz(t) = her REAL root z (CharacterMotion, her_walk_replay.cjs 60 fps, Gaussian sigma 0.1 s) - the baked authored root z (K.her).
=> in frame she sits where the accepted camera put her; dz = 0 before 30.675 s and from 40.3 s (both stopped on the same root),
so the shared part, the settle and the last frame (coastBoardPose) are untouched. Output s7_follow_delta.json (ints, 1e-4 m, per 60 fps
frame from i0), used by bake_track.py (track) and test_coast_arrival_runtime.cjs (ref + dz). usage: s7_follow.py <replay.json>"""
import json, sys, os, math, re
H = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(H, '../..')
hr = open(os.path.join(H, 'her_size_runtime.py')).read(); hr = hr[:hr.index('src = sys.argv[1]')]; h = {'__file__': os.path.join(H, 'her_size_runtime.py'), '__name__': 'x'}; exec(hr, h)
K = h['K']; HR = h['dec'](K['her'], K['n_her'])
run = [r for r in json.load(open(sys.argv[1])) if r['name'] == '60fps'][0]['frames']
T0, T1, SIG = 30.675, 40.3, 0.1
RA, RB = (float(x) for x in os.environ.get('QF_FOLLOW_RAMP', '36.0,39.0').split(','))  # follow weight 1 -> 0 (cosine) over [RA,RB]: the accepted 1.2 m/s S7 camera takes over again (her-size: she stays as near as with the d08b5bc5 camera)
def herz(t):  # replay sampled at 1/60 exactly
    fr = run; i = max(0, min(len(fr) - 1, round((t - fr[0]['t']) * 60))); return fr[i]['root'][2]
i0, i1 = int(math.floor((T0 - 0.5) * 60)), int(math.ceil(T1 * 60)); dz = []
for i in range(i0, i1 + 1):
    t = i / 60; ws = 0; acc = 0
    for k in range(-30, 31):
        w = math.exp(-0.5 * (k / 60 / SIG) ** 2); acc += w * herz(t + k / 60); ws += w
    d = acc / ws - HR[min(i, len(HR) - 1)][2]
    if t >= 40.075: d *= 0.5 * (1 + math.cos(math.pi * min(1, (t - 40.075) / (T1 - 40.075))))  # stopped: residual (<1 cm) eased out to 0
    if t > RA: d *= 0.5 * (1 + math.cos(math.pi * min(1, (t - RA) / (RB - RA))))
    dz.append(round(d * 1e4))
while dz and dz[0] == 0: dz.pop(0); i0 += 1
while dz and dz[-1] == 0: dz.pop()
json.dump(dict(i0=i0, scale=1e4, sigma_s=SIG, window=[T0, T1], dz=dz), open(os.path.join(H, 's7_follow_delta.json'), 'w'), separators=(',', ':'))
print('i0', i0, i0 / 60, 'n', len(dz), 'max', max(dz) / 1e4, 'min', min(dz) / 1e4)
