# CMU Graphics Lab ASF/AMC reader + forward kinematics (numpy only; runs in system Python and in Blender's Python).
# Output frame: CMU world (Y up), metres. Joint "position" = segment start (CMU convention: bone end = child start).
import numpy as np

INCH = 0.0254


def euler_xyz(ax, ay, az):
    """CMU/ASF 'XYZ' order: R = Rz(az) @ Ry(ay) @ Rx(ax) (static axes), degrees."""
    ax, ay, az = np.radians([ax, ay, az])
    cx, sx, cy, sy, cz, sz = np.cos(ax), np.sin(ax), np.cos(ay), np.sin(ay), np.cos(az), np.sin(az)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


class Skeleton:
    def __init__(self, path):
        txt = open(path).read().split('\n')
        self.scale = 1.0
        self.bones = {}
        self.order = ['root']
        self.parent = {'root': None}
        self.children = {'root': []}
        self.root_order = ['TX', 'TY', 'TZ', 'RX', 'RY', 'RZ']
        sec = None
        cur = None
        for ln in txt:
            s = ln.strip()
            if not s or s.startswith('#'):
                continue
            if s.startswith(':'):
                sec = s.split()[0]
                if sec == ':units':
                    pass
                continue
            tok = s.split()
            if sec == ':units' and tok[0] == 'length':
                self.scale = INCH / float(tok[1])
            elif sec == ':root' and tok[0] == 'order':
                self.root_order = tok[1:]
            elif sec == ':bonedata':
                if tok[0] == 'begin':
                    cur = dict(dof=[], axis=np.eye(3), direction=np.zeros(3), length=0.0)
                elif tok[0] == 'end':
                    self.bones[cur['name']] = cur
                elif tok[0] == 'name':
                    cur['name'] = tok[1]
                elif tok[0] == 'direction':
                    cur['direction'] = np.array([float(x) for x in tok[1:4]])
                elif tok[0] == 'length':
                    cur['length'] = float(tok[1]) * self.scale
                elif tok[0] == 'axis':
                    cur['axis'] = euler_xyz(*[float(x) for x in tok[1:4]])
                elif tok[0] == 'dof':
                    cur['dof'] = tok[1:]
            elif sec == ':hierarchy':
                if tok[0] in ('begin', 'end'):
                    continue
                p = tok[0]
                for c in tok[1:]:
                    self.parent[c] = p
                    self.children.setdefault(p, []).append(c)
                    self.children.setdefault(c, [])
        # parents before children
        out, stack = [], ['root']
        while stack:
            n = stack.pop(0)
            out.append(n)
            stack.extend(self.children.get(n, []))
        self.order = out


def read_amc(path, sk):
    frames, cur = [], None
    for ln in open(path):
        s = ln.strip()
        if not s or s.startswith('#') or s.startswith(':'):
            continue
        tok = s.split()
        if len(tok) == 1 and tok[0].isdigit():
            cur = {}
            frames.append(cur)
            continue
        cur[tok[0]] = [float(x) for x in tok[1:]]
    return frames


def fk(sk, frames):
    """returns dict name -> (pos[n,3] start of segment, end[n,3] end of segment, R[n,3,3] world rotation)."""
    n = len(frames)
    P = {b: np.zeros((n, 3)) for b in sk.order}
    E = {b: np.zeros((n, 3)) for b in sk.order}
    R = {b: np.zeros((n, 3, 3)) for b in sk.order}
    for i, fr in enumerate(frames):
        v = fr['root']
        d = dict(zip(sk.root_order, v))
        R['root'][i] = euler_xyz(d.get('RX', 0), d.get('RY', 0), d.get('RZ', 0))
        P['root'][i] = np.array([d.get('TX', 0), d.get('TY', 0), d.get('TZ', 0)]) * sk.scale
        E['root'][i] = P['root'][i]
        for b in sk.order[1:]:
            bd = sk.bones[b]
            p = sk.parent[b]
            ang = {'rx': 0.0, 'ry': 0.0, 'rz': 0.0}
            if b in fr:
                for k, x in zip(bd['dof'], fr[b]):
                    ang[k] = x
            C = bd['axis']
            L = C @ euler_xyz(ang['rx'], ang['ry'], ang['rz']) @ C.T
            R[b][i] = R[p][i] @ L
            P[b][i] = E[p][i]
            E[b][i] = P[b][i] + bd['length'] * (R[b][i] @ bd['direction'])
    return P, E, R


def rest(sk):
    """zero-angle rest pose (CMU T-pose-like): name -> (start, end)."""
    fr = [{'root': [0] * 6}]
    P, E, R = fk(sk, fr)
    return {b: (P[b][0], E[b][0]) for b in sk.order}


def load(asf, amc, fps_src=120):
    sk = Skeleton(asf)
    frames = read_amc(amc, sk)
    P, E, R = fk(sk, frames)
    return sk, P, E, R
