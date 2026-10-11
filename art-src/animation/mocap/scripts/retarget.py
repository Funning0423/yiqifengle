# Mocap -> character rig retargeting (numpy). glTF space: Y up, +Z = her forward, +X = her LEFT.
# Bone suffix is mirrored on this rig: bone .L = her RIGHT. CMU 'l*' = performer's left -> our '.R' bones.
#
# Method (rest-pose matching, like Rokoko / Blender retarget add-ons):
#  1. Pose the CMU skeleton into OUR rest pose ("calibration"): walking the CMU hierarchy, each mapped segment gets the
#     minimal swing that points it along the matching target bone (A-pose arms, our leg/foot/spine directions).
#  2. Per frame, target bone world rotation = R_src(t) @ R_calib^T @ R_rest_target, so every mapped bone points where the
#     performer's segment points and twists like it.
#  3. Hips translation = performer hip-joint centre scaled by the leg-length ratio (vertical) and by a separate horizontal
#     factor (stride/speed fit), heading normalised so the clip walks along +Z.
import numpy as np
import cmu_amc as C
import rig as RG

TMAP = {'hips': 'root', 'spine': 'upperback', 'chest': 'thorax', 'neck': 'lowerneck', 'head': 'head',
        'upper_arm.R': 'lhumerus', 'forearm.R': 'lwrist', 'hand.R': 'lhand',
        'upper_arm.L': 'rhumerus', 'forearm.L': 'rwrist', 'hand.L': 'rhand',
        'thigh.R': 'lfemur', 'shin.R': 'ltibia', 'foot.R': 'lfoot',
        'thigh.L': 'rfemur', 'shin.L': 'rtibia', 'foot.L': 'rfoot'}
SRC2T = {v: k for k, v in TMAP.items()}
BODY = ['root', 'hips', 'spine', 'chest', 'neck', 'head', 'upper_arm.L', 'forearm.L', 'hand.L', 'upper_arm.R', 'forearm.R', 'hand.R',
        'thigh.L', 'shin.L', 'foot.L', 'thigh.R', 'shin.R', 'foot.R']


def roty(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


class Source:
    """one CMU trial: world rotations/positions at the native 120 Hz."""

    def __init__(self, asf, amc, fps=120):
        self.sk, self.P, self.E, self.R = C.load(asf, amc)
        self.fps = fps
        self.n = len(self.P['root'])
        sk = self.sk
        self.leg = sk.bones['lfemur']['length'] + sk.bones['ltibia']['length']

    def smooth(self, sigma_frames):
        """Gaussian low-pass of positions and rotations (rotations via rotation-vector of the delta to a running mean)."""
        if sigma_frames <= 0:
            return
        r = int(3 * sigma_frames) + 1
        k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma_frames) ** 2)
        k /= k.sum()

        def filt(x):
            pad = np.concatenate([np.repeat(x[:1], r, 0), x, np.repeat(x[-1:], r, 0)])
            out = np.zeros_like(x)
            for i, w in enumerate(k):
                out += w * pad[i:i + len(x)]
            return out
        for b in self.P:
            self.P[b] = filt(self.P[b])
            self.E[b] = filt(self.E[b])
            q = RG.m2q(self.R[b])
            # hemisphere continuity
            for i in range(1, len(q)):
                if np.dot(q[i], q[i - 1]) < 0:
                    q[i] = -q[i]
            self.R[b] = RG.q2m(RG.qnorm(filt(q)))


class Retargeter:
    def __init__(self, rig, src):
        self.rig = rig
        self.src = src
        rw = rig.rest_world
        self.rest_rot = {n: rw[rig.idx[n], :3, :3] / np.linalg.norm(rw[rig.idx[n], :3, :3], axis=0) for n in rig.names}
        # target bone directions: Blender bone axis = local +Y
        self.tdir = {n: self.rest_rot[n] @ np.array([0, 1, 0.]) for n in rig.names}
        sk = src.sk
        self.calib = {'root': np.eye(3)}
        for b in sk.order[1:]:
            cand = self.calib[sk.parent[b]]
            if b in SRC2T and sk.bones[b]['length'] > 1e-6:
                d = cand @ sk.bones[b]['direction']
                self.calib[b] = RG.align(d, self.tdir[SRC2T[b]]) @ cand
            else:
                self.calib[b] = cand
        lt = rig.rest_t
        self.leg_t = np.linalg.norm(lt[rig.idx['shin.L']]) + np.linalg.norm(lt[rig.idx['foot.L']])

    def world_rots(self, frames, yaw):
        """frames: float source frame indices -> dict target bone -> [n,3,3] world rotation (heading-rotated)."""
        f = np.clip(np.asarray(frames, float), 0, self.src.n - 1)
        i0 = np.floor(f).astype(int)
        i1 = np.minimum(i0 + 1, self.src.n - 1)
        u = (f - i0)[:, None]
        Ry = roty(yaw)
        out = {}
        for t, s in TMAP.items():
            q0 = RG.m2q(self.src.R[s][i0])
            q1 = RG.m2q(self.src.R[s][i1])
            Rs = RG.q2m(RG.slerp(q0, q1, u))
            out[t] = Ry[None] @ Rs @ self.calib[s].T[None] @ self.rest_rot[t][None]
        return out

    def hip_centre(self, frames):
        f = np.clip(np.asarray(frames, float), 0, self.src.n - 1)
        i0 = np.floor(f).astype(int)
        i1 = np.minimum(i0 + 1, self.src.n - 1)
        u = (f - i0)[:, None]
        h = 0.5 * (self.src.E['lhipjoint'] + self.src.E['rhipjoint'])
        return h[i0] * (1 - u) + h[i1] * u

    def heading(self, frames):
        """performer heading (radians, yaw of the pelvis forward axis in the CMU XZ plane) per frame."""
        f = np.clip(np.round(np.asarray(frames)).astype(int), 0, self.src.n - 1)
        rv = self.src.E['rhipjoint'][f] - self.src.E['lhipjoint'][f]      # performer's right (-X in the zero pose)
        fwd = np.cross(np.array([0, 1., 0]), rv)                           # up x right = forward (+Z in the zero pose)
        return np.arctan2(fwd[:, 0], fwd[:, 2])

    def to_local(self, Wrot, hips_pos):
        """world rotations dict + hips world position -> local quats [n,J,4], local trans [n,J,3]."""
        rig = self.rig
        n = len(hips_pos)
        Q = np.repeat(rig.rest_r[None], n, 0).copy()
        T = np.repeat(rig.rest_t[None], n, 0).copy()
        Wr = {}
        for name in rig.names:
            i = rig.idx[name]
            p = rig.parent[i]
            pr = np.eye(3)[None].repeat(n, 0) if p is None else Wr[rig.names[p]]
            if name in Wrot:
                Wr[name] = Wrot[name]
                Q[:, i] = RG.m2q(np.transpose(pr, (0, 2, 1)) @ Wrot[name])
            else:
                Wr[name] = pr @ RG.q2m(rig.rest_r[i])[None]
        # hips translation is local to root (root at rest, identity rotation)
        ri = rig.idx['root']
        T[:, rig.idx['hips']] = hips_pos - rig.rest_t[ri][None]
        return Q, T


def order_names(rig, names):
    return [n for n in rig.names if n in names]
