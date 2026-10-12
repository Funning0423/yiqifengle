# Shared Blender helpers for the seated drape shape keys (task 03).  Imported by the blender -b -P scripts in this folder.
# Frames: glTF character space (x = her left, y up, z = forward) -> Blender (x, -z, y).  The seated controller root is the
# origin; the chair is placed from the room data (FirstsliceFacts seat_anchor / chair_spec, CharacterReference seatedRoot).
import bpy, os, sys, json, math, struct
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
CHR = os.path.join(REPO, 'creator-build-project/assets/bundles/region_island/character')
GLB = os.path.join(CHR, 'chr_b_r5g2_lod0_anim_pass2_INTERIM_s1_grokbot2.glb')
ROOM = os.path.join(REPO, 'creator-build-project/assets/bundles/region_island/combined_visual_m.glb')
FPS = 30

# room data (world, glTF / Cocos frame)
SEAT_ANCHOR = np.array([0.4203000068664551, 0.38, -4.2133002281188965])
SEAT_YAW = -2.0
SEATED_ROOT = np.array([0.4327299768730942, 0.0, -4.207611558444886])
CHAIR_SPEC = dict(width_m=0.4946, depth_m=0.3815, thickness_m=0.0389, back_height_m=0.862, seat_top_y_m=0.38)


def seat_offset_local():
    """seat-top centre in the seated root frame (glTF axes): rotate the world offset by -yaw."""
    d = SEAT_ANCHOR - SEATED_ROOT
    c, s = math.cos(SEAT_YAW), math.sin(SEAT_YAW)
    return np.array([c * d[0] - s * d[2], d[1], s * d[0] + c * d[2]])


def gl2bl(P):
    P = np.asarray(P, float)
    return np.stack([P[..., 0], -P[..., 2], P[..., 1]], -1)


def bl2gl(P):
    P = np.asarray(P, float)
    return np.stack([P[..., 0], P[..., 2], -P[..., 1]], -1)


