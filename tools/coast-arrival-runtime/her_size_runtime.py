#!/usr/bin/env python3
"""Re-measure the S7 her-size rule on the DECODED runtime track (CoastArrivalTrack.ts v3, same float decode as CoastArrivalLens.ts):
replaces the camera columns of out_v4/<screen>/frames.csv with the decoded runtime camera and runs tools/coast-transition-draft/s7_her_height.py
(real model, skeletal clips, in-game lens). Writes tools/coast-arrival-runtime/s7_her_size_runtime.json (+ cam_digest of the runtime rows).
usage: her_size_runtime.py <out_v4 dir>"""
import json, csv, os, sys, shutil, tempfile
H = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(H, '../..')
s = open(os.environ.get('QF_COAST_TRACK') or os.path.join(ROOT, 'creator-build-project/assets/bundles/region_coast/scripts/CoastArrivalTrack.ts')).read(); K = json.loads(s[s.index('TRACK=') + 6:s.rindex(';')])
A64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
def unpack(s):
    o = []; u = 0; sh = 0
    for ch in s:
        d = A64.index(ch); u += (d & 31) << sh
        if d & 32: sh += 5; continue
        o.append(-(u + 1) // 2 if u % 2 else u // 2); u = 0; sh = 0
    return o
def col(k, n):
    k = [unpack(k[0]), unpack(k[1])]; Ks = []; V = []; a = b = 0
    for x, y in zip(k[0], k[1]): a += x; b += y; Ks.append(a); V.append(b)
    out = []; j = 0
    for i in range(n):
        while j + 1 < len(Ks) and Ks[j + 1] < i: j += 1
        out.append((V[-1] if j + 1 >= len(Ks) else V[j] + (V[j + 1] - V[j]) * (i - Ks[j]) / (Ks[j + 1] - Ks[j])) / K['scale'])
    return out
def dec(cols, n, base=None):
    c = [col(k, n) for k in cols]; return [[c[k][i] + (base[i][k] if base else 0) for k in range(len(c))] for i in range(n)]
FD = json.load(open(os.path.join(H, 's7_follow_delta.json')))
src = sys.argv[1]; tmp = tempfile.mkdtemp(prefix='yj-rt-')
for scr in K['s7']:
    n7 = K['s7_len'][scr]; sh = dec(K['shared'], K['n_shared']); b7 = dec(K['s7'][K['base']], n7); s7 = b7 if scr == K['base'] else dec(K['s7'][scr], n7, b7)
    rows = sh + s7[1:]; os.makedirs(f'{tmp}/{scr}')
    shutil.copy(f'{src}/{scr}/end_pose.json', f'{tmp}/{scr}/end_pose.json')
    R = list(csv.DictReader(open(f'{src}/{scr}/frames.csv'))); w = csv.DictWriter(open(f'{tmp}/{scr}/frames.csv', 'w'), fieldnames=list(R[0].keys())); w.writeheader()
    for i, r in enumerate(R):
        q = rows[min(i, len(rows) - 1)]
        for k, name in enumerate(('px', 'py', 'pz', 'lx', 'ly', 'lz', 'fov')): r[name] = repr(q[k])
        j = i - FD['i0']
        if 0 <= j < len(FD['dz']): r['hz'] = repr(float(r['hz']) + FD['dz'][j] / 1e4)  # option A: her root at her real (slow-walk) z, as the follow camera expects
        w.writerow(r)
code = open(os.path.join(ROOT, 'tools/coast-transition-draft/s7_her_height.py')).read()
code = code.replace("os.path.join(os.path.dirname(os.path.abspath(__file__)),'../coast-board-lens/s7_her_size.json')", repr(os.path.join(H, 's7_her_size_runtime.json')))
code = code.replace("round(round(cam[k],4)*1e4)", "math.floor(cam[k]*1e4+0.5)")  # = JS Math.round (half up), as the gate
assert 's7_her_size_runtime.json' in code
sys.argv = ['s7_her_height.py', tmp]; g = {'__file__': os.path.join(ROOT, 'tools/coast-transition-draft/s7_her_height.py'), '__name__': '__main__'}; exec(compile(code, 's7_her_height.py', 'exec'), g)
shutil.rmtree(tmp)
