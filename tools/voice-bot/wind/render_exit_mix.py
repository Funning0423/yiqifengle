#!/usr/bin/env python3
"""Exit window mix with island BGM underneath (stereo), from sim_exit.cjs output (REAL WindAudio + AmbienceAudio).
  node sim_exit.cjs --timeline exit50c_timeline.json --apron-at 14.87 --out /tmp/sim.json
  python3 render_exit_mix.py --sim /tmp/sim.json --out .../exit-v3-preview.mp3 [--start 9 --end 23] [--music-volume 0.4]
Layers: wind soft/strong + waves (mono loops, per-frame gains from the sim), apron flap (0.7), gulls from 'start' events through
the L/R clips with a worst-case pan of +0.5 (R = vol*1.307, L = vol*0.541), island BGM v1 (bgm_main.mp3) played the way
GameAudio plays it: musicVolume x wind duck (constants read from GameAudio.ts, driven by the sim's smoothed wind s) with the
two-source loop crossfade at loopStartAt(dur). Peaks:
  - worst_case_sum: per channel, sum over layers of (file peak x max gain in the window)  [every layer peak aligned]
  - realistic: rendered mix; BGM offset scanned over the whole loop (incl. the crossfade seam), worst offset reported
"""
import argparse, json, os, re, subprocess
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); SR = 44100

def decode(path, ch):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', str(ch), '-ar', str(SR), '-f', 'f32le', '-'], check=True, stdout=subprocess.PIPE).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64).reshape(-1, ch)
def num(src, name, default):
    m = re.search(r'\b' + re.escape(name) + r'\s*=\s*(-?[0-9.]+)', src); return float(m.group(1)) if m else default
