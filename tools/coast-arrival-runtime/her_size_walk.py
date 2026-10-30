#!/usr/bin/env python3
"""Her-size rule on her REAL S7 walk: rig TRS recorded from the real CharacterMotion (her_walk_replay.cjs) skinned with the real GLB,
projected through the decoded runtime camera (CoastArrivalTrack.ts) on 7 screens, per clock (60/30/uneven).
Rule (Grok Bot 2026-10-30 final (a)): t<=38.867 s her height >=0.06 and >=40 px (390x520 >=38.5 px). usage: her_size_walk.py <replay.json> <out.json>"""
import json, sys, os, math, numpy as np
H = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(H, '../..')
src = open(os.path.join(ROOT, 'tools/coast-transition-draft/s7_her_height.py')).read(); src = src[:src.index('\nimport json,math\nO=')]
g = {'__file__': os.path.join(ROOT, 'tools/coast-transition-draft/s7_her_height.py'), '__name__': 'x'}; exec(src, g)
hr = open(os.path.join(H, 'her_size_runtime.py')).read(); hr = hr[:hr.index('src = sys.argv[1]')]; h = {'__file__': os.path.join(H, 'her_size_runtime.py'), '__name__': 'x'}; exec(hr, h)
K = h['K']; N = g['N']; par = g['par']; JN = g['JN']; IBM = g['IBM']; P = g['P']; JI = g['JI']; W = g['W']; qm = g['qm']
def skin(trs):
    M = [None] * N
    def wm(i):
        if M[i] is not None: return M[i]
        q = trs[i]; m = np.eye(4); m[:3, :3] = qm(q[3:7]) * np.array(q[7:10]); m[:3, 3] = q[0:3]
        M[i] = (wm(par[i]) @ m) if par[i] >= 0 else m; return M[i]
    for i in range(N): wm(i)
    S = np.stack([M[JN[k]] @ IBM[k] for k in range(len(JN))]); ph = np.c_[P, np.ones(len(P))]; out = np.zeros((len(P), 3))
    for c in range(4): out += W[:, c:c + 1] * np.einsum('nij,nj->ni', S[JI[:, c]], ph)[:, :3]
    return out
rows = {}
for scr in K['s7']:
    n7 = K['s7_len'][scr]; sh = h['dec'](K['shared'], K['n_shared']); b7 = h['dec'](K['s7'][K['base']], n7); s7 = b7 if scr == K['base'] else h['dec'](K['s7'][scr], n7, b7); rows[scr] = sh + s7[1:]
def cam(R, t):
    f = max(0, min(len(R) - 1, t * 60)); i = min(len(R) - 2, int(f)); u = f - i; return [a + (b - a) * u for a, b in zip(R[i], R[i + 1])]
RP = json.load(open(sys.argv[1])); res = {}
for run in RP:
    sk = {}
    for scr, R in rows.items():
        w, hh = map(int, scr.split('x')); samples = []
        for k, fr in enumerate(run['frames']):
            t = fr['t']
            if t > 38.867 + 1e-6: continue
            if k not in sk:
                v = skin(fr['trs']); c, s_ = math.cos(fr['yaw']), math.sin(fr['yaw']); sk[k] = np.c_[v[:, 0] * c + v[:, 2] * s_, v[:, 1], -v[:, 0] * s_ + v[:, 2] * c] + np.array(fr['root'])
            X = sk[k]; q = cam(R, t); p = np.array(q[:3]); l = np.array(q[3:6]); f = (l - p) / np.linalg.norm(l - p); rr = np.cross(f, [0, 1, 0]); rr /= np.linalg.norm(rr); u = np.cross(rr, f); d = X - p; z = d @ f
            th = math.tan(math.radians(q[6]) / 2); sy = 0.5 - (d @ u) / z / th / 2; hf = float(sy.max() - sy.min()); samples.append([round(t, 4), round(hf, 4), round(hf * hh, 2), fr['clip']])
        line = 38.5 if scr == '390x520' else 40.0; mf = min(samples, key=lambda x: x[1]); mp = min(samples, key=lambda x: x[2]); bad = [x for x in samples if x[1] < 0.06 or x[2] < line]
        res.setdefault(run['name'], {})[scr] = dict(frac_min=mf[1], frac_t=mf[0], px_min=mp[2], px_t=mp[0], line=line, bad=bad[:5], n_bad=len(bad), n=len(samples), clips=run['clips'])
        print(run['name'], scr, 'frac', mf[1], '@', mf[0], 'px', mp[2], '@', mp[0], 'line', line, 'FAIL' if bad else 'ok', len(bad), flush=True)
json.dump(res, open(sys.argv[2], 'w'), indent=1)
