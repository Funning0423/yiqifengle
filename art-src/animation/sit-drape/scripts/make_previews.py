# Comparison renders for RESULT-sit-drape.md (before = the GLB without the sit drape, after = the new GLB with the
# anim_meta sit_drape weights), all through render_sit.py (chair + floor at their game position).
#   python3 make_previews.py <before.glb> <before_anim_meta> <after.glb> <after_anim_meta> <out_dir>
# out_dir: compare_<view>.jpg (settled frame, before | after, close to the chair), sheet_<clip>.jpg (key frames, after,
# 3/4 + side rows), settled_<view>.png (after, 1280x720, for re-rendering the loading-page background).
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sitlib as SL  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
VIEWS = ('side_L', 'front', 'q34', 'back')
SETTLED = ('sit_hold', 0.0)


def render(job, tmp):
    p = os.path.join(tmp, 'job_%d.json' % (abs(hash(json.dumps(job, sort_keys=True))) % 10 ** 8))
    with open(p, 'w') as f:
        json.dump(job, f)
    subprocess.run(['blender', '-b', '-P', os.path.join(HERE, 'render_sit.py'), '--', p], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def sheet(out, cols, items):
    cmd = ['python3', os.path.join(HERE, 'sheet.py'), out, str(cols)] + ['%s=%s' % (p, l) for p, l in items]
    subprocess.run(cmd, check=True)


def main():
    before, mb, after, ma, out = sys.argv[1:6]
    os.makedirs(out, exist_ok=True)
    tmp = os.path.join(out, '_render')
    os.makedirs(tmp, exist_ok=True)
    metas = dict(before=json.load(open(mb)), after=json.load(open(ma)))
    glbs = dict(before=before, after=after)
    c, t = SETTLED
    for tag in ('before', 'after'):
        shots = []
        for v in VIEWS:
            shots.append(dict(name='%s_%s' % (tag, v), clip=c, t=t, view=v, weights=SL.morph_weights(metas[tag], c, t),
                              dist=1.05 if v != 'back' else 1.2))
        render(dict(glb=glbs[tag], out=tmp, res=[800, 800], shots=shots), tmp)
    for v in VIEWS:
        sheet(os.path.join(out, 'compare_%s.jpg' % v), 2,
              [(os.path.join(tmp, 'before_%s.png' % v), 'before ' + v), (os.path.join(tmp, 'after_%s.png' % v), 'after ' + v)])
    # key-frame sheets (after): 3/4 row + side row
    for clip, ts in (('sit_down', (0.0, 0.3, 0.5, 0.7, 0.9, 1.2)), ('sit_hold', (0.0, 0.4, 0.8, 1.2, 1.6, 1.9667)),
                     ('stand_up', (0.0, 0.3, 0.6, 0.9, 1.1, 1.2667))):
        shots = []
        for view in ('q34', 'side_L'):
            for x in ts:
                shots.append(dict(name='%s_%s_%.3f' % (clip, view, x), clip=clip, t=x, view=view,
                                  weights=SL.morph_weights(metas['after'], clip, x), dist=1.6))
        render(dict(glb=after, out=tmp, res=[480, 480], shots=shots), tmp)
        items = []
        for view in ('q34', 'side_L'):
            for x in ts:
                w = SL.morph_weights(metas['after'], clip, x).get('sit_drape', 0.0)
                items.append((os.path.join(tmp, '%s_%s_%.3f.png' % (clip, view, x)), '%s %.2fs w=%.2f' % (clip, x, w)))
        sheet(os.path.join(out, 'sheet_%s.jpg' % clip), len(ts), items)
    # settled frame for the loading page: wide and 3/4, 1280x720, PNG
    shots = [dict(name='settled_%s' % v, clip=c, t=t, view=v, weights=SL.morph_weights(metas['after'], c, t), dist=d)
             for v, d in (('wide', 2.2), ('q34', 1.6), ('front', 1.8))]
    render(dict(glb=after, out=out, res=[1280, 720], shots=shots), tmp)
    print('previews in', out)


if __name__ == '__main__':
    main()
