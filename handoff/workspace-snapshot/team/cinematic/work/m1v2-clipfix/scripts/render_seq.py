"""Resumable game-camera sequence render (skips existing PNGs). Camera = R24 camera_render_plan (the only authored M1 camera; shot A eye fixed,
target per 30 fps sample, vfov 90, aspect 0.774) and/or 'portrait45' (same eye/target, vfov 45, 390x844 phone portrait = game default fovVerticalDeg 45).
usage: blender -b --python render_seq.py -- <blend> <checker_scripts_dir> <outdir> <cam r24|portrait45|close> [frames: all | clip:f,clip:f]"""
import bpy, sys, os, json, math
a=sys.argv[sys.argv.index('--')+1:]; blend,sdir,out,camname=a[:4]; fr=a[4] if len(a)>4 else 'all'
sys.path.insert(0,sdir); import clips
sys.path.insert(0,os.path.dirname(__file__)); import render_lib as RL
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath=blend); os.makedirs(out,exist_ok=True); sc=bpy.context.scene
for o in bpy.data.objects:
    if o.name.startswith('col_') or o.name in ('CHAIR_VARIANT_arms_NOT_IN_GAME','MARK'): o.hide_render=True
PLAN=json.load(open('/workspace/wechat-game/team/cinematic/refs/oi-handoff/evidence/CAMERA-MOTION-EVIDENCE-20261009-v1/character/actual_motion_branch/REALSCENE-FULLCHAIN-R24/camera_render_plan.json'))
def g2b(v): return Vector((v[0],-v[2],v[1]))
def r24(t):
    P=PLAN['poses']; p=min(P,key=lambda q:abs(q['time']-t)); return g2b(p['position_game_m']),g2b(p['target_game_m']),p['vfov_deg']
if fr=='all': seq=[('cine_open_stand',f) for f in range(0,91)]+[('cine_open_turn',f) for f in range(1,46)]
else: seq=[(x.split(':')[0],int(x.split(':')[1])) for x in fr.split(',')]
RL.setup((540,698)); sc.render.resolution_percentage=100
sc.display.shading.color_type='MATERIAL'
COL={'B_ANATOMICAL_VERTICAL_SLENDER_R5':(0.93,0.74,0.62,1),'G2_DRESS_R5G2':(0.98,0.80,0.22,1),'G2_APRON_R5G2':(0.97,0.97,0.95,1),'G2_HAIR_BOB_R5G2':(0.33,0.2,0.12,1),'G2_BOW_TAILS_R5G2':(0.85,0.2,0.15,1),'CHAIR_REAL_reading_chair':(0.55,0.42,0.3,1)}
for n,cl in COL.items():
    o=bpy.data.objects.get(n)
    if not o: continue
    for ms in o.material_slots:
        m=ms.material
        if m and max(abs(c-0.8) for c in m.diffuse_color[:3])<0.05: m.diffuse_color=cl   # only untinted (default grey) display colours
cur=None
for i,(clip,f) in enumerate(seq):
    path=f'{out}/{camname}_{clip[5:]}_f{f:03d}.png'
    if os.path.exists(path): continue
    if clip!=cur: clips.activate(clip); cur=clip
    sc.frame_set(f); bpy.context.view_layer.update()
    t=(f if clip=='cine_open_stand' else 90+f)/30.0; pos,tgt,vf=r24(t)
    if camname=='r24': c=RL.cam('GC',pos,tgt); c.data.sensor_fit='VERTICAL'; c.data.angle_y=math.radians(vf); sc.render.resolution_x,sc.render.resolution_y=540,698
    elif camname=='portrait45': c=RL.cam('GC',pos,tgt); c.data.sensor_fit='VERTICAL'; c.data.angle_y=math.radians(45); sc.render.resolution_x,sc.render.resolution_y=390,844
    RL.shoot(c,path); print('R',path,flush=True)
print('RDONE')
