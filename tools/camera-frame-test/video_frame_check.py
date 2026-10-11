#!/usr/bin/env python3
"""T2/T3a native video check (stdlib + ffmpeg/ffprobe only; runs on the Mac and on Linux).

Extracts every frame of a time window from a recorded mp4, computes per-frame mean luma (Rec.709, 0..1),
saturation-weighted mean hue (deg) and mean absolute pixel difference to the previous frame, and FLAGS any
single-frame step above the thresholds. Writes a JSON report and a contact sheet PNG.

A smooth camera move changes luma/hue gradually; a lighting/geometry/material snap shows up as ONE frame with a
large step. Flag rule (per adjacent frame pair):
  luma step   |dY|  > --luma-step  (default 0.02 = 2% of full scale)       -> FLAG
  hue step    |dH|  > --hue-step   (default 6 deg, only if mean sat > 0.15) -> FLAG
  pixel step  MAD   > --mad-step   (default 0.06) AND > 4x window median MAD -> FLAG (cut / pop)
Capture stutter holds a frame for N refreshes and then jumps; such a jump is only a POP if it is also > 3x (4x for
pixels) what the local motion rate (median per-frame step within +-0.5 s) times N explains. Stutter is reported
separately under "stutter".

Window: --start/--end seconds in the video, OR derive it from a GB_MARK log (GGbot T0 autoplay):
  --gb-log run.log --video-start-mark <mark at video t=0> | --video-offset <log seconds at video t=0>
  --from-mark island_settled_before --to-mark island --pad 0.5
GB_MARK lines are matched loosely: the line must contain 'GB_MARK', a mark name and a time. Accepted forms:
  GB_MARK <name> <seconds|ms|ISO-8601>     or     GB_MARK {"mark":"<name>","t":<seconds|ms>|"<ISO>"}
Times >1e11 are treated as epoch ms, >1e8 as epoch s, otherwise seconds; ISO strings are parsed with fromisoformat.
Exit code: 0 = no flags, 1 = flags found (use --expect-flag for a negative control: then 0 = flagged as expected).
"""
import argparse, json, math, os, re, subprocess, sys, datetime

def probe(path):
    out = subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                                   'stream=width,height,r_frame_rate:format=duration', '-of', 'json', path])
    d = json.loads(out); s = d['streams'][0]; n, m = s['r_frame_rate'].split('/')
    return int(s['width']), int(s['height']), float(n) / float(m), float(d['format']['duration'])

def parse_time(tok):
    tok = tok.strip().strip('"\'')
    try:
        v = float(tok)
        return v / 1000.0 if v > 1e11 else v
    except ValueError:
        pass
    try:
        return datetime.datetime.fromisoformat(tok.replace('Z', '+00:00')).timestamp()
    except ValueError:
        return None

def read_marks(path):
    marks = []
    for line in open(path, encoding='utf-8', errors='replace'):
        if 'GB_MARK' not in line: continue
        rest = line[line.index('GB_MARK') + len('GB_MARK'):].strip()
        name = t = None
        j = rest.find('{')
        if j >= 0:
            try:
                d = json.loads(rest[j:rest.rindex('}') + 1])
                name = d.get('mark') or d.get('name') or d.get('state')
                for k in ('t', 'ts', 'time', 'ms', 'utc'):
                    if k in d: t = parse_time(str(d[k])); break
            except Exception:
                pass
        if name is None:
            parts = rest.split()
            if parts:
                name = parts[0]
                for p in parts[1:]:
                    t = parse_time(p)
                    if t is not None: break
        if name is not None and t is not None: marks.append((name, t))
    return marks

def window_from_marks(a):
    marks = read_marks(a.gb_log)
    if not marks: sys.exit('no GB_MARK lines with name+time in ' + a.gb_log)
    def find(name):
        for n, t in marks:
            if n == name: return t
        sys.exit('GB_MARK %r not found; available: %s' % (name, sorted(set(n for n, _ in marks))))
    if a.video_start_mark: origin = find(a.video_start_mark)
    elif a.video_offset is not None: origin = a.video_offset
    else: sys.exit('--gb-log needs --video-start-mark or --video-offset')
    start = find(a.from_mark) - origin - a.pad
    end = (find(a.to_mark) if a.to_mark else find(a.from_mark)) - origin + a.pad
    return max(0.0, start), end, {'origin': origin, 'from': a.from_mark, 'to': a.to_mark, 'pad': a.pad}

