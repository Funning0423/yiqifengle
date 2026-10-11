#!/usr/bin/env python3
"""Offline preview of the walk-out (exit) wind sequence, mixed exactly like the game code
(WindAudio.ts + AmbienceAudio.ts, 60 fps control rate, same smoothing / curves / gull triggers).
Needs: python3 + numpy, ffmpeg on PATH. Mix constants are read from the .ts sources, so re-tuning in code
is picked up automatically.

  python3 render_exit_preview.py                              # game assets from this worktree
  python3 render_exit_preview.py --gulls-dir /workspace/yiqifengle/previews/Voice-bot/gull-v2   # try new gulls
  python3 render_exit_preview.py --out /tmp/x.mp3 --timeline /tmp/x.json
  # real 运镜bot 138bca5 timeline (per-frame wind + room-light weight from flow_sim), 9..23 s from leaveHome:
  python3 render_exit_preview.py --scene exit138_timeline.json --start 9 --end 23 --apron-at 14.82 \
      --out /workspace/yiqifengle/previews/Voice-bot/exit-v2/exit-v2-preview.mp3 --timeline .../exit-v2-timeline.json

Scene (seconds): she steps out at 0; outdoor amount (1 - roomLightWeight) ramps 0->1 linearly over --outdoor-ramp
(T5 rig blend is linear; real exit holds w=1 through the door crossing, so this is the generous case for waves);
wind 0.15 for 2 s, ease to 1.0 over 3 s, hold 1 s, ease to 0.15 over 3 s, hold; onApronLift('full') at 5.0.
--scene <json>: per-frame [t, wind, weight, layers] (see exit138_timeline.json); waves follow 1 - weight (silent while
layers == 0), crane gull from events.craneStart, apron lift from --apron-at (default events.apronLift).
"""
import argparse, json, os, re, subprocess, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SR, FPS = 44100, 60

def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         check=True, stdout=subprocess.PIPE).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)

def num(src, name, default):
    m = re.search(r'\b' + re.escape(name) + r'\s*[:=]\s*([0-9.]+)\s*(?:\*\s*([0-9.]+))?', src)
    if not m: print('WARN: %s not found in source, using %s' % (name, default)); return default
    v = float(m.group(1)); return v * float(m.group(2)) if m.group(2) else v

def smoothstep(a, b, x):
    u = min(1.0, max(0.0, (x - a) / (b - a))); return u * u * (3 - 2 * u)

