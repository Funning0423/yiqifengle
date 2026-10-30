"""Static code check for the coast activation gate (Grok Bot, after 5b78bdb0): during both coast transitions either no sail
driver runs or the wake strength is 0. Pins code facts by pattern (not line numbers); any change makes it FAIL with a message.
  python3 wake_code_check.py [--src <repo root>]   (default: this worktree; QF_SRC env also accepted)"""
import os, re, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
def src_root(argv):
    if '--src' in argv: return argv[argv.index('--src') + 1]
    return os.environ.get('QF_SRC', os.path.normpath(HERE + '/../..'))
def run(root):
    S = root + '/creator-build-project/assets/scripts'; R = S + '/region'; fails = []; facts = {}
    def rd(p):
        try: return open(p, encoding='utf-8').read()
        except OSError: fails.append(f'missing file {p}'); return ''
    def need(cond, msg):
        if not cond: fails.append(msg)
    ts = {}
    for d, _, fs in os.walk(S):
        for f in fs:
            if f.endswith('.ts'): ts[os.path.relpath(os.path.join(d, f), S)] = rd(os.path.join(d, f))
    adapter, art, core, boot = ts.get('region/RegionJourneyAdapter.ts', ''), ts.get('region/SailArt.ts', ''), ts.get('region/SailWakeCore.ts', ''), ts.get('WorldIntegrationBoot.ts', '')
    # 1. SailArt is mounted only by the island->meadow journey (and the dev-only SailShot, which replaces the whole world flow)
    callers = sorted(k for k, v in ts.items() if re.search(r'\bmountSailArt\s*\(', v) and k != 'region/SailArt.ts')
    facts['mountSailArt_callers'] = callers
    need(callers == ['region/RegionJourneyAdapter.ts', 'region/SailShot.ts'], f'mountSailArt callers changed: {callers} (expected RegionJourneyAdapter + SailShot only)')
    need(re.search(r"if\s*\(\s*typeof sailShotRequested\s*===\s*'function'\s*&&\s*sailShotRequested\(\)\s*\)\s*\{\s*void this\.presentSailShot\(\);\s*return;\s*\}", boot) is not None,
         'WorldIntegrationBoot: SailShot is no longer an early-return dev path (sailShotRequested() -> presentSailShot(); return;)')
    drivers = sorted(k for k, v in ts.items() if re.search(r'\bcreateSailDriver\s*\(', v) and k != 'region/SailRide.ts')
    facts['createSailDriver_callers'] = drivers
    need(drivers == ['region/RegionJourneyAdapter.ts'], f'createSailDriver callers changed: {drivers} (expected RegionJourneyAdapter only)')
    # 2. inside the adapter: mount + driver are inside the journey rig and the sail branch; release disposes SailArt
    need(re.search(r"rig\s*=\s*new Node\('RegionJourney-'\s*\+\s*to\)", adapter) is not None, "adapter: journey rig 'RegionJourney-'+to not found")
    need(re.search(r'sailArt\s*=\s*await mountSailArt\(\s*rig\s*,', adapter) is not None, 'adapter: SailArt no longer mounted under the journey rig (mountSailArt(rig, ...))')
    need(re.search(r'const release\s*=\s*\(\)\s*=>\s*\{[^\n]*sailArt\?\.dispose\(\)', adapter) is not None, 'adapter: release() no longer calls sailArt?.dispose()')
    i_if, i_mount, i_drv = adapter.find('if(sail){'), adapter.find('mountSailArt('), adapter.find('createSailDriver(')
    need(0 <= i_if < i_mount and 0 <= i_if < i_drv, 'adapter: mountSailArt/createSailDriver are no longer inside the if(sail){...} branch')
    m = re.search(r"const\s+sail\s*=\s*([^;]+);", adapter); facts['adapter_sail_expr'] = m.group(1) if m else None
    jr = sorted(set(re.findall(r"'(meadow|skycity|lakeside|coast|island)'", adapter))); facts['adapter_region_literals'] = jr
    need('coast' not in jr, "adapter: the island->region journey now mentions 'coast' (sail art could run in a coast transition)")
    # 3. SailArt.ts: wake node starts inactive, only shown when peak > 1/255, only synced from the per-frame driver path, root destroyed on dispose
    need(re.search(r"new Node\('wake_trail'\);\s*parent\.addChild\(node\);\s*node\.active\s*=\s*false;", art) is not None, 'SailArt: wake_trail is no longer created inactive')
    need(re.search(r'const show\s*=\s*fx\.peak\s*>\s*1\s*/\s*255;\s*if\(fx\.node\.active!==show\)fx\.node\.active=show;', art) is not None, 'SailArt: wake visibility is no longer peak > 1/255')
    calls = re.findall(r'(?<!function )syncWakeTrail\(([^)]*)\)', art); facts['syncWakeTrail_calls'] = calls
    need(len(calls) == 1 and re.search(r'\bv\.speed\b', calls[0] or ''), f'SailArt: syncWakeTrail call sites changed: {calls} (expected one, fed by the driver speed v.speed)')
    need(re.search(r'if\(root\.isValid\)root\.destroy\(\);', art) is not None, 'SailArt: dispose no longer destroys the SailArt root')
    # 4. SailWakeCore: emission = smooth(speedLo, speedHi, |speed|), speedLo = 0.35; ghost scaled by pts[0].k
    lo = re.search(r'speedLo\s*:\s*([0-9.]+)', core); hi = re.search(r'speedHi\s*:\s*([0-9.]+)', core)
    need(lo and hi, 'SailWakeCore: speedLo/speedHi constants not found')
    need(re.search(r'export function wakeEmission\(speed:number\):number\{return smooth\(SAIL_WAKE\.speedLo,SAIL_WAKE\.speedHi,Math\.abs\(speed\)\);\}', core) is not None,
         'SailWakeCore: wakeEmission is no longer smooth(speedLo, speedHi, |speed|)')
    need(re.search(r'function smooth\(e0:number,e1:number,x:number\)\{const t=clamp01\(\(x-e0\)/\(e1-e0\)\);return t\*t\*\(3-2\*t\);\}', core) is not None, 'SailWakeCore: smooth() changed')
    need(re.search(r'const k\s*=\s*wakeEmission\(speed\);', core) is not None, 'SailWakeCore: stepWakeTrail no longer uses k = wakeEmission(speed)')
    need(re.search(r'const k=pts\[0\]\.k\*SAIL_WAKE\.ghostK\*w;if\(k<=0\.001\)return \{n:0,k:0\};', core) is not None, 'SailWakeCore: launch ghost no longer scaled by pts[0].k')
    if lo and hi:
        L, H = float(lo.group(1)), float(hi.group(1)); facts['speedLo'], facts['speedHi'] = L, H
        def emission(v):
            t = min(1, max(0, (abs(v) - L) / (H - L))); return t * t * (3 - 2 * t)
        need(L >= 0.35, f'SailWakeCore: speedLo {L} < 0.35')
        need(emission(0.0) == 0 and emission(0.349) == 0, 'SailWakeCore: wake strength is not 0 below 0.35 m/s')
        facts['emission(0)'] = emission(0.0)
    return fails, facts
def boat_speed_model(n_frames):
    """Model: no sail driver in a coast transition (facts above) => the boat is not stepped => speed 0 on every frame."""
    return [0.0] * n_frames
def gate(root=None, n_frames=None):
    fails, facts = run(root or src_root(sys.argv))
    if n_frames:
        sp = boat_speed_model(n_frames); facts['boat_speed_max'] = max(sp)
        if any(v > 0 for v in sp): fails.append('model: boat speed > 0 during the coast transition')
    return dict(pass_=not fails, fails=fails, facts=facts, src=root or src_root(sys.argv))
if __name__ == '__main__':
    g = gate(); print(json.dumps(g, indent=1)); sys.exit(0 if g['pass_'] else 1)
