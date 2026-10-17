import bpy, sys, json, numpy as np
sys.path.insert(0,'/workspace/wechat-game/team/cinematic/work/m1v2/scripts')
import poselib as P
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
bpy.ops.wm.open_mainfile(filepath='/workspace/wechat-game/team/cinematic/work/m1v2/scene/cine_m1_base.blend')
dg=bpy.context.evaluated_depsgraph_get()
def ev(n,solid=True,used_only=True):
    o=bpy.data.objects[n]
    for m in o.modifiers:
        if m.type=='SOLIDIFY': m.show_viewport=solid
    dg.update(); oe=o.evaluated_get(dg); me=oe.to_mesh()
    co=np.array([o.matrix_world@v.co for v in me.vertices]); me.calc_loop_triangles()
    tri=np.array([t.vertices[:] for t in me.loop_triangles]); oe.to_mesh_clear()
    if used_only:
        u=np.zeros(len(co),bool); u[tri.ravel()]=True; return co,tri,u
    return co,tri,None
P.reset(); P.apply_list(P.SIT); P.set_sk(1)
co,tri,u=ev(P.BODY)
b=bpy.data.objects[P.BODY]; vg=[g.name for g in b.vertex_groups]
W=np.zeros((len(b.data.vertices),len(vg)))
for v in b.data.vertices:
    for g in v.groups: W[v.index,g.group]=g.weight
dom=np.array(vg)[W.argmax(1)]
neg=u&(co[:,2]<0.0)
import collections
print('BELOW0',neg.sum(),collections.Counter(dom[neg]).most_common(5), co[neg].min(0) if neg.any() else None)
# rug / floor height near chair: props verts near chair
pm=bpy.data.objects['ENV_props_merged_minus_chair']
pc=np.array([pm.matrix_world@v.co for v in pm.data.vertices])
near=(np.hypot(pc[:,0]-0.4203,pc[:,1]-4.2133)<1.0)&(pc[:,2]<0.03)
print('PROPS low near chair z values',np.unique(np.round(pc[near,2],4))[:20], 'xy range',pc[near,:2].min(0) if near.any() else None,pc[near,:2].max(0) if near.any() else None)
# chair in char frame for given placement: char root world = Tw @ Rz(-2); chair world = chair_w; chair in char = inv(char)@chair_w
ch=bpy.data.objects['CHAIR_REAL_reading_chair']
cc=np.array([ch.matrix_world@v.co for v in ch.data.vertices]); ch.data.calc_loop_triangles(); ct=np.array([t.vertices[:] for t in ch.data.loop_triangles])
# chair local coords (front = -Y local)
cl=np.array([v.co[:] for v in ch.data.vertices])
print('CHAIR local bbox',cl.min(0),cl.max(0))
zs=np.unique(np.round(cl[:,2],4)); print('CHAIR z levels',zs)
# seat top surface y-extent at z=0.38
st=cl[np.abs(cl[:,2]-0.38)<0.003]; print('SEAT top verts y',st[:,1].min() if len(st) else None, st[:,1].max() if len(st) else None,'x',st[:,0].min() if len(st) else None,st[:,0].max() if len(st) else None)
# character in sit pose (char frame) underside of butt/thighs vs seat: for each placement compute min clearance
S=np.where(u & np.isin(dom,['hips','thigh.L','thigh.R']))[0]
pts=co[S]
for off in np.arange(-0.20,0.06,0.02):
    # chair local origin placed at char (0,off,0)? chair local -Y is front; char front is -Y => same orientation. seat centre at char y=off
    loc=pts-np.array([0,off,0])
    inseat=(np.abs(loc[:,0])<0.247)&(loc[:,1]>st[:,1].min())&(loc[:,1]<st[:,1].max())
    if inseat.any(): print('OFF',round(off,3),'butt/thigh min z over seat',round(loc[inseat,2].min(),4),'n',inseat.sum(),'back-most body y rel',round((co[u][:,1]-off).max(),3))
# where are body verts most posterior in seat zone
print('ANKLE',[round(x,4) for x in P.head('foot.L')])
fz=co[u&np.isin(dom,['foot.L','foot.R'])]; print('FEET minz',fz[:,2].min(),'y range',fz[:,1].min(),fz[:,1].max())
d,dt,du=ev(P.DRESS); print('DRESS sit y range',d[:,1].min(),d[:,1].max(),'minz',d[:,2].min())
sel=u&(co[:,2]<0.37)&(co[:,1]>-0.3)
print('LOWBACK n',sel.sum(),collections.Counter(dom[sel]).most_common(6),'y',co[sel,1].min() if sel.any() else None,co[sel,1].max() if sel.any() else None,'z',co[sel,2].min() if sel.any() else None,'x',co[sel,0].min() if sel.any() else None,co[sel,0].max() if sel.any() else None)
mats=[b.data.materials[p.material_index].name for p in b.data.polygons]
vm={}
for p in b.data.polygons:
    for v in p.vertices: vm[v]=b.data.materials[p.material_index].name
print('LOWBACK mats',collections.Counter(vm.get(i) for i in np.where(sel)[0]).most_common(5))
