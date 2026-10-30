"""Gate test: runs reanchor.py + toggle_window.py for both directions and fails on any FAIL. `python3 test_gates.py`"""
import json, os, subprocess, sys
H = os.path.dirname(os.path.abspath(__file__)); bad = []
for d, out in [('out', 'out_v3'), ('return', 'out_v3/return')]:
    env = dict(os.environ, DIR=d, FIT='r2')
    subprocess.run([sys.executable, 'reanchor.py'], cwd=H, env=env, check=True, stdout=subprocess.DEVNULL)
    if subprocess.run([sys.executable, 'toggle_window.py'], cwd=H, env=env, stdout=subprocess.DEVNULL).returncode: bad.append(f'{d}: activation_gate')
    g = json.load(open(f'{H}/{out}/gates.json'))
    for k in ('yaw_standing', 'yaw_walking'):
        if not g[k]['pass']: bad.append(f'{d}: {k}')
    for k in ('clear_pass', 'occlusion_pass', 'first_frame_eq_live', 'last_frame_eq_board'):
        if not g[k]: bad.append(f'{d}: {k}')
    if g['hard_cuts']: bad.append(f'{d}: hard_cuts')
    for s in g['screens']:
        if not s['margin_pass'] or s['face_under_menu'] or (s['far_in_frame_pct'] or 100) < 95: bad.append(f"{d}: screen {s['screen']}")
        if d == 'out' and s['lighthouse_upper_right_pct'] < 95: bad.append(f"{d}: lighthouse {s['screen']}")
print('FAIL' if bad else 'PASS', bad)
if bad: sys.exit(1)
# negative check: the activation gate must FAIL when coast is switched on at frame 0 (map lens) of the outbound path
import importlib; os.environ.update(DIR='out', FIT='r2'); sys.path.insert(0, H); os.chdir(H); TW = importlib.import_module('toggle_window')
neg = TW.activation_gate(TW.vis_series(TW.R.CAM), TW.R.CAM, 1, False)  # coast on from frame 1, frame 0 visible groups -> must fail
assert not neg['pass_'], 'activation gate failed to catch a pop-in toggle'; print('negative check OK')
# v3.5 negative checks: the wake/sail-driver code check must FAIL on mutated copies of the sources
import shutil, tempfile, wake_code_check as WC
SRC = os.path.normpath(H + '/../..'); FILES = ['region/RegionJourneyAdapter.ts', 'region/SailArt.ts', 'region/SailWakeCore.ts', 'WorldIntegrationBoot.ts', 'region/SailShot.ts', 'region/SailRide.ts']
MUT = [('region/SailWakeCore.ts', 'speedLo:0.35', 'speedLo:0.0'), ('region/RegionJourneyAdapter.ts', 'sailArt?.dispose();', ''),
       ('region/SailArt.ts', "node.active=false;\n", "node.active=true;\n"), ('region/SailArt.ts', 'if(root.isValid)root.destroy();', '')]
for f, a, b in MUT:
    tmp = tempfile.mkdtemp(dir='/workspace', prefix='coast-wakeneg-')
    try:
        for g_ in FILES:
            d = f'{tmp}/creator-build-project/assets/scripts/{g_}'; os.makedirs(os.path.dirname(d), exist_ok=True); shutil.copy(f'{SRC}/creator-build-project/assets/scripts/{g_}', d)
        p = f'{tmp}/creator-build-project/assets/scripts/{f}'; txt = open(p).read(); assert a in txt, f'mutation anchor missing: {a}'
        open(p, 'w').write(txt.replace(a, b, 1)); r = WC.gate(tmp, 10)
        assert not r['pass_'], f'wake code check missed mutation {f}: {a!r}'
    finally: shutil.rmtree(tmp)
assert WC.gate(SRC, 10)['pass_']; print('wake code negative checks OK (%d mutations)' % len(MUT))