def extract_chair(room=ROOM):
    """chair triangles in chair-local glTF coordinates, cut out of env_interior_props_merged (the chair is merged into it)."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=room)
    o = bpy.data.objects['env_interior_props_merged']
    mw = o.matrix_world
    P = np.array([tuple(mw @ v.co) for v in o.data.vertices])
    gl = bl2gl(P)
    c, s = math.cos(SEAT_YAW), math.sin(SEAT_YAW)
    d = gl - np.array([SEAT_ANCHOR[0], 0.0, SEAT_ANCHOR[2]])
    L = np.stack([c * d[:, 0] - s * d[:, 2], d[:, 1], s * d[:, 0] + c * d[:, 2]], 1)
    inside = (np.abs(L[:, 0]) < 0.262) & (L[:, 2] > -0.29) & (L[:, 2] < 0.215) & (L[:, 1] < 0.95) & (L[:, 1] > -0.01)
    tris = []
    for p in o.data.polygons:
        vs = list(p.vertices)
        if all(inside[v] for v in vs):
            for k in range(1, len(vs) - 1):
                tris.append((vs[0], vs[k], vs[k + 1]))
    tris = np.array(tris)
    used = np.unique(tris)
    remap = -np.ones(len(L), int)
    remap[used] = np.arange(len(used))
    for ob in list(bpy.data.objects):
        if ob not in before:
            bpy.data.objects.remove(ob)
    return L[used], remap[tris]


def chair_in_seated_root(V_local):
    """chair-local (glTF) -> seated root frame (glTF): same yaw as the character, offset by the seat anchor."""
    so = seat_offset_local()
    return V_local + np.array([so[0], 0.0, so[2]])


def make_mesh_object(name, V_bl, F, mat=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(map(float, v)) for v in V_bl], [], [tuple(map(int, f)) for f in F])
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    if mat is not None:
        me.materials.append(mat)
    return ob


def glb_json(path):
    raw = open(path, 'rb').read()
    jl = struct.unpack('<I', raw[12:16])[0]
    return json.loads(raw[20:20 + jl])


class Character:
    """runtime GLB imported once; pose(clip, t) evaluates the armature; deformed(obj) returns evaluated vertex positions."""

    def __init__(self, glb=GLB):
        sc = bpy.context.scene
        sc.render.fps = FPS
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=glb)
        self.objs = [o for o in bpy.data.objects if o not in before]
        for o in list(self.objs):
            if o.name.startswith('Icosphere'):
                bpy.data.objects.remove(o)
                self.objs.remove(o)
        self.arm = [o for o in self.objs if o.type == 'ARMATURE'][0]
        top = self.arm
        while top.parent is not None:
            top = top.parent
        self.top = top
        self.top.matrix_world = Matrix.Identity(4)
        if self.arm.animation_data is None:
            self.arm.animation_data_create()
        for t in self.arm.animation_data.nla_tracks:
            t.mute = True
        J = glb_json(glb)
        self.dur = {an['name']: max(J['accessors'][s['input']]['max'][0] for s in an['samplers']) for an in J['animations']}
        self.mesh = {n: bpy.data.objects[n] for n in ('LOD0_G2_BODY', 'LOD0_G2_DRESS', 'LOD0_G2_APRON', 'LOD0_G2_BOW')}

    def pose(self, clip, t):
        act = bpy.data.actions[clip]
        ad = self.arm.animation_data
        ad.action = act
        if getattr(act, 'slots', None) and len(act.slots):
            ad.action_slot = act.slots[0]
        f0, f1 = act.frame_range
        k = (f1 - f0) / self.dur[clip] if self.dur[clip] > 0 else 1.0
        f = f0 + t * k
        bpy.context.scene.frame_set(int(math.floor(f)), subframe=f - math.floor(f))

    def rest(self):
        self.arm.animation_data.action = None
        for pb in self.arm.pose.bones:
            pb.matrix_basis.identity()
        bpy.context.scene.frame_set(0)

    def deformed(self, name):
        o = self.mesh[name] if isinstance(name, str) else name
        dg = bpy.context.evaluated_depsgraph_get()
        ev = o.evaluated_get(dg)
        m = ev.to_mesh()
        mw = o.matrix_world
        V = np.array([tuple(mw @ v.co) for v in m.vertices])
        ev.to_mesh_clear()
        return V

    def faces(self, name):
        o = self.mesh[name]
        return [list(p.vertices) for p in o.data.polygons]

    def bone_mats(self):
        """deform matrices per bone (pose @ rest^-1) in world space, as used by linear blend skinning."""
        aw = self.arm.matrix_world
        out = {}
        for pb in self.arm.pose.bones:
            out[pb.name] = aw @ pb.matrix @ pb.bone.matrix_local.inverted() @ aw.inverted()
        return out

    def skin_linear(self, name):
        """per-vertex 3x3 linear part + translation of the blended skin matrix for the current pose (world, Blender axes)."""
        o = self.mesh[name]
        mats = self.bone_mats()
        gi = {g.index: g.name for g in o.vertex_groups}
        n = len(o.data.vertices)
        A = np.zeros((n, 3, 3))
        tv = np.zeros((n, 3))
        mw = o.matrix_world
        for v in o.data.vertices:
            ws = [(gi[g.group], g.weight) for g in v.groups if gi[g.group] in mats and g.weight > 0]
            tot = sum(w for _, w in ws) or 1.0
            M = Matrix(((0, 0, 0, 0), (0, 0, 0, 0), (0, 0, 0, 0), (0, 0, 0, 0)))
            for b, w in ws:
                M = M + mats[b] * (w / tot)
            M = M @ mw
            A[v.index] = np.array([[M[r][c] for c in range(3)] for r in range(3)])
            tv[v.index] = np.array([M[r][3] for r in range(3)])
        return A, tv


def dominant_groups(o):
    gi = {g.index: g.name for g in o.vertex_groups}
    out = []
    for v in o.data.vertices:
        best = max(((g.weight, gi[g.group]) for g in v.groups), default=(0, '-'))
        out.append(best[1])
    return out


def body_parts(ch):
    """BODY vertex classes from the runtime skin: legs (thigh/shin/foot dominant, or hips-dominant below the waist),
    hand_L/R, sleeve_L/R, torso, head."""
    o = ch.mesh['LOD0_G2_BODY']
    dom = dominant_groups(o)
    cls = []
    for v, d in zip(o.data.vertices, dom):
        z = v.co.z  # Blender up
        if d.startswith(('thigh', 'shin', 'foot')):
            cls.append('legs')
        elif d == 'hips' and z < 0.93:
            cls.append('legs')
        elif d.startswith('hand'):
            cls.append('hand_' + d[-1])
        elif d.startswith(('upper_arm', 'forearm')):
            cls.append('sleeve_' + d[-1])
        elif d in ('head', 'neck'):
            cls.append('head')
        else:
            cls.append('torso')
    return cls


def tris_of(F):
    out = []
    for f in F:
        for k in range(1, len(f) - 1):
            out.append((f[0], f[k], f[k + 1]))
    return out


def bvh(V, F):
    return BVHTree.FromPolygons([tuple(map(float, v)) for v in V], [tuple(f) for f in F])
