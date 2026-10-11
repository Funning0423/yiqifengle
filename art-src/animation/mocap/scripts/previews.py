# Before/after previews (python3 + Blender + ffmpeg + PIL):
#   python3 previews.py <new_glb> <new_anim_meta> <old_glb> <old_anim_meta> <out_dir> [videos|sheets ...]
# videos: side + front comparison mp4 (old | new) for walk_loop, sit_down, stand_up, the root driven as the game driver does
#         (walk: 0.7 m/s straight; sit/stand: linear between the standing and seated controller roots, 0.494 m apart).
# sheets: per clip, key frames in front / side / 3/4 / back views, old row above new row (root placed by root_motion).
import json
import math
import os
import shutil
import struct
import subprocess
import sys
import tempfile
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
BLENDER = os.environ.get('BLENDER', 'blender')
FPS = 30
SEATED_BACK = 0.494
VIEWS = ['front', 'side', 'q34', 'back']
CLIPS = ['walk_loop', 'walk_start', 'walk_stop_bodyL', 'walk_stop_bodyR', 'walk_turn_90_bodyL', 'walk_turn_90_bodyR',
         'walk_turn_180', 'walk_turn_180_bodyR', 'idle_breathing_loop', 'sit_hold', 'sit_down', 'stand_up', 'door_reach']
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'


def durations(glb):
    raw = open(glb, 'rb').read()
    jl = struct.unpack('<I', raw[12:16])[0]
    J = json.loads(raw[20:20 + jl])
    return {an['name']: max(J['accessors'][s['input']]['max'][0] for s in an['samplers']) for an in J['animations']}


def interp(tab, t):
    if not tab:
        return 0.0
    if t <= tab[0][0]:
        return tab[0][1]
    for a, b in zip(tab[:-1], tab[1:]):
        if a[0] <= t <= b[0]:
            u = (t - a[0]) / (b[0] - a[0]) if b[0] > a[0] else 1.0
            return a[1] + u * (b[1] - a[1])
    return tab[-1][1]


def root_at(meta, clip, t):
    rm = (meta.get('clips', {}).get(clip) or {}).get('root_motion')
    if not isinstance(rm, dict):
        return 0.0, 0.0, 0.0
    return interp(rm.get('lateral_m'), t), interp(rm.get('forward_m'), t), math.radians(interp(rm.get('yaw_deg'), t))


