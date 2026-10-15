# v7 builder (Blender). Input v6 glb. Outputs:
#  parts_wm.glb   : windmill_static_merged + windmill_sails with UVs remapped to new palette cells
#  life_<group>.glb: new nodes + one animation each (flowers static, butterflies, birds, flag)
#  v74_cells.json  : new palette cells (pixel blocks + colours) ; v74_ground_map.json : world->ground texture mapping
import bpy,sys,bmesh,math,random,json,os
from mathutils import Vector,Matrix,Euler
from mathutils.bvhtree import BVHTree
src,outd=sys.argv[-2],sys.argv[-1]; random.seed(7171)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene; sc.render.fps=24
bpy.ops.import_scene.gltf(filepath=src)
O=bpy.data.objects
# ---------- new palette cells: 8x8 blocks in free column x=0..7 (blocks (0,2k)) and x=16..23 (blocks (2,2k)) ----------
NEW={'cream':(1.00,0.87,0.64),'cream2':(0.97,0.80,0.57),'brick':(0.86,0.40,0.22),'brick_dark':(0.66,0.29,0.18),
     'lwood':(0.84,0.66,0.42),'lwood2':(0.72,0.53,0.32),'teal':(0.16,0.62,0.64),'teal_dark':(0.10,0.45,0.48),
     'canvas_w':(0.99,0.95,0.86),'fl_yellow':(0.98,0.84,0.22),'fl_pink':(0.96,0.55,0.72),'fl_white':(0.98,0.97,0.93),
     'stem':(0.33,0.60,0.24),'bird':(0.22,0.24,0.28),'flag_red':(0.90,0.25,0.20),'bfly_orange':(0.98,0.58,0.18),
     'shade_1':(0.21,0.38,0.11),'shade_2':(0.16,0.30,0.09)}
cells={}; i=0
for k in NEW:
    bx,by=(0,2*i) if i<8 else ((2,2*(i-8)) if i<16 else (4,2*(i-16))); i+=1
    cells[k]={'block_px_x':bx*8,'block_px_y_from_bottom':by*8,'rgb':NEW[k],'uv':((bx*8+4)/256,(by*8+4)/256)}
UV={k:v['uv'] for k,v in cells.items()}
json.dump(cells,open(os.path.join(outd,'v74_cells.json'),'w'),indent=1)
# ---------- windmill recolour by original palette cell ----------
WMAP={(0.591,0.469):'cream2',(0.639,0.594):'brick',(0.3,0.594):'brick_dark',(0.38,0.469):'lwood',(0.78,0.469):'lwood',
 (0.348,0.594):'brick',(0.645,0.594):'brick',(0.45,0.594):'brick_dark',
 (0.516,0.719):'cream',(0.62,0.719):'cream',(0.7,0.719):'cream',(0.82,0.719):'cream',(0.42,0.719):'cream2',(0.3,0.719):'cream2',
 (0.25,0.469):'teal',(0.45,0.469):'teal_dark',(0.05,0.469):'teal_dark',(0.3,0.469):'teal',(0.5,0.469):'teal_dark',(0.1,0.469):'teal_dark',
 (0.55,0.469):'lwood2',(0.75,0.469):'lwood',(0.35,0.469):'lwood2'}
SMAP={(0.3,0.469):'lwood2',(0.1,0.469):'lwood',(0.979,0.889):'canvas_w'}
rep={'windmill_remap':{},'sails_remap':{}}
def remap(obj,M,key):
    uv=obj.data.uv_layers[0].data; cnt={}
    for p in obj.data.polygons:
        u=uv[p.loop_indices[0]].uv; k=(round(u.x,3),round(u.y,3))
        if k in M:
            for li in p.loop_indices: uv[li].uv=UV[M[k]]
            cnt[str(k)+'->'+M[k]]=cnt.get(str(k)+'->'+M[k],0)+1
    rep[key]=cnt
