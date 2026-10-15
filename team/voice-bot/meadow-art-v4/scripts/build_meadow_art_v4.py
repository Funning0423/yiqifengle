# Voice Bot meadow windmill+path candidate builder. Self-made geometry, no external assets.
import bpy,sys,bmesh,math,random,json
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
src,dst=sys.argv[-2],sys.argv[-1]
random.seed(20261015)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
O=bpy.data.objects
UV={'path':(0.86,0.781),'stone':(0.4609,0.8203),'dstone':(0.0859,0.8203),'wood':(0.30,0.469),'dwood':(0.10,0.469),'cloth':(0.72,0.719),'dirt':(0.2402,0.5645),'pathv3':(0.2637,0.0176),'canvas4':(0.9785,0.8887),'lstone':(0.3145,0.6895)}
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
    # v4 (canvas z 0.49..1.16 = 58% of lattice width 1.16): rebuild all 4 blades identically (original boards removed): stock + front lattice + half canvas behind lattice
    bmesh.ops.delete(bm,geom=list(bm.verts),context='VERTS')
    I=Matrix.Identity(3)
    for k in range(4):
        R=Matrix.Rotation(math.radians(90*k),3,'Y')
        add_box(bm,uvl,R@Vector((3.1,0,0)),(6.2,0.16,0.16),R,'wood')          # stock y -0.08..0.08
        for i in range(17):                                                       # crossbars y -0.135..-0.085
            r=1.3+0.3*i
            add_box(bm,uvl,R@Vector((r,-0.11,0.62)),(0.05,0.05,1.16),R,'dwood')
        for zz in (0.06,0.62,1.18):                                               # rails y -0.165..-0.115
            add_box(bm,uvl,R@Vector((3.7,-0.14,zz)),(4.9,0.05,0.06),R,'dwood')
        add_box(bm,uvl,R@Vector((3.7,0.0,0.825)),(4.8,0.02,0.67),R,'canvas4')         # canvas y -0.01..0.01, z 0.65..1.15, behind lattice, clear of stock(z<=0.08)
    add_box(bm,uvl,Vector((0,-0.14,0)),(0.6,0.2,0.6),I,'dwood')                  # hub cap
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
W=1.14; prof=[(-1,0.035),(-0.72,0.05),(0,0.06),(0.72,0.05),(1,0.035)]
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
        for l in f.loops: l[uvl].uv=UV['pathv3'] if 0<j<3 else UV['dirt']
# edge stones
acc=0; ns=0; side=1; stone_chk=[]; stone_sizes=[]
cur_sz=[None]
for i in range(1,len(cl)):
    acc+=(cl[i]-cl[i-1]).length
    if acc>1.3 and 6<i<len(cl)-8:
        acc=0; side=-side
        d=(cl[i+1]-cl[i-1]); d.z=0; d.normalize(); nrm=Vector((-d.y,d.x,0))
        q=cl[i]+nrm*side*(W*1.12+random.uniform(0,.15))
        sc_=1.4*random.uniform(0.7,1.5); sz=(0.32*sc_*random.uniform(.85,1.2),0.26*sc_*random.uniform(.8,1.1),0.2*sc_*random.uniform(.7,1.0))
        rr=max(sz[0],sz[1])/2
        gs=[ground(q.x+dx*rr,q.y+dy*rr) for dx in(-1,0,1) for dy in(-1,0,1)]
        z=min(gs)-0.06+sz[2]*0.35   # bottom (z-sz/2) sits >=4cm below lowest ground under footprint
        stone_chk.append(round(z-sz[2]/2-min(gs),3)); stone_sizes.append(round(sc_,2))
        q=Vector((q.x,q.y,z)); global PSZ; PSZ=sz
        R=Matrix.Rotation(random.uniform(0,3.14),3,'Z')
        add_pebble(bm,uvl,pi_,q,R,random.choice(['lstone','lstone','stone'])); ns+=1
bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
old=p.data; me=bpy.data.meshes.new('meadow_path'); bm.to_mesh(me); bm.free()
me.materials.append(old.materials[0]); p.data=me
report['path']={'verts':len(me.vertices),'clearance_m_min':min(clear),'edge_stones':ns,'stone_bottom_minus_lowest_ground_max_m':max(stone_chk),'stone_scale_range':[min(stone_sizes),max(stone_sizes)]}
bpy.ops.object.select_all(action='DESELECT')
for n in ('meadow_path','windmill_static_merged','windmill_sails'):
    o=O[n]; o.parent=None; o.matrix_world=Matrix.Identity(4); o.animation_data_clear(); o.select_set(True)
bpy.ops.export_scene.gltf(filepath=dst,export_format='GLB',use_selection=True,export_animations=False,export_yup=True,export_materials='PLACEHOLDER')
json.dump(report,open(dst+'.build_report.json','w'),indent=1); print("REPORT",json.dumps(report))