def frames(path, start, end, w):
    W, H, fps, dur = probe(path); h = int(round(H * w / W / 2)) * 2
    cmd = ['ffmpeg', '-v', 'error', '-ss', '%.3f' % start, '-i', path, '-t', '%.3f' % (end - start),
           '-vf', 'scale=%d:%d' % (w, h), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE); size = w * h * 3; i = 0
    while True:
        buf = p.stdout.read(size)
        if len(buf) < size: break
        yield start + i / fps, buf; i += 1
    p.wait()

def stats(buf):
    n = len(buf) // 3; ys = 0.0; hx = hy = 0.0; sat = 0.0
    for k in range(0, len(buf), 3 * 4):  # every 4th pixel is plenty for means
        r, g, b = buf[k] / 255.0, buf[k + 1] / 255.0, buf[k + 2] / 255.0
        ys += 0.2126 * r + 0.7152 * g + 0.0722 * b
        mx, mn = max(r, g, b), min(r, g, b); c = mx - mn
        if c > 1e-6:
            if mx == r: hh = ((g - b) / c) % 6
            elif mx == g: hh = (b - r) / c + 2
            else: hh = (r - g) / c + 4
            a = hh * math.pi / 3; s = c / mx if mx > 0 else 0
            hx += s * math.cos(a); hy += s * math.sin(a); sat += s
    m = len(range(0, len(buf), 12))
    return ys / m, (math.degrees(math.atan2(hy, hx)) % 360), sat / m

