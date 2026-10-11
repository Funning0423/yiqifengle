# Quick stick-figure sheet (side + front) of target joint positions: python3 stick.py out.png  (used from other scripts)
import numpy as np
from PIL import Image, ImageDraw

BONES = [('hips', 'spine'), ('spine', 'chest'), ('chest', 'neck'), ('neck', 'head'), ('chest', 'upper_arm.L'), ('upper_arm.L', 'forearm.L'),
         ('forearm.L', 'hand.L'), ('chest', 'upper_arm.R'), ('upper_arm.R', 'forearm.R'), ('forearm.R', 'hand.R'), ('hips', 'thigh.L'),
         ('thigh.L', 'shin.L'), ('shin.L', 'foot.L'), ('hips', 'thigh.R'), ('thigh.R', 'shin.R'), ('shin.R', 'foot.R')]


def sheet(rig, W, frames, path, cell=220, scale=120, extra=None):
    """W [n,J,4,4] world matrices; frames: indices to draw. side view (Z right) and front view (X right)."""
    cols = len(frames)
    im = Image.new('RGB', (cols * cell, 2 * cell), 'white')
    d = ImageDraw.Draw(im)
    for c, f in enumerate(frames):
        P = {n: W[f, rig.idx[n], :3, 3] for n in rig.names}
        cx = P['hips'][2]
        cxf = P['hips'][0]
        for row, (ax, cc) in enumerate(((2, cx), (0, cxf))):
            ox, oy = c * cell + cell / 2, row * cell + cell - 10
            d.line((c * cell, oy, c * cell + cell, oy), fill=(200, 200, 200))
            for a, b in BONES:
                col = (200, 40, 40) if a.endswith('.L') or b.endswith('.L') else (40, 40, 200) if a.endswith('.R') or b.endswith('.R') else (0, 0, 0)
                pa, pb = P[a], P[b]
                d.line((ox + (pa[ax] - cc) * scale, oy - pa[1] * scale, ox + (pb[ax] - cc) * scale, oy - pb[1] * scale), fill=col, width=2)
            if extra is not None:
                for p in extra[f]:
                    d.ellipse((ox + (p[ax] - cc) * scale - 2, oy - p[1] * scale - 2, ox + (p[ax] - cc) * scale + 2, oy - p[1] * scale + 2), fill=(0, 160, 0))
        d.text((c * cell + 4, 4), str(f), fill='black')
    im.save(path)
