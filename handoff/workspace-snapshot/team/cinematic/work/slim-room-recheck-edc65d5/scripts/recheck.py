import bpy,json,sys,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
D='/workspace/wechat-game/team/cinematic/work/slim-room-recheck-edc65d5/'
ROOM=['env_interior_shell','env_lighthouse_door','env_interior_props_merged','env_lighthouse_ext','env_interior_glass']
def imp(path,tag):
    before=set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=path)
    new=[o for o in bpy.data.objects if o not in before]; out={}
    for o in new:
        if o.type=='MESH' and o.name.split('.')[0] in ROOM:
            dg=bpy.context.evaluated_depsgraph_get(); e=o.evaluated_get(dg); m=e.to_mesh()
            co=[o.matrix_world@v.co for v in m.vertices]; m.calc_loop_triangles()
            tris=[tuple(t.vertices) for t in m.loop_triangles]
            nr=[(o.matrix_world.to_3x3()@v.normal).normalized() for v in m.vertices]
            out[o.name.split('.')[0]]=(co,tris,nr); e.to_mesh_clear()
    for o in new: o.hide_viewport=o.hide_render=True; o.location.z-=1000  # park away
    return out
O=imp(D+'input/room_orig_7aff1c0parent.glb','o'); S=imp(D+'input/room_slim_edc65d5.glb','s')
T={k:{n:BVHTree.FromPolygons(v[0],v[1],all_triangles=True) for n,v in X.items()} for k,X in (('o',O),('s',S))}
def allbvh(X):
    co=[];tr=[]
    for n,(c,t,_) in X.items():
        b=len(co); co+=c; tr+=[(a+b,bb+b,cc+b) for a,bb,cc in t]
    return BVHTree.FromPolygons(co,tr,all_triangles=True)
TO=allbvh(O); TS=allbvh(S)
# path polylines
def pts(prefix): return [bpy.data.objects[f'{prefix}_{i:02d}'].matrix_world.translation.copy() for i in range(30) if f'{prefix}_{i:02d}' in bpy.data.objects]
paths={'exit':pts('A_exit_path'),'return':pts('A_return_path')}
key=[bpy.data.objects[n].matrix_world.translation.copy() for n in ('A_seat_anchor','A_seated_foot_anchor','A_stand_up_foot_anchor','A_door_stand_point','A_entrance_point','A_exit_point','A_door_hinge','A_door_handle')]
samp=[]
for P in paths.values():
    for a,b in zip(P,P[1:]):
        n=max(1,int((b-a).length/0.05))
        samp+=[a.lerp(b,i/n) for i in range(n)]
samp+=key
def nearpath(p,r=1.0): return min(((p.x-q.x)**2+(p.y-q.y)**2) for q in samp)<r*r
def cls(p,n,name):
    if name=='env_lighthouse_door' or (-0.75<p.x<0.95 and -0.35<p.y<0.35 and p.z<2.4 and abs(n.z)<0.5 and name!='env_interior_props_merged'): return 'door_frame'
    if n.z>0.9 and p.z<0.25: return 'floor'
    if abs(n.z)<0.35: return 'wall'
    return 'other'
# 1 surface deviation both directions
dev={'o2s':[], 's2o':[]}
summary={}
for d,(X,Tt) in (('o2s',(O,TS)),('s2o',(S,TO))):
    for name,(co,tr,nr) in X.items():
        for p,n in zip(co,nr):
            if p.z>3.2 or not nearpath(p,1.0): continue
            hit=Tt.find_nearest(p)
            if hit[0] is None: continue
            dd=hit[3]; c=cls(p,n,name)
            k=(d,name,c); s=summary.setdefault(k,[0,0.0,None,0]); s[0]+=1
            if dd>s[1]: s[1]=dd; s[2]=[round(x,4) for x in p]
            if dd>0.01 and c in('floor','wall','door_frame'):
                s[3]+=1; dev[d].append({'mesh':name,'class':c,'pos':[round(x,4) for x in p],'dev_mm':round(dd*1000,2),'nearest_path_m':round(min(math.dist((p.x,p.y),(q.x,q.y)) for q in samp),3)})
