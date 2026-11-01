import bpy,sys,json,math
from mathutils import Vector,Matrix
args=sys.argv[sys.argv.index('--')+1:]; glb,meta,out=args
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
M=json.load(open(meta))
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
dress=bpy.data.objects['LOD0_G2_DRESS']; apron=bpy.data.objects['LOD0_G2_APRON']
sc=bpy.context.scene; FPS=sc.render.fps
for o in bpy.data.objects:
    if o.type=='MESH' and o.data.shape_keys: o.data.shape_keys.animation_data_clear()
def pw(c,t):
    if t<=c[0][0]: return c[0][1]
    for (a,va),(b,vb) in zip(c,c[1:]):
        if t<=b: return va+(vb-va)*(t-a)/max(b-a,1e-9)
    return c[-1][1]
def set_morph(clip,t,on=True):
    curves=(M['clips'].get(clip,{}).get('morph') or {}).get('curves',{})
    for o in bpy.data.objects:
        if o.type!='MESH' or not o.data.shape_keys: continue
        for kb in o.data.shape_keys.key_blocks[1:]:
            v=pw(curves[kb.name],t) if (on and kb.name in curves) else 0.0
            kb.value=min(1,max(0,v))
def wpos(o,dg):
    e=o.evaluated_get(dg); m=e.to_mesh(); mw=o.matrix_world
    P=[mw@v.co for v in m.vertices]; e.to_mesh_clear(); return P
# rest pose
arm.animation_data_create(); arm.animation_data.action=None
for pb in arm.pose.bones: pb.matrix_basis=Matrix()
set_morph('',0,False); sc.frame_set(0); dg=bpy.context.evaluated_depsgraph_get()
Rd=wpos(dress,dg); Ra=wpos(apron,dg)
def bw(name): return arm.matrix_world@arm.pose.bones[name].head
knee0=(bw('shin.L')+bw('shin.R'))/2; hip0=bw('hips')
fwd0=Vector((0,-1,0))
zmin=min(p.z for p in Rd); zmin_a=min(p.z for p in Ra)
def front(p): # angle from forward about hips vertical axis
    d=Vector((p.x-hip0.x,p.y-hip0.y)); return d.length>1e-4 and d.normalized().dot(Vector((fwd0.x,fwd0.y)))>math.cos(math.radians(40))
# front panel = front verts below knee+0.05 ; hem band = lowest 4 cm of front region
FP=[i for i,p in enumerate(Rd) if front(p) and p.z<knee0.z+0.10]
fz=min(Rd[i].z for i in FP); HEM=[i for i in FP if Rd[i].z<fz+0.04]
AP=[i for i,p in enumerate(Ra)]; az=min(p.z for p in Ra); AHEM=[i for i in AP if Ra[i].z<az+0.03]
def wstats(o,idx):
    names={g.index:g.name for g in o.vertex_groups}; acc={}; per=[]
    for i in idx:
        v=o.data.vertices[i]; gs=[(names[g.group],g.weight) for g in v.groups if g.weight>1e-4]; s=sum(w for _,w in gs) or 1
        for n,w in gs: acc[n]=acc.get(n,0)+w/s
        per.append({'i':i,'sum':round(s,4),'g':sorted([(n,round(w,3)) for n,w in gs],key=lambda x:-x[1])})
    return {k:round(v/len(idx),4) for k,v in sorted(acc.items(),key=lambda x:-x[1])},per
res={'rest':{'knee_z':knee0.z,'dress_front_hem_z':fz,'apron_hem_z':az,'hip_z':hip0.z,'n_front_panel':len(FP),'n_hem':len(HEM),'n_apron_hem':len(AHEM)}}
res['weights_dress_front_hem'],per=wstats(dress,HEM); res['weights_apron_hem'],pera=wstats(apron,AHEM)
res['weights_dress_front_panel'],_=wstats(dress,FP)
res['unnormalised_hem']=[p for p in per+pera if abs(p['sum']-1)>0.01][:20]
res['hem_vertices_with_thigh']=sum(1 for p in per if any(n.startswith('thigh') for n,_ in p['g']))
res['apron_hem_with_thigh']=sum(1 for p in pera if any(n.startswith('thigh') for n,_ in p['g']))
def frame_metrics(clip,t,morph=True):
    set_morph(clip,t,morph); sc.frame_set(int(math.floor(t*FPS)),subframe=(t*FPS)%1)
    dg=bpy.context.evaluated_depsgraph_get()
    D=wpos(dress,dg); A=wpos(apron,dg)
    kL=bw('shin.L'); kR=bw('shin.R'); kz=(kL.z+kR.z)/2; km=(kL+kR)/2
    hb=arm.pose.bones['hips']; R=(arm.matrix_world@hb.matrix).to_3x3()@(arm.matrix_world@arm.data.bones['hips'].matrix_local).to_3x3().inverted()
    f=R@fwd0; f.z=0; f.normalize()
    def m(P,idx,R0):
        lows=min(P[i].z for i in idx)
        lifts=[(P[i].z-kz)-(R0[i].z-knee0.z) for i in idx]
        j=max(range(len(idx)),key=lambda k:lifts[k])
        flare=max((P[i]-km).dot(f) for i in idx)
        return {'low_rel_knee':lows-kz,'lift_low':(lows-kz)-(min(R0[i].z for i in idx)-knee0.z),'max_vert_lift':lifts[j],'vert':idx[j],'flare':flare}
    return {'dress':m(D,HEM,Rd),'apron':m(A,AHEM,Ra),'knee_z':kz}
# rest reference values
for pb in arm.pose.bones: pb.matrix_basis=Matrix()
r0=frame_metrics('',0,False); res['rest_metrics']=r0
CL=sys.argv[sys.argv.index('--')+4:] if len(args)>3 else None
acts={a.name.replace('_R5G2_RIG_22P4',''):a for a in bpy.data.actions}
res['clips']={}
for clip,act in acts.items():
    if clip=='wind_flutter_loop':continue
    arm.animation_data.action=act; dur=act.frame_range[1]/FPS
    for fps in (60,30):
        n=int(round(dur*fps)); rows=[]
        for k in range(n+1):
            t=min(k/fps,dur); r=frame_metrics(clip,t); r['t']=t; r['f']=k; rows.append(r)
        res['clips'].setdefault(clip,{})[fps]=rows
    if clip=='sit_hold':
        r=frame_metrics(clip,0,False); res['sit_hold_t0_no_morph']=r
    print('done',clip,flush=True)
# wind layer on walk_loop (COMBINE, weight 1)
w=acts['wind_flutter_loop']
fc={}
for c in w.fcurves:
    b=c.data_path.split('"')[1]; vals=[c.evaluate(f) for f in range(0,97,2)]
    fc.setdefault(b,[]).append((c.array_index,round(min(vals),4),round(max(vals),4)))
res['wind_channels']={b:v for b,v in fc.items() if b.startswith('skirt')}
json.dump(res,open(out,'w'),default=float)