remap(O['windmill_static_merged'],WMAP,'windmill_remap'); remap(O['windmill_sails'],SMAP,'sails_remap')
# ground mapping from terrain (Blender uv -> world)
t=O['meadow_terrain']; tuv=t.data.uv_layers[0].data; pts=[]
for p in list(t.data.polygons)[::997]:
    li=p.loop_indices[0]; w=t.matrix_world@t.data.vertices[t.data.loops[li].vertex_index].co; pts.append((w.x,w.y,tuv[li].uv.x,tuv[li].uv.y))
json.dump(pts,open(os.path.join(outd,'v74_ground_map.json'),'w'))
tb=bmesh.new(); tb.from_mesh(t.data); tb.transform(t.matrix_world); bvh=BVHTree.FromBMesh(tb)
def ground(x,y): h=bvh.ray_cast(Vector((x,y,200)),Vector((0,0,-1))); return h[0].z
# export windmill meshes
def export(objs,path,anim=False,frames=None,step=1):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    kw=dict(filepath=path,export_format='GLB',use_selection=True,export_yup=True,export_materials='PLACEHOLDER')
    if anim:
        sc.frame_start,sc.frame_end=frames
        kw.update(export_animations=True,export_animation_mode='SCENE',export_force_sampling=True,export_optimize_animation_size=True,export_frame_range=True,export_frame_step=step)
    else: kw.update(export_animations=False)
    bpy.ops.export_scene.gltf(**kw)
for n in ('windmill_static_merged','windmill_sails'):
    o=O[n]; o.animation_data_clear(); o.parent=None; o.matrix_world=Matrix.Identity(4)
export([O['windmill_static_merged'],O['windmill_sails']],os.path.join(outd,'parts_wm.glb'))
# path centreline (for flowers placement)
cl=[O[f'walk_path_{i:02d}'].matrix_world.translation.copy() for i in range(23)]
def dist_path(x,y):
    best=1e9
    for a,b in zip(cl,cl[1:]):
        a2=Vector((a.x,a.y));b2=Vector((b.x,b.y));p=Vector((x,y));d=b2-a2;t_=max(0,min(1,(p-a2).dot(d)/d.length_squared)); best=min(best,(a2+d*t_-p).length)
    return best
# remove everything else from scene for life exports
keep=set()
for o in list(bpy.data.objects): bpy.data.objects.remove(o,do_unlink=True)
def new_mesh_obj(name,bm):
    me=bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); ob=bpy.data.objects.new(name,me); sc.collection.objects.link(ob); return ob
def tri_uv(bm):
    return bm.loops.layers.uv.get('UVMap') or bm.loops.layers.uv.new('UVMap')
def face(bm,uvl,vs,uvk):
    f=bm.faces.new(vs)
    for l in f.loops: l[uvl].uv=UV[uvk]
    return f
# ---------- flowers v7.1: many small clumps along the path, smaller heads (~60%), random size/yaw/tilt, petals with thickness ----------
bm=bmesh.new(); uvl=tri_uv(bm); clumps=[]
for k in range(9):   # windmill base ring, avoid door/path side
    a=math.radians(-60+k*(300/8)+random.uniform(-8,8))
    if -110<math.degrees(a)%360-0<-70: continue
    r=random.uniform(3.6,4.6); clumps.append((r*math.cos(a),30+r*math.sin(a),random.randint(5,8)))
cl_dense=[]
for i in range(len(cl)-1):
    for s in range(4): cl_dense.append(cl[i].lerp(cl[i+1],s/4))