def render(glb, frames, views, res, follow=True):
    d = tempfile.mkdtemp(prefix='mocap_r_')
    seq = os.path.join(d, 'seq.json')
    with open(seq, 'w') as f:
        json.dump(dict(frames=frames, follow=follow), f)
    subprocess.run([BLENDER, '-b', '-P', os.path.join(HERE, 'render_seq.py'), '--', glb, seq, d, ','.join(views), str(res)],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return d


def label(im, text, size=14):
    dr = ImageDraw.Draw(im)
    dr.text((6, 4), text, fill=(255, 255, 255), font=ImageFont.truetype(FONT, size))
    return im


# ---------------------------------------------------------------- videos
def seq_walk(dur, T=3.0):
    return [['walk_loop', (i / FPS) % dur['walk_loop'], 0.0, 0.7 * i / FPS, 0.0] for i in range(int(T * FPS))]


def seq_sit(dur, down):
    fr = []
    a, b = (0.0, -SEATED_BACK) if down else (-SEATED_BACK, 0.0)
    pre, post = ('idle_breathing_loop', 'sit_hold') if down else ('sit_hold', 'idle_breathing_loop')
    clip = 'sit_down' if down else 'stand_up'
    for i in range(12):
        fr.append([pre, (i / FPS) % dur[pre], 0.0, a, 0.0])
    n = int(round(dur[clip] * FPS))
    for i in range(n + 1):
        u = i / n
        fr.append([clip, min(i / FPS, dur[clip]), 0.0, a + (b - a) * u, 0.0])
    for i in range(1, 19):
        fr.append([post, (i / FPS) % dur[post], 0.0, b, 0.0])
    return fr


def video(name, new_glb, old_glb, out, res=420):
    dn, do = durations(new_glb), durations(old_glb)
    if name == 'walk_loop':
        sn, so, follow = seq_walk(dn), seq_walk(do), True
    else:
        sn, so, follow = seq_sit(dn, name == 'sit_down'), seq_sit(do, name == 'sit_down'), False
    rn = render(new_glb, sn, ['side', 'front'], res, follow)
    ro = render(old_glb, so, ['side', 'front'], res, follow)
    n = max(len(sn), len(so))
    fd = tempfile.mkdtemp(prefix='mocap_v_')
    for i in range(n):
        tiles = []
        for v in ('side', 'front'):
            for tag, d, L in (('old', ro, len(so)), ('new', rn, len(sn))):
                im = Image.open(os.path.join(d, '%s_%04d.png' % (v, min(i, L - 1)))).convert('RGB')
                tiles.append(label(im, '%s  %s  %s' % (tag, name, v)))
        w, h = tiles[0].size
        g = Image.new('RGB', (2 * w, 2 * h))
        for k, im in enumerate(tiles):
            g.paste(im, ((k % 2) * w, (k // 2) * h))
        g.save(os.path.join(fd, '%04d.png' % i))
    path = os.path.join(out, 'compare_%s.mp4' % name)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(fd, '%04d.png'),
                    '-c:v', 'libx264', '-crf', '30', '-pix_fmt', 'yuv420p', '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', path],
                   check=True)
    for d in (rn, ro, fd):
        shutil.rmtree(d, ignore_errors=True)
    return path


# ---------------------------------------------------------------- contact sheets
def key_times(d, loop, k=6):
    return [d * i / k for i in range(k)] if loop else [d * i / (k - 1) for i in range(k)]


def sheet(name, new_glb, new_meta, old_glb, old_meta, out, res=260, k=6):
    rows = []
    for tag, glb, meta in (('old', old_glb, old_meta), ('new', new_glb, new_meta)):
        dur = durations(glb)
        loop = bool((meta.get('clips', {}).get(name) or {}).get('loop', name.endswith('_loop') or name == 'sit_hold'))
        ts = key_times(dur[name], loop, k)
        fr = []
        for t in ts:
            x, z, yaw = root_at(meta, name, t)
            if name == 'stand_up' and tag == 'new':
                z -= SEATED_BACK
            if name == 'sit_hold':
                z = -SEATED_BACK
            fr.append([name, t, x, z, yaw])
        d = render(glb, fr, VIEWS, res, follow=True)
        rows.append((tag, ts, d))
    w, h = Image.open(os.path.join(rows[0][2], 'front_0000.png')).size
    S = Image.new('RGB', (k * w, 2 * len(VIEWS) * h), (30, 30, 30))
    r = 0
    for v in VIEWS:
        for tag, ts, d in rows:
            for i, t in enumerate(ts):
                im = Image.open(os.path.join(d, '%s_%04d.png' % (v, i))).convert('RGB')
                S.paste(label(im, '%s %s %.2fs' % (tag, v, t), 12), (i * w, r * h))
            r += 1
    for _, _, d in rows:
        shutil.rmtree(d, ignore_errors=True)
    path = os.path.join(out, 'sheet_%s.jpg' % name)
    S.save(path, quality=78, optimize=True)
    return path


def main():
    new_glb, new_meta, old_glb, old_meta, out = sys.argv[1:6]
    what = sys.argv[6:] or ['videos', 'sheets']
    os.makedirs(out, exist_ok=True)
    nm, om = json.load(open(new_meta)), json.load(open(old_meta))
    if 'videos' in what:
        for c in ('walk_loop', 'sit_down', 'stand_up'):
            print('video', video(c, new_glb, old_glb, out), flush=True)
    if 'sheets' in what:
        for c in CLIPS:
            print('sheet', sheet(c, new_glb, nm, old_glb, om, out), flush=True)


if __name__ == '__main__':
    main()
