"""worst-frame stills: game camera (R24 plan, vfov 90; portrait45) + close debug cameras (0.35 m from the point, from the game-camera direction and rotated 90 deg)
usage: blender -b --python closeup_pair.py -- <blend> <checker_scripts_dir> <outdir> <tag> "clip:frame:x:y:z:label;..." """
import bpy, sys, os, json, math
a=sys.argv[sys.argv.index('--')+1:]; blend,sdir,out,tag,spec=a[:5]
sys.path.insert(0,sdir); import clips
sys.path.insert(0,os.path.dirname(__file__)); import render_lib as RL
from mathutils import Vector, Matrix
bpy.ops.wm.open_mainfile(filepath=blend); os.makedirs(out,exist_ok=True); sc=bpy.context.scene
for o in bpy.data.objects:
    if o.name.startswith('col_') or o.name=='CHAIR_VARIANT_arms_NOT_IN_GAME': o.hide_render=True
PLAN=json.load(open('/workspace/wechat-game/team/cinematic/refs/oi-handoff/evidence/CAMERA-MOTION-EVIDENCE-20261009-v1/character/actual_motion_branch/REALSCENE-FULLCHAIN-R24/camera_render_plan.json'))
def g2b(v): return Vector((v[0],-v[2],v[1]))
def r24(t):
    P=PLAN['poses']; p=min(P,key=lambda q:abs(q['time']-t)); return g2b(p['position_game_m']),g2b(p['target_game_m']),p['vfov_deg']
RL.setup((540,698)); sc.display.shading.color_type='MATERIAL'
COL={'B_ANATOMICAL_VERTICAL_SLENDER_R5':(0.93,0.74,0.62,1),'G2_DRESS_R5G2':(0.98,0.80,0.22,1),'G2_APRON_R5G2':(0.97,0.97,0.95,1),'G2_HAIR_BOB_R5G2':(0.33,0.2,0.12,1),'G2_BOW_TAILS_R5G2':(0.85,0.2,0.15,1),'CHAIR_REAL_reading_chair':(0.55,0.42,0.3,1)}
for n,cl in COL.items():
    o=bpy.data.objects.get(n)
    if not o: continue
    for ms in o.material_slots:
        m=ms.material
        if m and max(abs(c-0.8) for c in m.diffuse_color[:3])<0.05: m.diffuse_color=cl
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.005); mk=bpy.context.active_object; mk.name='MARK'; mat=bpy.data.materials.new('MK'); mat.diffuse_color=(1,0,0,1); mk.data.materials.append(mat)
cur=None
for it in spec.split(';'):
    clip,f,x,y,z,lab=it.split(':'); f=int(f); P=Vector((float(x),float(y),float(z)))
    if clip!=cur: clips.activate(clip); cur=clip
    sc.frame_set(f); bpy.context.view_layer.update(); t=(f if clip=='cine_open_stand' else 90+f)/30.0; pos,tgt,vf=r24(t)
    mk.location=P; mk.hide_render=True
    c=RL.cam('GC',pos,tgt); c.data.sensor_fit='VERTICAL'; c.data.angle_y=math.radians(vf); sc.render.resolution_x,sc.render.resolution_y=540,698
    RL.shoot(c,f'{out}/{tag}_f{f:03d}_{lab}_game_r24.png')
    c.data.angle_y=math.radians(45); sc.render.resolution_x,sc.render.resolution_y=390,844; RL.shoot(c,f'{out}/{tag}_f{f:03d}_{lab}_game_portrait45.png')
    sc.render.resolution_x,sc.render.resolution_y=600,600
    R=Matrix.Rotation(-2.0,3,'Z'); fwd=R@Vector((0,-1,0)); right=R@Vector((-1,0,0))   # seat-yaw frame (same as render_video.py)
    views={'closeFront':(fwd+Vector((0,0,0.35))).normalized(),'closeRight':(right+fwd*0.3+Vector((0,0,0.25))).normalized()}
    for nm,dd in views.items():
        cc=RL.cam('DBG',P+dd*0.40,P,lens=30); RL.shoot(cc,f'{out}/{tag}_f{f:03d}_{lab}_{nm}.png')
    mk.hide_render=False; cc=RL.cam('DBG',P+views['closeFront']*0.40,P,lens=30); RL.shoot(cc,f'{out}/{tag}_f{f:03d}_{lab}_closeFront_marker.png'); mk.hide_render=True
    print('CU',tag,f,lab,flush=True)
print('CUDONE')
