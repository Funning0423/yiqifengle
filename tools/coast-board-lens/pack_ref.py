#!/usr/bin/env python3
"""Pack the coast transition per-frame numbers the gate needs (no images, no out_v4 dirs).
usage: pack_ref.py <out_v4 dir> -> ref_transition.json (+ ref_old.json from <out_v4>/old and old_s3)
Frames: px,py,pz, lx,ly,lz, fov (1e-4, delta ints per column; t = frame/60, S7 starts at frame n_shared-1). S1..S6 are the same on every screen (only S7 ends on the per-aspect board pose)."""
import sys, os, json, csv
D = sys.argv[1]; H = os.path.dirname(os.path.abspath(__file__))
S = ['390x844', '414x896', '360x780', '375x667', '320x568', '390x520', '768x1024']
def rows(p): return [[round(float(r[k]), 4) for k in ('t', 'px', 'py', 'pz', 'lx', 'ly', 'lz', 'fov')] for r in csv.DictReader(open(p + '/frames.csv'))]
def _arr(p):  # arrival A (S6 hold): hut cover by her real mesh + camera height, from arrival.json (real-model renders); absent for old dirs
    if not os.path.exists(p + '/arrival.json'): return {}
    a = json.load(open(p + '/arrival.json')); return dict(arr_ground=a['s6_ground_min'], arr_hut_covered=a['hut_covered_pct'], arr_hut_on_screen=a['hut_on_screen'], arr_hut_pct=a['hut_frame_pct_min'])
def summ(p):
    g = json.load(open(p + '/gates.json')); e = json.load(open(p + '/end_pose.json')); sc = g['screens'][0]
    return dict(min_margin=sc['min_margin'], at_t=sc['at_t'], face_under_menu=sc['face_under_menu'], occlusion_worst_s=g['occlusion_worst_s'], travel_ground_min=g['travel_ground_min'],
                travel_solid_min=g['travel_solid_min'], first_frame_eq_live=g['first_frame_eq_live'], s7_start=e['s7_start'], total=e['total'], shots=[round(x, 4) for x in g['timeline']['T']], **_arr(p))
def pack(base):
    R = {s: rows(f'{base}/{s}') for s in S}; sm = {s: summ(f'{base}/{s}') for s in S}; s7 = sm[S[0]]['s7_start']
    n = sum(1 for r in R[S[0]] if r[0] < s7 - 1e-9); shared = R[S[0]][:n]
    for s in S: assert R[s][:n] == shared, s + ' S1..S6 differ'
    return dict(cols=['t', 'px', 'py', 'pz', 'lx', 'ly', 'lz', 'fov'], shared=shared, s7={s: R[s][n - 1:] for s in S}, summary=sm)
def compact(P):  # v2: only what the gate reads. t = frame/fps (60 fps, uniform); px..fov as 1e-4 ints, delta-encoded per column
    enc = lambda R: [d for c in range(1, 8) for d in (lambda v: [v[0]] + [v[i] - v[i - 1] for i in range(1, len(v))])([round(r[c] * 1e4) for r in R])]
    keep = ('min_margin', 'at_t', 'face_under_menu', 'occlusion_worst_s', 'travel_ground_min', 'travel_solid_min', 'first_frame_eq_live', 's7_start', 'total', 'shots', 'arr_ground', 'arr_hut_covered', 'arr_hut_on_screen', 'arr_hut_pct')
    n = len(P['shared'])
    return dict(v=2, fps=60, scale=1e4, cols=['px', 'py', 'pz', 'lx', 'ly', 'lz', 'fov'], n_shared=n, shared=enc(P['shared']), s7={s: enc(r) for s, r in P['s7'].items()},
                s7_len={s: len(r) for s, r in P['s7'].items()}, summary={s: {k: (round(v, 4) if isinstance(v, float) else v) for k, v in m.items() if k in keep} for s, m in P['summary'].items()})
json.dump(compact(pack(D)), open(H + '/ref_transition.json', 'w'), separators=(',', ':'))
old = {}
if os.path.isdir(D + '/old'): o = pack(D + '/old'); old['s1_old'] = dict(shared=o['shared'][:int(2.2 * 60)], summary={s: o['summary'][s] for s in S})
if os.path.isdir(D + '/old_s3'): old['s3_old'] = {s: summ(f'{D}/old_s3/{s}') for s in S}
if old: json.dump(old, open(H + '/ref_old.json', 'w'), separators=(',', ':'))  # keep the stored pre-fix numbers when old dirs are absent