def db(x): return round(20 * np.log10(max(x, 1e-9)), 2)
def smoothstep(a, b, x): u = np.clip((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--repo', default=os.path.abspath(os.path.join(HERE, '../../..')))
    ap.add_argument('--sim', required=True); ap.add_argument('--out', default=None)
    ap.add_argument('--start', type=float, default=9.0); ap.add_argument('--end', type=float, default=23.0)
    ap.add_argument('--music-volume', type=float, default=None); ap.add_argument('--no-duck', action='store_true')
    ap.add_argument('--pan', type=float, default=0.5); ap.add_argument('--pan-law', default=None, choices=['norm', 'eqpow']); ap.add_argument('--bgm-offset', type=float, default=None)
    ap.add_argument('--scan-step', type=float, default=0.25); ap.add_argument('--report', default=None)
    a = ap.parse_args()
    res = os.path.join(a.repo, 'creator-build-project/assets/resources')
    ga = open(os.path.join(a.repo, 'creator-build-project/assets/scripts/audio/GameAudio.ts'), encoding='utf8').read()
    mv = a.music_volume if a.music_volume is not None else float(re.search(r'private musicVolume = ([0-9.]+)', ga).group(1))
    duck_db = 0.0 if a.no_duck else num(ga, 'WIND_DUCK_DB', 0.0); duck_tau = num(ga, 'WIND_DUCK_TAU_S', 0.5)
    duck_from = num(ga, 'WIND_DUCK_FROM', 0.2); duck_to = num(ga, 'WIND_DUCK_TO', 1.0)
    pad, lxf, lsafe = num(ga, 'MP3_PADDING_S', 0.045), num(ga, 'LOOP_XFADE_S', 0.15), num(ga, 'LOOP_SAFETY_S', 0.03)
    S = json.load(open(a.sim)); F = S['frames']
    ft = np.array([f['t'] for f in F])
    n = int(round((a.end - a.start) * SR)); tt = a.start + np.arange(n) / SR
    L = {k: decode(os.path.join(res, p), 1)[:, 0] for k, p in (('soft', 'audio_amb/amb_wind_soft_loop.mp3'), ('strong', 'audio_amb/amb_wind_strong_loop.mp3'),
         ('waves', 'audio_amb/amb_waves_loop.mp3'), ('flap', 'audio_sfx/sfx_apron_flap.mp3'))}
    gull = {c: decode(os.path.join(res, 'audio_sfx/sfx_amb_gull_%s.mp3' % c[-1]), 1)[:, 0] for c in ('sfx_amb_gull_1', 'sfx_amb_gull_2', 'sfx_amb_gull_3')}
    gl = {c: decode(os.path.join(res, 'audio_sfx/gull_lr/%s_R.mp3' % c), 2)[:, 1] for c in gull}   # what the game plays (R-only clip, right channel)
    bgm = decode(os.path.join(a.repo, 'creator-build-project/assets/bundles/audio_bgm_island/audio/bgm_main.mp3'), 2)   # moved to the audio_bgm_island subpackage
    amb_src = open(os.path.join(a.repo, 'creator-build-project/assets/scripts/audio/AmbienceAudio.ts'), encoding='utf8').read()
    law = a.pan_law or ('norm' if 'c / m' in amb_src else 'eqpow')
    th = (np.clip(a.pan, -1, 1) + 1) * np.pi / 4
    if law == 'norm': m = max(np.cos(th), np.sin(th)); gL, gR = np.cos(th) / m, np.sin(th) / m
    else: gL, gR = np.sqrt(2) * np.cos(th), np.sqrt(2) * np.sin(th)
    # ---- mono ambience bus
    amb = np.zeros(n); maxg = {}
    for k in ('soft', 'strong', 'waves'):
        g = np.array([f[k] for f in F]); w = (ft >= a.start) & (ft <= a.end); maxg[k] = float(g[w].max()) if w.any() else 0.0
        nz = np.nonzero(g > 0)[0]
        if not len(nz): continue
        t_on = ft[nz[0]]; x = L[k]; idx = ((tt - t_on) * SR).astype(int) % len(x)
        amb += np.interp(tt, ft, g) * x[idx] * (tt >= t_on)
    flap = np.zeros(n)
    for e in S['flaps']:
        i = int(round((e['t'] - a.start) * SR)); m = min(len(L['flap']), n - i)
        if 0 <= i < n: flap[i:i + m] += e['vol'] * L['flap'][:m]
    maxg['flap'] = max([e['vol'] for e in S['flaps']] or [0])
    gR_ = np.zeros(n); gL_ = np.zeros(n); starts = [e for e in S['events'] if e['phase'] == 'start']; gpk = 0.0
    for e in starts:
        x = gl[e['clip']]; i = int(round((e['t'] - a.start) * SR))
        if i >= n or i + len(x) < 0: continue
        j0 = max(0, -i); i = max(0, i); m = min(len(x) - j0, n - i)
        gR_[i:i + m] += e['vol'] * gR * x[j0:j0 + m]; gL_[i:i + m] += e['vol'] * gL * x[j0:j0 + m]
        gpk = max(gpk, e['vol'] * gR * float(np.abs(x).max()))
    # ---- BGM gain (musicVolume x wind duck, smoothed like GameAudio)
    s = np.array([f['s'] for f in F]); tgt = smoothstep(duck_from, duck_to, s); d = np.zeros(len(F)); acc = 0.0
    for i in range(len(F)): acc += (tgt[i] - acc) * (1 - np.exp(-(1 / 60) / duck_tau)); d[i] = acc
    duck_gain = 10 ** (duck_db * d / 20); bg = mv * np.interp(tt, ft, duck_gain)
    # game-like loop stream (two sources, equal-power crossfade at loopStartAt), 2 passes long
    dur = len(bgm) / SR; sa = dur - pad - lxf - lsafe; P = int(round(sa * SR)); X = int(round(lxf * SR))
    stream = np.zeros((P * 3 + len(bgm), 2))
    for p in range(3):
        o = p * P; seg = bgm.copy()
        if p > 0: seg[:X] *= np.sin(np.linspace(0, 1, X) * np.pi / 2)[:, None]
        seg[P:P + X] *= np.cos(np.linspace(0, 1, X) * np.pi / 2)[:, None]; seg[P + X:] = 0
        stream[o:o + len(seg)] += seg
    def mix(off):
        i0 = int(round(off * SR)); b = stream[i0:i0 + n] * bg[:, None]
        y = np.zeros((n, 2)); y[:, 0] = amb + flap + gL_ + b[:, 0]; y[:, 1] = amb + flap + gR_ + b[:, 1]; return y
    offs = np.arange(P / SR - 1.0, 2 * P / SR - 1.0, a.scan_step)   # covers one full pass incl. the seam
    seam_off = P / SR - (a.end - a.start) / 2                           # seam in the middle of the window
    offs = np.append(offs, [seam_off + k * 0.01 for k in range(-20, 21)])
    pk = [(float(np.abs(mix(o)).max()), o) for o in offs]; worst, wo = max(pk)
    # worst-case sum (every layer peak aligned), right channel = loudest gull channel; BGM at crossfade worst (cos+sin = 1.414)
    fp = {k: float(np.abs(L[k]).max()) for k in L}; bpk = float(np.abs(bgm).max())
    bgm_g_min_window = float(bg.min()); bgm_g_at_wind = float(bg[np.argmin(np.abs(tt - (S['apronAt'])))])
    layers = {'wind_soft': fp['soft'] * maxg['soft'], 'wind_strong': fp['strong'] * maxg['strong'], 'waves': fp['waves'] * maxg['waves'],
              'apron_flap': fp['flap'] * maxg['flap'], 'gull_R': gpk}
    bgm_lv = {'bgm_steady_at_lift': bpk * bgm_g_at_wind, 'bgm_crossfade_at_lift': bpk * bgm_g_at_wind * np.sqrt(2), 'bgm_undamped_crossfade': bpk * mv * np.sqrt(2)}
    wc_window = sum(layers.values()) + bgm_lv['bgm_crossfade_at_lift']
    # per frame: continuous layers at their gains in that frame (BGM at crossfade worst) + one-shots (flap, near gull R) on top
    gf = {k: np.array([f[k] for f in F]) for k in ('soft', 'strong', 'waves')}; bgf = mv * duck_gain
    inst = fp['soft'] * gf['soft'] + fp['strong'] * gf['strong'] + fp['waves'] * gf['waves'] + bpk * bgf * np.sqrt(2)
    w = (ft >= a.start) & (ft <= a.end); kmax = int(np.argmax(np.where(w, inst, -1)))
    wc = float(inst[kmax]) + layers['apron_flap'] + layers['gull_R']
    off = a.bgm_offset if a.bgm_offset is not None else wo
    rep = dict(sim=os.path.basename(a.sim), musicVolume=mv, duck_db=duck_db, pan=a.pan, window=[a.start, a.end],
               layer_peaks_dbfs={k: db(v) for k, v in layers.items()}, bgm_dbfs={k: db(v) for k, v in bgm_lv.items()},
               worst_case_sum_dbfs=db(wc), worst_case_sum_at=round(float(ft[kmax]), 2),
               worst_case_sum_terms_dbfs=dict(soft=db(fp['soft'] * gf['soft'][kmax]), strong=db(fp['strong'] * gf['strong'][kmax]), waves=db(fp['waves'] * gf['waves'][kmax]),
                                              bgm_crossfade=db(bpk * bgf[kmax] * np.sqrt(2)), flap=db(layers['apron_flap']), gull_R=db(layers['gull_R'])),
               worst_case_sum_window_max_gains_dbfs=db(wc_window), pan_law=law,
               realistic_worst_offset_dbfs=db(worst), realistic_worst_offset_s=round(float(wo), 2),
               realistic_median_offset_dbfs=db(float(np.median([p for p, _ in pk]))), offsets_scanned=len(pk),
               bgm_gain_at_lift=round(bgm_g_at_wind, 4), bgm_gain_min=round(bgm_g_min_window, 4),
               gulls=[dict(kind=e['kind'], t=e['t'], clip=e['clip'], vol=e['vol']) for e in starts])
    if a.out:
        y = mix(off); k = int(0.03 * SR); y[:k] *= np.linspace(0, 1, k)[:, None]; y[-k:] *= np.linspace(1, 0, k)[:, None]
        os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'libmp3lame', '-b:a', '128k', a.out],
                       input=np.clip(y, -1, 1).astype(np.float32).tobytes(), check=True)
        rep.update(out=a.out, bgm_offset_used=round(float(off), 2), out_peak_dbfs=db(float(np.abs(y).max())), bytes=os.path.getsize(a.out))
    js = json.dumps(rep, indent=1, ensure_ascii=False)
    if a.report: open(a.report, 'w').write(js)
    print(js)
if __name__ == '__main__': main()
