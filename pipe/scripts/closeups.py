"""Locate residual non-bow items (layer-cross apron verts, visible-shell tri pairs), measure depth/gap and visibility from the
cinematic camera (R24 camera_render_plan, the only authored M1 camera; cine_camera is not authored yet) and orbit views; render close-ups.
usage: blender -b --python closeups.py -- <blend> <outdir> <clip:frame,...>"""
import bpy,sys,os,json,math,numpy as np
sys.path.insert(0,'/workspace/wechat-game/team/cinematic/work/m1v2-clipfix/pipe/scripts'); import checker as C, clips, render_lib as RL
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view
blend,out,spec=sys.argv[sys.argv.index('--')+1:][:3]; os.makedirs(out,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=blend); sc=bpy.context.scene; arm=bpy.data.objects['R5G2_RIG_22P4']
for o in bpy.data.objects:
    if o.name.startswith('col_') or o.name=='CHAIR_VARIANT_arms_NOT_IN_GAME': o.hide_viewport=True; o.hide_render=True
# layer baseline exactly as check_run
for h in [arm]+[bpy.data.objects[n].data.shape_keys for n in (C.DRESS,C.APRON)]:
    if h.animation_data:
        h.animation_data.action=None
        for t in h.animation_data.nla_tracks: t.mute=True
for pb in arm.pose.bones: pb.matrix_basis.identity()
for n in (C.DRESS,C.APRON):
    for kb in bpy.data.objects[n].data.shape_keys.key_blocks[1:]: kb.value=0
bpy.context.view_layer.update(); ck=C.Checker(); ck.set_layer_baseline()
PLAN=json.load(open('/workspace/wechat-game/team/cinematic/refs/oi-handoff/evidence/CAMERA-MOTION-EVIDENCE-20261009-v1/character/actual_motion_branch/REALSCENE-FULLCHAIN-R24/camera_render_plan.json'))
def g2b(v): return Vector((v[0],-v[2],v[1]))
def r24cam(t):
    P=PLAN['poses']; p=min(P,key=lambda q:abs(q['time']-t)); return g2b(p['position_game_m']),g2b(p['target_game_m']),p['vfov_deg'],p['shot']
def setcam(name,loc,tgt,vfov,aspect):
    c=RL.cam(name,loc,tgt); c.data.sensor_fit='VERTICAL'; c.data.angle_y=math.radians(vfov); return c
def visible_from(cam_loc,P,tol=0.002):
    d=(P-cam_loc); L=d.length; hit,loc,n,i,ob,M=sc.ray_cast(bpy.context.evaluated_depsgraph_get(),cam_loc,d.normalized(),distance=L+0.01)
    return (hit and (loc-P).length<=tol), (ob.name if hit else None), round(((loc-cam_loc).length-L)*1000,2) if hit else None
NOR=os.environ.get('NORENDER')=='1'
_shoot=RL.shoot
def _sh(*a,**k):
    if not NOR: _shoot(*a,**k)