for j in range(1,len(cl_dense)-6,2):
    c=cl_dense[j]; d=(cl_dense[j+1]-cl_dense[j-1]); d.z=0; d.normalize(); nrm=Vector((-d.y,d.x,0))
    side=random.choice((-1,1)) if random.random()<0.35 else (1 if (j//2)%2 else -1)
    p=c+d*random.uniform(-.6,.6)+nrm*side*random.uniform(1.7,2.6); clumps.append((p.x,p.y,random.randint(5,9)))
placed=0; rejected=0
def petal_ring(top,R,yaw,tilt,thick,col):
    # v7.2: single-sided cupped petal fan (palette material is doubleSided) - no back layer, no side walls; 10-vert lobed rim
    M=Euler((tilt,0,yaw)).to_matrix()
    up=M@Vector((0,0,1)); cen_t=bm.verts.new(top+up*.004)
    npet=5; outer_t=[]
    for q in range(npet*2):
        an=q*2*math.pi/(npet*2); rr=R*(1.0 if q%2==0 else 0.55)
        p=M@Vector((rr*math.cos(an),rr*math.sin(an),0)); bend=Vector((0,0,0.18*rr))
        outer_t.append(bm.verts.new(top+p+M@bend))
    n=len(outer_t)
    for q in range(n): face(bm,uvl,[cen_t,outer_t[q],outer_t[(q+1)%n]],col)
    cc=top+up*.007; r2=R*0.3
    c2=[bm.verts.new(cc+M@Vector((r2*math.cos(k2*2*math.pi/5),r2*math.sin(k2*2*math.pi/5),0))) for k2 in range(5)]
    face(bm,uvl,c2,'fl_yellow' if col!='fl_yellow' else 'bfly_orange')
for cx,cy,nf in clumps:
    rad=random.uniform(.22,.38)
    for _ in range(nf):
        x=cx+random.gauss(0,rad*.6); y=cy+random.gauss(0,rad*.6)
        if dist_path(x,y)<1.45 or (abs(x)<1.8 and 24.3<y<27.6) or math.hypot(x,y-30)<3.35 or (1.6<x<7.6 and 28.1<y<33.1): rejected+=1; continue
        g=ground(x,y); sz=random.uniform(.62,.88); h=random.uniform(.10,.20)*(0.8+0.4*sz)
        col=random.choice(['fl_yellow','fl_pink','fl_white','fl_yellow','fl_pink'])
        b0=Vector((x,y,g-0.04)); top=Vector((x+random.uniform(-.04,.04),y+random.uniform(-.04,.04),g+h))
        s1=bm.verts.new(b0+Vector((.009,0,0))); s2=bm.verts.new(b0+Vector((-.009,0,0))); s3=bm.verts.new(top)
        face(bm,uvl,[s1,s2,s3],'stem'); s4=bm.verts.new(b0+Vector((0,.009,0))); s5=bm.verts.new(b0+Vector((0,-.009,0))); face(bm,uvl,[s4,s5,s3],'stem')
        R=random.uniform(.08,.12)*sz
        tilt=math.radians(random.uniform(30,65)); yaw=random.gauss(0,0.7)  # mostly faces camera (-Y), randomised
        petal_ring(top,R,math.pi+yaw*0.5 if False else yaw,tilt,0.012,col)
        placed+=1
bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
fl=new_mesh_obj('meadow_vb_flowers',bm); fl.data.shade_smooth(); rep['flowers']={'clumps':len(clumps),'flowers':placed,'rejected_near_path_or_door':rejected,'verts':len(fl.data.vertices)}
export([fl],os.path.join(outd,'life_flowers.glb')); bpy.data.objects.remove(fl)
# ---------- contact shadow ring at tower base (new static node) ----------
bm=bmesh.new(); uvl=tri_uv(bm); NS=40; rings=[(3.05,'shade_2'),(3.55,'shade_1')]; R0=2.95
prev=None
for ri,(rr,ck) in enumerate([(R0,None)]+rings):
    cur=[]
    for q in range(NS):
        a=q*2*math.pi/NS; x=rr*math.cos(a); y=30+rr*math.sin(a); cur.append(bm.verts.new((x,y,ground(x,y)+0.03)))
    if prev:
        for q in range(NS): face(bm,uvl,[prev[q],prev[(q+1)%NS],cur[(q+1)%NS],cur[q]],ck)
    prev=cur
ringo=new_mesh_obj('meadow_vb_tower_contact_shadow',bm); rep['contact_ring_verts']=len(ringo.data.vertices)
export([ringo],os.path.join(outd,'life_contact.glb')); bpy.data.objects.remove(ringo)
# ---------- helpers for animated groups ----------
def wing_mesh(name,span,chord,uvk,sign):
    # v7.4: two-lobed wing (forewing + hindwing), each lobe = coloured inner fan + dark rim band ('bird') + 2 light spots ('fl_white')
    bm=bmesh.new(); uvl=tri_uv(bm)
    def lobe(pts,spots):
        root=Vector((0,0,0)); outer=[Vector((sign*x*span,y*chord,0)) for x,y in pts]
        inner=[root.lerp(p,0.74) for p in outer]
        rv=bm.verts.new(root); ov=[bm.verts.new(p) for p in outer]; iv=[bm.verts.new(p) for p in inner]
        n=len(outer)
        for q in range(n-1):
            f=[rv,iv[q],iv[q+1]]; face(bm,uvl,f if sign>0 else f[::-1],uvk)
            f=[iv[q],ov[q],ov[q+1],iv[q+1]]; face(bm,uvl,f if sign>0 else f[::-1],'bird')
        for sx,sy,sr in spots:   # small diamond spot, lifted 3 mm to avoid z-fight
            c=Vector((sign*sx*span,sy*chord,0.003)); d=[bm.verts.new(c+Vector(v)) for v in ((sr*span,0,0),(0,sr*chord,0),(-sr*span,0,0),(0,-sr*chord,0))]
            face(bm,uvl,d if sign>0 else d[::-1],'fl_white')
    lobe([(0.15,0.55),(0.55,0.62),(0.95,0.45),(1.0,0.15),(0.75,-0.02),(0.3,-0.05)],[(0.8,0.4,0.07),(0.6,0.5,0.05)])
    lobe([(0.25,-0.1),(0.7,-0.15),(0.78,-0.45),(0.5,-0.7),(0.15,-0.55)],[(0.55,-0.42,0.06)])
    return new_mesh_obj(name,bm)
def body_mesh(name,L,uvk):
    bm=bmesh.new(); uvl=tri_uv(bm); p=[bm.verts.new(v) for v in [(0,L/2,0),(0.022,-L/2,0),(-0.022,-L/2,0),(0,-L/2,0.03)]]
    for f in ([0,1,2],[0,3,1],[0,2,3],[1,3,2]): face(bm,uvl,[p[i] for i in f],uvk)
    return new_mesh_obj(name,bm)
def key(o,f):
    o.keyframe_insert('location',frame=f); o.keyframe_insert('rotation_euler',frame=f)
# ---------- butterflies: loop 8 s @24fps = 192 frames, wing flap 6 Hz -> 48 cycles ----------
N=int(os.environ.get('BF_N','192')); objs=[]; BF0_SPAN=float(os.environ.get('BF0_SPAN','0.19')); BF0_D=float(os.environ.get('BF0_D','13.5'))
cols=['fl_yellow','bfly_orange','fl_white']
centres=[(-1.6,-15.5),(1.4,-13.0),(-0.4,-10.5)]
# v7.3: meadow_butterfly_00 path defined in meadowScenePose camera space (right, up, depth m) -> world. Crosses the frame L->R at 4.3-5 m in 0-2.7 s, then loops off-screen around/behind the camera; Catmull-Rom closed loop = seamless 8 s.
_CP=Vector((9,-42,19)); _CT=Vector((0.3274661665889038,15.81687522999821,5.509406509325702)); _F=(_CT-_CP).normalized(); _R=_F.cross(Vector((0,0,1))).normalized(); _U=_R.cross(_F)
_D=BF0_D; _tx=0.2125; _ty=0.4602   # tan of half FOV (horizontal at 540/1170, vertical)
_CAMWP=[(xs*_D*_tx,ys*_D*_ty,_D) for xs,ys in ((-1.25,-0.30),(-0.6,-0.22),(0.0,-0.32),(0.6,-0.24),(1.25,-0.30))]+[(0.5*_D,-0.2*_D,0.9*_D),(0.9*_D,0,0.3*_D),(0.7*_D,0.15*_D,-0.3*_D),(0,0.2*_D,-0.5*_D),(-0.7*_D,0.15*_D,-0.3*_D),(-0.9*_D,0,0.3*_D),(-0.5*_D,-0.2*_D,0.9*_D)]
WP=[tuple(_CP+_R*r+_U*u+_F*d) for r,u,d in _CAMWP]
def crpath(u):
    n=len(WP); s_=(u%1.0)*n; i0=int(s_); tt=s_-i0
    P=[Vector(WP[(i0+k)%n]) for k in (-1,0,1,2)]
    v=0.5*((2*P[1])+(-P[0]+P[2])*tt+(2*P[0]-5*P[1]+4*P[2]-P[3])*tt*tt+(-P[0]+3*P[1]-3*P[2]+P[3])*tt**3)
    return v.x,v.y,v.z
for bi in range(3):
    sp=BF0_SPAN if bi==0 else 0.3; body=body_mesh(f'meadow_butterfly_{bi:02d}',0.24*sp/0.3,'bird'); objs.append(body)
    wl=wing_mesh(f'meadow_butterfly_{bi:02d}_wing_L',sp,sp*1.1,cols[bi],-1); wr=wing_mesh(f'meadow_butterfly_{bi:02d}_wing_R',sp,sp*1.1,cols[bi],1)
    wl.parent=body; wr.parent=body; objs+= [wl,wr]
    cx,cy=centres[bi]; gz=ground(cx,cy); ph=bi*2.1
    for f in range(N+1):
        t=f/N*2*math.pi
        if bi==0:   # v7.1: closed path that crosses close in front of the gameplay camera at ~0.4-2.6 s
            x,y,z=crpath(f/N); z=z+0.04*math.sin(40*t); x2,y2,_=crpath((f+1)/N); dx,dy=x2-x,y2-y
        else:
            x=cx+1.1*math.sin(t+ph); y=cy+0.7*math.sin(2*t+ph); z=gz+0.75+0.25*math.sin(3*t+ph)+0.06*math.sin(40*t)
            dx=1.1*math.cos(t+ph); dy=1.4*math.cos(2*t+ph)
        body.location=(x,y,z); body.rotation_euler=(0,0,math.atan2(dy,dx)-math.pi/2); key(body,f+1)
        flap=math.radians(5+70*(0.5+0.5*math.sin(40*t)))   # v7.4: 40 flaps / 8 s = 0.2 s period
        wl.location=(0,0,0); wr.location=(0,0,0); wl.rotation_euler=(0,-flap,0); wr.rotation_euler=(0,flap,0); key(wl,f+1); key(wr,f+1)
for o in objs:
    for fc in o.animation_data.action.fcurves if hasattr(o.animation_data.action,'fcurves') else []:
        for kp in fc.keyframe_points: kp.interpolation='LINEAR'
_fps=sc.render.fps; sc.render.fps=round(N/8); export(objs,os.path.join(outd,'life_butterflies.glb'),True,(1,N+1)); sc.render.fps=_fps
bf_names=[o.name for o in objs]
for o in objs: bpy.data.objects.remove(o)
# ---------- birds: loop 20 s = 480 frames; v7.1: flock root x -32 -> +58 at y~120 z~48 (enters view ~3 s, wraps outside view); flap 1.5 Hz (30 cycles) ----------
N=480; root=bpy.data.objects.new('meadow_birds_root',None); sc.collection.objects.link(root); objs=[root]
offs=[(0,0,0),(-3.5,2.0,-1.0),(-3.2,-2.2,0.8),(-7,3.8,-1.6),(-6.6,-4.1,0.4)]
birds=[]
for k,(ox,oy,oz) in enumerate(offs):
    b=body_mesh(f'meadow_bird_{k:02d}',0.9,'bird'); b.parent=root; b.location=(ox,oy,oz); b.rotation_euler=(0,0,-math.pi/2)
    wl=wing_mesh(f'meadow_bird_{k:02d}_wing_L',1.8,0.6,'bird',-1); wr=wing_mesh(f'meadow_bird_{k:02d}_wing_R',1.8,0.6,'bird',1)
    wl.parent=b; wr.parent=b; objs+=[b,wl,wr]; birds.append((b,wl,wr,k))
for f in range(N+1):
    t=f/N
    root.location=(-32+90*t,120+6*math.sin(2*math.pi*t),48+2.5*math.sin(4*math.pi*t)); root.rotation_euler=(0,0,0); key(root,f+1)
    for b,wl,wr,k in birds:
        ph=k*0.7; s=math.sin(2*math.pi*30*t+ph)
        b.location=(offs[k][0],offs[k][1],offs[k][2]+0.25*math.sin(2*math.pi*2*t+ph)); key(b,f+1)
        a=math.radians(8+35*(0.5+0.5*s)); wl.rotation_euler=(0,-a,0); wr.rotation_euler=(0,a,0); key(wl,f+1); key(wr,f+1)
export(objs,os.path.join(outd,'life_birds.glb'),True,(1,N+1),2); bd_names=[o.name for o in objs]
for o in objs: bpy.data.objects.remove(o)
# ---------- flag on windmill roof apex: loop 2 s = 48 frames ----------
N=48; apex=Vector((0,30,6.462+12.3))
bm=bmesh.new(); uvl=tri_uv(bm); r=0.03; h=1.7
vs=[bm.verts.new((r*math.cos(a),r*math.sin(a),-0.25)) for a in (0,2.1,4.2)]+[bm.verts.new((r*math.cos(a),r*math.sin(a),h)) for a in (0,2.1,4.2)]
for q in range(3): face(bm,uvl,[vs[q],vs[(q+1)%3],vs[3+(q+1)%3],vs[3+q]],'lwood2')
face(bm,uvl,[vs[3],vs[4],vs[5]],'lwood2')
pole=new_mesh_obj('windmill_flag_pole',bm); pole.location=apex; objs=[pole]; segs=[]; parent=pole
for s in range(3):
    bm=bmesh.new(); uvl=tri_uv(bm); w=0.3; tp=1.65; bt=1.15-0.06*s
    q=[bm.verts.new(v) for v in [(0,0,tp),(w,0,tp-0.02*(s+1)),(w,0,bt+0.03),(0,0,bt)]]
    face(bm,uvl,q,'flag_red')
    seg=new_mesh_obj(f'windmill_flag_seg_{s}',bm); seg.parent=parent; seg.location=(0.04,0,0)
    if s>0: seg.location=(w,0,0)
    objs.append(seg); segs.append(seg); parent=seg
for f in range(N+1):
    t=f/N*2*math.pi; key(pole,f+1)
    for s,seg in enumerate(segs):
        seg.rotation_euler=(0,0,math.radians((12+6*s)*math.sin(t-1.1*s)) + (math.radians(-35) if s==0 else 0)); key(seg,f+1)
export(objs,os.path.join(outd,'life_flag.glb'),True,(1,N+1)); fg_names=[o.name for o in objs]
rep['new_nodes']={'flowers':['meadow_vb_flowers'],'butterflies':bf_names,'birds':bd_names,'flag':fg_names}
json.dump(rep,open(os.path.join(outd,'v74_build_report.json'),'w'),indent=1); print("REPORT",json.dumps(rep)[:1500])
