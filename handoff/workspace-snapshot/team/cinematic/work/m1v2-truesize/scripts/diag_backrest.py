import bpy,sys,collections,numpy as np
sys.path.insert(0,'/workspace/wechat-game/team/cinematic/work/m1v2-truesize/scripts'); import clips, checker as C
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ck=C.Checker(); clips.activate('cine_open_stand')
ch=bpy.data.objects['CHAIR_REAL_reading_chair']; me=ch.data; me.calc_loop_triangles()
tris=[list(t.vertices) for t in me.loop_triangles if (lambda c:(c.y>0.17 and c.z>0.40))(sum((me.vertices[i].co for i in t.vertices),Vector())/3)]
BT=BVHTree.FromPolygons([ch.matrix_world@v.co for v in me.vertices],tris,all_triangles=True)
bx=ck.boxes['col_int_chair_back']; o=bx[0]
e=sorted([bx[i]-o for i in range(1,8)],key=np.linalg.norm); ax=[e[0]]
for v in e[1:]:
    if all(abs(np.dot(v,a))/(np.linalg.norm(v)*np.linalg.norm(a))<1e-3 for a in ax): ax.append(v)
    if len(ax)==3: break
M=np.array(ax).T; print('BOX dims mm',[round(float(np.linalg.norm(a))*1000,1) for a in ax])
for f in (0,15,32,45,50):
    bpy.context.scene.frame_set(f); bc,_=ck.ev(C.BODY,solid=False); T=ck.T; used=np.unique(T.ravel())
    loc=np.linalg.solve(M,(bc[used]-o).T).T; ins=(loc>0).all(1)&(loc<1).all(1)
    dom=collections.Counter(ck.dom[used[ins]]).most_common(4)
    dmin=1e9; 
    for vi in used[::3]:
        cp,nr,fi,dd=BT.find_nearest(Vector(bc[vi]),0.5)
        if cp is not None: dmin=min(dmin,dd)
    print('BACK',f,'proxy_inside',int(ins.sum()),dom,'min_dist_to_real_backrest_mm',round(dmin*1000,1))