json.dump({'summary':[{'dir':k[0],'mesh':k[1],'class':k[2],'n_verts':v[0],'max_mm':round(v[1]*1000,2),'max_at':v[2],'n_over_10mm':v[3]} for k,v in summary.items()],'over_10mm':dev},open(D+'out/surface_deviation.json','w'),indent=1)
# 2 path floor/wall clearance
rows=[]
for nm,P in paths.items():
  for a,b in zip(P,P[1:]):
    n=max(1,int((b-a).length/0.05))
    for i in range(n):
        p=a.lerp(b,i/n); r={'path':nm,'pos':[round(p.x,4),round(p.y,4)]}
        for k,Tt in (('o',TO),('s',TS)):
            h=Tt.ray_cast(Vector((p.x,p.y,1.0)),Vector((0,0,-1)),3.0); r['floor_'+k]=None if h[0] is None else round(h[0].z,5)
            cl=9
            for zz in (0.1,0.9,1.6):
                for ang in range(0,360,15):
                    dv=Vector((math.cos(math.radians(ang)),math.sin(math.radians(ang)),0))
                    hh=Tt.ray_cast(Vector((p.x,p.y,zz)),dv,2.0)
                    if hh[0] is not None: cl=min(cl,hh[3])
            r['clear_'+k]=round(cl,4)
        rows.append(r)
json.dump(rows,open(D+'out/path_samples.json','w'),indent=1)
# 3 per-frame character checks
sc=bpy.context.scene; arm=bpy.data.objects['R5G2_RIG_22P4']
CH=['B_ANATOMICAL_VERTICAL_SLENDER_R5','G2_DRESS_R5G2','G2_APRON_R5G2','G2_HAIR_BOB_R5G2']
clips=[a for a in bpy.data.actions if a.name.startswith('cine_') and '__' not in a.name]
fr=[]
for act in clips:
    arm.animation_data.action=act
    for ob in ('G2_DRESS_R5G2','G2_APRON_R5G2'):
        o=bpy.data.objects[ob]; sk=bpy.data.actions.get(act.name+'__'+ob+'_sk')
        if sk and o.data.shape_keys:
            o.data.shape_keys.animation_data_create(); o.data.shape_keys.animation_data.action=sk
    f0,f1=map(int,act.frame_range)
    for f in range(f0,f1+1):
        sc.frame_set(f); dg=bpy.context.evaluated_depsgraph_get()
        V=[]
        for n in CH:
            o=bpy.data.objects[n]; e=o.evaluated_get(dg); m=e.to_mesh(); V+=[(n,o.matrix_world@v.co) for v in m.vertices]; e.to_mesh_clear()
        body=[p for n,p in V if n=='B_ANATOMICAL_VERTICAL_SLENDER_R5']
        low=sorted(body,key=lambda p:p.z)[:40]
        r={'clip':act.name,'frame':f,'root_xy':[round(sum(p.x for p in body)/len(body),4),round(sum(p.y for p in body)/len(body),4)]}
        for k,Tt,X in (('o',TO,O),('s',TS,S)):
            pen=0;fz=[];wpen=0;wpos=None;minw=9
            for p in low:
                h=Tt.ray_cast(Vector((p.x,p.y,p.z+0.3)),Vector((0,0,-1)),1.0)
                if h[0] is not None: fz.append(h[0].z); pen=max(pen,h[0].z-p.z)
            for n,p in V[::3]:
                h=Tt.find_nearest(p,0.08)
                if h[0] is None: continue
                cn=h[1]; 
                if cn.z>0.9 and h[0].z<0.25: continue  # floor handled above
                # only walls/door (shell + door + ext), skip props (chair excluded from glb anyway)
                minw=min(minw,h[3])
                if (p-h[0]).dot(cn)<0 and h[3]>0.0005:
                    # confirm inside by ray parity along normal
                    hh=Tt.ray_cast(p,-cn,0.08)
                    if hh[0] is not None and hh[1].dot(cn)>0 and h[3]>wpen: wpen=h[3]; wpos=[round(x,4) for x in p]
            r['foot_pen_mm_'+k]=round(pen*1000,3); r['floor_z_'+k]=round(min(fz),5) if fz else None
            r['foot_min_z']=round(min(p.z for p in low),5)
            r['env_pen_mm_'+k]=round(wpen*1000,3); r['env_pen_at_'+k]=wpos; r['env_min_dist_mm_'+k]=round(minw*1000,2) if minw<9 else None
        fr.append(r); print('F',act.name,f,r['foot_pen_mm_o'],r['foot_pen_mm_s'],r['env_pen_mm_o'],r['env_pen_mm_s'],flush=True)
json.dump(fr,open(D+'out/per_frame.json','w'),indent=1)
print('DONE')
