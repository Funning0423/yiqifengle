#!/usr/bin/env python3
"""Lens motion on three frame clocks (GGbot ggbot/yawfollower-dt rule): 60 fps, 30 fps and uneven dt uniform in [1/90, 1/45] s from the
same fixed-seed LCG (x=20261030, x=x*1103515245+12345 mod 2^32). The trajectory is computed at 240 fps (LENS_FPS) and sampled with a cubic
spline at each clock's frame times; limits use the real dt: yaw/pitch <=90 deg/s, p99 turn accel <=200 deg/s^2 (accel over (dt_i+dt_i+1)/2),
<=8 m/s, <=0.5 m/frame, fov <=1.5 deg/frame. Usage: SCREEN=390x844 python3 motion_clocks.py -> out_v4/<screen>/motion_clocks.json"""
import os, sys, json, numpy as np
os.environ.setdefault('FIT', 'r5d'); os.environ['LENS_FPS'] = os.environ.get('LENS_FPS', '240'); sys.argv = sys.argv[:1]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import reanchor as R
from scipy.interpolate import CubicSpline
P = CubicSpline(R.TS, np.array([c[0] for c in R.CAM])); L = CubicSpline(R.TS, np.array([c[1] for c in R.CAM])); FV = CubicSpline(R.TS, np.array([c[2] for c in R.CAM]))
def clock(name):
    if name == '60fps': return np.arange(0, R.TOTAL + 1e-9, 1 / 60)
    if name == '30fps': return np.arange(0, R.TOTAL + 1e-9, 1 / 30)
    x, t, ts = 20261030, 0.0, [0.0]
    while True:
        x = (x * 1103515245 + 12345) % 4294967296; t += 1 / 90 + (1 / 45 - 1 / 90) * x / 4294967296
        if t >= R.TOTAL: break
        ts.append(t)
    return np.array(ts + [R.TOTAL])
out = {}
for c in ('60fps', '30fps', 'jitter'):
    t = clock(c); p, l, fv = P(t), L(t), FV(t); F = l - p; Fn = F / np.linalg.norm(F, axis=1)[:, None]; dt = np.diff(t)
    yaw = np.degrees(np.unwrap(np.arctan2(F[:, 0], F[:, 2]))); pit = np.degrees(np.arcsin(np.clip(Fn[:, 1], -1, 1)))
    wy, wp = np.diff(yaw) / dt, np.diff(pit) / dt; h = (dt[1:] + dt[:-1]) / 2; ay, ap = np.diff(wy) / h, np.diff(wp) / h
    step = np.linalg.norm(np.diff(p, axis=0), axis=1)
    r = dict(frames=int(len(t)), dt_min=round(float(dt.min()), 5), dt_max=round(float(dt.max()), 5), yaw_max=round(float(np.abs(wy).max()), 1), pitch_max=round(float(np.abs(wp).max()), 1),
             yaw_acc_p99=round(float(np.percentile(np.abs(ay), 99)), 1), pitch_acc_p99=round(float(np.percentile(np.abs(ap), 99)), 1), speed_max=round(float((step / dt).max()), 2),
             step_max=round(float(step.max()), 3), fov_step_max=round(float(np.abs(np.diff(fv)).max()), 3), last_eq_board=bool(np.allclose(p[-1], R.END_POSE['pos'], atol=1e-6) and np.allclose(l[-1], R.END_POSE['look'], atol=1e-6)))
    r['pass'] = r['yaw_max'] <= 90 and r['pitch_max'] <= 90 and r['yaw_acc_p99'] <= 200 and r['pitch_acc_p99'] <= 200 and r['speed_max'] <= 8 and r['step_max'] <= 0.5 and r['fov_step_max'] <= 1.5 and r['last_eq_board']
    out[c] = r
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out_v4', R.SCREEN); json.dump(out, open(d + '/motion_clocks.json', 'w'), indent=1); print(R.SCREEN, json.dumps(out))