def ease(a, b, u):
    u = min(1.0, max(0.0, u)); return a + (b - a) * u * u * (3 - 2 * u)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--repo', default=os.path.abspath(os.path.join(HERE, '../../..')))
    ap.add_argument('--gulls-dir', default=None, help='dir with sfx_amb_gull_1/2/3.mp3 overriding the game ones')
    ap.add_argument('--out', default='/workspace/yiqifengle/previews/Voice-bot/exit-v1/exit-v1-preview.mp3')
    ap.add_argument('--timeline', default=None, help='also write the report/event timeline JSON here')
    ap.add_argument('--scene', default=None, help='per-frame scene JSON (e.g. exit138_timeline.json); default = synthetic')
    ap.add_argument('--start', type=float, default=None, help='render from this scene time (s); simulation still runs from 0')
    ap.add_argument('--end', type=float, default=None, help='render until this scene time (s)')
    ap.add_argument('--seconds', type=float, default=12.0, help='synthetic scene length')
    ap.add_argument('--outdoor-ramp', type=float, default=4.0, help='synthetic: outdoor 0->1 over this many s')
    ap.add_argument('--flap-at', type=float, default=5.0, help='synthetic: apron lift time')
    ap.add_argument('--apron-at', type=float, default=None, help='scene: apron lift time (default scene events.apronLift)')
    ap.add_argument('--crane-at', type=float, default=None, help='scene: onCraneStart time (default scene events.craneStart)')
    ap.add_argument('--near-vol', type=float, default=None, help='override EXIT_AUDIO.nearVol (try-outs only)')
    ap.add_argument('--flap-vol', type=float, default=None, help='override FLAP_FULL_VOL (try-outs only)')
    ap.add_argument('--wave-duck', type=float, default=None, help='override EXIT_AUDIO.waveWindDuck (try-outs only)')
    ap.add_argument('--bitrate', default='96k')
    a = ap.parse_args()

    res = os.path.join(a.repo, 'creator-build-project/assets/resources')
    scr = os.path.join(a.repo, 'creator-build-project/assets/scripts/audio')
    amb_src = open(os.path.join(scr, 'AmbienceAudio.ts'), encoding='utf8').read()
    wind_src = open(os.path.join(scr, 'WindAudio.ts'), encoding='utf8').read()
    gull_vol = num(amb_src, 'GULL_VOL', 0.6)
    C = dict(
        WAVES_MAX_VOL=num(amb_src, 'WAVES_MAX_VOL', 0.55), WAVES_SMOOTH=num(amb_src, 'SMOOTH_PER_S', 4),
        GULL_VOL=gull_vol, floor=num(amb_src, 'waveWindFloor', 0.35),
        floorFrom=num(amb_src, 'waveFloorFrom', 0.1), floorTo=num(amb_src, 'waveFloorTo', 0.6),
        exitOn=num(amb_src, 'exitOn', 0.1), nearDelay=num(amb_src, 'nearDelayS', 0.4), nearVol=num(amb_src, 'nearVol', 0.6),
        nearMaxLate=num(amb_src, 'nearMaxLateS', 4), craneDelay=num(amb_src, 'craneDelayS', 1.5),
        craneVol=gull_vol if re.search(r'craneVol:\s*GULL_VOL', amb_src) else num(amb_src, 'craneVol', gull_vol),
        craneMaxLate=num(amb_src, 'craneMaxLateS', 0), waveDuck=num(amb_src, 'waveWindDuck', 0) if 'waveWindDuck' in amb_src else 0.0,
        gap=num(amb_src, 'gullMinGapS', 2.5), tau=num(wind_src, 'SMOOTH_TAU_S', 0.25), onGain=num(wind_src, 'ON_GAIN', 0.003),
        flapFull=num(wind_src, 'FLAP_FULL_VOL', 0.7), windMax=num(wind_src, 'WIND_MAX_VOL', 1))
    if a.near_vol is not None: C['nearVol'] = a.near_vol
    if a.flap_vol is not None: C['flapFull'] = a.flap_vol
    if a.wave_duck is not None: C['waveDuck'] = a.wave_duck
    distant = [(float(m.group(1)), m.group(2), float(m.group(3)), float(m.group(4))) for m in
               re.finditer(r"\{\s*at:\s*([0-9.]+),\s*clip:\s*'([a-z0-9_]+)'[^,]*,\s*vol:\s*([0-9.]+),\s*maxLateS:\s*([0-9.]+)", amb_src)]
    if not distant: sys.exit('could not parse EXIT_AUDIO.distant from AmbienceAudio.ts')
    near_clip = re.search(r"nearClip:\s*'([a-z0-9_]+)'", amb_src).group(1)
    crane_clip = re.search(r"craneClip:\s*'([a-z0-9_]+)'", amb_src).group(1)
    C['distant'] = distant; C['nearClip'] = near_clip; C['craneClip'] = crane_clip

    soft = decode(os.path.join(res, 'audio_amb/amb_wind_soft_loop.mp3'))
    strong = decode(os.path.join(res, 'audio_amb/amb_wind_strong_loop.mp3'))
    waves = decode(os.path.join(res, 'audio_amb/amb_waves_loop.mp3'))
    flap = decode(os.path.join(res, 'audio_sfx/sfx_apron_flap.mp3'))
    gdir = a.gulls_dir or os.path.join(res, 'audio_sfx')
    gull = {n: decode(os.path.join(gdir, n + '.mp3')) for n in ('sfx_amb_gull_1', 'sfx_amb_gull_2', 'sfx_amb_gull_3')}

    # ---- scene: per-frame (t, wind, weight, visible) + event times ----
    if a.scene:
        sp = a.scene if os.path.isabs(a.scene) or os.path.exists(a.scene) else os.path.join(HERE, a.scene)
        S = json.load(open(sp, encoding='utf8'))
        frames = [(f[0], f[1], f[2], f[3] > 0) for f in S['frames']]
        apron_at = a.apron_at if a.apron_at is not None else S['events'].get('apronLift')
        crane_at = a.crane_at if a.crane_at is not None else S['events'].get('craneStart')
        scene_name = os.path.basename(sp)
    else:
        def wind_api(t):
            if t < 2: return 0.15
            if t < 5: return ease(0.15, 1.0, (t - 2) / 3)
            if t < 6: return 1.0
            if t < 9: return ease(1.0, 0.15, (t - 6) / 3)
            return 0.15
        frames = [(i / FPS, wind_api(i / FPS), 1 - min(1.0, (i / FPS) / a.outdoor_ramp), True) for i in range(int(a.seconds * FPS) + 1)]
        apron_at, crane_at, scene_name = a.flap_at, a.crane_at, 'synthetic'
    t_end_scene = frames[-1][0]
    r0 = a.start if a.start is not None else frames[0][0]
    r1 = a.end if a.end is not None else t_end_scene

    # ---- control-rate simulation (mirrors WindAudio.update + AmbienceAudio.update, 60 fps) ----
    nf = len(frames); dt = 1.0 / FPS
    ft = np.array([f[0] for f in frames])
    g_soft = np.zeros(nf); g_strong = np.zeros(nf); g_waves = np.zeros(nf)
    s = sw = wv = 0.0; last_gull = -1e9; pending = []; done = [False] * len(distant)
    starts = {}; events = []; flap_done = crane_done = False; dropped = []
    for i, (t, w, weight, visible) in enumerate(frames):
        if apron_at is not None and not flap_done and t >= apron_at:
            flap_done = True; events.append(dict(t=round(t, 3), what='apron flap (full)', clip='sfx_apron_flap', vol=C['flapFull']))
            pending.append([t + C['nearDelay'], near_clip, C['nearVol'], C['nearMaxLate'], 'near gull (apron lift + %.1f s)' % C['nearDelay']])
        if crane_at is not None and not crane_done and t >= crane_at:
            crane_done = True; events.append(dict(t=round(t, 3), what='onCraneStart'))
            pending.append([t + C['craneDelay'], crane_clip, C['craneVol'], C['craneMaxLate'], 'crane gull (crane + %.1f s)' % C['craneDelay']])
        k = 1 - np.exp(-dt / C['tau'])
        wvis = w if visible else 0.0
        s += (wvis - s) * k; sw += (wvis - sw) * k
        if not visible: s = sw = 0.0
        sv = min(1, s / 0.08) * (0.35 + 0.40 * s) * C['windMax']; st = smoothstep(0.3, 1.0, s) * C['windMax']
        g_soft[i] = sv if sv >= C['onGain'] else 0; g_strong[i] = st if st >= C['onGain'] else 0
        for name, g in (('soft', g_soft[i]), ('strong', g_strong[i])):
            if g > 0 and name not in starts: starts[name] = t; events.append(dict(t=round(t, 3), what='wind %s loop starts' % name))
        outdoor = (1 - weight) if visible else -1
        floor = C['floor'] * smoothstep(C['floorFrom'], C['floorTo'], sw)
        target = max(outdoor * C['WAVES_MAX_VOL'], floor) * (1 - C['waveDuck'] * smoothstep(0.3, 1.0, sw)) if outdoor >= 0 else 0
        wv += (target - wv) * min(1, dt * C['WAVES_SMOOTH'])
        g_waves[i] = wv if wv >= 0.002 else 0
        if g_waves[i] > 0 and 'waves' not in starts: starts['waves'] = t; events.append(dict(t=round(t, 3), what='waves start'))
        if sw >= C['exitOn']:
            for j, (at, clip, vol, ml) in enumerate(distant):
                if not done[j] and sw >= at:
                    done[j] = True; pending.append([t, clip, vol, ml, 'distant gull (wind crossed %.1f)' % at])
        else:
            done = [False] * len(distant)
        if pending:
            pending.sort(key=lambda x: x[0]); gap_ok = t - last_gull >= C['gap']; keep = []; played = False
            for g in pending:
                if t < g[0]: keep.append(g); continue
                if not played and gap_ok:
                    played = True; last_gull = t
                    events.append(dict(t=round(t, 3), what=g[4], clip=g[1], vol=round(g[2], 3), late=round(t - g[0], 3))); continue
                if t - g[0] > g[3]:
                    dropped.append(dict(due=round(g[0], 3), what=g[4] + ' DROPPED (gap %.1f s, maxLate %.1f s)' % (C['gap'], g[3]))); continue
                keep.append(g)
            pending = keep

    # ---- render [r0, r1] ----
    n = int(round((r1 - r0) * SR)); st_ = r0 + np.arange(n) / SR
    def loop_from(x, start):
        out = np.zeros(n); i0 = int(round((start - r0) * SR)); off = 0
        if i0 < 0: off = (-i0) % len(x); i0 = 0
        if i0 < n: out[i0:] = np.tile(x, (n - i0 + off) // len(x) + 2)[off:off + n - i0]
        return out
    y = np.zeros(n)
    for name, src, g in (('soft', soft, g_soft), ('strong', strong, g_strong), ('waves', waves, g_waves)):
        if name in starts: y += np.interp(st_, ft, g) * loop_from(src, starts[name])
    for e in events:
        if 'clip' not in e: continue
        x = flap if e['clip'] == 'sfx_apron_flap' else gull[e['clip']]
        i = int(round((e['t'] - r0) * SR)); j0 = 0
        if i < 0: j0 = -i; i = 0
        m = min(len(x) - j0, n - i)
        if m > 0: y[i:i + m] += e['vol'] * x[j0:j0 + m]
    k = int(0.03 * SR); y[:k] *= np.linspace(0, 1, k)
    k = int(0.05 * SR); y[-k:] *= np.linspace(1, 0, k)
    peak_lin = float(np.abs(y).max()); peak_t = r0 + int(np.abs(y).argmax()) / SR

    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    pcm = np.clip(y, -1, 1).astype(np.float32).tobytes()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                    '-c:a', 'libmp3lame', '-b:a', a.bitrate, a.out], input=pcm, check=True)
    r = subprocess.run(['ffmpeg', '-nostats', '-i', a.out, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                       stderr=subprocess.PIPE, text=True).stderr
    lufs = re.findall(r'I:\s+(-?[0-9.]+) LUFS', r); tp = re.findall(r'Peak:\s+(-?[0-9.]+) dBFS', r)
    # decoded mp3 sample peak (what a player sees)
    dec = decode(a.out); mp3_peak = 20 * np.log10(max(float(np.abs(dec).max()), 1e-9))
    report = dict(out=a.out, bytes=os.path.getsize(a.out), scene=scene_name, render=[r0, r1],
                  note='event t = scene seconds (from leaveHome for exit138); preview time = t - %.2f' % r0,
                  mix_peak_dbfs=round(20 * np.log10(max(peak_lin, 1e-9)), 2), mix_peak_at=round(peak_t, 2),
                  mp3_sample_peak_dbfs=round(mp3_peak, 2),
                  mp3_integrated_lufs=float(lufs[-1]) if lufs else None, mp3_true_peak_dbtp=float(tp[-1]) if tp else None,
                  gulls_from=gdir, constants=C, events=events, dropped=dropped)
    js = json.dumps(report, indent=1, ensure_ascii=False)
    if a.timeline: open(a.timeline, 'w').write(js)
    print(js)

if __name__ == '__main__':
    main()
