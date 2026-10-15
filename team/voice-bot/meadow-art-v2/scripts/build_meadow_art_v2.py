# Voice Bot meadow windmill+path candidate builder. Self-made geometry, no external assets.
import bpy,sys,bmesh,math,random,json
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
src,dst=sys.argv[-2],sys.argv[-1]
random.seed(20261015)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
O=bpy.data.objects
UV={'path':(0.86,0.781),'stone':(0.4609,0.8203),'dstone':(0.0859,0.8203),'wood':(0.30,0.469),'dwood':(0.10,0.469),'cloth':(0.72,0.719),'dirt':(0.8047,0.5703)}
def add_box(bm,uvl,c,size,rot=Matrix.Identity(3),uv='stone'):
    sx,sy,sz=[s/2 for s in size]; vs=[]
    for dx in(-1,1):
        for dy in(-1,1):
            for dz in(-1,1): vs.append(bm.verts.new(c+rot@Vector((dx*sx,dy*sy,dz*sz))))
    F=[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)]
    for f in F:
        face=bm.faces.new([vs[i] for i in f])
        for l in face.loops: l[uvl].uv=UV[uv]
def add_pebble(bm,uvl,inv,q,R,uv):
    tmp=bmesh.new(); bmesh.ops.create_icosphere(tmp,subdivisions=1,radius=0.5)
    for v in tmp.verts:
        v.co=Vector((v.co.x*PSZ[0],v.co.y*PSZ[1],v.co.z*PSZ[2]))*random.uniform(.9,1.08)
    tilt=Matrix.Rotation(random.uniform(-.25,.25),3,'X')@Matrix.Rotation(random.uniform(-.25,.25),3,'Y')
    vm={}
    for v in tmp.verts: vm[v]=bm.verts.new(inv@(q+R@tilt@v.co))
    for f in tmp.faces:
        nf=bm.faces.new([vm[v] for v in f.verts])
        for l in nf.loops: l[uvl].uv=UV[uv]
    tmp.free()
def addto(obj,fn):
    bm=bmesh.new(); bm.from_mesh(obj.data); uvl=bm.loops.layers.uv[0]
    fn(bm,uvl); bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    bm.to_mesh(obj.data); bm.free(); obj.data.update()
# terrain BVH (world)
t=O['meadow_terrain']; tb=bmesh.new(); tb.from_mesh(t.data); tb.transform(t.matrix_world); bvh=BVHTree.FromBMesh(tb)
def ground(x,y):
    h=bvh.ray_cast(Vector((x,y,200)),Vector((0,0,-1))); return h[0].z
report={}
# ---- 1. sails: lattice battens + spar edges (local space; anim rotates object so untouched)
s=O['windmill_sails']; n0=len(s.data.vertices)
def sails(bm,uvl):
    for ang in range(4):
        R=Matrix.Rotation(math.radians(90*ang),3,'Y')
        for r in [1.45+0.25*i for i in range(19)]:
            add_box(bm,uvl,R@Vector((r,0.07,0.45)),(0.06,0.07,1.3),R,'dwood')   # dense cross battens
        for zz in (1.08,0.45,-0.18):
            add_box(bm,uvl,R@Vector((3.75,0.08,zz)),(4.7,0.07,0.08),R,'dwood')   # longitudinal spars (outer/mid/inner)
    # hub cap
    add_box(bm,uvl,Vector((0,0.12,0)),(0.7,0.25,0.7),Matrix.Identity(3),'dwood')
addto(s,sails); report['sails_verts']=(n0,len(s.data.vertices))
# ---- 2. windmill base: door step + stone footing stones at door, grounded
w=O['windmill_static_merged']; n0=len(w.data.vertices); wm=w.matrix_world; wi=wm.inverted()
door=O['windmill_door_point'].matrix_world.translation.copy()
steps=[]
def base(bm,uvl):
    g=ground(door.x,door.y+0.35)
    c=Vector((door.x,door.y+0.35,g+0.06)); steps.append(('door_step',c.z-0.12-g))
    add_box(bm,uvl,wi@c,(1.8,0.7,0.24),wi.to_3x3().normalized(),'stone')
    for i,(dx) in enumerate([-1.45,-1.05,1.05,1.45]):
        x=door.x+dx; y=door.y+0.6+random.uniform(-.1,.1); g=ground(x,y)
        c=Vector((x,y,g+0.08)); steps.append((f'door_stone_{i}',0.08-0.15))
        R=Matrix.Rotation(random.uniform(-.4,.4),3,'Z')
        add_box(bm,uvl,wi@c,(0.38,0.32,0.3),(wi.to_3x3().normalized())@R,'dstone')
