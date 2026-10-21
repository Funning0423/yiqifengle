import bpy, math, json, numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
def load(p):
    bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=p)
    d={}
    for o in bpy.data.objects:
        e=dict(type=o.type,parent=o.parent.name if o.parent else None,loc=tuple(round(x,5) for x in o.location),q=tuple(round(x,5) for x in o.rotation_quaternion),s=tuple(round(x,5) for x in o.scale))
        if o.type=='MESH': e['V']=np.array([tuple(o.matrix_world@v.co) for v in o.data.vertices]); e['nF']=len(o.data.polygons)
        d[o.name]=e
    return d
A=load('src/transport_balloon_893ac038.glb'); B=load('src/transport_balloon_b69faa60.glb')
print('names same',set(A)==set(B))
for n in A:
    a,b=A[n],B[n]
    for k in ('type','parent','loc','q','s','nF'):
        if a.get(k)!=b.get(k): print('DIFF',n,k,a.get(k),b.get(k))
    if 'V' in a:
        if a['V'].shape!=b['V'].shape: print('DIFF nV',n,a['V'].shape,b['V'].shape); continue
        dv=np.abs(a['V']-b['V']).max(1); ch=np.where(dv>1e-5)[0]
        print('mesh',n,'changed verts',len(ch), 'max',dv.max().round(4))
        for i in ch[:12]: print('   ',a['V'][i].round(4),'->',b['V'][i].round(4))
leaf=bpy.data.objects['basket_door_leaf']; bk=bpy.data.objects['balloon_basket']; door=bpy.data.objects['basket_door']; door.rotation_mode='XYZ'
BV=[bk.matrix_world@v.co for v in bk.data.vertices]; BP=[tuple(p.vertices) for p in bk.data.polygons]; bt=BVHTree.FromPolygons(BV,BP); BVa=np.array([tuple(v) for v in BV])
Lv=[v.co.copy() for v in leaf.data.vertices]; LP=[tuple(p.vertices) for p in leaf.data.polygons]
H=np.array([0.4,-0.84])
qa=json.load(open('qa_v3.json')); used=sorted(set(qa['door_deg']))
angs=sorted(set([round(x*0.1,1) for x in range(1001)]+used))
worst=[];res={}
for d in angs:
    door.rotation_euler=(0,0,math.radians(d)); bpy.context.view_layer.update(); W=leaf.matrix_world
    V=[W@v for v in Lv]; ov=bt.overlap(BVHTree.FromPolygons(V,LP))
    # basket verts inside leaf slab box (leaf-local: x -0.8..0, y 0..0.04 inner(blender +y), z .01..1.15)
    th=math.radians(d); dd=BVa[:,:2]-H; c,s=math.cos(-th),math.sin(-th); lx=c*dd[:,0]-s*dd[:,1]; ly=s*dd[:,0]+c*dd[:,1]
    ins=(lx>-0.8+1e-6)&(lx<-1e-6)&(ly>1e-6)&(ly<0.04-1e-6)&(BVa[:,2]>0.01+1e-6)&(BVa[:,2]<1.15-1e-6)
    md=min(bt.find_nearest(v)[3] for v in V)
    res[d]=(len(ov),int(ins.sum()),md)
    if len(ov) or ins.sum(): worst.append((d,len(ov),int(ins.sum()),round(md*1000,2)))
print('angles tested',len(angs),'incl used',len(used),'bad',len(worst),worst[:15])
print('min clearance mm', {k:round(res[k][2]*1000,2) for k in (0,0.1,0.2,0.5,0.7,1,2,5,10,50,100)})
print('used frames', [(d,res[d][0],res[d][1],round(res[d][2]*1000,2)) for d in used[:8]])
