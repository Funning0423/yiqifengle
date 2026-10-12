# Extract the reading chair and the floor around it from the island visual GLB, in game world space (glTF: Y up, metres).
#   blender -b -P extract_chair.py -- <combined_visual_m.glb> <out.npz>
# Chair = faces of env_interior_props_merged whose vertices all lie inside the chair's oriented box (seat_anchor frame,
# local +Z = chair front); floor = env_interior_shell faces at y = 0 within 1.6 m of the seat.
import sys
import bpy
import bmesh
import numpy as np

a = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = a[0], a[1]
SEAT = np.array([0.4203000068664551, 0.3799999952316284, -4.2133002281188965])   # seat_anchor (FirstsliceFacts)
YAW = -2.0
BOX = dict(x=(-0.275, 0.275), y=(-0.01, 1.10), z=(-0.36, 0.30))                       # chair local, around the seat centre on the floor

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
Y2G = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], float)   # Blender (x, y, z) -> glTF (x, z, -y)


def world_tris(name):
    o = bpy.data.objects[name]
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.transform(o.matrix_world)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    V = np.array([v.co[:] for v in bm.verts]) @ Y2G.T
    F = np.array([[v.index for v in f.verts] for f in bm.faces], int)
    bm.free()
    return V, F


c, s = np.cos(YAW), np.sin(YAW)
RX = np.array([c, 0, -s])      # chair local +X in world
RZ = np.array([s, 0, c])       # chair local +Z (front) in world
origin = np.array([SEAT[0], 0.0, SEAT[2]])


def to_local(P):
    d = P - origin
    return np.stack([d @ RX, d[:, 1], d @ RZ], 1)


V, F = world_tris('env_interior_props_merged')
L = to_local(V)
inside = ((L[:, 0] > BOX['x'][0]) & (L[:, 0] < BOX['x'][1]) & (L[:, 1] > BOX['y'][0]) & (L[:, 1] < BOX['y'][1]) &
          (L[:, 2] > BOX['z'][0]) & (L[:, 2] < BOX['z'][1]))
fk = inside[F].all(1)
used = np.unique(F[fk])
remap = -np.ones(len(V), int)
remap[used] = np.arange(len(used))
chairV, chairF = V[used], remap[F[fk]]

V2, F2 = world_tris('env_interior_shell')
cen = V2[F2].mean(1)
fl = (np.abs(V2[F2][:, :, 1]).max(1) < 1e-3) & (np.hypot(cen[:, 0] - SEAT[0], cen[:, 2] - SEAT[2]) < 1.6)
used = np.unique(F2[fl])
remap = -np.ones(len(V2), int)
remap[used] = np.arange(len(used))
floorV, floorF = V2[used], remap[F2[fl]]
Lc = to_local(chairV)
print('CHAIR verts %d tris %d  local bbox min %s max %s' % (len(chairV), len(chairF), Lc.min(0).round(4), Lc.max(0).round(4)))
print('FLOOR verts %d tris %d' % (len(floorV), len(floorF)))
np.savez_compressed(OUT, chair_V=chairV, chair_F=chairF, floor_V=floorV, floor_F=floorF, seat=SEAT, yaw=YAW,
                    note='game world space (glTF Y up); chair local frame: origin = seat_anchor on the floor, +Z = chair front')