RL.shoot=_sh
RL.setup((600,600)); sc.display.shading.color_type='MATERIAL'
res=[]
for item in spec.split(','):
    clip,f=item.split(':'); f=int(f); clips.activate(clip); sc.frame_set(f); bpy.context.view_layer.update()
    t=(f if clip=='cine_open_stand' else 90+f)/30.0
    dm,dt=ck.ev(C.DRESS,False); am,at=ck.ev(C.APRON,False); DTm=ck.tree(dm,dt); ATm=ck.tree(am,at)
    dv,dvt=ck.ev(C.DRESS,True); av,avt=ck.ev(C.APRON,True); DTv=ck.tree(dv,dvt)
    bco,bT=ck.ev(C.BODY,False)
    pts=[]
    ck.layer_cross(am,DTm)
    for i,d in ck.last_bad: pts.append(('layer_cross apron v%d'%i,Vector(am[i]),round(d*1000,3)))
    for (a_,b_) in ck.tree(av,avt).overlap(DTv):
        c=Vector(av[avt[a_]].mean(0)); cp,n,fi,dd=DTm.find_nearest(c); cp2,n2,fi2,dd2=ATm.find_nearest(c)
        pts.append(('vis apronxdress tri%d/%d'%(a_,b_),c,round((cp-cp2).length*1000,3)))   # midsurface gap at the pair
    for part in ('legL','legR','torso'):
        TB=ck.tree(bco,bT[ck.parts[part]])
        for (a_,b_) in TB.overlap(DTv):
            c=Vector(bco[bT[ck.parts[part]][a_]].mean(0)); cp,n,fi,dd=DTm.find_nearest(c); sgn=1 if (c-cp).dot(n)<0 else -1
            pts.append((f'vis {part}xdress tri{a_}/{b_}',c,round(dd*1000*sgn,3)))   # >0: body is outside? sign wrt dress normal
    if not pts: res.append({'clip':clip,'frame':f,'items':[]}); continue
    # cluster
    cl=[]
    for nm,p,d in pts:
        for c in cl:
            if (c['p']-p).length<0.02: c['n']+=1; c['names'].append(nm); c['d'].append(d); break
        else: cl.append({'p':p.copy(),'n':1,'names':[nm],'d':[d]})
    cpos,ctgt,vfov,shot=r24cam(t)
    camA=setcam('CINE_R24',cpos,ctgt,vfov,0.774); camB=setcam('CINE_45',cpos,ctgt,45,0.46)
    entry={'clip':clip,'frame':f,'time_s':round(t,3),'cine_shot':shot,'clusters':[]}
    for k,c in enumerate(cl):
        P=c['p']; e={'center_blender':[round(x,4) for x in P],'count':c['n'],'kinds':sorted(set(x.split(' v')[0].split(' tri')[0] for x in c['names'])),'depth_or_gap_mm':[min(c['d']),max(c['d'])]}
        for nm,cam,asp in (('cine_r24',camA,0.774),('cine_45_portrait',camB,0.46)):
            sc.render.resolution_x,sc.render.resolution_y=(int(900*asp),900); bpy.context.view_layer.update()
            uv=world_to_camera_view(sc,cam,P); inframe=0<=uv.x<=1 and 0<=uv.y<=1 and uv.z>0
            vis,ob,dz=visible_from(cam.matrix_world.translation,P); e[nm]={'in_frame':inframe,'ray_first_hit':ob,'hit_minus_point_mm':dz,'point_visible':bool(vis and inframe)}
        # orbit visibility: 32 directions on a sphere r=1.0 m (upper hemisphere + horizon), camera outside meshes
        nvis=0; ntot=0; near={}
        for el in (-10,10,30,50,70):
            for az in range(0,360,45):
                dv_=Vector((math.cos(math.radians(el))*math.cos(math.radians(az)),math.cos(math.radians(el))*math.sin(math.radians(az)),math.sin(math.radians(el))))
                ntot+=1; v_,ob_,dz_=visible_from(P+dv_*1.0,P); nvis+=bool(v_)
                if dz_ is not None and dz_>-5.0: near[ob_]=near.get(ob_,0)+1
        e['orbit_visible_dirs']=f'{nvis}/{ntot}'; e['orbit_first_hit_within_5mm_of_point']=near
        # renders: cine (R24 + 45 portrait), 4 orbit close-ups at 0.25 m + one with marker
        tag=f'{clip}_f{f:03d}_c{k}'
        sc.render.resolution_x,sc.render.resolution_y=(697,900); RL.shoot(camA,f'{out}/{tag}_cine_r24.png')
        sc.render.resolution_x,sc.render.resolution_y=(414,900); RL.shoot(camB,f'{out}/{tag}_cine_45_portrait.png')
        sc.render.resolution_x,sc.render.resolution_y=(600,600)
        # close-up from the cine direction + 3 orbit angles
        dcin=(camA.matrix_world.translation-P).normalized()
        for j,ang in enumerate((0,90,180,270)):
            dd=Matrix.Rotation(math.radians(ang),3,'Z')@dcin; cc=RL.cam(f'ORB{j}',P+dd*0.25+Vector((0,0,0.05)),P,lens=50); RL.shoot(cc,f'{out}/{tag}_orbit{ang:03d}.png')
        m=bpy.data.objects.get('MARK')
        if m is None:
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.004); m=bpy.context.active_object; m.name='MARK'
            mat=bpy.data.materials.new('MARKRED'); mat.diffuse_color=(1,0,0,1); m.data.materials.append(mat)
        m.location=P; m.hide_render=False; m.hide_viewport=True   # hidden from ray casts
        cc=RL.cam('ORBM',P+dcin*0.25+Vector((0,0,0.05)),P,lens=50); RL.shoot(cc,f'{out}/{tag}_orbit000_marker.png'); m.hide_render=True
        entry['clusters'].append(e)
    res.append(entry); print('CU',json.dumps(entry),flush=True)
json.dump(res,open(f'{out}/closeups.json','w'),indent=1); print('DONE')
