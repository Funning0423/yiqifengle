#!/usr/bin/env python3
"""Offline preview of the walk-out (exit) wind sequence, mixed exactly like the game code
(WindAudio.ts + AmbienceAudio.ts, 60 fps control rate, same smoothing / curves / gull triggers).
Needs: python3 + numpy, ffmpeg on PATH. Mix constants are read from the .ts sources, so re-tuning in code
is picked up automatically.

  python3 render_exit_preview.py                              # game assets from this worktree
  python3 render_exit_preview.py --gulls-dir /workspace/yiqifengle/previews/Voice-bot/gull-v2   # try new gulls
  python3 render_exit_preview.py --out /tmp/x.mp3 --timeline /tmp/x.json

Scene (seconds): she steps out at 0; outdoor amount (1 - roomLightWeight) ramps 0->1 linearly over --outdoor-ramp
(T5 rig blend is linear; real exit holds w=1 through the door crossing, so this is the generous case for waves);
wind 0.15 for 2 s, ease to 1.0 over 3 s, hold 1 s, ease to 0.15 over 3 s, hold; onApronLift('full') at 5.0.
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
    ap.add_argument('--timeline', default=None, help='write event timeline JSON here (default: <out>.json printed only)')
    ap.add_argument('--seconds', type=float, default=12.0)
    ap.add_argument('--outdoor-ramp', type=float, default=4.0)
    ap.add_argument('--flap-at', type=float, default=5.0)
    ap.add_argument('--bitrate', default='96k')
    a = ap.parse_args()

    res = os.path.join(a.repo, 'creator-build-project/assets/resources')
    scr = os.path.join(a.repo, 'creator-build-project/assets/scripts/audio')
    amb_src = open(os.path.join(scr, 'AmbienceAudio.ts'), encoding='utf8').read()
    wind_src = open(os.path.join(scr, 'WindAudio.ts'), encoding='utf8').read()
    C = dict(
        WAVES_MAX_VOL=num(amb_src, 'WAVES_MAX_VOL', 0.55), WAVES_SMOOTH=num(amb_src, 'SMOOTH_PER_S', 4),
        GULL_VOL=num(amb_src, 'GULL_VOL', 0.5), floor=num(amb_src, 'waveWindFloor', 0.35),
        floorFrom=num(amb_src, 'waveFloorFrom', 0.1), floorTo=num(amb_src, 'waveFloorTo', 0.6),
        exitOn=num(amb_src, 'exitOn', 0.1), nearDelay=num(amb_src, 'nearDelayS', 0.4), nearRel=num(amb_src, 'nearRel', 0.8),
        gap=num(amb_src, 'gullMinGapS', 0.8), tau=num(wind_src, 'SMOOTH_TAU_S', 0.25), onGain=num(wind_src, 'ON_GAIN', 0.003),
        flapFull=num(wind_src, 'FLAP_FULL_VOL', 0.7), windMax=num(wind_src, 'WIND_MAX_VOL', 1))
    distant = [(float(m.group(1)), m.group(2), float(m.group(3))) for m in
               re.finditer(r"\{\s*at:\s*([0-9.]+),\s*clip:\s*'([a-z0-9_]+)'[^,]*,\s*rel:\s*([0-9.]+)", amb_src)]
    near_clip = re.search(r"nearClip:\s*'([a-z0-9_]+)'", amb_src).group(1)
    C['distant'] = distant; C['nearClip'] = near_clip

    soft = decode(os.path.join(res, 'audio_amb/amb_wind_soft_loop.mp3'))
    strong = decode(os.path.join(res, 'audio_amb/amb_wind_strong_loop.mp3'))
    waves = decode(os.path.join(res, 'audio_amb/amb_waves_loop.mp3'))
    flap = decode(os.path.join(res, 'audio_sfx/sfx_apron_flap.mp3'))
    gdir = a.gulls_dir or os.path.join(res, 'audio_sfx')
    gull = {n: decode(os.path.join(gdir, n + '.mp3')) for n in ('sfx_amb_gull_1', 'sfx_amb_gull_2', 'sfx_amb_gull_3')}

    def wind_api(t):
        if t < 0: return 0.0
        if t < 2: return 0.15
        if t < 5: return ease(0.15, 1.0, (t - 2) / 3)
        if t < 6: return 1.0
        if t < 9: return ease(1.0, 0.15, (t - 6) / 3)
        return 0.15

    # ---- control-rate simulation (mirrors WindAudio.update + AmbienceAudio.update) ----
    nf = int(a.seconds * FPS) + 1; dt = 1.0 / FPS
    g_soft = np.zeros(nf); g_strong = np.zeros(nf); g_waves = np.zeros(nf)
    s = sw = wv = 0.0; clock = 0.0; last_gull = -1e9; pending = []; done = [False] * len(distant)
    starts = {}; events = []; flap_done = False
    for i in range(nf):
        t = i * dt
        if not flap_done and t >= a.flap_at:
            flap_done = True; events.append(dict(t=round(t, 3), what='apron flap (full)', clip='sfx_apron_flap', vol=C['flapFull']))
            pending.append((clock + C['nearDelay'], near_clip, C['nearRel'] * C['GULL_VOL'], 'near gull (flap+%.1fs)' % C['nearDelay']))
        w = wind_api(t)
        k = 1 - np.exp(-dt / C['tau'])
        s += (w - s) * k; sw += (w - sw) * k
        sv = min(1, s / 0.08) * (0.35 + 0.40 * s) * C['windMax']; st = smoothstep(0.3, 1.0, s) * C['windMax']
        g_soft[i] = sv if sv >= C['onGain'] else 0; g_strong[i] = st if st >= C['onGain'] else 0
        for name, g in (('soft', g_soft[i]), ('strong', g_strong[i])):
            if g > 0 and name not in starts: starts[name] = t; events.append(dict(t=round(t, 3), what='wind %s loop starts' % name))
        clock += dt
        outdoor = min(1.0, max(0.0, t / a.outdoor_ramp)) if t >= 0 else 0.0
        floor = C['floor'] * smoothstep(C['floorFrom'], C['floorTo'], sw)
        target = max(outdoor * C['WAVES_MAX_VOL'], floor)
        wv += (target - wv) * min(1, dt * C['WAVES_SMOOTH'])
        g_waves[i] = wv if wv >= 0.002 else 0
        if g_waves[i] > 0 and 'waves' not in starts: starts['waves'] = t; events.append(dict(t=round(t, 3), what='waves start'))
        if sw >= C['exitOn']:
            for j, (at, clip, rel) in enumerate(distant):
                if not done[j] and sw >= at:
                    done[j] = True; pending.append((clock, clip, rel * C['GULL_VOL'], 'distant gull (s crossed %.1f)' % at))
        else:
            done = [False] * len(distant)
        if pending:
            pending.sort(key=lambda x: x[0])
            if clock >= pending[0][0] and clock - last_gull >= C['gap']:
                at, clip, vol, why = pending.pop(0); last_gull = clock
                events.append(dict(t=round(t, 3), what=why, clip=clip, vol=round(vol, 3)))

    # ---- render ----
    n = int(a.seconds * SR); ft = np.arange(nf) * dt; st_ = np.arange(n) / SR
    def loop_from(x, start):
        out = np.zeros(n); i0 = int(start * SR)
        if i0 < n: out[i0:] = np.tile(x, (n - i0) // len(x) + 2)[:n - i0]
        return out
    y = np.zeros(n)
    for name, src, g in (('soft', soft, g_soft), ('strong', strong, g_strong), ('waves', waves, g_waves)):
        if name in starts: y += np.interp(st_, ft, g) * loop_from(src, starts[name])
    for e in events:
        if 'clip' not in e: continue
        x = flap if e['clip'] == 'sfx_apron_flap' else gull[e['clip']]
        i = int(e['t'] * SR); m = min(len(x), n - i)
        if m > 0: y[i:i + m] += e['vol'] * x[:m]
    k = int(0.05 * SR); y[-k:] *= np.linspace(1, 0, k)
    peak_lin = float(np.abs(y).max())

    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    pcm = np.clip(y, -1, 1).astype(np.float32).tobytes()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                    '-c:a', 'libmp3lame', '-b:a', a.bitrate, a.out], input=pcm, check=True)
    r = subprocess.run(['ffmpeg', '-nostats', '-i', a.out, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                       stderr=subprocess.PIPE, text=True).stderr
    lufs = re.findall(r'I:\s+(-?[0-9.]+) LUFS', r); tp = re.findall(r'Peak:\s+(-?[0-9.]+) dBFS', r)
    report = dict(out=a.out, bytes=os.path.getsize(a.out), seconds=a.seconds,
                  mix_peak_dbfs=round(20 * np.log10(max(peak_lin, 1e-9)), 1),
                  mp3_integrated_lufs=float(lufs[-1]) if lufs else None, mp3_true_peak_dbtp=float(tp[-1]) if tp else None,
                  gulls_from=gdir, constants=C, events=events)
    js = json.dumps(report, indent=1, ensure_ascii=False)
    if a.timeline: open(a.timeline, 'w').write(js)
    print(js)

if __name__ == '__main__':
    main()