report['windmill_static']='unchanged (v1 door-step stones removed: overlapped existing wooden steps)'
# ---- 3. path: rebuild conforming strip along walk_path, plus edge stones
pts=[O[f'walk_path_{i:02d}'].matrix_world.translation.copy() for i in range(23)]
def cr(p0,p1,p2,p3,t): return 0.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t**3)
P=[pts[0]]+pts+[pts[-1]]; cl=[]
for i in range(1,len(P)-2):
    for k in range(6): cl.append(cr(P[i-1],P[i],P[i+1],P[i+2],k/6))
cl.append(pts[-1])
p=O['meadow_path']; pm=p.matrix_world; pi_=pm.inverted()
bm=bmesh.new(); uvl=bm.loops.layers.uv.new('UVMap')
W=0.95; prof=[(-1,0.035),(-0.82,0.05),(0,0.06),(0.82,0.05),(1,0.035)]
rows=[]; clear=[]
for i,c in enumerate(cl):
    d=(cl[min(i+1,len(cl)-1)]-cl[max(i-1,0)]); d.z=0; d.normalize(); nrm=Vector((-d.y,d.x,0))
    wob=W*(1+0.08*math.sin(i*0.7))
    row=[]
    for a,off in prof:
        q=c+nrm*a*wob; g=ground(q.x,q.y); clear.append(off); row.append(bm.verts.new(pi_@Vector((q.x,q.y,g+off))))
    rows.append(row)
for i in range(len(rows)-1):
    for j in range(4):
        f=bm.faces.new([rows[i][j],rows[i][j+1],rows[i+1][j+1],rows[i+1][j]])
        for l in f.loops: l[uvl].uv=UV['path'] if 0<j<3 else UV['dirt']
# edge stones
acc=0; ns=0; side=1; stone_chk=[]; stone_sizes=[]
cur_sz=[None]
for i in range(1,len(cl)):
    acc+=(cl[i]-cl[i-1]).length
    if acc>1.3 and 6<i<len(cl)-8:
        acc=0; side=-side
        d=(cl[i+1]-cl[i-1]); d.z=0; d.normalize(); nrm=Vector((-d.y,d.x,0))
        q=cl[i]+nrm*side*(W*1.12+random.uniform(0,.15))
        sc_=random.uniform(0.6,1.5); sz=(0.32*sc_*random.uniform(.85,1.2),0.26*sc_*random.uniform(.8,1.1),0.2*sc_*random.uniform(.7,1.0))
        rr=max(sz[0],sz[1])/2
        gs=[ground(q.x+dx*rr,q.y+dy*rr) for dx in(-1,0,1) for dy in(-1,0,1)]
        z=min(gs)-0.06+sz[2]*0.35   # bottom (z-sz/2) sits >=4cm below lowest ground under footprint
        stone_chk.append(round(z-sz[2]/2-min(gs),3)); stone_sizes.append(round(sc_,2))
        q=Vector((q.x,q.y,z)); global PSZ; PSZ=sz
        R=Matrix.Rotation(random.uniform(0,3.14),3,'Z')
        add_pebble(bm,uvl,pi_,q,R,random.choice(['stone','dstone'])); ns+=1
bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
old=p.data; me=bpy.data.meshes.new('meadow_path'); bm.to_mesh(me); bm.free()
me.materials.append(old.materials[0]); p.data=me
report['path']={'verts':len(me.vertices),'clearance_m_min':min(clear),'edge_stones':ns,'stone_bottom_minus_lowest_ground_max_m':max(stone_chk),'stone_scale_range':[min(stone_sizes),max(stone_sizes)]}
bpy.ops.object.select_all(action='DESELECT')
for n in ('meadow_path','windmill_static_merged','windmill_sails'):
    o=O[n]; o.parent=None; o.matrix_world=Matrix.Identity(4); o.animation_data_clear(); o.select_set(True)
bpy.ops.export_scene.gltf(filepath=dst,export_format='GLB',use_selection=True,export_animations=False,export_yup=True,export_materials='PLACEHOLDER')
json.dump(report,open(dst+'.build_report.json','w'),indent=1); print("REPORT",json.dumps(report))