def mad(a, b):
    t = 0; m = 0
    for k in range(0, len(a), 12): t += abs(a[k] - b[k]) + abs(a[k + 1] - b[k + 1]) + abs(a[k + 2] - b[k + 2]); m += 3
    return t / m / 255.0

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('video'); ap.add_argument('--start', type=float); ap.add_argument('--end', type=float)
    ap.add_argument('--gb-log'); ap.add_argument('--video-start-mark'); ap.add_argument('--video-offset', type=float)
    ap.add_argument('--from-mark'); ap.add_argument('--to-mark'); ap.add_argument('--pad', type=float, default=0.5)
    ap.add_argument('--luma-step', type=float, default=0.02); ap.add_argument('--hue-step', type=float, default=6.0)
    ap.add_argument('--mad-step', type=float, default=0.06); ap.add_argument('--width', type=int, default=146)
    ap.add_argument('--out', default='video-frame-check'); ap.add_argument('--sheet-fps', type=float, default=10)
    ap.add_argument('--expect-flag', action='store_true', help='negative control: succeed only if something is flagged')
    a = ap.parse_args()
    meta = None
    if a.gb_log: start, end, meta = window_from_marks(a)
    else:
        if a.start is None or a.end is None: sys.exit('give --start/--end or --gb-log ... --from-mark')
        start, end = a.start, a.end
    os.makedirs(a.out, exist_ok=True)
    rows = []; prev = None; prevbuf = None
    for t, buf in frames(a.video, start, end, a.width):
        y, h, s = stats(buf); r = {'t': round(t, 4), 'luma': round(y, 5), 'hue': round(h, 2), 'sat': round(s, 4)}
        if prev:
            dh = (h - prev['hue'] + 180) % 360 - 180
            r.update(dLuma=round(y - prev['luma'], 5), dHue=round(dh, 2), mad=round(mad(buf, prevbuf), 5))
        rows.append(r); prev = r; prevbuf = buf
    # Recorded captures often hold a frame for several refreshes and then jump (stutter). A step after N held
    # frames carries N frames of motion, so steps are normalized by the gap since the last CHANGED frame.
    HOLD = 0.002; gap = 1; holds = []; run = 0
    for r in rows:
        if 'mad' not in r: continue
        if r['mad'] < HOLD: gap += 1; run += 1; r['held'] = True; continue
        if run: holds.append(run)
        r['gap'] = gap; r['nLuma'] = round(r['dLuma'] / gap, 5); r['nHue'] = round(r['dHue'] / gap, 2); r['nMad'] = round(r['mad'] / gap, 5)
        gap = 1; run = 0
    # A step is a POP when it is larger than the threshold AND larger than what the local motion rate explains:
    # expected = 3 x (median per-frame step of the other changed frames within +-0.5 s) x gap.
    changed = [r for r in rows if 'nLuma' in r]
    def local(r, key):
        v = sorted(abs(x[key]) for x in changed if x is not r and abs(x['t'] - r['t']) <= .5)
        return v[len(v) // 2] if v else 0.0
    flags = []
    for r in changed:
        why = []; g = r['gap']
        if abs(r['dLuma']) > a.luma_step and abs(r['dLuma']) > 3 * local(r, 'nLuma') * g:
            why.append('luma %+.3f (gap %d, local %.4f/frame)' % (r['dLuma'], g, local(r, 'nLuma')))
        if min(r['sat'], 1) > .15 and abs(r['dHue']) > a.hue_step and abs(r['dHue']) > 3 * local(r, 'nHue') * g:
            why.append('hue %+.1f (gap %d)' % (r['dHue'], g))
        if r['mad'] > a.mad_step and r['mad'] > 4 * local(r, 'nMad') * g:
            why.append('pixels %.3f (gap %d, local %.4f/frame)' % (r['mad'], g, local(r, 'nMad')))
        if why: flags.append({'t': r['t'], 'why': why}); r['flag'] = why
    med = sorted(r['nMad'] for r in changed)[len(changed) // 2] if changed else 0
    stutter = {'heldFrames': sum(holds), 'longestHold': max(holds or [0]), 'holdRuns': len(holds)}
    sheet = os.path.join(a.out, 'contact-sheet.png')
    n = max(1, int((end - start) * a.sheet_fps)); cols = min(10, n); rws = int(math.ceil(n / cols))
    vf = 'fps=%g,scale=146:-1,tile=%dx%d' % (a.sheet_fps, cols, rws)
    try:
        subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-ss', '%.3f' % start, '-i', a.video, '-t', '%.3f' % (end - start),
                               '-vf', "fps=%g,scale=146:-1,drawtext=text='%%{pts\\:hms\\:%.3f}':x=4:y=4:fontsize=12:fontcolor=white:box=1:boxcolor=black@0.6,tile=%dx%d" % (a.sheet_fps, start, cols, rws),
                               '-frames:v', '1', sheet])
    except Exception:
        subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-ss', '%.3f' % start, '-i', a.video, '-t', '%.3f' % (end - start), '-vf', vf, '-frames:v', '1', sheet])
    rep = {'video': os.path.abspath(a.video), 'window': [round(start, 3), round(end, 3)], 'gbMark': meta, 'frames': len(rows),
           'thresholds': {'lumaStep': a.luma_step, 'hueStepDeg': a.hue_step, 'madStep': a.mad_step, 'madMedian': med},
           'maxAbsLumaStep': max([abs(r.get('dLuma', 0)) for r in rows] or [0]), 'maxAbsLumaStepPerFrame': max([abs(r.get('nLuma', 0)) for r in rows] or [0]), 'stutter': stutter, 'flags': flags,
           'contactSheet': sheet, 'contactSheetLayout': {'fps': a.sheet_fps, 'cols': cols, 'start': start}, 'rows': rows,
           'scope': 'Pixel statistics of a recorded video only; says nothing about why a step happened.'}
    json.dump(rep, open(os.path.join(a.out, 'report.json'), 'w'), indent=1)
    print(json.dumps({k: rep[k] for k in ('video', 'window', 'frames', 'maxAbsLumaStep', 'stutter', 'flags', 'contactSheet')}, ensure_ascii=False))
    bad = bool(flags)
    sys.exit((0 if bad else 1) if a.expect_flag else (1 if bad else 0))

if __name__ == '__main__': main()
