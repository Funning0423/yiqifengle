# v7 builder (Blender). Input v6 glb. Outputs:
#  parts_wm.glb   : windmill_static_merged + windmill_sails with UVs remapped to new palette cells
#  life_<group>.glb: new nodes + one animation each (flowers static, butterflies, birds, flag)
#  v71_cells.json  : new palette cells (pixel blocks + colours) ; v71_ground_map.json : world->ground texture mapping
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
json.dump(cells,open(os.path.join(outd,'v71_cells.json'),'w'),indent=1)
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
json.dump(pts,open(os.path.join(outd,'v71_ground_map.json'),'w'))
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
    M=Euler((tilt,0,yaw)).to_matrix()
    up=M@Vector((0,0,1)); cen_t=bm.verts.new(top+up*(thick+.004)); cen_b=bm.verts.new(top-up*.002)
    npet=5; outer_t=[];outer_b=[];inner_t=[]
    for q in range(npet*3):
        an=q*2*math.pi/(npet*3); rr=R*(0.5+0.5*abs(math.cos(npet*an/2)))   # rounded petal lobes
        p=M@Vector((rr*math.cos(an),rr*math.sin(an),0)); bend=Vector((0,0,0.18*rr))  # cupped petals
        outer_t.append(bm.verts.new(top+p+M@bend+up*thick)); outer_b.append(bm.verts.new(top+p+M@bend))
    n=len(outer_t)
    for q in range(n):
        face(bm,uvl,[cen_t,outer_t[q],outer_t[(q+1)%n]],col)
        face(bm,uvl,[cen_b,outer_b[(q+1)%n],outer_b[q]],col)
        if q%3!=2: face(bm,uvl,[outer_b[q],outer_b[(q+1)%n],outer_t[(q+1)%n],outer_t[q]],col)
    cc=top+up*(thick+.006); r2=R*0.3
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
    bm=bmesh.new(); uvl=tri_uv(bm)
    a=bm.verts.new((0,0.6*chord*0,0)); b=bm.verts.new((sign*span,chord*0.35,0)); c=bm.verts.new((sign*span*0.8,-chord*0.55,0)); d=bm.verts.new((0,-chord*0.5,0))
    face(bm,uvl,[a,b,c,d] if sign>0 else [a,d,c,b],uvk); return new_mesh_obj(name,bm)
def body_mesh(name,L,uvk):
    bm=bmesh.new(); uvl=tri_uv(bm); p=[bm.verts.new(v) for v in [(0,L/2,0),(0.015,-L/2,0),(-0.015,-L/2,0),(0,-L/2,0.02)]]
    for f in ([0,1,2],[0,3,1],[0,2,3],[1,3,2]): face(bm,uvl,[p[i] for i in f],uvk)
    return new_mesh_obj(name,bm)
def key(o,f):
    o.keyframe_insert('location',frame=f); o.keyframe_insert('rotation_euler',frame=f)
# ---------- butterflies: loop 8 s @24fps = 192 frames, wing flap 6 Hz -> 48 cycles ----------
N=192; objs=[]
cols=['fl_yellow','bfly_orange','fl_white']
centres=[(-1.6,-15.5),(1.4,-13.0),(-0.4,-10.5)]
WP=[(-2.9,-19.9,1.05),(-1.9,-19.7,1.18),(-0.9,-19.6,1.08),(0.1,-19.5,1.2),(1.2,-19.2,1.0),(2.4,-18.0,0.8),(2.6,-15.5,0.9),(1.4,-13.2,0.8),(-0.6,-12.6,0.95),(-2.6,-13.6,0.8),(-3.6,-16.0,0.7),(-3.7,-18.6,0.6)]
def crpath(u):
    n=len(WP); s_=(u%1.0)*n; i0=int(s_); tt=s_-i0
    P=[Vector(WP[(i0+k)%n]) for k in (-1,0,1,2)]
    v=0.5*((2*P[1])+(-P[0]+P[2])*tt+(2*P[0]-5*P[1]+4*P[2]-P[3])*tt*tt+(-P[0]+3*P[1]-3*P[2]+P[3])*tt**3)
    return v.x,v.y,v.z
for bi in range(3):
    body=body_mesh(f'meadow_butterfly_{bi:02d}',0.24,'bird'); objs.append(body)
    wl=wing_mesh(f'meadow_butterfly_{bi:02d}_wing_L',0.3,0.33,cols[bi],-1); wr=wing_mesh(f'meadow_butterfly_{bi:02d}_wing_R',0.3,0.33,cols[bi],1)
    wl.parent=body; wr.parent=body; objs+= [wl,wr]
    cx,cy=centres[bi]; gz=ground(cx,cy); ph=bi*2.1
    for f in range(N+1):
        t=f/N*2*math.pi
        if bi==0:   # v7.1: closed path that crosses close in front of the gameplay camera at ~0.4-2.6 s
            x,y,hz=crpath(f/N); z=ground(x,y)+hz+0.06*math.sin(48*t); x2,y2,_=crpath((f+1)/N); dx,dy=x2-x,y2-y
        else:
            x=cx+1.1*math.sin(t+ph); y=cy+0.7*math.sin(2*t+ph); z=gz+0.75+0.25*math.sin(3*t+ph)+0.06*math.sin(48*t)
            dx=1.1*math.cos(t+ph); dy=1.4*math.cos(2*t+ph)
        body.location=(x,y,z); body.rotation_euler=(0,0,math.atan2(dy,dx)-math.pi/2); key(body,f+1)
        flap=math.radians(10+55*(0.5+0.5*math.sin(48*t)))
        wl.location=(0,0,0); wr.location=(0,0,0); wl.rotation_euler=(0,-flap,0); wr.rotation_euler=(0,flap,0); key(wl,f+1); key(wr,f+1)
for o in objs:
    for fc in o.animation_data.action.fcurves if hasattr(o.animation_data.action,'fcurves') else []:
        for kp in fc.keyframe_points: kp.interpolation='LINEAR'
export(objs,os.path.join(outd,'life_butterflies.glb'),True,(1,N+1))
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
json.dump(rep,open(os.path.join(outd,'v71_build_report.json'),'w'),indent=1); print("REPORT",json.dumps(rep)[:1500])
